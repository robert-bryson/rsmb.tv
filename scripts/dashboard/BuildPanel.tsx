import React, { useEffect, useMemo } from 'react';
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
import { relativeTime } from './utils.js';

interface BuildInfo {
    project: string;
    label: string;
    source: 'amplify' | 'github';
    status: string;
    id: string;
    branch: string;
    time: string;
    url: string;
    createdAt: Date | null;
    staleThresholdHours: number | undefined;
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

function isRunning(status: string): boolean {
    const s = status.toUpperCase();
    return ['PENDING', 'RUNNING', 'IN_PROGRESS', 'QUEUED'].includes(s);
}

function isStaleWorkflow(build: BuildInfo): boolean {
    if (!build.staleThresholdHours || !build.createdAt) return false;
    const ageHours = (Date.now() - build.createdAt.getTime()) / (1000 * 60 * 60);
    return ageHours > build.staleThresholdHours;
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
            label: project.name,
            source: 'amplify',
            status: job.status ?? 'UNKNOWN',
            id: `#${job.jobId}`,
            branch: 'main',
            time: job.startTime ? relativeTime(new Date(job.startTime)) : '—',
            url: `https://${region}.console.aws.amazon.com/amplify/home#/${project.amplifyAppId}/main/${job.jobId}`,
            createdAt: job.startTime ? new Date(job.startTime) : null,
            staleThresholdHours: undefined,
        };
    } catch {
        return {
            project: project.name,
            label: project.name,
            source: 'amplify',
            status: 'ERROR',
            id: '—',
            branch: 'main',
            time: 'fetch failed',
            url: `https://${region}.console.aws.amazon.com/amplify/home#/${project.amplifyAppId}`,
            createdAt: null,
            staleThresholdHours: undefined,
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
            label: project.name,
            source: 'github',
            status,
            id: `#${run.run_number}`,
            branch: run.head_branch ?? 'main',
            time: run.created_at ? relativeTime(new Date(run.created_at)) : '—',
            url: run.html_url,
            createdAt: run.created_at ? new Date(run.created_at) : null,
            staleThresholdHours: undefined,
        };
    } catch {
        return {
            project: project.name,
            label: project.name,
            source: 'github',
            status: 'ERROR',
            id: '—',
            branch: 'main',
            time: 'fetch failed',
            url: `https://github.com/${project.githubRepo}/actions`,
            createdAt: null,
            staleThresholdHours: undefined,
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
                createdAt: run.created_at ? new Date(run.created_at) : null,
                staleThresholdHours: wf.staleThresholdHours,
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
                createdAt: null,
                staleThresholdHours: wf.staleThresholdHours,
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
    onProblems: (labels: string[]) => void;
}) {
    const { data, isLoading, isStale, error } = useAwsPoll(
        () => fetchAllBuilds(config),
        config.intervals.builds * 1000,
        'Builds',
    );

    const failures = (data ?? []).filter((b) => isFailure(b.status));
    const running = (data ?? []).filter((b) => isRunning(b.status));
    const staleWorkflows = (data ?? []).filter((b) => isStaleWorkflow(b));
    const hasProblems = failures.length > 0;

    const problemLabels = useMemo(
        () => failures.map((b) => `${b.label} build failed`),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- failures is derived from data
        [data],
    );

    useEffect(() => {
        onProblems(problemLabels);
    }, [problemLabels, onProblems]);

    // Calm mode: summary dots + running builds on second line
    if (mode === 'calm') {
        return (
            <Box flexDirection="column">
                <Box gap={1}>
                    <Box width={9}><Text dimColor> Builds</Text></Box>
                    {isLoading && !data ? (
                        <Text color="cyan"><Spinner type="dots" /></Text>
                    ) : error && !data ? (
                        <Text color="red">⚠ connection error</Text>
                    ) : (
                        <>
                            <Box width={25} gap={1}>
                                {(data ?? []).map((b) => (
                                    <Text key={`${b.source}:${b.label}`} color={isStaleWorkflow(b) ? 'yellow' : statusColor(b.status)}>
                                        {isStaleWorkflow(b) ? '⚠' : statusLabel(b.status)}
                                    </Text>
                                ))}
                            </Box>
                            {hasProblems && <Text color="red">{failures.length} failed</Text>}
                            {!hasProblems && running.length === 0 && staleWorkflows.length === 0 && <Text dimColor>OK</Text>}
                            {staleWorkflows.length > 0 && !hasProblems && (
                                <Text color="yellow">{staleWorkflows.map((b) => b.label).join(', ')} stale</Text>
                            )}
                        </>
                    )}
                    {isStale && <Text color="yellow">⚠ stale</Text>}
                </Box>
                {running.map((b) => (
                    <Box key={`${b.source}:${b.label}`} gap={1}>
                        <Text>  </Text>
                        <Text color="yellow"><Spinner type="dots" /></Text>
                        <Text color="yellow"> {b.label}</Text>
                        <Text>{link(b.url, b.id)}</Text>
                        <Text dimColor>{b.time}</Text>
                    </Box>
                ))}
            </Box>
        );
    }

    // Detail: show all. Otherwise only failures.
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
                            <Text key={`${b.source}:${b.label}`} color={statusColor(b.status)}>
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

            {(() => {
                const amplifyItems = items.filter((b) => b.source === 'amplify');
                const githubItems = items.filter((b) => b.source === 'github');
                const sections: { label: string; builds: BuildInfo[] }[] = [];
                if (amplifyItems.length > 0) sections.push({ label: 'AWS Amplify', builds: amplifyItems });
                if (githubItems.length > 0) sections.push({ label: 'GitHub Actions', builds: githubItems });

                return sections.map((section) => {
                    // Group builds by project so workflows nest under their parent
                    const mainBuilds = section.builds.filter((b) => b.label === b.project);
                    const workflowsByProject = new Map<string, BuildInfo[]>();
                    for (const b of section.builds) {
                        if (b.label !== b.project) {
                            const list = workflowsByProject.get(b.project) ?? [];
                            list.push(b);
                            workflowsByProject.set(b.project, list);
                        }
                    }

                    return (
                        <Box key={section.label} flexDirection="column">
                            <Text dimColor>  {section.label}</Text>
                            {mainBuilds.map((b) => (
                                <React.Fragment key={`${b.source}:${b.label}`}>
                                    <Box gap={1}>
                                        <Text>    </Text>
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
                                    {(workflowsByProject.get(b.project) ?? []).map((wf) => (
                                        <Box key={`${wf.source}:${wf.label}`} gap={1}>
                                            <Text>      </Text>
                                            <Text color={statusColor(wf.status)}>●</Text>
                                            <Text> </Text>
                                            <Box width={22}>
                                                <Text dimColor>{wf.label}</Text>
                                            </Box>
                                            <Box width={4}>
                                                <Text color={statusColor(wf.status)}>{statusLabel(wf.status)}</Text>
                                            </Box>
                                            <Box width={8}>
                                                <Text>{link(wf.url, wf.id)}</Text>
                                            </Box>
                                            <Box width={6}>
                                                <Text dimColor>{wf.branch}</Text>
                                            </Box>
                                            <Text dimColor>{wf.time}</Text>
                                        </Box>
                                    ))}
                                </React.Fragment>
                            ))}
                        </Box>
                    );
                });
            })()}

            {!config.githubToken && mode === 'detail' && (
                <Text dimColor>  ⚠ Set GITHUB_TOKEN for GitHub Actions builds</Text>
            )}
        </Box>
    );
}
