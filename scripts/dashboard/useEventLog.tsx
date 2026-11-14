/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useRef } from 'react';
import { format, stripVTControlCharacters } from 'node:util';
import { Box, Text } from 'ink';

export interface DashboardEvent {
    id: number;
    timestamp: Date;
    level: 'error' | 'warn' | 'info';
    source: string;
    message: string;
    count: number;
}

const MAX_EVENTS = 20;
const EVENT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const POLL_INTERVAL_MS = 2000;

let events: DashboardEvent[] = [];
let nextId = 1;
let revision = 0;

function pruneExpired() {
    const cutoff = Date.now() - EVENT_TTL_MS;
    const current = events.filter((e) => e.timestamp.getTime() > cutoff);
    if (current.length !== events.length) {
        events = current;
        revision++;
    }
}

export function addEvent(
    level: DashboardEvent['level'],
    source: string,
    message: string,
): void {
    pruneExpired();

    // Deduplicate: if any recent event has same source+level+message, bump count
    const existing = events.find(
        (e) => e.source === source && e.level === level && e.message === message,
    );
    if (existing) {
        events = events.map(event => event === existing
            ? { ...event, timestamp: new Date(), count: event.count + 1 }
            : event);
        revision++;
        return;
    }

    events = [
        ...events.slice(-(MAX_EVENTS - 1)),
        { id: nextId++, timestamp: new Date(), level, source, message, count: 1 },
    ];
    revision++;
}

export function clearEvents(): void {
    events = [];
    revision++;
}

let restoreInterception: (() => void) | undefined;

/**
 * Intercept console.log / .warn / .error and process.stderr.write so that
 * stray output from AWS SDK, Octokit, etc. doesn't corrupt the Ink display.
 * Captured lines are routed into the event log instead.
 */
export function interceptConsole(): () => void {
    if (restoreInterception) return restoreInterception;
    const original = { log: console.log, warn: console.warn, error: console.error, write: process.stderr.write };

    // Intercept raw stderr writes (AWS SDK sometimes writes directly)
    // Filter out Octokit HTTP request debug lines (e.g. "GET /repos/... - 403 with id ...")
    const HTTP_DEBUG_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/.*\d{3} with id/;

    function capture(level: DashboardEvent['level'], source: 'console' | 'stderr', value: string): void {
        const message = stripVTControlCharacters(value).trim();
        if (!message || (source === 'stderr' && HTTP_DEBUG_RE.test(message))) return;
        addEvent(level, source, message.length > 200 ? message.slice(0, 197) + '…' : message);
    }

    console.log = (...args: unknown[]) => capture('info', 'console', format(...args));
    console.warn = (...args: unknown[]) => capture('warn', 'console', format(...args));
    console.error = (...args: unknown[]) => capture('error', 'console', format(...args));

    process.stderr.write = (chunk: string | Uint8Array, encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => {
        const encoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8';
        capture('warn', 'stderr', typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(encoding));
        const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
        if (done) queueMicrotask(() => done());
        return true;
    };

    const restore = () => {
        if (restoreInterception !== restore) return;
        console.log = original.log;
        console.warn = original.warn;
        console.error = original.error;
        process.stderr.write = original.write;
        restoreInterception = undefined;
    };
    restoreInterception = restore;
    return restore;
}

/** Polls the event store on a timer instead of synchronous notifications,
 *  so addEvent() never triggers a re-render mid-fetch-cycle. */
export function useEvents(): DashboardEvent[] {
    const [, setTick] = useState(0);
    const lastRevision = useRef(revision);

    useEffect(() => {
        const update = () => {
            pruneExpired();
            if (revision !== lastRevision.current) {
                lastRevision.current = revision;
                setTick((t) => t + 1);
            }
        };
        update();
        const id = setInterval(update, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, []);

    return events;
}

function levelColor(level: DashboardEvent['level']): string {
    if (level === 'error') return 'red';
    if (level === 'warn') return 'yellow';
    return 'green';
}

function levelIcon(level: DashboardEvent['level']): string {
    if (level === 'error') return '✗';
    if (level === 'warn') return '⚠';
    return '✓';
}

export function EventLogPanel({ timeZone }: { timeZone: string }) {
    const evts = useEvents();

    if (evts.length === 0) return null;

    return (
        <Box flexDirection="column">
            <Text> </Text>
            <Text dimColor>{'─'.repeat(60)}</Text>
            <Text bold dimColor> Event Log</Text>
            {evts.map((e) => (
                <Box key={e.id} gap={1}>
                    <Text dimColor>
                        {' '}
                        {e.timestamp.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                            timeZone,
                        })}
                    </Text>
                    <Text color={levelColor(e.level)}>{levelIcon(e.level)}</Text>
                    <Text color={levelColor(e.level)} bold>
                        {e.source}
                    </Text>
                    <Text color={levelColor(e.level)}>
                        {e.message}
                    </Text>
                    {e.count > 1 && <Text dimColor>(×{e.count})</Text>}
                </Box>
            ))}
        </Box>
    );
}
