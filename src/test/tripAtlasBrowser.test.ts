import { describe, expect, it } from 'vitest';
import type { TripAtlasEntry } from '../features/trips/atlas/tripAtlasEntries';
import {
    atlasLocations, atlasRegionKey, emptyAtlasFilters, filterAtlasEntries, readAtlasBrowse, sortAtlasEntries,
    validateAtlasFilters, writeAtlasBrowse, type AtlasFilters, type AtlasSort,
} from '../features/trips/atlas/tripAtlasBrowser';

function entry(id: string, facts: { days?: number; miles?: number; start?: string; end?: string; countries?: { code: string; regions?: string[] }[] } = {}): TripAtlasEntry {
    return {
        id, title: id, description: id, reports: [], summary: {
            id, dates: { start: facts.start ?? '2024-01-10', end: facts.end ?? '2024-01-20' },
            ridingDays: facts.days, distanceMiles: facts.miles, countries: facts.countries,
            hero: { id: 'hero', src: '/hero.webp', width: 100, height: 100, alt: 'Road' }, route: { geoJson: '/route.json' },
        },
    };
}
const entries = [
    entry('coast', { days: 3, miles: 600.1, countries: [{ code: 'CA', regions: ['British Columbia'] }] }),
    entry('mountain', { days: 7, miles: 1200, countries: [{ code: 'US', regions: ['Georgia'] }] }),
    entry('country-only', { countries: [{ code: 'CA' }] }),
    entry('georgia-country', { days: 3, miles: 600, countries: [{ code: 'GE', regions: ['Georgia'] }] }),
    { id: 'incomplete', title: 'incomplete', description: '', reports: [] } satisfies TripAtlasEntry,
];
const ids = (values: TripAtlasEntry[]) => values.map(value => value.id);
const filter = (patch: Partial<AtlasFilters>) => filterAtlasEntries(entries, { ...emptyAtlasFilters(), ...patch });

