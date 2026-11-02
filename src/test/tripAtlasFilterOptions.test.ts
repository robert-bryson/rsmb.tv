import { describe, expect, it } from 'vitest';
import { atlasFilterCount, emptyAtlasFilters, filterAtlasEntries } from '../features/trips/atlas/tripAtlasBrowser';
import type { TripAtlasEntry } from '../features/trips/atlas/tripAtlasEntries';
import { atlasRangeLabel, buildAtlasFilterOptions } from '../features/trips/atlas/tripAtlasFilterOptions';

function trip(id: string, year: number, days?: number, miles?: number): TripAtlasEntry {
    return { id, title: id, description: '', reports: [], summary: {
        id, dates: { start: `${year}-01-01`, end: `${year}-01-02` }, ridingDays: days, distanceMiles: miles,
        hero: { id: 'hero', src: '/hero.webp', alt: 'Road', width: 100, height: 100 }, route: { geoJson: '/route.json' },
    } };
}

describe('atlas filter choices', () => {
    it('offers only years and populated ranges from the supplied collection', () => {
        const entries = [trip('weekend', 2024, 2, 306), trip('coast', 2024, 5, 1641), trip('river', 2025, 7, 1344), trip('long', 2026, 27, 5578)];
        const choices = buildAtlasFilterOptions(entries);
        expect(choices.year.map(choice => choice.label)).toEqual(['Any year', '2026', '2025', '2024']);
        expect(choices.days.map(choice => choice.label)).toEqual(['Any number of days', '1–3 days', '4–7 days', '15+ days']);
        expect(choices.miles.map(choice => choice.label)).toEqual(['Any distance', 'Up to 500 miles', '500–1,500 miles', '1,500–3,000 miles', '5,000+ miles']);
        expect(buildAtlasFilterOptions(entries.slice(0, 2)).year.map(choice => choice.label)).toEqual(['Any year', '2024']);
    });

    it('includes crossed calendar years, deduplicates them, and ignores missing facts', () => {
        const crossing = trip('new-year', 2024);
        crossing.summary!.dates.end = '2025-01-02';
        const choices = buildAtlasFilterOptions([crossing, trip('same-year', 2025), { id: 'missing', title: '', description: '', reports: [] }]);
        expect(choices.year.map(choice => choice.label)).toEqual(['Any year', '2025', '2024']);
        expect(choices.days).toHaveLength(1);
        expect(choices.miles).toHaveLength(1);
        expect(buildAtlasFilterOptions([]).year.map(choice => choice.label)).toEqual(['Any year']);
    });

    it('uses exact inclusive bounds for presets and keeps fractional mileage at boundaries', () => {
        const entries = [trip('edge', 2024, 3, 500), trip('fraction', 2024, 4, 1499.9), trip('above', 2024, 8, 1500.1)];
        const { miles, days } = buildAtlasFilterOptions(entries);
        const range = miles.find(choice => choice.label === '500–1,500 miles')!;
        expect(filterAtlasEntries(entries, { ...emptyAtlasFilters(), milesMin: range.min, milesMax: range.max }).map(entry => entry.id)).toEqual(['edge', 'fraction']);
        const weekend = days.find(choice => choice.label === '1–3 days')!;
        expect(filterAtlasEntries(entries, { ...emptyAtlasFilters(), daysMin: weekend.min, daysMax: weekend.max }).map(entry => entry.id)).toEqual(['edge']);
    });

    it('counts a year and each numeric range once and formats precise shared ranges', () => {
        expect(atlasFilterCount({ ...emptyAtlasFilters(), from: '2024-01-01', to: '2024-12-31', daysMin: '4', daysMax: '7', milesMin: '500', milesMax: '1500' })).toBe(3);
        expect(atlasRangeLabel('miles', '600.1', '600.1')).toBe('600.1 miles');
        expect(atlasRangeLabel('year', '2024-05-11', '2024-05-19')).toBe('2024-05-11 – 2024-05-19');
    });

    it.each([
        ['2024-05-11', '', '2024-05-11 – Any'],
        ['', '2024-05-19', 'Any – 2024-05-19'],
        ['invalid-date', '2024-05-19', 'invalid-date – 2024-05-19'],
    ])('shows both shared date bounds, including open and invalid ranges', (min, max, label) => {
        expect(atlasRangeLabel('year', min, max)).toBe(label);
    });
});
