import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'ink';
import type { DashboardConfig } from '../config.js';
import type { BuildInfo } from '../buildModel.js';

const pollState = vi.hoisted(() => ({
    data: [] as BuildInfo[],
}));

vi.mock('../useAwsPoll.js', () => ({
    useAwsPoll: () => ({
        data: pollState.data,
        isLoading: false,
        isStale: false,
        error: null,
    }),
}));

vi.mock('../buildFetchers.js', () => ({
    fetchAllBuilds: vi.fn(),
}));

const { BuildPanel } = await import('../BuildPanel.js');

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const OSC8_SEQUENCE = new RegExp(`${ESC}]8;;[^${BEL}]*${BEL}`, 'g');
const ANSI_COLOR_SEQUENCE = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');

function build(overrides: Partial<BuildInfo>): BuildInfo {
    return {
        project: 'rsmb.tv',
        label: 'rsmb.tv',
        source: 'github',
        status: 'SUCCESS',
        id: '#1',
        branch: 'main',
        time: 'now',
        url: 'https://example.com/build/1',
        createdAt: new Date('2026-04-30T00:00:00Z'),
        staleThresholdHours: undefined,
        ...overrides,
    };
}

function config(): DashboardConfig {
    return {
        profile: 'test',
        region: 'us-east-1',
        timeZone: 'America/Chicago',
        githubToken: undefined,
        projects: [],
        githubRepos: [],
        externalGroups: [],
        intervals: {
            health: 60,
            alarms: 60,
            builds: 60,
            costs: 300,
            external: 60,
            github: 120,
        },
    };
}

function visibleText(value: string): string {
    return value
        .replace(OSC8_SEQUENCE, '')
        .replace(ANSI_COLOR_SEQUENCE, '');
}

function renderBuildPanel(builds: BuildInfo[]): string {
    pollState.data = builds;

    return visibleText(renderToString(
        React.createElement(BuildPanel, {
            config: config(),
            mode: 'detail',
            onProblems: vi.fn(),
        }),
    ));
}

describe('BuildPanel summaries', () => {
    it('does not describe unknown workflow rows as passing', () => {
        const text = renderBuildPanel([
            build({ project: 'parc', label: 'CI', status: 'UNKNOWN', id: '-', time: 'no runs found' }),
        ]);

        expect(text).toContain('1 unknown');
        expect(text).not.toContain('All passing');
    });

    it('does not describe stale workflow rows as passing', () => {
        const text = renderBuildPanel([
            build({
                project: 'rsmb.tv',
                label: 'Sync Temps',
                status: 'SUCCESS',
                createdAt: new Date('2020-01-01T00:00:00Z'),
                staleThresholdHours: 36,
            }),
        ]);

        expect(text).toContain('1 stale');
        expect(text).not.toContain('All passing');
    });

    it('does not describe unclassified terminal statuses as passing', () => {
        const text = renderBuildPanel([
            build({ project: 'aborg', label: 'CI', status: 'SKIPPED', id: '#3' }),
        ]);

        expect(text).toContain('1 status warning');
        expect(text).not.toContain('All passing');
    });
});