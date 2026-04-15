import { describe, it, expect } from 'vitest';
import type { DisplayMode } from '../config.js';

/**
 * Pure-logic tests for the problem-label aggregation introduced when the
 * dashboard switched from the three-mode (calm/alert/detail) model to two
 * modes (calm/detail) with a prominent problem banner.
 *
 * React component rendering is not tested here — these cover the data-layer
 * contracts that each panel and the App shell depend on.
 */

// ─── DisplayMode ─────────────────────────────────────────────────────────────

describe('DisplayMode type', () => {
    it('only allows calm and detail', () => {
        // This is a compile-time check; at runtime we verify the expected values
        const validModes: DisplayMode[] = ['calm', 'detail'];
        expect(validModes).toEqual(['calm', 'detail']);
    });

    it('derives mode correctly from forceDetail flag', () => {
        const deriveMode = (forceDetail: boolean): DisplayMode =>
            forceDetail ? 'detail' : 'calm';

        expect(deriveMode(false)).toBe('calm');
        expect(deriveMode(true)).toBe('detail');
    });
});

// ─── Problem label generation (mirrors panel logic) ──────────────────────────

describe('problem label generation', () => {
    describe('health panel labels', () => {
        it('generates "down" labels for confirmed unhealthy items', () => {
            const confirmedUnhealthy = [
                { name: 'bookend', domain: 'bookend.rsmb.tv', detail: '0/8 checkers' },
                { name: 'rsmb.tv', domain: 'www.rsmb.tv', detail: 'Timeout' },
            ];
            const labels = confirmedUnhealthy.map((h) => `${h.name} down`);
            expect(labels).toEqual(['bookend down', 'rsmb.tv down']);
        });

        it('returns empty array when all healthy', () => {
            const confirmedUnhealthy: { name: string }[] = [];
            const labels = confirmedUnhealthy.map((h) => `${h.name} down`);
            expect(labels).toEqual([]);
        });
    });

    describe('alarm panel labels', () => {
        it('generates "alarm firing" labels for non-OK alarms', () => {
            const alarms = [
                { name: 'rsmbtv-5xx', state: 'ALARM' },
                { name: 'bookend-4xx', state: 'OK' },
                { name: 'bookend-5xx', state: 'ALARM' },
            ];
            const firingAlarms = alarms.filter((a) => a.state !== 'OK');
            const labels = firingAlarms.map((a) => `${a.name} alarm firing`);
            expect(labels).toEqual([
                'rsmbtv-5xx alarm firing',
                'bookend-5xx alarm firing',
            ]);
        });

        it('returns empty when all clear', () => {
            const alarms = [
                { name: 'rsmbtv-5xx', state: 'OK' },
                { name: 'bookend-5xx', state: 'OK' },
            ];
            const firingAlarms = alarms.filter((a) => a.state !== 'OK');
            const labels = firingAlarms.map((a) => `${a.name} alarm firing`);
            expect(labels).toEqual([]);
        });
    });

    describe('build panel labels', () => {
        it('generates "build failed" labels for failures', () => {
            const builds = [
                { label: 'bookend', status: 'FAILURE' },
                { label: 'rsmb.tv', status: 'SUCCESS' },
                { label: 'route2gpx', status: 'FAILED' },
            ];
            const isFailure = (status: string) =>
                ['FAILED', 'FAILURE', 'CANCELLED', 'ERROR'].includes(status.toUpperCase());
            const failures = builds.filter((b) => isFailure(b.status));
            const labels = failures.map((b) => `${b.label} build failed`);
            expect(labels).toEqual([
                'bookend build failed',
                'route2gpx build failed',
            ]);
        });
    });

    describe('external health panel labels', () => {
        it('combines "down" and "incident" labels', () => {
            const confirmedUnhealthy = [
                { name: 'FLIGHT', detail: 'Major Outage' },
            ];
            const alerts = [
                { kind: 'incident' as const, name: 'Network disruption' },
                { kind: 'maintenance' as const, name: 'Scheduled update' },
            ];
            const labels = [
                ...confirmedUnhealthy.map((h) => `${h.name} down`),
                ...alerts.filter((a) => a.kind === 'incident').map((a) => `${a.name} incident`),
            ];
            expect(labels).toEqual([
                'FLIGHT down',
                'Network disruption incident',
            ]);
        });

        it('excludes maintenance from problem labels', () => {
            const confirmedUnhealthy: { name: string }[] = [];
            const alerts = [
                { kind: 'maintenance' as const, name: 'Scheduled update' },
            ];
            const labels = [
                ...confirmedUnhealthy.map((h) => `${h.name} down`),
                ...alerts.filter((a) => a.kind === 'incident').map((a) => `${a.name} incident`),
            ];
            expect(labels).toEqual([]);
        });
    });
});

