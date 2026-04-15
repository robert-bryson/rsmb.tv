import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { Octokit } from '@octokit/rest';
import { useAwsPoll } from './useAwsPoll.js';
import type { DashboardConfig, DisplayMode } from './config.js';
import { link } from './config.js';
import { relativeTime, truncate } from './utils.js';

interface PrInfo {
    repo: string;
    number: number;
    title: string;
    author: string;
    draft: boolean;
    url: string;
    age: string;
}

interface IssueInfo {
    repo: string;
    number: number;
    title: string;
    labels: string[];
    url: string;
    age: string;
}

interface RepoError {
    repo: string;
    scope: 'PRs' | 'issues';
    message: string;
}

interface GitHubData {
    prs: PrInfo[];
    issues: IssueInfo[];
    repoErrors: RepoError[];
}

async function fetchGitHubData(config: DashboardConfig): Promise<GitHubData> {
    const octokit = config.githubToken
        ? new Octokit({ auth: config.githubToken })
        : new Octokit();

    const repos = config.githubRepos;

    const prs: PrInfo[] = [];
    const issues: IssueInfo[] = [];
    const repoErrors: RepoError[] = [];

    await Promise.all(
        repos.map(async (fullRepo) => {
            const [owner, repo] = fullRepo.split('/');

            // Fetch open PRs
            try {
                const { data } = await octokit.pulls.list({
                    owner,
                    repo,
                    state: 'open',
                    per_page: 10,
                });
                for (const pr of data) {
                    prs.push({
                        repo,
                        number: pr.number,
                        title: pr.title,
                        author: pr.user?.login ?? '?',
                        draft: pr.draft ?? false,
                        url: pr.html_url,
                        age: pr.created_at ? relativeTime(new Date(pr.created_at)) : '—',
                    });
                }
            } catch (err) {
                repoErrors.push({ repo, scope: 'PRs', message: err instanceof Error ? err.message : String(err) });
            }

            // Fetch open issues (excluding PRs)
            try {
                const { data } = await octokit.issues.listForRepo({
                    owner,
                    repo,
                    state: 'open',
                    per_page: 10,
                });
                for (const issue of data) {
                    if (issue.pull_request) continue; // skip PRs
                    issues.push({
                        repo,
                        number: issue.number,
                        title: issue.title,
                        labels: (issue.labels ?? [])
                            .map((l) => (typeof l === 'string' ? l : l.name ?? ''))
                            .filter(Boolean),
                        url: issue.html_url,
                        age: issue.created_at ? relativeTime(new Date(issue.created_at)) : '—',
                    });
                }
            } catch (err) {
                repoErrors.push({ repo, scope: 'issues', message: err instanceof Error ? err.message : String(err) });
            }
        }),
    );

    return { prs, issues, repoErrors };
}

export function GitHubPanel({
    config,
    mode,
}: {
    config: DashboardConfig;
    mode: DisplayMode;
}) {
    const { data, isLoading, isStale, error } = useAwsPoll(
        () => fetchGitHubData(config),
        config.intervals.github * 1000,
        'GitHub',
    );

    const prCount = data?.prs.length ?? 0;
    const issueCount = data?.issues.length ?? 0;
    const total = prCount + issueCount;

    // Calm mode: single summary line
    if (mode === 'calm') {
        return (
            <Box gap={1}>
                <Box width={9}><Text dimColor> GitHub</Text></Box>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : error && !data ? (
                    <Text color="red">⚠ error</Text>
                ) : total > 0 ? (
                    <Text color="yellow">
                        {prCount > 0 ? `${prCount} PR${prCount !== 1 ? 's' : ''}` : ''}
                        {prCount > 0 && issueCount > 0 ? ', ' : ''}
                        {issueCount > 0 ? `${issueCount} issue${issueCount !== 1 ? 's' : ''}` : ''}
                        {' open'}
                    </Text>
                ) : (
                    <Text dimColor>OK</Text>
                )}
                {isStale && <Text color="yellow">⚠ stale</Text>}
            </Box>
        );
    }

    // Detail mode
    return (
        <Box flexDirection="column">
            <Box gap={1}>
                <Text bold> GITHUB</Text>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : error && !data ? (
                    <Text color="red">⚠ {error}</Text>
                ) : total === 0 ? (
                    <Text dimColor>No open PRs or issues</Text>
                ) : (
                    <Text dimColor>
                        {prCount} PR{prCount !== 1 ? 's' : ''}, {issueCount} issue{issueCount !== 1 ? 's' : ''}
                    </Text>
                )}
                {isStale && <Text color="yellow">(stale)</Text>}
            </Box>

            {/* PRs */}
            {data && data.prs.length > 0 && (
                <Box flexDirection="column">
                    <Text dimColor>  Pull Requests</Text>
                    {data.prs.map((pr) => (
                        <Box key={`${pr.repo}#${pr.number}`} gap={1}>
                            <Text>    </Text>
                            <Text color={pr.draft ? 'gray' : 'yellow'}>●</Text>
                            <Text> </Text>
                            <Box width={12}>
                                <Text dimColor>{pr.repo}</Text>
                            </Box>
                            <Box width={30}>
                                <Text>{link(pr.url, truncate(pr.title, 30))}</Text>
                            </Box>
                            <Text dimColor>{pr.author}</Text>
                            <Text dimColor>{pr.age}</Text>
                            {pr.draft && <Text color="gray">(draft)</Text>}
                        </Box>
                    ))}
                </Box>
            )}

            {/* Issues */}
            {data && data.issues.length > 0 && (
                <Box flexDirection="column">
                    <Text dimColor>  Issues</Text>
                    {data.issues.map((issue) => (
                        <Box key={`${issue.repo}#${issue.number}`} gap={1}>
                            <Text>    </Text>
                            <Text color="yellow">●</Text>
                            <Text> </Text>
                            <Box width={12}>
                                <Text dimColor>{issue.repo}</Text>
                            </Box>
                            <Box width={30}>
                                <Text>{link(issue.url, truncate(issue.title, 30))}</Text>
                            </Box>
                            {issue.labels.length > 0 && (
                                <Text dimColor>[{issue.labels.join(', ')}]</Text>
                            )}
                            <Text dimColor>{issue.age}</Text>
                        </Box>
                    ))}
                </Box>
            )}

            {data && data.repoErrors.length > 0 && (
                <Box flexDirection="column">
                    <Text dimColor>  Errors</Text>
                    {data.repoErrors.map((e, i) => (
                        <Text key={i} color="red">    ⚠ {e.repo} ({e.scope}): {e.message}</Text>
                    ))}
                </Box>
            )}

            {!config.githubToken && (
                <Text dimColor>  ⚠ Set GITHUB_TOKEN for private repos</Text>
            )}
        </Box>
    );
}
