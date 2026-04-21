import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    openIncident,
    resolveIncident,
    clearIncidents,
    clearResolvedIncidents,
    _resetIncidents,
    _getIncidents,
} from '../useIncidentLog.js';

describe('incident log', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
        _resetIncidents();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('opens an incident with correct fields', () => {
        openIncident('Health', 'bookend.rsmb.tv', '0/8 checkers');

        const items = _getIncidents();
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            id: 1,
            source: 'Health',
            entity: 'bookend.rsmb.tv',
            detail: '0/8 checkers',
            resolvedAt: null,
        });
        expect(items[0].startedAt).toBeInstanceOf(Date);
    });

    it('resolves an active incident', () => {
        openIncident('Health', 'bookend.rsmb.tv', '0/8 checkers');
        vi.advanceTimersByTime(5 * 60_000); // 5 minutes later
        resolveIncident('Health', 'bookend.rsmb.tv');

        const items = _getIncidents();
        expect(items).toHaveLength(1);
        expect(items[0].resolvedAt).toBeInstanceOf(Date);
        expect(items[0].resolvedAt!.getTime() - items[0].startedAt.getTime()).toBe(5 * 60_000);
    });

    it('deduplicates active incidents by source+entity, updating detail', () => {
        openIncident('EGP', 'FLIGHT', 'DOWN');
        openIncident('EGP', 'FLIGHT', 'Major Outage');

        const items = _getIncidents();
        expect(items).toHaveLength(1);
        expect(items[0].detail).toBe('Major Outage');
    });

    it('creates a new incident after resolving the previous one', () => {
        openIncident('Health', 'bookend.rsmb.tv', 'down');
        resolveIncident('Health', 'bookend.rsmb.tv');
        openIncident('Health', 'bookend.rsmb.tv', 'down again');

        const items = _getIncidents();
        expect(items).toHaveLength(2);
        expect(items[0].resolvedAt).not.toBeNull();
        expect(items[1].resolvedAt).toBeNull();
    });

    it('does not resolve an already-resolved incident', () => {
        openIncident('Alarms', 'rsmbtv-5xx', 'ALARM');
        resolveIncident('Alarms', 'rsmbtv-5xx');

        const resolvedAt = _getIncidents()[0].resolvedAt;

        vi.advanceTimersByTime(1000);
        resolveIncident('Alarms', 'rsmbtv-5xx');

        // resolvedAt should be unchanged
        expect(_getIncidents()[0].resolvedAt).toBe(resolvedAt);
    });

    it('is a no-op when resolving a nonexistent incident', () => {
        resolveIncident('Health', 'nonexistent');
        expect(_getIncidents()).toHaveLength(0);
    });

    it('tracks separate incidents per source', () => {
        openIncident('Health', 'bookend.rsmb.tv', '0/8 checkers');
        openIncident('EGP', 'bookend.rsmb.tv', 'DOWN');

        expect(_getIncidents()).toHaveLength(2);

        resolveIncident('Health', 'bookend.rsmb.tv');

        const items = _getIncidents();
        const healthIncident = items.find((i) => i.source === 'Health');
        const egpIncident = items.find((i) => i.source === 'EGP');
        expect(healthIncident?.resolvedAt).not.toBeNull();
        expect(egpIncident?.resolvedAt).toBeNull();
    });

    it('clearIncidents removes everything', () => {
        openIncident('Health', 'a', 'down');
        openIncident('Health', 'b', 'down');
        expect(_getIncidents()).toHaveLength(2);

        clearIncidents();
        expect(_getIncidents()).toHaveLength(0);
    });

    it('clearResolvedIncidents removes only resolved incidents', () => {
        openIncident('Health', 'a', 'down');
        openIncident('Health', 'b', 'down');
        resolveIncident('Health', 'a');

        clearResolvedIncidents();

        const items = _getIncidents();
        expect(items).toHaveLength(1);
        expect(items[0].entity).toBe('b');
        expect(items[0].resolvedAt).toBeNull();
    });

    it('clearResolvedIncidents is a no-op when nothing is resolved', () => {
        openIncident('Health', 'a', 'down');
        openIncident('Health', 'b', 'down');

        clearResolvedIncidents();

        const items = _getIncidents();
        expect(items).toHaveLength(2);
        expect(items.every((i) => i.resolvedAt === null)).toBe(true);
    });

    it('prunes incidents older than 24 hours', () => {
        openIncident('Health', 'old-site', 'down');
        resolveIncident('Health', 'old-site');

        vi.advanceTimersByTime(25 * 60 * 60 * 1000);

        // Opening a new incident triggers pruning
        openIncident('Health', 'new-site', 'down');

        const items = _getIncidents();
        expect(items).toHaveLength(1);
        expect(items[0].entity).toBe('new-site');
    });

    it('assigns incrementing ids', () => {
        openIncident('A', 'x', 'd');
        openIncident('B', 'y', 'd');
        openIncident('C', 'z', 'd');

        const ids = _getIncidents().map((i) => i.id);
        expect(ids).toEqual([1, 2, 3]);
    });
});
