import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import https from 'node:https';
import {
    Route53Client,
    GetHealthCheckStatusCommand,
    ListHealthChecksCommand,
} from '@aws-sdk/client-route-53';
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

function httpPing(url: string): Promise<{ healthy: boolean; status: number }> {
    return new Promise((resolve) => {
        const req = https.get(url, { timeout: 10_000 }, (res) => {
            res.resume();
            resolve({
                healthy: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 400,
                status: res.statusCode ?? 0,
            });
        });
        req.on('error', () => resolve({ healthy: false, status: 0 }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ healthy: false, status: 0 });
        });
    });
}

async function fetchAllHealth(
    config: DashboardConfig,
): Promise<HealthResult[]> {
    const client = new Route53Client({
        region: 'us-east-1', // Route53 is global but uses us-east-1
        credentials: awsCredentials(config.profile),
    });

    // Discover health check IDs if not provided via env
    const discovered = await discoverHealthCheckIds(client);

    const results: HealthResult[] = [];

    for (const project of config.projects) {
        const healthCheckId =
            project.healthCheckId ?? discovered.get(project.domain);

        if (healthCheckId) {
            try {
                const { healthy, detail } = await checkRoute53Health(
                    client,
                    healthCheckId,
                );
                results.push({
                    domain: project.domain,
                    name: project.name,
                    healthy,
                    detail,
                    source: 'route53',
                    url: project.healthUrl ?? `https://${project.domain}`,
                });
            } catch {
                results.push({
                    domain: project.domain,
                    name: project.name,
                    healthy: null,
                    detail: 'Route53 error',
                    source: 'route53',
                    url: project.healthUrl ?? `https://${project.domain}`,
                });
            }
        } else if (project.healthUrl) {
            const { healthy, status } = await httpPing(project.healthUrl);
            results.push({
                domain: project.domain,
                name: project.name,
                healthy,
                detail: healthy ? `HTTP ${status}` : status ? `HTTP ${status}` : 'Timeout',
                source: 'http',
                url: project.healthUrl,
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
                </Box>
            ))}
        </Box>
    );
}
