import { describe, expect, it } from 'vitest';
import { filterSkiAreas, formatSkiStat, readSkiSort, sortSkiAreas } from '../features/ski-status/browse';
import { skiAreas } from '../features/ski-status/catalog';

describe('ski-status pilot', () => {
    it('maps each eligible area once and keeps split base data under one resort', () => {
        expect(skiAreas).toHaveLength(25);
        expect(new Set(skiAreas.map(area => area.id)).size).toBe(skiAreas.length);
        expect(new Set(skiAreas.map(area => area.location.coordinates.join(','))).size).toBe(skiAreas.length);
        expect(skiAreas.every(area => (area.acres ?? 0) >= 100 || area.passes.some(pass => pass.access === 'included'))).toBe(true);
        expect(filterSkiAreas(skiAreas, 'alpine meadows', '').map(area => area.id)).toEqual(['palisades-tahoe']);
    });

    it('includes a small pass partner while excluding discount-only access from that filter', () => {
        expect(filterSkiAreas(skiAreas, '', '', 'indy').map(area => area.id)).toEqual(['whaleback']);
        expect(filterSkiAreas(skiAreas, 'whiteface', '')[0]?.passes).toMatchObject([{ family: 'indy', access: 'discount' }]);
        expect(filterSkiAreas(skiAreas, 'quebec le massif', 'QC', 'mountain-collective').map(area => area.id)).toEqual(['le-massif']);
        expect(filterSkiAreas(skiAreas, 'heavenly', 'NV', 'epic').map(area => area.id)).toEqual(['heavenly']);
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
