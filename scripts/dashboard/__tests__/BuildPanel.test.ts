import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'ink';
import type { Octokit } from '@octokit/rest';
import type { ProjectConfig } from '../config.js';
import { fetchWorkflowRuns } from '../buildFetchers.js';
import { RunningBuildRow } from '../BuildPanel.js';
import type { BuildInfo } from '../buildModel.js';

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const OSC8_SEQUENCE = new RegExp(`${ESC}]8;;[^${BEL}]*${BEL}`, 'g');
const ANSI_COLOR_SEQUENCE = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');

function build(overrides: Partial<BuildInfo>): BuildInfo {
    return {
        project: 'bookend',
        label: 'bookend',
        source: 'github',
        status: 'RUNNING',
        id: '#1',
        branch: 'main',
        time: '1m ago',
        url: 'https://github.com/owner/repo/actions/runs/1',
        createdAt: new Date('2026-04-30T12:00:00Z'),
        staleThresholdHours: undefined,
        ...overrides,
    };
}

function visibleText(value: string): string {
    return value
        .replace(OSC8_SEQUENCE, '')
        .replace(ANSI_COLOR_SEQUENCE, '');
}

function renderRunningRow(buildInfo: BuildInfo): string {
    return visibleText(renderToString(React.createElement(RunningBuildRow, { build: buildInfo })));
}

describe('RunningBuildRow', () => {
    it('keeps build number links and timestamps aligned across label and id lengths', () => {
        const rows = [
            { id: '#347', time: '1m ago', text: renderRunningRow(build({ id: '#347', time: '1m ago' })) },
            {
                id: '#39',
                time: '8h ago',
                text: renderRunningRow(build({
                    project: 'rsmb.tv',
                    label: 'Sync Temps',
                    id: '#39',
                    time: '8h ago',
                })),
            },
        ];

        const idColumns = rows.map((row) => row.text.indexOf(row.id));
        const timeColumns = rows.map((row) => row.text.indexOf(row.time));

        expect(idColumns[0]).toBeGreaterThan(0);
        expect(timeColumns[0]).toBeGreaterThan(idColumns[0]);
        expect(idColumns[1]).toBe(idColumns[0]);
        expect(timeColumns[1]).toBe(timeColumns[0]);
    });
});

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