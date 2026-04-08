import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import {
    CloudWatchClient,
    GetMetricDataCommand,
    ListMetricsCommand,
} from '@aws-sdk/client-cloudwatch';
import {
    CloudFrontClient,
    ListDistributionsCommand,
} from '@aws-sdk/client-cloudfront';
import { useAwsPoll } from './useAwsPoll.js';
import type { DashboardConfig, DisplayMode } from './config.js';
import { awsCredentials, link } from './config.js';

interface BucketMetrics {
    name: string;
    sizeBytes: number;
    objects: number;
}

interface DistributionMetrics {
    id: string;
    label: string;
    consoleUrl: string;
    requests: number;
    bytesDownloaded: number;
}

interface LambdaMetrics {
    name: string;
    consoleUrl: string;
    invocations: number;
    errors: number;
    avgDurationMs: number;
}

interface ResourceData {
    buckets: BucketMetrics[];
    totalSizeBytes: number;
    totalObjects: number;
    distributions: DistributionMetrics[];
    totalCfRequests: number;
    totalCfBytes: number;
    lambdas: LambdaMetrics[];
    totalInvocations: number;
    totalErrors: number;
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

const DISCOVERY_CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

let bucketCache: { data: string[]; timestamp: number } | null = null;

/** Discover all S3 buckets that have BucketSizeBytes metrics. Cached for 1 hour. */
async function discoverBuckets(cw: CloudWatchClient): Promise<string[]> {
    if (bucketCache && Date.now() - bucketCache.timestamp < DISCOVERY_CACHE_MAX_AGE_MS) {
        return bucketCache.data;
    }
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
    const result = [...buckets].sort();
    bucketCache = { data: result, timestamp: Date.now() };
    return result;
}

let distIdCache: { data: string[]; timestamp: number } | null = null;

/** Discover all CloudFront distributions that have Requests metrics. Cached for 1 hour. */
async function discoverDistributions(cw: CloudWatchClient): Promise<string[]> {
    if (distIdCache && Date.now() - distIdCache.timestamp < DISCOVERY_CACHE_MAX_AGE_MS) {
        return distIdCache.data;
    }
    const ids = new Set<string>();
    let token: string | undefined;
    do {
        const resp = await cw.send(
            new ListMetricsCommand({
                Namespace: 'AWS/CloudFront',
                MetricName: 'Requests',
                NextToken: token,
            }),
        );
        for (const m of resp.Metrics ?? []) {
            const id = m.Dimensions?.find((d) => d.Name === 'DistributionId')?.Value;
            if (id) ids.add(id);
        }
        token = resp.NextToken;
    } while (token);
    const result = [...ids].sort();
    distIdCache = { data: result, timestamp: Date.now() };
    return result;
}

let distLabelCache: { data: Map<string, string>; knownIds: string } | null = null;

/** Fetch human-readable labels for CloudFront distributions. Re-fetches only when distribution IDs change. */
async function fetchDistributionLabels(
    config: DashboardConfig,
    distIds: string[],
): Promise<Map<string, string>> {
    const idsKey = distIds.join(',');
    if (distLabelCache && distLabelCache.knownIds === idsKey) {
        return distLabelCache.data;
    }
    const cf = new CloudFrontClient({
        region: 'us-east-1',
        credentials: awsCredentials(config.profile),
    });
    const labels = new Map<string, string>();
    let marker: string | undefined;
    do {
        const resp = await cf.send(
            new ListDistributionsCommand({ Marker: marker, MaxItems: 100 }),
        );
        for (const dist of resp.DistributionList?.Items ?? []) {
            if (!dist.Id) continue;
            const aliases = dist.Aliases?.Items ?? [];
            const label = aliases[0] ?? dist.Comment ?? dist.Id;
            labels.set(dist.Id, label);
        }
        marker = resp.DistributionList?.IsTruncated
            ? resp.DistributionList.NextMarker
            : undefined;
    } while (marker);
    distLabelCache = { data: labels, knownIds: idsKey };
    return labels;
}

let lambdaCache: { data: string[]; timestamp: number } | null = null;

/** Discover all Lambda functions that have Invocations metrics. Cached for 1 hour. */
async function discoverLambdas(cw: CloudWatchClient): Promise<string[]> {
    if (lambdaCache && Date.now() - lambdaCache.timestamp < DISCOVERY_CACHE_MAX_AGE_MS) {
        return lambdaCache.data;
    }
    const fns = new Set<string>();
    let token: string | undefined;
    do {
        const resp = await cw.send(
            new ListMetricsCommand({
                Namespace: 'AWS/Lambda',
                MetricName: 'Invocations',
                NextToken: token,
            }),
        );
        for (const m of resp.Metrics ?? []) {
            const name = m.Dimensions?.find((d) => d.Name === 'FunctionName')?.Value;
            if (name) fns.add(name);
        }
        token = resp.NextToken;
    } while (token);
    const result = [...fns].sort();
    lambdaCache = { data: result, timestamp: Date.now() };
    return result;
}

async function fetchResources(config: DashboardConfig): Promise<ResourceData> {
    const cw = new CloudWatchClient({
        region: config.region,
        credentials: awsCredentials(config.profile),
    });

    // CloudFront metrics live in us-east-1
    const cwGlobal = config.region === 'us-east-1' ? cw : new CloudWatchClient({
        region: 'us-east-1',
        credentials: awsCredentials(config.profile),
    });

    const [bucketNames, distIds, lambdaNames] = await Promise.all([
        discoverBuckets(cw),
        discoverDistributions(cwGlobal),
        discoverLambdas(cw),
    ]);

    const distLabels = await fetchDistributionLabels(config, distIds);

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

    const cfQueries = distIds.flatMap((id, i) => [
        {
            Id: `cfreqs${i}`,
            MetricStat: {
                Metric: {
                    Namespace: 'AWS/CloudFront',
                    MetricName: 'Requests',
                    Dimensions: [
                        { Name: 'DistributionId', Value: id },
                        { Name: 'Region', Value: 'Global' },
                    ],
                },
                Period: 3600,
                Stat: 'Sum',
            },
        },
        {
            Id: `cfbytes${i}`,
            MetricStat: {
                Metric: {
                    Namespace: 'AWS/CloudFront',
                    MetricName: 'BytesDownloaded',
                    Dimensions: [
                        { Name: 'DistributionId', Value: id },
                        { Name: 'Region', Value: 'Global' },
                    ],
                },
                Period: 3600,
                Stat: 'Sum',
            },
        },
    ]);

    const lambdaQueries = lambdaNames.flatMap((name, i) => [
        {
            Id: `linv${i}`,
            MetricStat: {
                Metric: {
                    Namespace: 'AWS/Lambda',
                    MetricName: 'Invocations',
                    Dimensions: [{ Name: 'FunctionName', Value: name }],
                },
                Period: 3600,
                Stat: 'Sum',
            },
        },
        {
            Id: `lerr${i}`,
            MetricStat: {
                Metric: {
                    Namespace: 'AWS/Lambda',
                    MetricName: 'Errors',
                    Dimensions: [{ Name: 'FunctionName', Value: name }],
                },
                Period: 3600,
                Stat: 'Sum',
            },
        },
        {
            Id: `ldur${i}`,
            MetricStat: {
                Metric: {
                    Namespace: 'AWS/Lambda',
                    MetricName: 'Duration',
                    Dimensions: [{ Name: 'FunctionName', Value: name }],
                },
                Period: 3600,
                Stat: 'Average',
            },
        },
    ]);

    // S3, CF, and Lambda metrics may need different regions — fetch separately
    const [s3Resp, cfResp, lambdaResp] = await Promise.all([
        queries.length > 0
            ? cw.send(new GetMetricDataCommand({ StartTime: s3Start, EndTime: now, MetricDataQueries: queries }))
            : Promise.resolve({ MetricDataResults: [] }),
        cfQueries.length > 0
            ? cwGlobal.send(new GetMetricDataCommand({ StartTime: s3Start, EndTime: now, MetricDataQueries: cfQueries }))
            : Promise.resolve({ MetricDataResults: [] }),
        lambdaQueries.length > 0
            ? cw.send(new GetMetricDataCommand({ StartTime: s3Start, EndTime: now, MetricDataQueries: lambdaQueries }))
            : Promise.resolve({ MetricDataResults: [] }),
    ]);

    const s3Latest = (id: string): number | null => {
        const result = s3Resp.MetricDataResults?.find((r) => r.Id === id);
        if (!result?.Values?.length) return null;
        return result.Values[0];
    };

    const cfLatest = (id: string): number | null => {
        const result = cfResp.MetricDataResults?.find((r) => r.Id === id);
        if (!result?.Values?.length) return null;
        return result.Values[0];
    };

    const lambdaLatest = (id: string): number | null => {
        const result = lambdaResp.MetricDataResults?.find((r) => r.Id === id);
        if (!result?.Values?.length) return null;
        return result.Values[0];
    };

    const buckets: BucketMetrics[] = bucketNames.map((name, i) => ({
        name,
        sizeBytes: s3Latest(`size${i}`) ?? 0,
        objects: s3Latest(`obj${i}`) ?? 0,
    }));

    // Sort largest first
    buckets.sort((a, b) => b.sizeBytes - a.sizeBytes);

    const distributions: DistributionMetrics[] = distIds.map((id, i) => ({
        id,
        label: distLabels.get(id) ?? id,
        consoleUrl: `https://us-east-1.console.aws.amazon.com/cloudfront/v4/home#/distributions/${id}`,
        requests: cfLatest(`cfreqs${i}`) ?? 0,
        bytesDownloaded: cfLatest(`cfbytes${i}`) ?? 0,
    }));

    // Sort most active first
    distributions.sort((a, b) => b.requests - a.requests);

    const lambdas: LambdaMetrics[] = lambdaNames.map((name, i) => ({
        name,
        consoleUrl: `https://${config.region}.console.aws.amazon.com/lambda/home?region=${config.region}#/functions/${name}`,
        invocations: lambdaLatest(`linv${i}`) ?? 0,
        errors: lambdaLatest(`lerr${i}`) ?? 0,
        avgDurationMs: Math.round(lambdaLatest(`ldur${i}`) ?? 0),
    }));

    // Sort most invoked first
    lambdas.sort((a, b) => b.invocations - a.invocations);

    return {
        buckets,
        totalSizeBytes: buckets.reduce((sum, b) => sum + b.sizeBytes, 0),
        totalObjects: buckets.reduce((sum, b) => sum + b.objects, 0),
        distributions,
        totalCfRequests: distributions.reduce((sum, d) => sum + d.requests, 0),
        totalCfBytes: distributions.reduce((sum, d) => sum + d.bytesDownloaded, 0),
        lambdas,
        totalInvocations: lambdas.reduce((sum, l) => sum + l.invocations, 0),
        totalErrors: lambdas.reduce((sum, l) => sum + l.errors, 0),
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
    const hasCf = data.distributions.length > 0;
    const hasLambda = data.lambdas.length > 0;

    if (mode === 'calm') {
        const parts: string[] = [];
        if (hasBuckets) parts.push(`S3 (${data.buckets.length}) ${formatBytes(data.totalSizeBytes)} · ${formatCount(data.totalObjects)} obj`);
        if (hasCf) parts.push(`CF (${data.distributions.length}) ${formatCount(data.totalCfRequests)} req/h`);
        if (hasLambda) {
            let lambdaPart = `λ (${data.lambdas.length}) ${formatCount(data.totalInvocations)} inv/h`;
            if (data.totalErrors > 0) lambdaPart += ` · ${formatCount(data.totalErrors)} err`;
            parts.push(lambdaPart);
        }
        if (parts.length === 0) return null;
        return (
            <Box flexDirection="column">
                {hasBuckets && (
                    <Box gap={1}>
                        <Box width={9}><Text dimColor> AWS</Text></Box>
                        <Text dimColor>S3 ({data.buckets.length} buckets) {formatBytes(data.totalSizeBytes)} · {formatCount(data.totalObjects)} obj</Text>
                    </Box>
                )}
                {hasCf && (
                    <Box gap={1}>
                        <Box width={9}><Text> </Text></Box>
                        <Text dimColor>CF ({data.distributions.length} distributions) {formatCount(data.totalCfRequests)} req/h</Text>
                    </Box>
                )}
                {hasLambda && (
                    <Box gap={1}>
                        <Box width={9}><Text> </Text></Box>
                        <Text dimColor>λ ({data.lambdas.length} functions) {formatCount(data.totalInvocations)} inv/h{data.totalErrors > 0 ? ` · ${formatCount(data.totalErrors)} err` : ''}</Text>
                    </Box>
                )}
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            {hasBuckets && (
                <>
                    <Box gap={1}>
                        <Text dimColor> S3</Text>
                        <Text color="cyan">{formatBytes(data.totalSizeBytes)}</Text>
                        <Text dimColor>·</Text>
                        <Text dimColor>{formatCount(data.totalObjects)} obj across {data.buckets.length} buckets</Text>
                    </Box>
                    {data.buckets.map((b) => (
                        <Box key={b.name} gap={1} paddingLeft={2}>
                            <Box width={28}><Text dimColor>{stripAccountId(b.name)}</Text></Box>
                            <Box width={10} justifyContent="flex-end"><Text>{formatBytes(b.sizeBytes)}</Text></Box>
                            <Text dimColor>({formatCount(b.objects)} obj)</Text>
                        </Box>
                    ))}
                </>
            )}
            {hasCf && (
                <>
                    <Box gap={1}>
                        <Text dimColor> CloudFront</Text>
                        <Text color="cyan">{formatCount(data.totalCfRequests)} req/h</Text>
                        <Text dimColor>· {formatBytes(data.totalCfBytes)} across {data.distributions.length} distributions</Text>
                    </Box>
                    {data.distributions.map((d) => (
                        <Box key={d.id} gap={1} paddingLeft={2}>
                            <Box width={28}><Text dimColor>{link(d.consoleUrl, d.label)}</Text></Box>
                            <Box width={10} justifyContent="flex-end"><Text>{formatCount(d.requests)} req/h</Text></Box>
                            <Text dimColor>({formatBytes(d.bytesDownloaded)})</Text>
                        </Box>
                    ))}
                </>
            )}
            {hasLambda && (
                <>
                    <Box gap={1}>
                        <Text dimColor> Lambda</Text>
                        <Text color="cyan">{formatCount(data.totalInvocations)} inv/h</Text>
                        {data.totalErrors > 0 && (
                            <Text color="red">· {formatCount(data.totalErrors)} errors</Text>
                        )}
                        <Text dimColor>across {data.lambdas.length} functions</Text>
                    </Box>
                    {data.lambdas.map((l) => (
                        <Box key={l.name} gap={1} paddingLeft={2}>
                            <Box width={28}><Text dimColor>{link(l.consoleUrl, l.name)}</Text></Box>
                            <Box width={10} justifyContent="flex-end"><Text>{formatCount(l.invocations)} inv/h</Text></Box>
                            <Box width={8} justifyContent="flex-end">
                                <Text dimColor>{l.avgDurationMs}ms</Text>
                            </Box>
                            {l.errors > 0 && (
                                <Text color="red">{formatCount(l.errors)} err</Text>
                            )}
                        </Box>
                    ))}
                </>
            )}
            {!hasBuckets && !hasCf && !hasLambda && <Text dimColor> Resources — No data yet</Text>}
        </Box>
    );
}
