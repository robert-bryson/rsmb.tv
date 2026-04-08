import React, { useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import https from 'node:https';
import { useAwsPoll } from './useAwsPoll.js';
import { useTimeSeries } from './useTimeSeries.js';
import { sparkline } from './sparkline.js';
import type { DisplayMode, SiteGroup } from './config.js';
import { link } from './config.js';

interface SiteResult {
    name: string;
    healthy: boolean | null;
    detail: string;
    responseTimeMs: number | null;
    drillDownUrl: string | null;
}

interface PageAlert {
    kind: 'incident' | 'maintenance';
    name: string;
}

function fetchJson(url: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: 15_000 }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchJson(res.headers.location).then(resolve, reject);
                res.resume();
                return;
            }
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
                } catch {
                    reject(new Error('Invalid JSON'));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

interface UptimeComponent {
    name: string;
    status: string;
    status_display: string;
    is_group: boolean;
    cached_response_time: number | null;
    service_url: string | null;
    subcomponents?: UptimeComponent[];
}

interface UptimeIncident {
    name?: string;
}

interface ComponentInfo {
    statusDisplay: string;
    responseTimeMs: number | null;
    drillDownUrl: string | null;
}

function extractComponents(components: UptimeComponent[]): Map<string, ComponentInfo> {
    const map = new Map<string, ComponentInfo>();
    for (const comp of components) {
        const subs = comp.is_group && comp.subcomponents?.length ? comp.subcomponents : [comp];
        for (const sub of subs) {
            if (sub.is_group) continue;
            map.set(sub.name, {
                statusDisplay: sub.status_display,
                responseTimeMs: sub.cached_response_time != null
                    ? Math.round(sub.cached_response_time * 1000)
                    : null,
                drillDownUrl: sub.service_url
                    ? `https://uptime.com${sub.service_url}`
                    : null,
            });
        }
    }
    return map;
}

interface GroupHealth {
    sites: SiteResult[];
    alerts: PageAlert[];
}

async function fetchGroupHealth(group: SiteGroup): Promise<GroupHealth> {
    const json = await fetchJson(`${group.statusPageUrl}/ajax`) as {
        data?: {
            components?: UptimeComponent[];
            active_incidents?: UptimeIncident[];
            upcoming_maintenance?: UptimeIncident[];
        };
    };
    const components = json?.data?.components ?? [];
    const infos = extractComponents(components);

    const alerts: PageAlert[] = [];
    for (const inc of json?.data?.active_incidents ?? []) {
        if (inc.name) alerts.push({ kind: 'incident', name: inc.name });
    }
    for (const m of json?.data?.upcoming_maintenance ?? []) {
        if (m.name) alerts.push({ kind: 'maintenance', name: m.name });
    }

    const sites = group.sites.map((site) => {
        const info = infos.get(site.name);
        if (!info) {
            return { name: site.name, healthy: null, detail: 'Not found on status page', responseTimeMs: null, drillDownUrl: null };
        }
        const healthy = info.statusDisplay === 'Operational';
        return {
            name: site.name,
            healthy,
            detail: info.statusDisplay,
            responseTimeMs: info.responseTimeMs,
            drillDownUrl: info.drillDownUrl,
        };
    });

    return { sites, alerts };
}

function StatusDot({ healthy, stale }: { healthy: boolean | null; stale: boolean }) {
    if (stale) return <Text color="yellow">●</Text>;
    if (healthy === null) return <Text color="gray">●</Text>;
    return healthy ? <Text color="green">●</Text> : <Text color="red">●</Text>;
}

export function ExternalHealthPanel({
    group,
    intervalMs,
    mode,
    onProblems,
}: {
    group: SiteGroup;
    intervalMs: number;
    mode: DisplayMode;
    onProblems: (v: boolean) => void;
}) {
    const { data, isLoading, isStale, error } = useAwsPoll(
        () => fetchGroupHealth(group),
        intervalMs,
        group.label,
    );

    const extractResponseTime = useCallback(
        (gh: GroupHealth) => {
            const out: Record<string, number | null> = {};
            for (const s of gh.sites) {
                out[s.name] = s.responseTimeMs;
            }
            return out;
        },
        [],
    );
    const responseHistory = useTimeSeries(data, extractResponseTime);

    const sites = data?.sites ?? [];
    const alerts = data?.alerts ?? [];
    const unhealthy = sites.filter((h) => h.healthy === false);
    const hasProblems = unhealthy.length > 0 || alerts.some((a) => a.kind === 'incident');

    useEffect(() => {
        onProblems(hasProblems);
    }, [hasProblems, onProblems]);

    const statusPageLink = link(group.statusPageUrl, 'status page');

    // Calm mode: single summary line
    if (mode === 'calm') {
        return (
            <Box gap={1}>
                <Text dimColor> Uptime.com</Text>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : error && !data ? (
                    <Text color="red">error</Text>
                ) : (
                    <>
                        {sites.map((h) => (
                            <StatusDot key={h.name} healthy={h.healthy} stale={isStale} />
                        ))}
                        {isStale ? <Text color="yellow">stale</Text> : <Text dimColor>All OK</Text>}
                    </>
                )}
            </Box>
        );
    }

    // Alert/Detail mode
    const showAll = mode === 'detail';
    const items = showAll ? sites : unhealthy;

    return (
        <Box flexDirection="column">
            <Box gap={1}>
                <Text bold> UPTIME.COM</Text>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : !hasProblems ? (
                    <>
                        {sites.map((h) => (
                            <StatusDot key={h.name} healthy={h.healthy} stale={isStale} />
                        ))}
                        <Text dimColor>All OK  {statusPageLink}</Text>
                    </>
                ) : (
                    <Text color="red">
                        {unhealthy.length}/{sites.length} down
                    </Text>
                )}
            </Box>

            {error && !data && (
                <Text color="red">  Error: {error}</Text>
            )}

            {items.map((h) => (
                <Box key={h.name} gap={1}>
                    <Text>  </Text>
                    <StatusDot healthy={h.healthy} stale={isStale} />
                    <Text> </Text>
                    <Box width={24}>
                        <Text>{h.drillDownUrl ? link(h.drillDownUrl, h.name) : h.name}</Text>
                    </Box>
                    <Box width={14}>
                        <Text color={h.healthy ? 'green' : h.healthy === false ? 'red' : 'gray'}>
                            {h.healthy ? 'Operational' : h.healthy === false ? 'DOWN' : 'Unknown'}
                        </Text>
                    </Box>
                    <Box width={7} justifyContent="flex-end">
                        <Text dimColor>{h.responseTimeMs != null ? `${h.responseTimeMs}ms` : ''}</Text>
                    </Box>
                    {(responseHistory[h.name]?.length ?? 0) > 1 && (
                        <Text dimColor>{sparkline(responseHistory[h.name])}</Text>
                    )}
                </Box>
            ))}

            {alerts.length > 0 && items.length > 0 && <Text> </Text>}
            {alerts.map((a) => (
                <Box key={a.name} gap={1}>
                    <Text>  </Text>
                    <Text color={a.kind === 'incident' ? 'red' : 'yellow'}>
                        {a.kind === 'incident' ? '⚠' : '🔧'}
                    </Text>
                    <Text color={a.kind === 'incident' ? 'red' : 'yellow'}>
                        {' '}{a.name}
                    </Text>
                </Box>
            ))}
        </Box>
    );
}
