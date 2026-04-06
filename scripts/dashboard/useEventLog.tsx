/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useRef } from 'react';
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
    events = events.filter((e) => e.timestamp.getTime() > cutoff);
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
        existing.timestamp = new Date();
        existing.count += 1;
        events = [...events];
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

let interceptInstalled = false;

/**
 * Intercept console.log / .warn / .error and process.stderr.write so that
 * stray output from AWS SDK, Octokit, etc. doesn't corrupt the Ink display.
 * Captured lines are routed into the event log instead.
 */
export function interceptConsole(): void {
    if (interceptInstalled) return;
    interceptInstalled = true;

    function capture(level: DashboardEvent['level'], args: unknown[]): void {
        const msg = args
            .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
            .join(' ')
            .trim();
        if (!msg) return;
        // Truncate long messages
        const short = msg.length > 200 ? msg.slice(0, 197) + '…' : msg;
        addEvent(level, 'console', short);
    }

    console.log = (...args: unknown[]) => capture('info', args);
    console.warn = (...args: unknown[]) => capture('warn', args);
    console.error = (...args: unknown[]) => capture('error', args);

    // Intercept raw stderr writes (AWS SDK sometimes writes directly)
    // Filter out Octokit HTTP request debug lines (e.g. "GET /repos/... - 403 with id ...")
    const HTTP_DEBUG_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/.*\d{3} with id/;

    process.stderr.write = ((chunk: unknown) => {
        const str = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : '';
        const trimmed = str.trim();
        if (!trimmed || HTTP_DEBUG_RE.test(trimmed)) return true;
        addEvent('warn', 'stderr', trimmed.length > 200 ? trimmed.slice(0, 197) + '…' : trimmed);
        // Don't actually write to stderr — it would corrupt Ink's display
        return true;
    }) as typeof process.stderr.write;
}

/** Polls the event store on a timer instead of synchronous notifications,
 *  so addEvent() never triggers a re-render mid-fetch-cycle. */
export function useEvents(): DashboardEvent[] {
    const [, setTick] = useState(0);
    const lastRevision = useRef(revision);

    useEffect(() => {
        const id = setInterval(() => {
            if (revision !== lastRevision.current) {
                lastRevision.current = revision;
                setTick((t) => t + 1);
            }
        }, POLL_INTERVAL_MS);
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

export function EventLogPanel() {
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
