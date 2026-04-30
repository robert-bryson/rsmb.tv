import { describe, expect, it } from 'vitest';
import type { ProjectConfig } from '../config.js';
import {
    buildKey,
    getBuildDisplaySections,
    getBuildProblemLabels,
    selectBuildProjects,
    uniqueBuilds,
    type BuildInfo,
} from '../buildModel.js';

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

describe('selectBuildProjects', () => {
    it('does not fetch a generic GitHub status for projects with explicit workflows', () => {
        const projects: ProjectConfig[] = [
            {
                name: 'route2gpx',
                domain: 'route2gpx.rsmb.tv',
                kind: 'amplify',
                amplifyAppId: 'amp-route2gpx',
                githubRepo: 'owner/route2gpx',
            },
            {
                name: 'rsmb.tv',
                domain: 'www.rsmb.tv',
                kind: 'amplify',
                amplifyAppId: 'amp-rsmb',
                githubRepo: 'owner/rsmb.tv',
                workflows: [{ name: 'Sync Temps', file: 'sync-temperatures.yml' }],
            },
            {
                name: 'aborg',
                domain: '',
                kind: 'github-only',
                githubRepo: 'owner/aborg',
                workflows: [{ name: 'CI', file: 'ci.yml' }],
            },
            {
                name: 'kin-cal',
                domain: '',
                kind: 'github-only',
                githubRepo: 'owner/kin-cal',
            },
        ];

        const selection = selectBuildProjects(projects);

        expect(selection.amplifyProjects.map((p) => p.name)).toEqual(['route2gpx', 'rsmb.tv']);
        expect(selection.githubProjects.map((p) => p.name)).toEqual(['route2gpx', 'kin-cal']);
        expect(selection.workflowProjects.map((p) => p.name)).toEqual(['rsmb.tv', 'aborg']);
    });
});

describe('getBuildProblemLabels', () => {
    it('includes project context for workflow failures and dedupes exact repeats', () => {
        const labels = getBuildProblemLabels([
            build({ project: 'rsmb.tv', label: 'Sync Temps', status: 'FAILURE' }),
            build({ project: 'rsmb.tv', label: 'Sync Temps', status: 'FAILED' }),
            build({ project: 'bookend', label: 'bookend', status: 'ERROR' }),
            build({ project: 'route2gpx', label: 'route2gpx', status: 'SUCCESS' }),
        ]);

        expect(labels).toEqual([
            'rsmb.tv Sync Temps build failed',
            'bookend build failed',
        ]);
    });
});

describe('uniqueBuilds', () => {
    it('keeps the first build for a source/project/label identity', () => {
        const builds = uniqueBuilds([
            build({ source: 'github', project: 'rsmb.tv', label: 'Sync Temps', id: '#39' }),
            build({ source: 'github', project: 'rsmb.tv', label: 'Sync Temps', id: '#39-duplicate' }),
            build({ source: 'amplify', project: 'rsmb.tv', label: 'rsmb.tv', id: '#187' }),
        ]);

        expect(builds.map((b) => b.id)).toEqual(['#39', '#187']);
    });
});

describe('getBuildDisplaySections', () => {
    it('keeps workflows under their project even when there is no generic main build', () => {
        const sections = getBuildDisplaySections([
            build({ source: 'github', project: 'bookend', label: 'bookend', id: '#7' }),
            build({ source: 'github', project: 'bookend', label: 'Deploy', id: '#8' }),
            build({ source: 'github', project: 'rsmb.tv', label: 'Sync Temps', id: '#39' }),
            build({ source: 'amplify', project: 'rsmb.tv', label: 'rsmb.tv', id: '#187' }),
        ]);

        const amplify = sections.find((section) => section.label === 'AWS Amplify');
        const github = sections.find((section) => section.label === 'GitHub Actions');

        expect(amplify?.mainBuilds.map((b) => b.project)).toEqual(['rsmb.tv']);
        expect(github?.mainBuilds.map((b) => b.project)).toEqual(['bookend']);
        expect(github?.workflowsByProject.get('bookend')?.map((b) => b.label)).toEqual(['Deploy']);
        expect(github?.orphanedWorkflowGroups).toHaveLength(1);
        expect(github?.orphanedWorkflowGroups[0].project).toBe('rsmb.tv');
        expect(github?.orphanedWorkflowGroups[0].workflows.map((b) => b.label)).toEqual(['Sync Temps']);

        const renderedGithubKeys = [
            ...(github?.mainBuilds ?? []).map(buildKey),
            ...(github?.mainBuilds ?? []).flatMap((b) =>
                (github?.workflowsByProject.get(b.project) ?? []).map(buildKey),
            ),
            ...(github?.orphanedWorkflowGroups ?? []).flatMap((group) => group.workflows.map(buildKey)),
        ];

        expect(new Set(renderedGithubKeys).size).toBe(renderedGithubKeys.length);
    });
});