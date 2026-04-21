/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { formatDuration } from './utils.js';

export interface Incident {
    id: number;
    source: string;
    entity: string;
    detail: string;
    startedAt: Date;
    resolvedAt: Date | null;
}

const INCIDENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const POLL_INTERVAL_MS = 2000;

let incidents: Incident[] = [];
let nextId = 1;

function pruneExpired(): void {
    const cutoff = Date.now() - INCIDENT_TTL_MS;
    incidents = incidents.filter((i) => i.startedAt.getTime() > cutoff);
}

export function openIncident(
    source: string,
    entity: string,
    detail: string,
): void {
    pruneExpired();

    // If there's already an active incident for this source+entity, update detail
    const active = incidents.find(
        (i) => i.source === source && i.entity === entity && !i.resolvedAt,
    );
    if (active) {
        active.detail = detail;
        incidents = [...incidents];
        return;
    }

    incidents = [
        ...incidents,
        { id: nextId++, source, entity, detail, startedAt: new Date(), resolvedAt: null },
    ];
}

export function resolveIncident(source: string, entity: string): void {
    const active = incidents.find(
        (i) => i.source === source && i.entity === entity && !i.resolvedAt,
    );
    if (active) {
        active.resolvedAt = new Date();
        incidents = [...incidents];
    }
}

export function clearIncidents(): void {
    incidents = [];
}

/** Clear only resolved incidents. */
export function clearResolvedIncidents(): void {
    incidents = incidents.filter((i) => !i.resolvedAt);
}

/** Reset all state — for tests only. */
export function _resetIncidents(): void {
    incidents = [];
    nextId = 1;
}

/** Return a snapshot of the incident list — for tests only. */
export function _getIncidents(): Incident[] {
    return [...incidents];
}

/** Polls the incident store on a timer (same pattern as useEvents). */
function useIncidents(): { items: Incident[]; now: number } {
    const [now, setNow] = useState(Date.now);

    useEffect(() => {
        const id = setInterval(() => {
            pruneExpired();
            setNow(Date.now());
        }, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, []);

    return { items: incidents, now };
}

/**
 * Detects state transitions and opens/resolves incidents automatically.
 *
 * @param source  Label for the panel (e.g. "Health", "Alarms", "EGP")
 * @param down    Map of entity→detail for currently-down entities,
 *                or null if no data has been fetched yet.
 */
export function useIncidentDetection(
    source: string,
    down: Map<string, string> | null,
): void {
    const prevRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!down) return;

        const currentDown = new Set(down.keys());
        const prev = prevRef.current;

        // New incidents: down now but wasn't before
        for (const [entity, detail] of down) {
            if (!prev.has(entity)) openIncident(source, entity, detail);
        }

        // Resolved: was down before but isn't now
        for (const entity of prev) {
            if (!currentDown.has(entity)) resolveIncident(source, entity);
        }

        prevRef.current = currentDown;
    }, [source, down]);
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** Full incident history — shown in detail mode. */
export function IncidentPanel({ timeZone, pollIterations }: { timeZone: string; pollIterations?: number }) {
    const { items, now } = useIncidents();

    const sorted = [...items].sort(
        (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
    );

    const uptimeMs = (pollIterations ?? 0) * POLL_INTERVAL_MS;
    const uptime = formatDuration(uptimeMs);

    return (
        <Box flexDirection="column">
            <Text> </Text>
            <Text dimColor>{'─'.repeat(60)}</Text>
            <Text bold dimColor> Incidents (24h)</Text>
            {sorted.length === 0 ? (
                <Text dimColor> no resolved incidents</Text>
            ) : (
                sorted.map((i) => {
                    const time = i.startedAt.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                        timeZone,
                    });
                    const duration = i.resolvedAt
                        ? formatDuration(i.resolvedAt.getTime() - i.startedAt.getTime())
                        : formatDuration(now - i.startedAt.getTime());
                    const resolved = !!i.resolvedAt;

                    return (
                        <Box key={i.id} gap={1}>
                            <Text dimColor> {time}</Text>
                            <Text color={resolved ? 'green' : 'red'}>
                                {resolved ? '✓' : '✗'}
                            </Text>
                            <Box width={12}>
                                <Text bold color={resolved ? 'green' : 'red'}>
                                    {i.source}
                                </Text>
                            </Box>
                            <Box width={24}>
                                <Text>{i.entity}</Text>
                            </Box>
                            <Text dimColor>{i.detail}</Text>
                            <Text dimColor> · </Text>
                            <Text color={resolved ? 'green' : 'yellow'}>
                                {resolved ? `Resolved (${duration})` : `Active (${duration})`}
                            </Text>
                        </Box>
                    );
                })
            )}
            {pollIterations !== undefined && (
                <>
                    <Text> </Text>
                    <Text dimColor>Instance running for {uptime} · {pollIterations ?? 0} poll cycles</Text>
                </>
            )}
        </Box>
    );
}

/** One-line summary — pinned below header in calm mode. */
export function IncidentSummary() {
    const { items, now } = useIncidents();

    if (items.length === 0) return null;

    const active = items.filter((i) => !i.resolvedAt).length;
    const resolved = items.filter((i) => i.resolvedAt).length;

    const parts: string[] = [];
    if (resolved > 0) parts.push(`${resolved} resolved`);
    if (active > 0) parts.push(`${active} active`);

    const latest = [...items].sort((a, b) => {
        const aTime = (a.resolvedAt ?? a.startedAt).getTime();
        const bTime = (b.resolvedAt ?? b.startedAt).getTime();
        return bTime - aTime;
    })[0];
    const latestTime = (latest.resolvedAt ?? latest.startedAt).getTime();
    const ago = formatDuration(now - latestTime);

    return (
        <Box flexShrink={0} gap={1}>
            <Text color="yellow"> ⚑</Text>
            <Text dimColor>
                {parts.join(', ')} incident{items.length !== 1 ? 's' : ''} · {ago} ago
            </Text>
        </Box>
    );
}
