import { describe, expect, it, vi } from 'vitest';
import { getTripSummary } from '../features/trips/tripSummaries';
import { getTripManifestIssue, loadTripManifest } from '../features/trips/tripManifests';

vi.mock('virtual:trip-content', () => ({
    summaries: { coast: { id: 'coast' } },
    loaders: {},
    issues: { broken: 'Missing route' },
}));

describe('trip registry lookups', () => {
    it.each(['constructor', 'toString', '__proto__', 'missing', ''])('ignores inherited or absent entries: %s', async id => {
        expect(getTripSummary(id)).toBeUndefined();
        expect(getTripManifestIssue(id)).toBeUndefined();
        await expect(loadTripManifest(id)).resolves.toBeUndefined();
    });

    it('returns own entries and tolerates absent IDs', () => {
        expect(getTripSummary('coast')).toEqual({ id: 'coast' });
        expect(getTripManifestIssue('broken')).toBe('Missing route');
        expect(getTripSummary(undefined)).toBeUndefined();
        expect(getTripManifestIssue(undefined)).toBeUndefined();
    });
});