describe('atlas browsing data', () => {
    it('round-trips committed filters while preserving selection and unrelated query parameters', () => {
        const initial = new URLSearchParams('trip=coast&view=selected&other=keep&country=CA&country=CA&sort=invalid');
        const { filters, sort } = readAtlasBrowse(initial);
        expect(filters.countries).toEqual(['CA']);
        expect(sort).toBe('newest');
        const next = writeAtlasBrowse(initial, { ...filters, from: '2024-01-01', milesMax: '600.1' }, 'miles-asc');
        expect(next.get('trip')).toBe('coast');
        expect(next.get('view')).toBe('selected');
        expect(next.get('other')).toBe('keep');
        expect(next.getAll('country')).toEqual(['CA']);
        expect(readAtlasBrowse(next)).toEqual({ filters: { ...filters, from: '2024-01-01', milesMax: '600.1' }, sort: 'miles-asc' });
        const cleared = writeAtlasBrowse(next, emptyAtlasFilters(), 'newest');
        expect(cleared.toString()).toBe('trip=coast&view=selected&other=keep');
    });

    it('normalizes qualified region keys and removes selections already covered by a country wildcard', () => {
        const { filters } = readAtlasBrowse(new URLSearchParams('country=ca&region=ca/British%20Columbia&region=us/Georgia&region=US/georgia'));
        expect(filters.countries).toEqual(['CA']);
        expect(filters.regions).toEqual(['US/georgia']);
    });

    it.each([
        { from: '2024-01-20' }, { to: '2024-01-10' }, { from: '2024-01-11', to: '2024-01-12' },
    ])('matches inclusive trip-date overlap: %j', patch => {
        expect(ids(filter(patch))).toEqual(['coast', 'mountain', 'country-only', 'georgia-country']);
    });

    it('excludes trips outside a date range and never uses publication dates for incomplete summaries', () => {
        expect(filter({ from: '2024-01-21' })).toEqual([]);
        expect(filter({ to: '2024-01-09' })).toEqual([]);
        expect(ids(filter({}))).toContain('incomplete');
    });

    it('uses exact inclusive numbers and excludes unknown facts only for active dimensions', () => {
        expect(ids(filter({ daysMin: '3', daysMax: '3', milesMin: '600', milesMax: '600' }))).toEqual(['georgia-country']);
        expect(ids(filter({ milesMin: '600.1', milesMax: '600.1' }))).toEqual(['coast']);
        expect(ids(filter({}))).toContain('country-only');
        expect(ids(filter({ daysMin: '0' }))).not.toContain('country-only');
    });

    it('accepts finite decimal and exponential notation from native number controls', () => {
        expect(validateAtlasFilters({ ...emptyAtlasFilters(), milesMin: '.5', milesMax: '1e3', daysMin: '3.0' })).toEqual([]);
        expect(ids(filter({ milesMin: '.5', milesMax: '1e3', daysMin: '3.0' }))).toEqual(['coast', 'georgia-country']);
    });

    it('combines country wildcards and qualified regions with OR, including country-only trips', () => {
        expect(ids(filter({ countries: ['CA'] }))).toEqual(['coast', 'country-only']);
        expect(ids(filter({ regions: ['US/georgia'] }))).toEqual(['mountain']);
        expect(ids(filter({ countries: ['CA'], regions: ['US/georgia'] }))).toEqual(['coast', 'mountain', 'country-only']);
        expect(ids(filter({ regions: ['GE/georgia'] }))).toEqual(['georgia-country']);
        expect(ids(filter({ countries: ['CA'], daysMin: '4' }))).toEqual([]);
    });

    it('uses normalized legacy regions and retains report geography when a summary is unavailable', () => {
        const legacy = entry('legacy');
        legacy.summary!.regions = ['Wisconsin'];
        expect(atlasLocations(legacy)).toEqual([{ code: 'US', regions: ['Wisconsin'] }]);
        const incomplete = { ...entries[4], countries: [{ code: 'CA', regions: ['Ontario'] }] };
        expect(atlasLocations(incomplete)).toEqual([{ code: 'CA', regions: ['Ontario'] }]);
        expect(atlasRegionKey('CA', 'British Columbia')).toBe('CA/british-columbia');
    });

    it.each(['days-asc', 'days-desc', 'miles-asc', 'miles-desc', 'newest', 'oldest'] satisfies AtlasSort[])(
        'sorts unknown facts last in %s order without mutating the source', sort => {
            const sorted = sortAtlasEntries(entries, sort);
            expect(sorted.at(-1)?.id).toBe('incomplete');
            expect(entries[0].id).toBe('coast');
        },
    );

    it('sorts numeric facts as numbers, with deterministic ascending title ties', () => {
        expect(ids(sortAtlasEntries(entries, 'miles-asc'))).toEqual(['georgia-country', 'coast', 'mountain', 'country-only', 'incomplete']);
        expect(ids(sortAtlasEntries(entries, 'days-desc'))).toEqual(['mountain', 'coast', 'georgia-country', 'country-only', 'incomplete']);
        expect(ids(sortAtlasEntries(entries, 'location-asc'))).toEqual(['country-only', 'coast', 'georgia-country', 'mountain', 'incomplete']);
    });

    it.each([
        { from: '2024-02-30' }, { to: '2024-1-1' }, { from: '2025-01-01', to: '2024-01-01' },
        { daysMin: '-1' }, { daysMax: '1.5' }, { daysMin: '9007199254740992' }, { milesMin: 'Infinity' },
        { milesMax: '1e309' }, { milesMin: '100', milesMax: '99' }, { countries: ['INVALID'] }, { regions: ['Georgia'] },
    ])('rejects invalid ranges or geography without silently broadening the result: %j', patch => {
        const filters = { ...emptyAtlasFilters(), ...patch };
        expect(validateAtlasFilters(filters).length).toBeGreaterThan(0);
        expect(filterAtlasEntries(entries, filters)).toEqual([]);
    });
});
