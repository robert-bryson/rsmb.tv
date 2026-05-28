import {
    AmplifyClient,
    ListJobsCommand,
} from '@aws-sdk/client-amplify';
import { Octokit } from '@octokit/rest';
import type { DashboardConfig, GitHubRepoRef, ProjectConfig, WorkflowConfig } from './config.js';
import { awsCredentials, parseGitHubRepo } from './config.js';
import { relativeTime } from './utils.js';
import { selectBuildProjects, uniqueBuilds, type BuildInfo } from './buildModel.js';

type ErrorLike = {
    message?: unknown;
    status?: unknown;
    response?: {
        data?: {
            message?: unknown;
        };
    };
};

function summarizeError(error: unknown): string {
    if (typeof error !== 'object' || error === null) {
        return String(error || 'unknown error');
    }

    const errorLike = error as ErrorLike;
    const message =
        typeof errorLike.response?.data?.message === 'string'
            ? errorLike.response.data.message
            : typeof errorLike.message === 'string'
                ? errorLike.message
                : 'unknown error';
    const status = typeof errorLike.status === 'number' ? errorLike.status : undefined;

    return status ? `${message} (${status})` : message;
}

function githubActionsUrl(repo: GitHubRepoRef, workflowFile?: string): string {
    const base = `https://github.com/${repo.owner}/${repo.repo}/actions`;
    return workflowFile ? `${base}/workflows/${encodeURIComponent(workflowFile)}` : base;
}

function githubConfigErrorBuild(
    project: ProjectConfig,
    label: string,
    message: string,
    staleThresholdHours: number | undefined,
): BuildInfo {
    return {
        project: project.name,
        label,
        source: 'github',
        status: 'ERROR',
        id: '—',
        branch: 'main',
        time: message,
        url: 'https://github.com',
        createdAt: null,
        staleThresholdHours,
    };
}

function githubWorkflowErrorBuild(
    project: ProjectConfig,
    repo: GitHubRepoRef,
    workflow: WorkflowConfig,
    message: string,
): BuildInfo {
    return {
        project: project.name,
        label: workflow.name.trim() || workflow.file.trim() || 'workflow',
        source: 'github',
        status: 'ERROR',
        id: '—',
        branch: 'main',
        time: message,
        url: githubActionsUrl(repo, workflow.file.trim() || undefined),
        createdAt: null,
        staleThresholdHours: workflow.staleThresholdHours,
    };
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
    } catch (error) {
        return {
            project: project.name,
            label: project.name,
            source: 'amplify',
            status: 'ERROR',
            id: '—',
            branch: 'main',
            time: `fetch failed: ${summarizeError(error)}`,
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

    const repoRef = parseGitHubRepo(project.githubRepo);
    if (!repoRef) {
        return githubConfigErrorBuild(
            project,
            project.name,
            `invalid githubRepo "${project.githubRepo}" (expected owner/repo)`,
            undefined,
        );
    }

    try {
        const { data } = await octokit.actions.listWorkflowRunsForRepo({
            owner: repoRef.owner,
            repo: repoRef.repo,
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
    } catch (error) {
        return {
            project: project.name,
            label: project.name,
            source: 'github',
            status: 'ERROR',
            id: '—',
            branch: 'main',
            time: `fetch failed: ${summarizeError(error)}`,
            url: githubActionsUrl(repoRef),
            createdAt: null,
            staleThresholdHours: undefined,
        };
    }
}

export async function fetchWorkflowRuns(
    octokit: Octokit,
    project: ProjectConfig,
): Promise<BuildInfo[]> {
    if (!project.githubRepo || !project.workflows?.length) return [];

    const repoRef = parseGitHubRepo(project.githubRepo);
    if (!repoRef) {
        return project.workflows.map((workflow) =>
            githubConfigErrorBuild(
                project,
                workflow.name.trim() || workflow.file.trim() || 'workflow',
                `invalid githubRepo "${project.githubRepo}" (expected owner/repo)`,
                workflow.staleThresholdHours,
            ),
        );
    }

    const results: BuildInfo[] = [];

    for (const wf of project.workflows) {
        const workflowFile = wf.file.trim();
        const workflowLabel = wf.name.trim() || workflowFile || 'workflow';
        if (!workflowFile) {
            results.push(githubWorkflowErrorBuild(
                project,
                repoRef,
                wf,
                'invalid workflow file (expected non-empty file name)',
            ));
            continue;
        }

        try {
            const { data } = await octokit.actions.listWorkflowRuns({
                owner: repoRef.owner,
                repo: repoRef.repo,
                workflow_id: workflowFile,
                branch: 'main',
                per_page: 1,
            });

            const run = data.workflow_runs[0];
            if (!run) {
                try {
                    await octokit.actions.getWorkflow({
                        owner: repoRef.owner,
                        repo: repoRef.repo,
                        workflow_id: workflowFile,
                    });
                } catch (error) {
                    results.push(githubWorkflowErrorBuild(
                        project,
                        repoRef,
                        wf,
                        `workflow unavailable: ${summarizeError(error)}`,
                    ));
                    continue;
                }

                results.push({
                    project: project.name,
                    label: workflowLabel,
                    source: 'github',
                    status: 'UNKNOWN',
                    id: '—',
                    branch: 'main',
                    time: 'no runs found',
                    url: githubActionsUrl(repoRef, workflowFile),
                    createdAt: null,
                    staleThresholdHours: wf.staleThresholdHours,
                });
                continue;
            }

            const status =
                run.conclusion?.toUpperCase() ?? run.status?.toUpperCase() ?? 'UNKNOWN';

            results.push({
                project: project.name,
                label: workflowLabel,
                source: 'github',
                status,
                id: `#${run.run_number}`,
                branch: run.head_branch ?? 'main',
                time: run.created_at ? relativeTime(new Date(run.created_at)) : '—',
                url: run.html_url,
                createdAt: run.created_at ? new Date(run.created_at) : null,
                staleThresholdHours: wf.staleThresholdHours,
            });
        } catch (error) {
            results.push(githubWorkflowErrorBuild(
                project,
                repoRef,
                wf,
                `fetch failed: ${summarizeError(error)}`,
            ));
        }
    }

    return results;
}

export async function fetchAllBuilds(
    config: DashboardConfig,
): Promise<BuildInfo[]> {
    const amplifyClient = new AmplifyClient({
        region: config.region,
        credentials: awsCredentials(config.profile),
    });

    const octokit = config.githubToken
        ? new Octokit({ auth: config.githubToken })
        : new Octokit();

    const { amplifyProjects, githubProjects, workflowProjects } = selectBuildProjects(config.projects);

    const [amplifyResults, githubResults, ...workflowResults] = await Promise.all([
        Promise.all(amplifyProjects.map((p) => fetchAmplifyBuilds(amplifyClient, p, config.region))),
        Promise.all(githubProjects.map((p) => fetchGitHubBuilds(octokit, p))),
        ...workflowProjects.map((p) => fetchWorkflowRuns(octokit, p)),
    ]);

    return uniqueBuilds([
        ...amplifyResults.filter((r): r is BuildInfo => r !== null),
        ...githubResults.filter((r): r is BuildInfo => r !== null),
        ...workflowResults.flat(),
    ]);
}