import { describe, expect, it } from 'vitest';
import { createBlogRegionSearch, filterPostsByRegion, findGeographicTag, getAllBlogRegions, separatePostGeography } from '../content/blogRegions';

describe('post geography', () => {
    it('moves geographic Sheet tags into countries and preserves topical tag spelling', () => {
        expect(separatePostGeography(['Maps', 'washington', 'US', 'British Columbia', 'canada', 'california', 'st-louis'])).toEqual({
            tags: ['Maps', 'st-louis'],
            countries: [
                { code: 'US', regions: ['Washington', 'California'] },
                { code: 'CA', regions: ['British Columbia'] },
            ],
        });
    });

    it('uses manifest countries outside North America and deduplicates explicit and legacy geography', () => {
        expect(separatePostGeography(['Travel', 'japan', 'tokyo', 'oregon'], [
            { code: 'JP', regions: ['Tokyo'] }, { code: 'US', regions: ['Oregon'] },
        ], ['Oregon', ' Idaho ', 'Unassigned region'])).toEqual({
            tags: ['Travel'],
            countries: [
                { code: 'JP', regions: ['Tokyo'] },
                { code: 'US', regions: ['Oregon', 'Idaho'] },
                { code: '', regions: ['Unassigned region'] },
            ],
        });
    });

    const posts = [
        { slug: 'cross-border', countries: [
            { code: 'US', regions: ['Oregon', 'Washington', 'Oregon'] },
            { code: 'CA', regions: ['British Columbia'] },
        ] },
        { slug: 'washington', countries: [{ code: 'US', regions: ['Washington'] }] },
        { slug: 'california', countries: [{ code: 'US', regions: ['California'] }] },
        { slug: 'country-only', countries: [{ code: 'JP', regions: [] }] },
        { slug: 'writing' },
    ];

    it('counts each post once per region and sorts by frequency, then name', () => {
        expect(getAllBlogRegions(posts)).toEqual([
            { code: 'US', name: 'United States', count: 3, regions: [
                { name: 'Washington', count: 2 }, { name: 'California', count: 1 }, { name: 'Oregon', count: 1 },
            ] },
            { code: 'CA', name: 'Canada', count: 1, regions: [{ name: 'British Columbia', count: 1 }] },
            { code: 'JP', name: 'Japan', count: 1, regions: [] },
        ]);
    });

    it('filters by country, country plus region, or a historic unqualified region', () => {
        expect(filterPostsByRegion(posts, 'US').map(post => post.slug)).toEqual(['cross-border', 'washington', 'california']);
        expect(filterPostsByRegion(posts, 'CA', 'british-columbia').map(post => post.slug)).toEqual(['cross-border']);
        expect(filterPostsByRegion(posts, '', 'washington').map(post => post.slug)).toEqual(['cross-border', 'washington']);
        expect(filterPostsByRegion(posts, 'JP').map(post => post.slug)).toEqual(['country-only']);
        expect(filterPostsByRegion(posts, 'CA', 'oregon')).toEqual([]);
        expect(filterPostsByRegion(posts, '')).toBe(posts);
    });

    it('resolves bookmarked geographic tags without treating topics as places', () => {
        expect(findGeographicTag(posts, ' us ')).toEqual({ country: 'US', region: '' });
        expect(findGeographicTag(posts, 'canada')).toEqual({ country: 'CA', region: '' });
        expect(findGeographicTag(posts, 'british-columbia')).toEqual({ country: '', region: 'british-columbia' });
        expect(findGeographicTag(posts, 'Maps')).toBeUndefined();
    });
});

describe('filter review regressions: geographic aliases', () => {
    const state = { countries: [{ code: 'US', regions: ['Georgia'] }] };
    const country = { countries: [{ code: 'GE', regions: [] }] };

    it.each([[state, country], [country, state]])('resolves ambiguous names independently of post order: %j', (...posts) => {
        expect(findGeographicTag(posts, 'georgia')).toEqual({ country: '', region: 'georgia' });
        expect(findGeographicTag(posts, 'ge')).toEqual({ country: 'GE', region: '' });
    });

    it('retains country-name aliases when no region has the same name', () => {
        expect(findGeographicTag([country], 'Georgia')).toEqual({ country: 'GE', region: '' });
    });

    it('keeps retained topical tags selectable when another post has the same country or region name', () => {
        const posts = [{ tags: ['Japan', 'Georgia'] }, country, { countries: [{ code: 'JP', regions: [] }] }, state];
        expect(findGeographicTag(posts, 'Japan')).toBeUndefined();
        expect(findGeographicTag(posts, 'Georgia')).toBeUndefined();
        expect(findGeographicTag(posts, 'japan')).toEqual({ country: 'JP', region: '' });
    });

    it.each([
        ['', '', ''],
        ['CA', '', '?country=CA'],
        [' ca ', ' British  Columbia ', '?country=CA&region=british-columbia'],
        ['', 'St. John\'s & coast', '?region=st.-john%27s-%26-coast'],
    ])('creates a scoped, encoded filter for %j and %j', (country, region, expected) => {
        expect(createBlogRegionSearch(country, region)).toBe(expected);
    });

    it('deduplicates repeated country entries and normalizes region identities within one post', () => {
        expect(getAllBlogRegions([{ countries: [
            { code: 'US', regions: [' New  Mexico ', 'New Mexico'] },
            { code: 'US', regions: ['New Mexico', 'Oregon'] },
        ] }])).toEqual([{ code: 'US', name: 'United States', count: 1, regions: [
            { name: ' New  Mexico ', count: 1 }, { name: 'Oregon', count: 1 },
        ] }]);
    });
});
