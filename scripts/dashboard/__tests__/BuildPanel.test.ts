import { describe, expect, it, vi } from 'vitest';
import type { Octokit } from '@octokit/rest';
import type { ProjectConfig } from '../config.js';
import { fetchWorkflowRuns } from '../buildFetchers.js';

describe('fetchWorkflowRuns', () => {
    it('requests configured workflow runs from main only', async () => {
        const listWorkflowRuns = vi.fn().mockResolvedValue({
            data: {
                workflow_runs: [{
                    conclusion: 'success',
                    status: 'completed',
                    run_number: 39,
                    head_branch: 'main',
                    created_at: '2026-04-30T12:00:00Z',
                    html_url: 'https://github.com/owner/repo/actions/runs/123',
                }],
            },
        });
        const octokit = { actions: { listWorkflowRuns } } as unknown as Octokit;
        const project: ProjectConfig = {
            name: 'rsmb.tv',
            domain: 'www.rsmb.tv',
            kind: 'amplify',
            githubRepo: 'owner/repo',
            workflows: [{ name: 'Sync Temps', file: 'sync-temperatures.yml', staleThresholdHours: 36 }],
        };

        const runs = await fetchWorkflowRuns(octokit, project);

        expect(listWorkflowRuns).toHaveBeenCalledWith({
            owner: 'owner',
            repo: 'repo',
            workflow_id: 'sync-temperatures.yml',
            branch: 'main',
            per_page: 1,
        });
        expect(runs).toMatchObject([{
            project: 'rsmb.tv',
            label: 'Sync Temps',
            source: 'github',
            status: 'SUCCESS',
            id: '#39',
            branch: 'main',
            url: 'https://github.com/owner/repo/actions/runs/123',
            staleThresholdHours: 36,
        }]);
    });
});