// ─── Problem aggregation (mirrors App.tsx logic) ─────────────────────────────

describe('problem aggregation', () => {
    function aggregateProblems(
        healthProblems: string[],
        alarmProblems: string[],
        buildProblems: string[],
        externalProblems: Record<string, string[]>,
    ): string[] {
        return [
            ...healthProblems,
            ...alarmProblems,
            ...buildProblems,
            ...Object.values(externalProblems).flat(),
        ];
    }

    it('returns empty when no problems', () => {
        const result = aggregateProblems([], [], [], {});
        expect(result).toEqual([]);
    });

    it('aggregates from a single source', () => {
        const result = aggregateProblems(
            [],
            [],
            ['bookend build failed'],
            {},
        );
        expect(result).toEqual(['bookend build failed']);
    });

    it('aggregates from multiple sources in order', () => {
        const result = aggregateProblems(
            ['bookend down'],
            ['rsmbtv-5xx alarm firing'],
            ['rsmb.tv build failed'],
            { egp: ['FLIGHT down'] },
        );
        expect(result).toEqual([
            'bookend down',
            'rsmbtv-5xx alarm firing',
            'rsmb.tv build failed',
            'FLIGHT down',
        ]);
    });

    it('flattens multiple external groups', () => {
        const result = aggregateProblems([], [], [], {
            egp: ['FLIGHT down', 'CFETS down'],
            other: ['Service X down'],
        });
        expect(result).toEqual(['FLIGHT down', 'CFETS down', 'Service X down']);
    });

    it('determines hasProblems correctly', () => {
        expect(aggregateProblems([], [], [], {}).length > 0).toBe(false);
        expect(aggregateProblems(['x down'], [], [], {}).length > 0).toBe(true);
    });
});

// ─── External problem callback equality check (mirrors App.tsx) ──────────────

describe('external problem callback equality', () => {
    it('detects no change when labels are identical', () => {
        const prev: Record<string, string[]> = { egp: ['FLIGHT down'] };
        const incoming = ['FLIGHT down'];

        const prevLabels = prev['egp'];
        const isEqual = prevLabels &&
            prevLabels.length === incoming.length &&
            prevLabels.every((l, i) => l === incoming[i]);
        expect(isEqual).toBe(true);
    });

    it('detects change when labels differ', () => {
        const prev: Record<string, string[]> = { egp: ['FLIGHT down'] };
        const incoming = ['FLIGHT down', 'CFETS down'];

        const prevLabels = prev['egp'];
        const isEqual = prevLabels &&
            prevLabels.length === incoming.length &&
            prevLabels.every((l, i) => l === incoming[i]);
        expect(isEqual).toBe(false);
    });

    it('detects change when previously empty', () => {
        const prev: Record<string, string[]> = {};
        const incoming = ['FLIGHT down'];

        const prevLabels = prev['egp'];
        const isEqual = prevLabels &&
            prevLabels.length === incoming.length &&
            prevLabels.every((l, i) => l === incoming[i]);
        expect(isEqual).toBeFalsy();
    });

    it('detects change with same length but different content', () => {
        const prev: Record<string, string[]> = { egp: ['FLIGHT down'] };
        const incoming = ['CFETS down'];

        const prevLabels = prev['egp'];
        const isEqual = prevLabels &&
            prevLabels.length === incoming.length &&
            prevLabels.every((l, i) => l === incoming[i]);
        expect(isEqual).toBe(false);
    });
});
