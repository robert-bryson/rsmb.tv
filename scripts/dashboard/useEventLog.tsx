/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useRef } from 'react';
import { format, stripVTControlCharacters } from 'node:util';
import { StringDecoder } from 'node:string_decoder';
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
const HTTP_DEBUG_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/.*\d{3} with id/;

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
    rawMessage: string,
): void {
    const text = stripVTControlCharacters(rawMessage).trim();
    if (!text || (source === 'stderr' && HTTP_DEBUG_RE.test(text))) return;
    // Avoid cutting a UTF-16 surrogate pair at the truncation boundary.
    const message = text.length > 200 ? text.slice(0, 197).replace(/[\uD800-\uDBFF]$/u, '') + '…' : text;
    pruneExpired();

    // Deduplicate: if any recent event has same source+level+message, bump count
    const existing = events.find(
        (e) => e.source === source && e.level === level && e.message === message,
    );
    if (existing) {
        events = [
            ...events.filter(event => event !== existing),
            { ...existing, timestamp: new Date(), count: existing.count + 1 },
        ];
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
    const stderrDecoder = new StringDecoder('utf8');

    console.log = (...args: unknown[]) => addEvent('info', 'console', format(...args));
    console.warn = (...args: unknown[]) => addEvent('warn', 'console', format(...args));
    console.error = (...args: unknown[]) => addEvent('error', 'console', format(...args));

    process.stderr.write = (chunk: string | NodeJS.ArrayBufferView, encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => {
        // Node ignores the encoding argument for binary chunks. Interpret the
        // terminal's bytes as UTF-8, regardless of that string-only option.
        const encoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8';
        const bytes = typeof chunk === 'string' ? Buffer.from(chunk, encoding)
            : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        addEvent('warn', 'stderr', stderrDecoder.write(bytes));
        const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
        if (done) queueMicrotask(() => done());
        return true;
    };

    const restore = () => {
        if (restoreInterception !== restore) return;
        const remaining = stderrDecoder.end();
        if (remaining) addEvent('warn', 'stderr', remaining);
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
