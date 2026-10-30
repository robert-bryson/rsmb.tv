import { describe, expect, it, vi } from 'vitest';
import type { BlogPostMeta } from '../content/posts';
import type { TripSummary } from '../features/trips/types';
import { buildTripAtlasEntries } from '../features/trips/atlas/tripAtlasEntries';

function trip(id: string, start = '2024-05-01'): TripSummary {
    return {
        id,
        dates: { start, end: start },
        hero: { id: 'hero', src: `/photos/${id}.webp`, width: 800, height: 600, alt: 'A mountain road.' },
        route: { geoJson: `/routes/${id}.geojson`, alt: 'A motorcycle route through the mountains.' },
    };
}

function report(slug: string, tripId = 'coast', overrides: Partial<BlogPostMeta> = {}): BlogPostMeta {
    return {
        slug, tripId, format: 'trip', title: slug, description: `Description for ${slug}.`, date: '2024-05-10', tags: [],
        ...overrides,
    };
}

const draft = {
    published: false, rowNumber: 2, issues: [], contentAvailable: true,
    documentUrl: 'https://example.com/private-editorial-source',
};

describe('trip atlas content adapter', () => {
    it('includes published report-backed trips without including drafts, writing, or orphaned manifests', () => {
        const summaries = [trip('coast'), trip('draft'), trip('orphan')];
        const getSummary = vi.fn(id => summaries.find(summary => summary.id === id));
        const posts = [
            report('coastal-story'),
            report('draft-story', 'draft', { development: draft }),
            report('ordinary-post', 'orphan', { format: 'post' }),
        ];

        const entries = buildTripAtlasEntries(posts, getSummary);
        expect(entries.map(entry => entry.id)).toEqual(['coast']);
        expect(entries[0].reports).toEqual([{
            slug: 'coastal-story', title: 'coastal-story', date: '2024-05-10', href: '/trips/coastal-story', draft: false, contentAvailable: true,
        }]);
        expect(getSummary).toHaveBeenCalledTimes(1);
        expect(getSummary).toHaveBeenCalledWith('coast');
    });

    it('permits explicitly included development drafts and omits incomplete development entries', () => {
        const summaries = [trip('coast'), trip('draft')];
        const entries = buildTripAtlasEntries([
            report('coastal-story'),
            report('draft-story', 'draft', { development: draft }),
            report('missing-manifest', 'missing', { development: draft }),
            report('missing-id', undefined, { tripId: undefined, development: draft }),
        ], id => summaries.find(summary => summary.id === id), { includeDrafts: true });

        expect(entries.map(entry => entry.id)).toEqual(['coast', 'draft']);
        expect(entries[1].reports[0].draft).toBe(true);
        expect(JSON.stringify(entries)).not.toContain('private-editorial-source');
    });

    it('can retain incomplete development reports without inventing trip dates, photos, or geometry', () => {
        const getSummary = vi.fn(id => id === 'coast' ? trip('coast') : undefined);
        const entries = buildTripAtlasEntries([
            report('coastal-story'),
            report('body-pending', 'coast', { development: { ...draft, contentAvailable: false } }),
            report('missing-manifest', 'missing', { countries: [{ code: 'CA', regions: ['Ontario'] }], development: { ...draft, contentAvailable: false } }),
            report('missing-id', 'coast', { tripId: undefined, development: draft }),
            report('published-incomplete', 'incomplete'),
        ], getSummary, { includeDrafts: true, includeIncomplete: true });
        expect(entries).toHaveLength(4);
        expect(entries.find(entry => entry.id === 'coast')?.reports.find(report => report.slug === 'body-pending')?.contentAvailable).toBe(false);
        const missing = entries.find(entry => entry.id === 'missing')!;
        expect(missing.summary).toBeUndefined();
        expect(missing.countries).toEqual([{ code: 'CA', regions: ['Ontario'] }]);
        expect(missing.reports[0]).toMatchObject({ href: '/trips/missing-manifest', draft: true, contentAvailable: false });
        const noId = entries.find(entry => entry.id === 'report:missing-id')!;
        expect(noId.summary).toBeUndefined();
        expect(noId.reports[0].href).toBe('/trips/missing-id');
        expect(getSummary).not.toHaveBeenCalledWith('report:missing-id');
        expect(entries.find(entry => entry.id === 'incomplete')?.summary).toBeUndefined();
        expect(JSON.stringify(entries)).not.toContain('private-editorial-source');
    });

    it('keeps incomplete multipart reports grouped and ordered without requiring a manifest', () => {
        const entries = buildTripAtlasEntries([
            report('later-part', 'missing', { date: '2025-06-01', development: draft }),
            report('earlier-part', 'missing', { date: '2025-05-01', development: draft }),
        ], () => undefined, { includeDrafts: true, includeIncomplete: true });
        expect(entries).toHaveLength(1);
        expect(entries[0].reports.map(report => report.slug)).toEqual(['earlier-part', 'later-part']);
        expect(entries[0].summary).toBeUndefined();
        expect(buildTripAtlasEntries([report('published-missing')], () => undefined)).toEqual([]);
    });

    it('groups a multipart trip once and prioritizes explicit series order over publication dates', () => {
        const summary = trip('coast');
        summary.series = { id: 'manifest-series', title: 'Manifest title', order: 9 };
        const getSummary = vi.fn(() => summary);
        const entries = buildTripAtlasEntries([
            report('part-two', 'coast', {
                date: '2024-01-01', series: { id: 'coast-series', title: 'Coastal journey', order: 2 },
            }),
            report('part-one', 'coast', {
                date: '2024-02-01', series: { id: 'coast-series', title: 'Coastal journey', order: 1 },
            }),
        ], getSummary);

        expect(entries).toHaveLength(1);
        expect(entries[0].title).toBe('Coastal journey');
        expect(entries[0].description).toBe('Description for part-one.');
        expect(entries[0].reports.map(part => part.slug)).toEqual(['part-one', 'part-two']);
        expect(getSummary).toHaveBeenCalledTimes(1);
    });

    it('uses oldest publication first and slug ties when explicit series order is absent', () => {
        const posts = [
            report('newest', 'coast', { date: '2024-06-01' }),
            report('b-first', 'coast', { date: '2024-05-01' }),
            report('a-first', 'coast', { date: '2024-05-01' }),
        ];
        const [entry] = buildTripAtlasEntries(posts, () => trip('coast'));
        expect(entry.reports.map(part => part.slug)).toEqual(['a-first', 'b-first', 'newest']);
        expect(entry.title).toBe('a-first');
        expect(entry.description).toBe('Description for a-first.');
    });

    it('falls back to manifest series metadata when a report has no series', () => {
        const summary = { ...trip('coast'), series: { id: 'coast-series', title: 'Manifest journey', order: 1 } };
        expect(buildTripAtlasEntries([report('part-one')], () => summary)[0].title).toBe('Manifest journey');
    });

    it('orders cards by travel start date, with stable trip ID ties, independently of publication and end dates', () => {
        const summaries = [trip('older', '2024-01-01'), trip('b-newer', '2024-02-01'), trip('a-newer', '2024-02-01')];
        summaries[0].dates.end = '2024-12-31';
        const entries = buildTripAtlasEntries([
            report('older-story', 'older', { date: '2026-01-01' }),
            report('b-story', 'b-newer', { date: '2024-01-01' }),
            report('a-story', 'a-newer', { date: '2024-01-01' }),
        ], id => summaries.find(summary => summary.id === id));
        expect(entries.map(entry => entry.id)).toEqual(['a-newer', 'b-newer', 'older']);
    });

    it('retains authored facts and responsive hero sources without calculating missing trip totals', () => {
        const summary = trip('coast');
        summary.distanceMiles = 1600;
        summary.ridingDays = 5;
        summary.motorcycle = 'Honda CB500X';
        summary.countries = [{ code: 'US', regions: ['Oregon'] }];
        summary.hero.srcSet = '/hero-480.webp 480w, /hero-800.webp 800w';
        const [entry] = buildTripAtlasEntries([report('coastal-story')], () => summary);
        expect(entry.summary).toBe(summary);
        expect(entry.summary).toMatchObject({ distanceMiles: 1600, ridingDays: 5, motorcycle: 'Honda CB500X' });
        expect(entry.summary!.route.geoJson).toBe('/routes/coast.geojson');
        const [withoutFacts] = buildTripAtlasEntries([report('coastal-story')], () => trip('coast'));
        expect(withoutFacts.summary!.distanceMiles).toBeUndefined();
        expect(withoutFacts.summary!.ridingDays).toBeUndefined();
    });

    it('leaves inputs unchanged and does not access story loaders', () => {
        const posts = Object.freeze([
            { ...report('later', 'coast', { date: '2024-06-01' }), get loadComponent(): never { throw new Error('Loaded a story'); } },
            report('earlier', 'coast', { date: '2024-05-01' }),
        ]);
        const summary = trip('coast');
        const [entry] = buildTripAtlasEntries(posts, () => summary);
        expect(posts.map(post => post.slug)).toEqual(['later', 'earlier']);
        expect(entry.reports.map(part => part.slug)).toEqual(['earlier', 'later']);
        expect(entry.summary).toBe(summary);
    });

    it('returns an empty collection before content import or when no reports qualify', () => {
        expect(buildTripAtlasEntries([], () => undefined)).toEqual([]);
        expect(buildTripAtlasEntries([report('draft', 'coast', { development: draft })], () => trip('coast'))).toEqual([]);
    });
});
