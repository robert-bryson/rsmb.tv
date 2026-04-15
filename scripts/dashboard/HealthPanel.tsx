import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import https from 'node:https';
import {
    Route53Client,
    GetHealthCheckStatusCommand,
    ListHealthChecksCommand,
} from '@aws-sdk/client-route-53';
import {
    CloudWatchClient,
    GetMetricStatisticsCommand,
} from '@aws-sdk/client-cloudwatch';
import { useAwsPoll } from './useAwsPoll.js';
import { useTimeSeries } from './useTimeSeries.js';
import { sparkline } from './sparkline.js';
import type { DashboardConfig, DisplayMode } from './config.js';
import { awsCredentials, link } from './config.js';
import { StatusDot } from './StatusDot.js';
import { useIncidentDetection } from './useIncidentLog.js';

interface HealthResult {
    domain: string;
    name: string;
    healthy: boolean | null;
    detail: string;
    source: 'route53' | 'http' | 'frontend';
    url: string;
    latencyMs: number | null;
}

async function checkRoute53Health(
    client: Route53Client,
    healthCheckId: string,
): Promise<{ healthy: boolean; detail: string }> {
    const res = await client.send(
        new GetHealthCheckStatusCommand({ HealthCheckId: healthCheckId }),
    );
    const checkers = res.HealthCheckObservations ?? [];
    const total = checkers.length;
    const healthyCount = checkers.filter(
        (c) => c.StatusReport?.Status?.startsWith('Success'),
    ).length;
    return {
        healthy: healthyCount > 0,
        detail: `${healthyCount}/${total} checkers`,
    };
}

const DISCOVERY_CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
let discoveryCache: { map: Map<string, string>; timestamp: number } | null = null;

async function discoverHealthCheckIds(
    client: Route53Client,
): Promise<Map<string, string>> {
    if (discoveryCache && Date.now() - discoveryCache.timestamp < DISCOVERY_CACHE_MAX_AGE_MS) {
        return discoveryCache.map;
    }
    const map = new Map<string, string>();
    const res = await client.send(new ListHealthChecksCommand({}));
    for (const hc of res.HealthChecks ?? []) {
        const domain = hc.HealthCheckConfig?.FullyQualifiedDomainName;
        if (domain && hc.Id) {
            map.set(domain, hc.Id);
        }
    }
    discoveryCache = { map, timestamp: Date.now() };
    return map;
}

function httpPing(url: string): Promise<{ healthy: boolean; status: number; latencyMs: number }> {
    return new Promise((resolve) => {
        const start = performance.now();
        const req = https.get(url, { timeout: 10_000, headers: { 'User-Agent': 'rsmb-dashboard/1.0' } }, (res) => {
            const latencyMs = Math.round(performance.now() - start);
            res.resume();
            resolve({
                healthy: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 400,
                status: res.statusCode ?? 0,
                latencyMs,
            });
        });
        req.on('error', () => resolve({ healthy: false, status: 0, latencyMs: 0 }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ healthy: false, status: 0, latencyMs: 0 });
        });
    });
}

async function fetchLatency(
    cw: CloudWatchClient,
    healthCheckId: string,
): Promise<number | null> {
    const now = new Date();
    const start = new Date(now.getTime() - 5 * 60_000);
    const res = await cw.send(
        new GetMetricStatisticsCommand({
            Namespace: 'AWS/Route53',
            MetricName: 'TimeToFirstByte',
            Dimensions: [{ Name: 'HealthCheckId', Value: healthCheckId }],
            StartTime: start,
            EndTime: now,
            Period: 60,
            Statistics: ['Average'],
        }),
    );
    const points = res.Datapoints ?? [];
    if (points.length === 0) return null;
    points.sort((a, b) => (b.Timestamp?.getTime() ?? 0) - (a.Timestamp?.getTime() ?? 0));
    return Math.round(points[0].Average ?? 0);
}

