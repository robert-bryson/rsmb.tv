import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseIdMap, createConfig } from '../config.js';

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
