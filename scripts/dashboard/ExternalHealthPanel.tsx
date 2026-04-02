import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import https from 'node:https';
import { useAwsPoll } from './useAwsPoll.js';
import type { DisplayMode, SiteGroup } from './config.js';
import { link } from './config.js';

interface SiteResult {
    name: string;
    healthy: boolean | null;
    detail: string;
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
    subcomponents?: UptimeComponent[];
}

function extractStatuses(components: UptimeComponent[]): Map<string, string> {
    const statuses = new Map<string, string>();
    for (const comp of components) {
        if (comp.is_group && comp.subcomponents?.length) {
            for (const sub of comp.subcomponents) {
                statuses.set(sub.name, sub.status_display);
            }
        } else if (!comp.is_group) {
            statuses.set(comp.name, comp.status_display);
        }
    }
    return statuses;
}

async function fetchGroupHealth(group: SiteGroup): Promise<SiteResult[]> {
    const json = await fetchJson(`${group.statusPageUrl}/ajax`) as {
        data?: { components?: UptimeComponent[] };
    };
    const components = json?.data?.components ?? [];
    const statuses = extractStatuses(components);

    return group.sites.map((site) => {
        const status = statuses.get(site.name);
        if (!status) {
            return { name: site.name, healthy: null, detail: 'Not found on status page' };
        }
        const healthy = status === 'Operational';
        return { name: site.name, healthy, detail: status };
    });
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
    );

    const unhealthy = (data ?? []).filter((h) => h.healthy === false);
    const hasProblems = unhealthy.length > 0;

    useEffect(() => {
        onProblems(hasProblems);
    }, [hasProblems, onProblems]);

    const statusPageLink = link(group.statusPageUrl, 'status page');

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
                            <StatusDot key={h.name} healthy={h.healthy} stale={isStale} />
                        ))}
                        <Text dimColor>All OK</Text>
                    </>
                )}
            </Box>
        );
    }

    // Alert/Detail mode
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
                            <StatusDot key={h.name} healthy={h.healthy} stale={isStale} />
                        ))}
                        <Text dimColor>All OK  {statusPageLink}</Text>
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
                <Box key={h.name} gap={1}>
                    <Text>  </Text>
                    <StatusDot healthy={h.healthy} stale={isStale} />
                    <Text> </Text>
                    <Box width={30}>
                        <Text>{h.name}</Text>
                    </Box>
                    <Text color={h.healthy ? 'green' : h.healthy === false ? 'red' : 'gray'}>
                        {h.healthy ? 'Operational' : h.healthy === false ? 'DOWN' : 'Unknown'}
                    </Text>
                    <Text dimColor>  {h.detail}</Text>
                </Box>
            ))}
        </Box>
    );
}
