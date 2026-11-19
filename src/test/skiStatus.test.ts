import { describe, expect, it } from 'vitest';
import { filterSkiAreas, formatArea, formatSkiStat, readPassFilter, readSkiResultsView, readSkiSort, sortSkiAreas } from '../features/ski-status/browse';
import { readSkiCatalog, skiAreas } from '../features/ski-status/catalog';
import { markerColor, markerLegend, readMarkerMode } from '../features/ski-status/mapAppearance';

const area = {
    id: 'test-mountain', name: 'Test Mountain', country: 'US', region: 'WA', locality: 'Test Town', acres: 100,
    website: 'https://example.org/', statsUrl: 'https://example.org/stats', reportUrl: 'https://example.org/conditions',
};
const point = { id: area.id, coordinates: [-121, 47], upstream: ['https://example.org/open-data'] };
const locations = {
    source: 'https://example.org/locations.csv', buildTime: '2026-11-16T01:43:51.452Z',
    license: 'https://example.org/license', attribution: { 'Test data': 'https://example.org/data' }, locations: [point],
};
const membership = { areaId: area.id, family: 'indy', access: 'included', source: 'https://example.org/pass' };
const passes = { season: '2026/27', checkedOn: '2026-11-19', memberships: [membership] };

describe('ski-status catalog validation', () => {
    it('rejects duplicate, missing, and orphan area coordinates', () => {
        expect(() => readSkiCatalog([area, area], locations, passes)).toThrow('Duplicate ski area ID test-mountain');
        expect(() => readSkiCatalog([area], { ...locations, locations: [point, point] }, passes)).toThrow('Duplicate map point ID test-mountain');
        expect(() => readSkiCatalog([area], { ...locations, locations: [] }, passes)).toThrow('No map point for test-mountain');
        expect(() => readSkiCatalog([area], { ...locations, locations: [{ ...point, id: 'unknown' }] }, passes)).toThrow('Map point has no ski area unknown');
    });

    it('rejects missing area references and duplicate pass family rows', () => {
        expect(() => readSkiCatalog([area], locations, { ...passes, memberships: [{ ...membership, areaId: 'unknown' }] }))
            .toThrow('Pass membership has no ski area unknown');
        expect(() => readSkiCatalog([area], locations, { ...passes, memberships: [membership, { ...membership, access: 'discount' }] }))
            .toThrow('Duplicate indy membership for test-mountain');
    });

    it('applies the acreage floor unless the resort has included access', () => {
        const smallArea = { ...area, acres: 99 };
        expect(readSkiCatalog([smallArea], locations, passes).areas[0]?.id).toBe(area.id);
        expect(() => readSkiCatalog([smallArea], locations, { ...passes, memberships: [{ ...membership, access: 'discount' }] }))
            .toThrow('requires 100 skiable acres or included pass access');
        expect(readSkiCatalog([area], locations, { ...passes, memberships: [] }).areas[0]?.passes).toEqual([]);
    });

    it('retains a matched pass resort whose stats and conditions are unknown', () => {
        const unknown = { ...area, acres: undefined, statsUrl: undefined, reportUrl: undefined };
        expect(readSkiCatalog([unknown], locations, passes).areas[0]).toMatchObject({ id: area.id, passes: [membership] });
    });

    it.each([
        [{ statsUrl: undefined }, /No skiable acreage source/],
        [{ trailCountQualifier: 'lower-bound' }, /Lower bound.*reported value/],
        [{ highestLiftTerminalFt: 3_000, lowestLiftTerminalFt: 3_100 }, /Inverted lift terminal/],
        [{ nightSkiing: false, nightAcres: 20 }, /Conflicting night skiing/],
        [{ grades: { unit: 'count', values: { Expert: 0.5 } } }, /Use whole trail counts/],
        [{ grades: { unit: 'percent', values: { Expert: 101 } } }, /percentages from 0 to 100/],
        [{ reportUrl: 'https://test:example@example.org/conditions' }, /Source URLs must not contain credentials/],
        [{ reportUrl: 'http://example.org/conditions' }, /Invalid URL/],
    ])('rejects invalid area fields %j', (field, reason) => {
        expect(() => readSkiCatalog([{ ...area, ...field }], locations, passes)).toThrow(reason);
    });
});

