import React, { useEffect } from 'react';
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
import type { DashboardConfig, DisplayMode } from './config.js';
import { awsCredentials, link } from './config.js';

interface HealthResult {
    domain: string;
    name: string;
    healthy: boolean | null;
    detail: string;
    source: 'route53' | 'http';
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

async function discoverHealthCheckIds(
    client: Route53Client,
): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const res = await client.send(new ListHealthChecksCommand({}));
    for (const hc of res.HealthChecks ?? []) {
        const domain = hc.HealthCheckConfig?.FullyQualifiedDomainName;
        if (domain && hc.Id) {
            map.set(domain, hc.Id);
        }
    }
    return map;
}

function httpPing(url: string): Promise<{ healthy: boolean; status: number; latencyMs: number }> {
    return new Promise((resolve) => {
        const start = performance.now();
        const req = https.get(url, { timeout: 10_000 }, (res) => {
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

    for (const project of config.projects) {
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

    return results;
}

function StatusDot({ healthy, stale }: { healthy: boolean | null; stale: boolean }) {
    if (stale) return <Text color="yellow">●</Text>;
    if (healthy === null) return <Text color="gray">●</Text>;
    return healthy ? <Text color="green">●</Text> : <Text color="red">●</Text>;
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

    const unhealthy = (data ?? []).filter((h) => h.healthy === false);
    const hasProblems = unhealthy.length > 0;

    useEffect(() => {
        onProblems(hasProblems);
    }, [hasProblems, onProblems]);

    // Calm mode: single summary line
    if (mode === 'calm') {
        return (
            <Box gap={1}>
                <Text dimColor> Health</Text>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : error && !data ? (
                    <Text color="red">error</Text>
                ) : (
                    <>
                        {(data ?? []).map((h) => (
                            <StatusDot key={h.domain} healthy={h.healthy} stale={isStale} />
                        ))}
                        <Text dimColor>All OK</Text>
                    </>
                )}
            </Box>
        );
    }

    // Alert mode: summary + only unhealthy expanded
    // Detail mode: all rows
    const showAll = mode === 'detail';
    const items = showAll ? (data ?? []) : unhealthy;

    return (
        <Box flexDirection="column">
            <Box gap={1}>
                <Text bold> HEALTH</Text>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : !hasProblems ? (
                    <>
                        {(data ?? []).map((h) => (
                            <StatusDot key={h.domain} healthy={h.healthy} stale={isStale} />
                        ))}
                        <Text dimColor>All OK</Text>
                    </>
                ) : (
                    <Text color="red">
                        {unhealthy.length}/{(data ?? []).length} down
                    </Text>
                )}
            </Box>

            {error && !data && (
                <Text color="red">  Error: {error}</Text>
            )}

            {items.map((h) => (
                <Box key={h.domain} gap={1}>
                    <Text>  </Text>
                    <StatusDot healthy={h.healthy} stale={isStale} />
                    <Text> </Text>
                    <Box width={30}>
                        <Text>{link(h.url, h.domain)}</Text>
                    </Box>
                    <Text color={h.healthy ? 'green' : h.healthy === false ? 'red' : 'gray'}>
                        {h.healthy ? 'Healthy' : h.healthy === false ? 'DOWN' : 'Unknown'}
                    </Text>
                    <Text dimColor>  {h.detail}</Text>
                    {h.latencyMs != null && (
                        <Text dimColor>  {h.latencyMs}ms</Text>
                    )}
                </Box>
            ))}
        </Box>
    );
}
