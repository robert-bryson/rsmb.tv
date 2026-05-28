import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConfig, getProjectConfigErrors, parseGitHubRepo, parseIdMap } from '../config.js';

describe('parseIdMap', () => {
    it('returns empty map for undefined', () => {
        const map = parseIdMap(undefined);
        expect(map.size).toBe(0);
    });

    it('returns empty map for empty string', () => {
        const map = parseIdMap('');
        expect(map.size).toBe(0);
    });

    it('parses single key=value pair', () => {
        const map = parseIdMap('rsmb.tv=abc123');
        expect(map.get('rsmb.tv')).toBe('abc123');
        expect(map.size).toBe(1);
    });

    it('parses multiple comma-separated pairs', () => {
        const map = parseIdMap('rsmb.tv=abc123,route2gpx=def456');
        expect(map.get('rsmb.tv')).toBe('abc123');
        expect(map.get('route2gpx')).toBe('def456');
        expect(map.size).toBe(2);
    });

    it('trims whitespace from keys and values', () => {
        const map = parseIdMap(' rsmb.tv = abc123 , route2gpx = def456 ');
        expect(map.get('rsmb.tv')).toBe('abc123');
        expect(map.get('route2gpx')).toBe('def456');
    });

    it('ignores malformed pairs without =', () => {
        const map = parseIdMap('rsmb.tv=abc123,badentry,route2gpx=def456');
        expect(map.size).toBe(2);
        expect(map.has('badentry')).toBe(false);
    });

    it('handles values containing = (splits on first = only)', () => {
        const map = parseIdMap('key=val=ue');
        expect(map.get('key')).toBe('val=ue');
    });
});

describe('parseGitHubRepo', () => {
    it('parses owner/repo strings', () => {
        expect(parseGitHubRepo(' robert-bryson/parc ')).toEqual({
            owner: 'robert-bryson',
            repo: 'parc',
        });
    });

    it('rejects malformed repo strings', () => {
        expect(parseGitHubRepo('parc')).toBeNull();
        expect(parseGitHubRepo('robert-bryson/parc/extra')).toBeNull();
        expect(parseGitHubRepo('robert bryson/parc')).toBeNull();
        expect(parseGitHubRepo('robert-bryson/')).toBeNull();
    });
});

describe('getProjectConfigErrors', () => {
    it('reports malformed GitHub repo and workflow config', () => {
        const errors = getProjectConfigErrors({
            name: 'broken',
            domain: '',
            kind: 'github-only',
            githubRepo: 'broken/repo/extra',
            workflows: [{ name: '', file: '' }],
        });

        expect(errors).toEqual([
            'githubRepo "broken/repo/extra" must use owner/repo format',
            'workflow name must not be empty',
            'workflow "(unnamed)" must include a file',
        ]);
    });
});

describe('createConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('uses default profile when not specified', () => {
        delete process.env.AWS_PROFILE;
        const config = createConfig({});
        expect(config.profile).toBe('rsmbtv-admin');
    });

    it('uses flag profile over env var', () => {
        process.env.AWS_PROFILE = 'env-profile';
        const config = createConfig({ profile: 'flag-profile' });
        expect(config.profile).toBe('flag-profile');
    });

    it('uses env AWS_PROFILE when no flag', () => {
        process.env.AWS_PROFILE = 'env-profile';
        const config = createConfig({});
        expect(config.profile).toBe('env-profile');
    });

    it('uses default region when not specified', () => {
        delete process.env.AWS_REGION;
        const config = createConfig({});
        expect(config.region).toBe('us-east-1');
    });

    it('enforces minimum interval floors', () => {
        const config = createConfig({ interval: 1 }); // 1 second, below all floors
        expect(config.intervals.health).toBeGreaterThanOrEqual(30);
        expect(config.intervals.alarms).toBeGreaterThanOrEqual(60);
        expect(config.intervals.builds).toBeGreaterThanOrEqual(60);
        expect(config.intervals.costs).toBeGreaterThanOrEqual(300);
        expect(config.intervals.external).toBeGreaterThanOrEqual(60);
        expect(config.intervals.github).toBeGreaterThanOrEqual(120);
    });

    it('scales intervals with multiplier when base is high', () => {
        const config = createConfig({ interval: 300 });
        // costs has multiplier 5 → 300*5=1500, which is > min 300
        expect(config.intervals.costs).toBe(1500);
        // github has multiplier 2 → 300*2=600, which is > min 120
        expect(config.intervals.github).toBe(600);
    });

    it('derives githubRepos from projects with githubRepo set', () => {
        const config = createConfig({});
        expect(config.githubRepos.length).toBeGreaterThan(0);
        for (const repo of config.githubRepos) {
            expect(repo).toMatch(/^[^/]+\/[^/]+$/);
        }
    });

    it('does not leak env-var project overrides between config instances', () => {
        process.env.AMPLIFY_APP_IDS = 'route2gpx=from-env';
        const overriddenConfig = createConfig({});
        const overriddenRoute2gpx = overriddenConfig.projects.find((project) => project.name === 'route2gpx');
        expect(overriddenRoute2gpx?.amplifyAppId).toBe('from-env');

        delete process.env.AMPLIFY_APP_IDS;
        const cleanConfig = createConfig({});
        const cleanRoute2gpx = cleanConfig.projects.find((project) => project.name === 'route2gpx');
        expect(cleanRoute2gpx?.amplifyAppId).toBeUndefined();
    });

    it('returns independent project config objects', () => {
        const firstConfig = createConfig({});
        const secondConfig = createConfig({});
        const firstParc = firstConfig.projects.find((project) => project.name === 'parc');
        const secondParc = secondConfig.projects.find((project) => project.name === 'parc');

        expect(firstParc).not.toBe(secondParc);
        expect(firstParc?.workflows?.[0]).not.toBe(secondParc?.workflows?.[0]);
    });

    it('includes the parc CI workflow in GitHub Actions monitoring', () => {
        const config = createConfig({});
        const parc = config.projects.find((project) => project.name === 'parc');

        expect(parc).toMatchObject({
            domain: '',
            kind: 'github-only',
            githubRepo: 'robert-bryson/parc',
            workflows: [{ name: 'CI', file: 'ci.yml' }],
        });
        expect(config.githubRepos).toContain('robert-bryson/parc');
    });

    it('includes external groups', () => {
        const config = createConfig({});
        expect(config.externalGroups.length).toBeGreaterThan(0);
        expect(config.externalGroups[0].id).toBe('egp');
    });

    it('respects GITHUB_TOKEN env var', () => {
        process.env.GITHUB_TOKEN = 'test-token';
        const config = createConfig({});
        expect(config.githubToken).toBe('test-token');
    });

    it('sets githubToken to undefined when not set', () => {
        delete process.env.GITHUB_TOKEN;
        const config = createConfig({});
        expect(config.githubToken).toBeUndefined();
    });
});