async function fetchAllHealth(
    config: DashboardConfig,
): Promise<HealthResult[]> {
    const creds = awsCredentials(config.profile);
    const client = new Route53Client({
        region: 'us-east-1', // Route53 is global but uses us-east-1
        credentials: creds,
    });
    const cw = new CloudWatchClient({
        region: 'us-east-1',
        credentials: creds,
    });

    // Discover health check IDs if not provided via env
    const discovered = await discoverHealthCheckIds(client);

    const results: HealthResult[] = [];

    for (const project of config.projects.filter((p) => p.kind !== 'github-only')) {
        const healthCheckId =
            project.healthCheckId ?? discovered.get(project.domain);

        if (healthCheckId) {
            try {
                const [{ healthy, detail }, latencyMs] = await Promise.all([
                    checkRoute53Health(client, healthCheckId),
                    fetchLatency(cw, healthCheckId).catch(() => null),
                ]);
                results.push({
                    domain: project.domain,
                    name: project.name,
                    healthy,
                    detail,
                    source: 'route53',
                    url: project.healthUrl ?? `https://${project.domain}`,
                    latencyMs,
                });
            } catch {
                results.push({
                    domain: project.domain,
                    name: project.name,
                    healthy: null,
                    detail: 'Route53 error',
                    source: 'route53',
                    url: project.healthUrl ?? `https://${project.domain}`,
                    latencyMs: null,
                });
            }
        } else if (project.healthUrl) {
            const { healthy, status, latencyMs } = await httpPing(project.healthUrl);
            results.push({
                domain: project.domain,
                name: project.name,
                healthy,
                detail: healthy ? `HTTP ${status}` : status ? `HTTP ${status}` : 'Timeout',
                source: 'http',
                url: project.healthUrl,
                latencyMs: healthy ? latencyMs : null,
            });
        }
    }

    // Frontend pings: naive GET to each domain root
    const frontendPings = await Promise.all(
        config.projects.filter((p) => p.kind !== 'github-only').map(async (project) => {
            const url = `https://${project.domain}/`;
            const { healthy, status, latencyMs } = await httpPing(url);
            return {
                domain: project.domain,
                name: project.name,
                healthy,
                detail: healthy ? `HTTP ${status}` : status ? `HTTP ${status}` : 'Timeout',
                source: 'frontend' as const,
                url,
                latencyMs: healthy ? latencyMs : null,
            };
        }),
    );
    results.push(...frontendPings);

    return results;
}

