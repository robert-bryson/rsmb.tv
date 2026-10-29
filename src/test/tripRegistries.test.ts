import { describe, expect, it, vi } from 'vitest';
import { getTripSummary } from '../features/trips/tripSummaries';
import { getTripManifestIssue, loadTripManifest, parseTripManifest } from '../features/trips/tripManifests';
import coastal from '../../tests/fixtures/trip-content/trips/coastal-test.json';

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

describe('review regressions: development animation URLs', () => {
    it('retains CDN video URLs because the still-photo processor does not prepare video', () => {
        const animation = {
            id: 'clip', src: 'https://data.rsmb.tv/trips/coastal-test/animations/clip.mp4',
            poster: 'https://data.rsmb.tv/trips/coastal-test/animations/poster.webp',
            width: 480, height: 208, alt: 'A rider crosses a forest.',
        };
        expect(parseTripManifest({ ...coastal, animations: [animation] }).animations).toEqual([animation]);
    });
});
