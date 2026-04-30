import {
    AmplifyClient,
    ListJobsCommand,
} from '@aws-sdk/client-amplify';
import { Octokit } from '@octokit/rest';
import type { DashboardConfig, ProjectConfig } from './config.js';
import { awsCredentials } from './config.js';
import { relativeTime } from './utils.js';
import { selectBuildProjects, uniqueBuilds, type BuildInfo } from './buildModel.js';

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

export async function fetchWorkflowRuns(
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
                branch: 'main',
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