export function HealthPanel({
    config,
    mode,
    onProblems,
}: {
    config: DashboardConfig;
    mode: DisplayMode;
    onProblems: (v: boolean) => void;
}) {
    const { data, isLoading, isStale, error } = useAwsPoll(
        () => fetchAllHealth(config),
        config.intervals.health * 1000,
    );

    const extractLatency = useCallback(
        (results: HealthResult[]) => {
            const out: Record<string, number | null> = {};
            for (const r of results) {
                const key = `${r.source}:${r.domain}`;
                out[key] = r.latencyMs;
            }
            return out;
        },
        [],
    );
    const latencyHistory = useTimeSeries(data, extractLatency);

    // Track consecutive failure streaks per check — first failure shows a
    // yellow warning but stays calm; second consecutive failure fires the alarm.
    // Uses the React-recommended "adjusting state when a prop changes" pattern.
    const [prevData, setPrevData] = useState<HealthResult[] | null>(null);
    const [failStreaks, setFailStreaks] = useState<Map<string, number>>(new Map());

    if (data !== prevData) {
        setPrevData(data);
        if (data) {
            setFailStreaks((prev) => {
                const next = new Map<string, number>();
                for (const h of data) {
                    const key = `${h.source}:${h.domain}`;
                    const streak = prev.get(key) ?? 0;
                    next.set(key, h.healthy === false ? streak + 1 : 0);
                }
                return next;
            });
        }
    }

    const getFailStreak = (h: HealthResult) =>
        failStreaks.get(`${h.source}:${h.domain}`) ?? 0;

    const unhealthy = (data ?? []).filter((h) => h.healthy === false);
    const confirmedUnhealthy = unhealthy.filter((h) => getFailStreak(h) >= 2);
    const hasProblems = confirmedUnhealthy.length > 0;

    useEffect(() => {
        onProblems(hasProblems);
    }, [hasProblems, onProblems]);

    // Record incidents when health checks transition to/from confirmed failure
    const incidentDown = useMemo(
        () => data ? new Map(confirmedUnhealthy.map((h) => [h.domain, h.detail])) : null,
        // eslint-disable-next-line react-hooks/exhaustive-deps -- confirmedUnhealthy is derived from data + failStreaks (which sync with data)
        [data],
    );
    useIncidentDetection('Health', incidentDown);

    const backend = (data ?? []).filter((h) => h.source !== 'frontend');
    const frontend = (data ?? []).filter((h) => h.source === 'frontend');

    // Calm mode: single summary line
    if (mode === 'calm') {
        return (
            <Box gap={1}>
                <Box width={9}><Text dimColor> Health</Text></Box>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : error && !data ? (
                    <Text color="red">⚠ error</Text>
                ) : (
                    <>
                        <Box width={25} gap={1}>
                            {backend.map((h) => (
                                <StatusDot key={h.domain} healthy={h.healthy} stale={isStale} warning={getFailStreak(h) === 1} />
                            ))}
                            <Text dimColor>│</Text>
                            {frontend.map((h) => (
                                <StatusDot key={`fe-${h.domain}`} healthy={h.healthy} stale={isStale} warning={getFailStreak(h) === 1} />
                            ))}
                        </Box>
                        <Text dimColor>OK</Text>
                    </>
                )}
            </Box>
        );
    }

    // Alert mode: summary + only unhealthy expanded
    // Detail mode: all rows
    const showAll = mode === 'detail';
    const backendItems = showAll ? backend : backend.filter((h) => h.healthy === false);
    const frontendItems = showAll ? frontend : frontend.filter((h) => h.healthy === false);

    return (
        <Box flexDirection="column">
            <Box gap={1}>
                <Text bold> HEALTH</Text>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : !hasProblems ? (
                    <>
                        {backend.map((h) => (
                            <StatusDot key={h.domain} healthy={h.healthy} stale={isStale} warning={getFailStreak(h) === 1} />
                        ))}
                        <Text dimColor>│</Text>
                        {frontend.map((h) => (
                            <StatusDot key={`fe-${h.domain}`} healthy={h.healthy} stale={isStale} warning={getFailStreak(h) === 1} />
                        ))}
                        <Text dimColor>All OK</Text>
                    </>
                ) : (
                    <Text color="red">
                        {confirmedUnhealthy.length}/{(data ?? []).length} down
                    </Text>
                )}
            </Box>

            {error && !data && (
                <Text color="red">  Error: {error}</Text>
            )}

            {backendItems.map((h) => (
                <Box key={h.domain} gap={1}>
                    <Text>  </Text>
                    <StatusDot healthy={h.healthy} stale={isStale} warning={getFailStreak(h) === 1} />
                    <Text> </Text>
                    <Box width={30}>
                        <Text>{link(h.url, h.domain)}</Text>
                    </Box>
                    <Box width={10}>
                        <Text color={h.healthy ? 'green' : getFailStreak(h) === 1 ? 'yellow' : h.healthy === false ? 'red' : 'gray'}>
                            {h.healthy ? 'Healthy' : getFailStreak(h) === 1 ? 'Warning' : h.healthy === false ? 'DOWN' : 'Unknown'}
                        </Text>
                    </Box>
                    <Box width={16}>
                        <Text dimColor>{h.detail}</Text>
                    </Box>
                    <Box width={7} justifyContent="flex-end">
                        <Text dimColor>{h.latencyMs != null ? `${h.latencyMs}ms` : ''}</Text>
                    </Box>
                    <Box width={10}>
                        {(latencyHistory[`${h.source}:${h.domain}`]?.length ?? 0) > 1 && (
                            <Text dimColor>{sparkline(latencyHistory[`${h.source}:${h.domain}`], 10)}</Text>
                        )}
                    </Box>
                </Box>
            ))}

            {(backendItems.length > 0 || frontendItems.length > 0) && frontendItems.length > 0 && (
                <Box gap={1}>
                    <Text dimColor>  ─ pings</Text>
                </Box>
            )}

            {frontendItems.map((h) => (
                <Box key={`fe-${h.domain}`} gap={1}>
                    <Text>  </Text>
                    <StatusDot healthy={h.healthy} stale={isStale} warning={getFailStreak(h) === 1} />
                    <Text> </Text>
                    <Box width={30}>
                        <Text dimColor>{link(h.url, h.domain)}</Text>
                    </Box>
                    <Box width={10}>
                        <Text color={h.healthy ? 'green' : getFailStreak(h) === 1 ? 'yellow' : h.healthy === false ? 'red' : 'gray'}>
                            {h.healthy ? 'OK' : getFailStreak(h) === 1 ? 'Warning' : h.healthy === false ? 'FAIL' : 'Unknown'}
                        </Text>
                    </Box>
                    <Box width={16}>
                        <Text dimColor>{h.detail}</Text>
                    </Box>
                    <Box width={7} justifyContent="flex-end">
                        <Text dimColor>{h.latencyMs != null ? `${h.latencyMs}ms` : ''}</Text>
                    </Box>
                    <Box width={10}>
                        {(latencyHistory[`${h.source}:${h.domain}`]?.length ?? 0) > 1 && (
                            <Text dimColor>{sparkline(latencyHistory[`${h.source}:${h.domain}`], 10)}</Text>
                        )}
                    </Box>
                </Box>
            ))}
        </Box>
    );
}
