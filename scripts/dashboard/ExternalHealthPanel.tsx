import React, { useEffect, useCallback, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import https from 'node:https';
import { useAwsPoll } from './useAwsPoll.js';
import { useTimeSeries } from './useTimeSeries.js';
import { sparkline } from './sparkline.js';
import type { DisplayMode, SiteGroup } from './config.js';
import { link } from './config.js';
import { StatusDot } from './StatusDot.js';

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

function fetchJson(url: string, maxRedirects = 5): Promise<unknown> {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'));
            return;
        }
        const req = https.get(url, { timeout: 15_000 }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchJson(res.headers.location, maxRedirects - 1).then(resolve, reject);
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

    // Track consecutive failure streaks — first failure shows a yellow warning
    // but stays calm; second consecutive failure fires the alarm.
    // Uses the React-recommended "adjusting state when a prop changes" pattern.
    const [prevData, setPrevData] = useState<GroupHealth | null>(null);
    const [failStreaks, setFailStreaks] = useState<Map<string, number>>(new Map());

    if (data !== prevData) {
        setPrevData(data);
        if (data) {
            setFailStreaks((prev) => {
                const next = new Map<string, number>();
                for (const s of data.sites) {
                    const streak = prev.get(s.name) ?? 0;
                    next.set(s.name, s.healthy === false ? streak + 1 : 0);
                }
                return next;
            });
        }
    }

    const getFailStreak = (name: string) =>
        failStreaks.get(name) ?? 0;

    const sites = data?.sites ?? [];
    const alerts = data?.alerts ?? [];
    const unhealthy = sites.filter((h) => h.healthy === false);
    const confirmedUnhealthy = unhealthy.filter((h) => getFailStreak(h.name) >= 2);
    const hasProblems = confirmedUnhealthy.length > 0 || alerts.some((a) => a.kind === 'incident');

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
                            <StatusDot key={h.name} healthy={h.healthy} stale={isStale} warning={getFailStreak(h.name) === 1} />
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
                            <StatusDot key={h.name} healthy={h.healthy} stale={isStale} warning={getFailStreak(h.name) === 1} />
                        ))}
                        <Text dimColor>All OK  {statusPageLink}</Text>
                    </>
                ) : (
                    <Text color="red">
                        {confirmedUnhealthy.length}/{sites.length} down
                    </Text>
                )}
            </Box>

            {error && !data && (
                <Text color="red">  Error: {error}</Text>
            )}

            {items.map((h) => (
                <Box key={h.name} gap={1}>
                    <Text>  </Text>
                    <StatusDot healthy={h.healthy} stale={isStale} warning={getFailStreak(h.name) === 1} />
                    <Text> </Text>
                    <Box width={24}>
                        <Text>{h.drillDownUrl ? link(h.drillDownUrl, h.name) : h.name}</Text>
                    </Box>
                    <Box width={14}>
                        <Text color={h.healthy ? 'green' : getFailStreak(h.name) === 1 ? 'yellow' : h.healthy === false ? 'red' : 'gray'}>
                            {h.healthy ? 'Operational' : getFailStreak(h.name) === 1 ? 'Warning' : h.healthy === false ? 'DOWN' : 'Unknown'}
                        </Text>
                    </Box>
                    <Box width={7} justifyContent="flex-end">
                        <Text dimColor>{h.responseTimeMs != null ? `${h.responseTimeMs}ms` : ''}</Text>
                    </Box>
                    <Box width={10}>
                        {(responseHistory[h.name]?.length ?? 0) > 1 && (
                            <Text dimColor>{sparkline(responseHistory[h.name], 10)}</Text>
                        )}
                    </Box>
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
