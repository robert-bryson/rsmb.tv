import { describe, expect, it } from 'vitest';
import { buildTornadoTrendIndex, summarizeTornadoTrends, parseTornadoTrendIndex } from '../../shared/tornadoTrends';
import { computeAnnualSummaryFromTracks } from '../features/tornadoes/utils';
import type { TornadoTrackFeature } from '../features/tornadoes/types';

function track(year: number, state: string, scale: number, widthYards: number, lengthMiles = 1.23): TornadoTrackFeature {
    return { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-96, 38], [-95, 39]] },
        properties: { year, state, scale, widthYards, lengthMiles, deaths: 1, injuries: 2 } } as TornadoTrackFeature;
}

describe('tornado chart aggregates', () => {
    const tracks = [track(2024, 'MO', 0, 10), track(2024, 'MO', 2, 100), track(2024, 'MO', 2, 900),
        track(2024, 'KS', 2, 20), track(2024, 'KS', 2, 30), track(2024, 'KS', -1, 0), track(2025, 'MO', 3, 200)];

    it.each([
        { states: [], minScale: -1, maxScale: 5 },
        { states: ['MO'], minScale: -1, maxScale: 5 },
        { states: ['MO', 'KS'], minScale: 2, maxScale: 5 },
        { states: ['KS'], minScale: -1, maxScale: -1 },
        { states: ['AK'], minScale: 0, maxScale: 5 },
    ])('matches geometry summaries for %j, including zero years and combined width medians', filters => {
        const selected = tracks.filter(({ properties: p }) => (!filters.states.length || filters.states.includes(p.state))
            && p.scale >= filters.minScale && p.scale <= filters.maxScale);
        const index = buildTornadoTrendIndex(tracks);
        expect(summarizeTornadoTrends(index, filters, [2023, 2024, 2025]))
            .toEqual(computeAnnualSummaryFromTracks(selected, [2023, 2024, 2025]));
    });

    it('is deterministic and survives the publisher JSON round trip', () => {
        const index = buildTornadoTrendIndex(tracks);
        expect(buildTornadoTrendIndex([...tracks].reverse())).toEqual(index);
        expect(parseTornadoTrendIndex(JSON.parse(JSON.stringify(index)), computeAnnualSummaryFromTracks(tracks))).toEqual(index);
        expect(JSON.stringify(index)).not.toContain('coordinates');
    });

    it.each([null, {}, { version: 2, groups: [] }, { version: 1, groups: [{ year: 2025 }] }])('rejects unusable published aggregates: %j', value => {
        expect(() => parseTornadoTrendIndex(value, computeAnnualSummaryFromTracks(tracks))).toThrow(/tornado trend/i);
    });

    const singleTrack = [track(2025, 'MO', 2, 100)];
    const singleIndex = buildTornadoTrendIndex(singleTrack);
    const singleAnnual = computeAnnualSummaryFromTracks(singleTrack);

    it.each([
        { state: ['MO'] }, { state: null }, { state: 'mo' }, { state: 'MOO' },
        { year: 1949 }, { year: 2025.5 }, { scale: -2 }, { scale: 6 }, { scale: 2.5 },
        { count: 0 }, { count: 0.5 }, { count: Number.MAX_SAFE_INTEGER + 1 },
        { deaths: 0.5 }, { deaths: -1 }, { injuries: Infinity }, { injuries: 0.5 },
        { trackMiles: NaN }, { trackMiles: -1 }, { trackMiles: '1' },
        { widths: null }, { widths: [[100, 0]] }, { widths: [[100, 0.5]] },
        { widths: [[0, 1]] }, { widths: [[Infinity, 1]] }, { widths: [[100, 2]] },
        { widths: [[100, 1], [50, 1]] }, { widths: [[100, 1, 2]] },
    ])('rejects malformed wire fields before filtering: %j', override => {
        const value = { version: 1, groups: [{ ...singleIndex.groups[0], ...override }] };
        expect(() => parseTornadoTrendIndex(value, singleAnnual)).toThrow(/tornado trend/i);
    });

    it('rejects duplicate year/state/scale groups', () => {
        expect(() => parseTornadoTrendIndex({ version: 1, groups: [...singleIndex.groups, ...singleIndex.groups] }, singleAnnual))
            .toThrow(/tornado trend/i);
    });

    it.each(['count', 'unknown', 'ef0', 'ef1', 'ef2', 'ef3', 'ef4', 'ef5', 'ef1Plus', 'ef2Plus',
        'deaths', 'injuries', 'trackMiles', 'medianWidthYards'] as const)('rejects mismatched published %s totals', metric => {
        const incompatible = [{ ...singleAnnual[0], [metric]: singleAnnual[0][metric] + 1 }];
        expect(() => parseTornadoTrendIndex(singleIndex, incompatible)).toThrow(/annual summary/i);
    });

    it('rejects empty, partial, and newer archives instead of reporting false zero years', () => {
        expect(() => parseTornadoTrendIndex({ version: 1, groups: [] }, singleAnnual)).toThrow(/annual summary/i);
        const laterAnnual = [...singleAnnual, { ...singleAnnual[0], year: 2026 }];
        expect(() => parseTornadoTrendIndex(singleIndex, laterAnnual)).toThrow(/annual summary/i);
        expect(() => parseTornadoTrendIndex(buildTornadoTrendIndex([...singleTrack, track(2026, 'MO', 2, 100)]), singleAnnual))
            .toThrow(/annual summary/i);
    });

    it('permits real zero-record years and ignores missing/nonpositive widths', () => {
        const source = [track(2024, 'MO', -1, 0), track(2024, 'MO', -1, -2), track(2024, 'MO', 0, 25.5)];
        const annual = computeAnnualSummaryFromTracks(source, [2023, 2024]);
        const index = buildTornadoTrendIndex(source);
        expect(parseTornadoTrendIndex(index, annual)).toEqual(index);
        expect(summarizeTornadoTrends(index, {}, [2023, 2024])).toEqual(annual);
    });
});
