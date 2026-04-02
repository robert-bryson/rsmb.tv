import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import {
    AmplifyClient,
    ListJobsCommand,
} from '@aws-sdk/client-amplify';
import { Octokit } from '@octokit/rest';
import { useAwsPoll } from './useAwsPoll.js';
import type { DashboardConfig, ProjectConfig, DisplayMode } from './config.js';
import { awsCredentials, link } from './config.js';

interface BuildInfo {
    project: string;
    label: string;
    source: 'amplify' | 'github';
    status: string;
    id: string;
    branch: string;
    time: string;
    url: string;
}

function relativeTime(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function statusColor(status: string): string {
    const s = status.toUpperCase();
    if (['SUCCEED', 'SUCCESS', 'COMPLETED'].includes(s)) return 'green';
    if (['FAILED', 'FAILURE', 'CANCELLED'].includes(s)) return 'red';
    if (['PENDING', 'RUNNING', 'IN_PROGRESS', 'QUEUED'].includes(s))
        return 'yellow';
    return 'gray';
}

function statusLabel(status: string): string {
    const s = status.toUpperCase();
    if (['SUCCEED', 'SUCCESS', 'COMPLETED'].includes(s)) return '✓';
    if (['FAILED', 'FAILURE', 'CANCELLED'].includes(s)) return '✗';
    if (['PENDING', 'RUNNING', 'IN_PROGRESS', 'QUEUED'].includes(s)) return '…';
    return '?';
}

function isFailure(status: string): boolean {
    const s = status.toUpperCase();
    return ['FAILED', 'FAILURE', 'CANCELLED', 'ERROR'].includes(s);
}

async function fetchAmplifyBuilds(
    client: AmplifyClient,
    project: ProjectConfig,
    region: string,
): Promise<BuildInfo | null> {
    if (!project.amplifyAppId) return null;

    try {
        const res = await client.send(
            new ListJobsCommand({
                appId: project.amplifyAppId,
                branchName: 'main',
                maxResults: 1,
            }),
        );

        const job = res.jobSummaries?.[0];
        if (!job) return null;

        return {
            project: project.name,
            label: `${project.name} (Amp)`,
            source: 'amplify',
            status: job.status ?? 'UNKNOWN',
            id: `#${job.jobId}`,
            branch: 'main',
            time: job.startTime ? relativeTime(new Date(job.startTime)) : '—',
            url: `https://${region}.console.aws.amazon.com/amplify/home#/${project.amplifyAppId}/main/${job.jobId}`,
        };
    } catch {
        return {
            project: project.name,
            label: `${project.name} (Amp)`,
            source: 'amplify',
            status: 'ERROR',
            id: '—',
            branch: 'main',
            time: 'fetch failed',
            url: `https://${region}.console.aws.amazon.com/amplify/home#/${project.amplifyAppId}`,
        };
    }
}

async function fetchGitHubBuilds(
    octokit: Octokit,
    project: ProjectConfig,
): Promise<BuildInfo | null> {
    if (!project.githubRepo) return null;

    const [owner, repo] = project.githubRepo.split('/');
    try {
        const { data } = await octokit.actions.listWorkflowRunsForRepo({
            owner,
            repo,
            branch: 'main',
            per_page: 1,
        });

        const run = data.workflow_runs[0];
        if (!run) return null;

        const status =
            run.conclusion?.toUpperCase() ?? run.status?.toUpperCase() ?? 'UNKNOWN';

        return {
            project: project.name,
            label: `${project.name} (GHA)`,
            source: 'github',
            status,
            id: `#${run.run_number}`,
            branch: run.head_branch ?? 'main',
            time: run.created_at ? relativeTime(new Date(run.created_at)) : '—',
            url: run.html_url,
        };
    } catch {
        return {
            project: project.name,
            label: `${project.name} (GHA)`,
            source: 'github',
            status: 'ERROR',
            id: '—',
            branch: 'main',
            time: 'fetch failed',
            url: `https://github.com/${project.githubRepo}/actions`,
        };
    }
}

async function fetchWorkflowRuns(
    octokit: Octokit,
    project: ProjectConfig,
): Promise<BuildInfo[]> {
    if (!project.githubRepo || !project.workflows?.length) return [];

    const [owner, repo] = project.githubRepo.split('/');
    const results: BuildInfo[] = [];

    for (const wf of project.workflows) {
        try {
            const { data } = await octokit.actions.listWorkflowRuns({
                owner,
                repo,
                workflow_id: wf.file,
                per_page: 1,
            });

            const run = data.workflow_runs[0];
            if (!run) continue;

            const status =
                run.conclusion?.toUpperCase() ?? run.status?.toUpperCase() ?? 'UNKNOWN';

            results.push({
                project: project.name,
                label: wf.name,
                source: 'github',
                status,
                id: `#${run.run_number}`,
                branch: run.head_branch ?? 'main',
                time: run.created_at ? relativeTime(new Date(run.created_at)) : '—',
                url: run.html_url,
            });
        } catch {
            results.push({
                project: project.name,
                label: wf.name,
                source: 'github',
                status: 'ERROR',
                id: '—',
                branch: 'main',
                time: 'fetch failed',
                url: `https://github.com/${project.githubRepo}/actions`,
            });
        }
    }

    return results;
}

async function fetchAllBuilds(
    config: DashboardConfig,
): Promise<BuildInfo[]> {
    const amplifyClient = new AmplifyClient({
        region: config.region,
        credentials: awsCredentials(config.profile),
    });

    const octokit = config.githubToken
        ? new Octokit({ auth: config.githubToken })
        : new Octokit();

    const amplifyProjects = config.projects.filter(
        (p) => p.kind === 'amplify' && p.amplifyAppId,
    );
    const githubProjects = config.projects.filter(
        (p) => p.githubRepo,
    );
    const workflowProjects = config.projects.filter(
        (p) => p.workflows?.length,
    );

    const [amplifyResults, githubResults, ...workflowResults] = await Promise.all([
        Promise.all(amplifyProjects.map((p) => fetchAmplifyBuilds(amplifyClient, p, config.region))),
        Promise.all(githubProjects.map((p) => fetchGitHubBuilds(octokit, p))),
        ...workflowProjects.map((p) => fetchWorkflowRuns(octokit, p)),
    ]);

    return [
        ...amplifyResults.filter((r): r is BuildInfo => r !== null),
        ...githubResults.filter((r): r is BuildInfo => r !== null),
        ...workflowResults.flat(),
    ];
}

export function BuildPanel({
    config,
    mode,
    onProblems,
}: {
    config: DashboardConfig;
    mode: DisplayMode;
    onProblems: (v: boolean) => void;
}) {
    const { data, isLoading, isStale, error } = useAwsPoll(
        () => fetchAllBuilds(config),
        config.intervals.builds * 1000,
    );

    const failures = (data ?? []).filter((b) => isFailure(b.status));
    const hasProblems = failures.length > 0;

    useEffect(() => {
        onProblems(hasProblems);
    }, [hasProblems, onProblems]);

    // Calm mode: summary dots
    if (mode === 'calm') {
        return (
            <Box gap={1}>
                <Text dimColor> Builds</Text>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : (
                    <>
                        {(data ?? []).map((b) => (
                            <Text key={`${b.label}`} color={statusColor(b.status)}>
                                {statusLabel(b.status)}
                            </Text>
                        ))}
                        {!hasProblems && <Text dimColor>All passing</Text>}
                    </>
                )}
            </Box>
        );
    }

    // Alert: show header + only failures. Detail: show all.
    const showAll = mode === 'detail';
    const items = showAll ? (data ?? []) : failures;

    return (
        <Box flexDirection="column">
            <Box gap={1}>
                <Text bold> BUILDS</Text>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : !hasProblems ? (
                    <>
                        {(data ?? []).map((b) => (
                            <Text key={`${b.label}`} color={statusColor(b.status)}>
                                {statusLabel(b.status)}
                            </Text>
                        ))}
                        <Text dimColor>All passing</Text>
                    </>
                ) : (
                    <Text color="red">
                        {failures.length} failed
                    </Text>
                )}
                {isStale && <Text color="yellow">(stale)</Text>}
            </Box>

            {error && !data && (
                <Text color="red">  Error: {error}</Text>
            )}

            {items.map((b) => (
                <Box key={`${b.label}`} gap={1}>
                    <Text>  </Text>
                    <Text color={statusColor(b.status)}>●</Text>
                    <Text> </Text>
                    <Box width={24}>
                        <Text>{b.label}</Text>
                    </Box>
                    <Box width={4}>
                        <Text color={statusColor(b.status)}>{statusLabel(b.status)}</Text>
                    </Box>
                    <Box width={8}>
                        <Text>{link(b.url, b.id)}</Text>
                    </Box>
                    <Box width={6}>
                        <Text dimColor>{b.branch}</Text>
                    </Box>
                    <Text dimColor>{b.time}</Text>
                </Box>
            ))}

            {!config.githubToken && mode === 'detail' && (
                <Text dimColor>  ⚠ Set GITHUB_TOKEN for GitHub Actions builds</Text>
            )}
        </Box>
    );
}