describe('ski-status catalog and browse', () => {
    it('uses a responsive default view and honors links to each explicit view', () => {
        expect(readSkiResultsView(new URLSearchParams(), true)).toBe('split');
        expect(readSkiResultsView(new URLSearchParams('view=unknown'), false)).toBe('table');
        for (const view of ['map', 'split', 'table']) {
            const params = new URLSearchParams({ view });
            expect(readSkiResultsView(params, true)).toBe(view);
            expect(readSkiResultsView(params, false)).toBe(view);
        }
    });

    it('maps each eligible area once and keeps split base data under one resort', () => {
        expect(skiAreas.length).toBeGreaterThanOrEqual(197);
        expect(new Set(skiAreas.map(area => area.id)).size).toBe(skiAreas.length);
        expect(new Set(skiAreas.map(area => area.location.coordinates.join(','))).size).toBe(skiAreas.length);
        expect(skiAreas.every(area => (area.acres ?? 0) >= 100 || area.passes.some(pass => pass.access === 'included'))).toBe(true);
        expect(filterSkiAreas(skiAreas, 'alpine meadows', '').map(area => area.id)).toEqual(['palisades-tahoe']);
    });

    it('includes a small pass partner while excluding discount-only access from that filter', () => {
        expect(filterSkiAreas(skiAreas, 'whaleback', '', 'indy').map(area => area.id)).toEqual(['whaleback']);
        expect(filterSkiAreas(skiAreas, 'whiteface', '', 'indy')).toEqual([]);
        expect(filterSkiAreas(skiAreas, 'whiteface', '')[0]?.passes).toContainEqual(expect.objectContaining({ family: 'indy', access: 'discount' }));
        expect(filterSkiAreas(skiAreas, 'quebec le massif', 'QC', 'mountain-collective').map(area => area.id)).toEqual(['le-massif']);
        expect(filterSkiAreas(skiAreas, 'heavenly', 'NV', 'epic').map(area => area.id)).toEqual(['heavenly']);
    });

    it('finds ski areas by full country name', () => {
        const canada = filterSkiAreas(skiAreas, 'Canada', '');
        expect(canada.length).toBeGreaterThanOrEqual(30);
        expect(canada.every(area => area.country === 'CA')).toBe(true);
    });

    it('requires a known yes for night skiing and ignores invalid pass or sort parameters', () => {
        const nightAreas = filterSkiAreas(skiAreas, '', '', undefined, true);
        expect(nightAreas.length).toBeGreaterThan(0);
        expect(nightAreas.every(area => area.nightSkiing === true)).toBe(true);
        expect(readPassFilter(new URLSearchParams('pass=indy'))).toBe('indy');
        expect(readPassFilter(new URLSearchParams('pass=invalid'))).toBeUndefined();
        expect(readSkiSort(new URLSearchParams('sort=acres:desc'))).toEqual({ key: 'acres', direction: 'desc' });
    });

    it('formats lower bounds, elevations, and night availability in both unit settings', () => {
        const peak = skiAreas.find(area => area.id === 'granite-peak')!;
        expect(formatSkiStat(peak, 'name', 'metric')).toBe('Granite Peak');
        expect(formatSkiStat(peak, 'acres', 'imperial')).toBe('200+ ac');
        expect(formatSkiStat(peak, 'acres', 'metric')).toBe('80.9+ ha');
        expect(formatArea(101, 'metric', true)).toBe('40.8+ ha');
        expect(formatSkiStat({ ...peak, verticalFt: 1000 }, 'verticalFt', 'metric')).toBe('305 m');
        expect(formatSkiStat({ ...peak, nightSkiing: false }, 'nightSkiing', 'metric')).toBe('No');
    });

    it('sorts a reported zero ahead of unknown values in either direction and preserves lower bounds', () => {
        const unreported = skiAreas.find(area => area.trailCount === undefined)!;
        const reported = skiAreas.find(area => area.id === 'park-city-mountain')!;
        expect(formatSkiStat(reported, 'trailCount', 'imperial')).toBe('330+');
        const zero = { ...reported, trailCount: 0, trailCountQualifier: undefined };
        expect(formatSkiStat(zero, 'trailCount', 'imperial')).toBe('0');
        for (const direction of ['asc', 'desc'] as const) {
            expect(sortSkiAreas([unreported, zero], { key: 'trailCount', direction })).toEqual([zero, unreported]);
        }
        expect(readSkiSort(new URLSearchParams('sort=unrecognized:desc'))).toEqual({ key: 'name', direction: 'asc' });
    });
});

describe('ski-status marker colors', () => {
    it('distinguishes included passes, multiple passes, and discount-only access', () => {
        const legend = markerLegend('pass', 'imperial');
        const alta = skiAreas.find(area => area.id === 'alta')!;
        const whiteface = skiAreas.find(area => area.id === 'whiteface')!;
        const whaleback = skiAreas.find(area => area.id === 'whaleback')!;
        expect(markerColor(alta, 'pass')).toBe(legend.find(entry => entry.label === 'Multiple passes')?.color);
        expect(markerColor(whaleback, 'pass')).toBe(legend.find(entry => entry.label === 'Indy')?.color);
        expect(markerColor({ ...whiteface, passes: whiteface.passes.filter(pass => pass.access === 'discount') }, 'pass'))
            .toBe(legend.find(entry => entry.label === 'Discount only')?.color);
        expect(markerColor({ ...alta, passes: [] }, 'pass')).toBe(legend.find(entry => entry.label === 'No pass recorded')?.color);
    });

    it('uses the numeric bin at its boundary and marks unknown values separately', () => {
        const legend = markerLegend('acres', 'metric');
        const source = skiAreas[0];
        expect(legend[0]?.label).toBe('Under 101.2 ha');
        expect(markerColor({ ...source, acres: 249 }, 'acres')).toBe(legend[0]?.color);
        expect(markerColor({ ...source, acres: 250 }, 'acres')).toBe(legend[1]?.color);
        expect(markerColor({ ...source, acres: undefined }, 'acres')).toBe(legend.at(-1)?.color);
        expect(markerLegend('default', 'metric')).toEqual([]);
        expect(readMarkerMode('__proto__')).toBe('default');
    });
});
