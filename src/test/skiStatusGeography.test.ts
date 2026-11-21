import { describe, expect, it } from 'vitest';
import { administrativeBounds } from '../../shared/geography/administrativeBounds';
import { filterSkiAreas } from '../features/ski-status/browse';
import { skiAreas } from '../features/ski-status/catalog';
import { readSkiFilters, skiLocationLabels, writeSkiLocations } from '../features/ski-status/skiFilters';
import { formatSkiLocation, matchesSkiLocation, skiLocationParts } from '../features/ski-status/skiGeography';

const area = (id: string) => skiAreas.find(area => area.id === id)!;

describe('ski area geography', () => {
    it('formats locations with one or more states, provinces, and countries', () => {
        expect(formatSkiLocation(area('banff-sunshine'))).toBe('Banff, AB, Canada');
        expect(formatSkiLocation(area('heavenly'))).toBe('South Lake Tahoe, CA / NV, United States');
        expect(skiLocationParts(area('portes-du-soleil')).countries.map(place => place.label)).toEqual(['France', 'Switzerland']);
        expect(formatSkiLocation(area('hakuba-happo-one'))).toMatch(/, Japan$/);
    });

    it('matches any included place and gives exclusions priority across jurisdictions', () => {
        const places = ['mammoth-mountain', 'heavenly', 'banff-sunshine', 'hakuba-happo-one', 'portes-du-soleil'].map(area);
        const find = (include: string[], exclude: string[] = []) => filterSkiAreas(places, { locations: { include, exclude } }).map(area => area.id);
        expect(find(['region:US:CA'])).toEqual(['mammoth-mountain', 'heavenly']);
        expect(find(['country:CA'])).toEqual(['banff-sunshine']);
        expect(find(['country:JP'])).toEqual(['hakuba-happo-one']);
        expect(find(['region:US:CA', 'country:JP'], ['region:US:NV'])).toEqual(['mammoth-mountain', 'hakuba-happo-one']);
        expect(find(['country:FR'], ['country:CH'])).toEqual([]);
        expect(find([], ['continent:Europe'])).toEqual(places.slice(0, 4).map(area => area.id));
        expect(filterSkiAreas(places, { query: 'alberta banff' }).map(area => area.id)).toEqual(['banff-sunshine']);
    });

    it('offers a continent for each catalog country and resolves zoom bounds for every listed jurisdiction', () => {
        for (const [value, label] of skiLocationLabels) {
            const [kind, country, region] = value.split(':');
            if (kind !== 'continent') expect(administrativeBounds({ country, region: region && label }), value).toBeDefined();
        }
        const continents = [...skiLocationLabels.keys()].filter(value => value.startsWith('continent:'));
        expect(skiAreas.filter(area => !continents.some(continent => matchesSkiLocation(area, continent)))).toEqual([]);
    });

    it('looks up only actual entries in the country and region tables', () => {
        expect(administrativeBounds({ country: 'constructor' })).toBeUndefined();
        expect(administrativeBounds({ country: '__proto__' })).toBeUndefined();
        expect(administrativeBounds({ country: 'US', region: ' ' })).toEqual(administrativeBounds({ country: 'US' }));
    });

    it('reads legacy filters and distinguishes saved preferences from explicit shared exclusions', () => {
        const params = new URLSearchParams('region=CA&region=country:JP&region=invalid&region=region:US:CA');
        const saved = ['continent:Europe', 'bad', false, 'continent:Europe'];
        expect(readSkiFilters(params, saved)).toMatchObject({
            status: 'all', locations: { include: ['region:US:CA', 'country:JP'], exclude: ['continent:Europe'] },
        });
        writeSkiLocations(params, 'include', ['region:CA:AB', 'country:JP']);
        writeSkiLocations(params, 'exclude', ['country:AT', 'region:US:NV']);
        expect(readSkiFilters(params, saved).locations).toEqual({ include: ['region:CA:AB', 'country:JP'], exclude: ['country:AT', 'region:US:NV'] });
        writeSkiLocations(params, 'exclude', []);
        expect(readSkiFilters(params, saved).locations.exclude).toEqual([]);
        expect(readSkiFilters(new URLSearchParams(), 'continent:Europe').locations.exclude).toEqual([]);
    });
});
