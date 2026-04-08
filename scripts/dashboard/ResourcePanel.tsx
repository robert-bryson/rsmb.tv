import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import {
    CloudWatchClient,
    GetMetricDataCommand,
    ListMetricsCommand,
} from '@aws-sdk/client-cloudwatch';
import { useAwsPoll } from './useAwsPoll.js';
import type { DashboardConfig, DisplayMode } from './config.js';
import { awsCredentials } from './config.js';

interface BucketMetrics {
    name: string;
    sizeBytes: number;
    objects: number;
}

interface ResourceData {
    buckets: BucketMetrics[];
    totalSizeBytes: number;
    totalObjects: number;
    dataCdnRequests: number | null;
    dataCdnBytes: number | null;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatCount(n: number): string {
    if (n < 1000) return String(n);
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
    return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Strip trailing AWS account ID (e.g. "-239339589087") from bucket names. */
function stripAccountId(name: string): string {
    return name.replace(/-\d{12}$/, '');
}

/** Discover all S3 buckets that have BucketSizeBytes metrics. */
async function discoverBuckets(cw: CloudWatchClient): Promise<string[]> {
    const buckets = new Set<string>();
    let token: string | undefined;
    do {
        const resp = await cw.send(
            new ListMetricsCommand({
                Namespace: 'AWS/S3',
                MetricName: 'BucketSizeBytes',
                NextToken: token,
            }),
        );
        for (const m of resp.Metrics ?? []) {
            const name = m.Dimensions?.find((d) => d.Name === 'BucketName')?.Value;
            if (name) buckets.add(name);
        }
        token = resp.NextToken;
    } while (token);
    return [...buckets].sort();
}

async function fetchResources(config: DashboardConfig): Promise<ResourceData> {
    const cw = new CloudWatchClient({
        region: config.region,
        credentials: awsCredentials(config.profile),
    });

    const bucketNames = await discoverBuckets(cw);

    const now = new Date();
    const s3Start = new Date(now.getTime() - 2 * 86_400_000);

    const queries = bucketNames.flatMap((name, i) => [
        {
            Id: `size${i}`,
            MetricStat: {
                Metric: {
                    Namespace: 'AWS/S3',
                    MetricName: 'BucketSizeBytes',
                    Dimensions: [
                        { Name: 'BucketName', Value: name },
                        { Name: 'StorageType', Value: 'StandardStorage' },
                    ],
                },
                Period: 86400,
                Stat: 'Average',
            },
        },
        {
            Id: `obj${i}`,
            MetricStat: {
                Metric: {
                    Namespace: 'AWS/S3',
                    MetricName: 'NumberOfObjects',
                    Dimensions: [
                        { Name: 'BucketName', Value: name },
                        { Name: 'StorageType', Value: 'AllStorageTypes' },
                    ],
                },
                Period: 86400,
                Stat: 'Average',
            },
        },
    ]);

    if (config.dataCdnDistributionId) {
        queries.push(
            {
                Id: 'cfreqs',
                MetricStat: {
                    Metric: {
                        Namespace: 'AWS/CloudFront',
                        MetricName: 'Requests',
                        Dimensions: [
                            { Name: 'DistributionId', Value: config.dataCdnDistributionId },
                            { Name: 'Region', Value: 'Global' },
                        ],
                    },
                    Period: 3600,
                    Stat: 'Sum',
                },
            },
            {
                Id: 'cfbytes',
                MetricStat: {
                    Metric: {
                        Namespace: 'AWS/CloudFront',
                        MetricName: 'BytesDownloaded',
                        Dimensions: [
                            { Name: 'DistributionId', Value: config.dataCdnDistributionId },
                            { Name: 'Region', Value: 'Global' },
                        ],
                    },
                    Period: 3600,
                    Stat: 'Sum',
                },
            },
        );
    }

    const resp = await cw.send(
        new GetMetricDataCommand({
            StartTime: s3Start,
            EndTime: now,
            MetricDataQueries: queries,
        }),
    );

    const latest = (id: string): number | null => {
        const result = resp.MetricDataResults?.find((r) => r.Id === id);
        if (!result?.Values?.length) return null;
        return result.Values[0];
    };

    const buckets: BucketMetrics[] = bucketNames.map((name, i) => ({
        name,
        sizeBytes: latest(`size${i}`) ?? 0,
        objects: latest(`obj${i}`) ?? 0,
    }));

    // Sort largest first
    buckets.sort((a, b) => b.sizeBytes - a.sizeBytes);

    return {
        buckets,
        totalSizeBytes: buckets.reduce((sum, b) => sum + b.sizeBytes, 0),
        totalObjects: buckets.reduce((sum, b) => sum + b.objects, 0),
        dataCdnRequests: latest('cfreqs'),
        dataCdnBytes: latest('cfbytes'),
    };
}

export function ResourcePanel({
    config,
    mode,
}: {
    config: DashboardConfig;
    mode: DisplayMode;
}) {
    const { data, isLoading } = useAwsPoll(
        () => fetchResources(config),
        config.intervals.costs * 1000, // Same cadence as costs (5 min)
        'Resources',
    );

    if (isLoading && !data) {
        return (
            <Box gap={1}>
                <Text dimColor> Resources</Text>
                <Text color="cyan"><Spinner type="dots" /></Text>
            </Box>
        );
    }

    if (!data) return null;

    const hasBuckets = data.buckets.length > 0;
    const hasCf = data.dataCdnRequests != null;

    if (mode === 'calm') {
        const parts: string[] = [];
        if (hasBuckets) parts.push(`S3 ${formatBytes(data.totalSizeBytes)} · ${formatCount(data.totalObjects)} obj (${data.buckets.length})`);
        if (hasCf) parts.push(`CDN ${formatCount(data.dataCdnRequests!)} req/h`);
        if (parts.length === 0) return null;
        return (
            <Box gap={1}>
                <Box width={9}><Text dimColor> Res</Text></Box>
                <Text dimColor>{parts.join(' │ ')}</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            <Box gap={1}>
                <Text dimColor> Resources</Text>
                {hasBuckets && (
                    <>
                        <Text dimColor>S3</Text>
                        <Text color="cyan">{formatBytes(data.totalSizeBytes)}</Text>
                        <Text dimColor>·</Text>
                        <Text dimColor>{formatCount(data.totalObjects)} obj ({data.buckets.length})</Text>
                    </>
                )}
                {hasCf && (
                    <>
                        <Text dimColor>│ CDN</Text>
                        <Text color="cyan">{formatCount(data.dataCdnRequests!)} req/h</Text>
                        {data.dataCdnBytes != null && (
                            <Text dimColor>({formatBytes(data.dataCdnBytes)})</Text>
                        )}
                    </>
                )}
                {!hasBuckets && !hasCf && <Text dimColor>No data yet</Text>}
            </Box>
            {hasBuckets && data.buckets.map((b) => (
                <Box key={b.name} gap={1} paddingLeft={2}>
                    <Box width={28}><Text dimColor>{stripAccountId(b.name)}</Text></Box>
                    <Box width={10} justifyContent="flex-end"><Text>{formatBytes(b.sizeBytes)}</Text></Box>
                    <Text dimColor>({formatCount(b.objects)} obj)</Text>
                </Box>
            ))}
        </Box>
    );
}
