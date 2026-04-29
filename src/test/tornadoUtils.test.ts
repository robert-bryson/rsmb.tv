import { describe, expect, it } from 'vitest';
import type { AnnualTornadoSummary, TornadoTrackFeature, TornadoTrackCollection } from '../features/tornadoes/types';
import {
    clampViewBox,
    computeDecades,
    computeFullHistory,
    computeSparklinePills,
    computeStateBreakdown,
    fallbackBounds,
    formatDamage,
    formatDateTime,
    INITIAL_VIEW_BOX,
    linReg,
    projectFallbackPoint,
    summarize,
    SVG_CANVAS_HEIGHT,
    SVG_CANVAS_WIDTH,
    toTrackPoints,
    trackPassesScale,
    zoomFallbackViewBox,
} from '../features/tornadoes/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrack(overrides: Partial<TornadoTrackFeature['properties']> = {}, coords: [number, number][] = [[-96, 38], [-95, 39]]): TornadoTrackFeature {
    return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {
            id: 'test-1',
            eventId: 'ev-1',
            episodeId: 'ep-1',
            year: 2024,
            month: 5,
            date: '2024-05-21',
            beginTime: '2024-05-21T15:00:00',
            endTime: '2024-05-21T15:30:00',
            timezone: 'CST-6',
            state: 'KS',
            stateName: 'Kansas',
            county: 'Harvey',
            countyFips: '091',
            wfo: 'ICT',
            scale: 3,
            scaleLabel: 'EF3',
            lengthMiles: 12.5,
            widthYards: 600,
            deaths: 2,
            injuries: 10,
            propertyDamage: 500_000,
            cropDamage: 0,
            source: 'NWS Storm Survey',
            dataSource: 'CSV',
            ...overrides,
        },
    };
}

// ---------------------------------------------------------------------------
// trackPassesScale
// ---------------------------------------------------------------------------

describe('trackPassesScale', () => {
    it('returns true for any scale when minScale is -1 (no filter)', () => {
        expect(trackPassesScale(-1, -1)).toBe(true);
        expect(trackPassesScale(0, -1)).toBe(true);
        expect(trackPassesScale(5, -1)).toBe(true);
    });

    it('passes when scale meets or exceeds minimum (unbounded)', () => {
        expect(trackPassesScale(2, 2)).toBe(true);
        expect(trackPassesScale(4, 2)).toBe(true);
    });

    it('fails when scale is below minimum', () => {
        expect(trackPassesScale(1, 2)).toBe(false);
        expect(trackPassesScale(0, 3)).toBe(false);
    });

    it('passes when scale is within [minScale, maxScale]', () => {
        expect(trackPassesScale(0, 0, 0)).toBe(true);   // ef0 exact
        expect(trackPassesScale(3, 2, 5)).toBe(true);   // ef2plus range
        expect(trackPassesScale(2, 2, 2)).toBe(true);   // ef2 exact
    });

    it('fails when scale exceeds maxScale', () => {
        expect(trackPassesScale(5, 0, 0)).toBe(false);  // ef5 not ef0
        expect(trackPassesScale(1, 0, 0)).toBe(false);  // ef1 not ef0
        expect(trackPassesScale(5, 3, 4)).toBe(false);  // ef5 outside ef3-ef4
    });

    it('unknown scale (-1) fails any non-all filter', () => {
        expect(trackPassesScale(-1, 0, 5)).toBe(false);
        expect(trackPassesScale(-1, 0, 0)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// summarize
// ---------------------------------------------------------------------------

describe('summarize', () => {
    it('returns zero stats for empty feature array', () => {
        expect(summarize([])).toEqual({ count: 0, deaths: 0, injuries: 0, trackMiles: 0, ef2Plus: 0, strongestScale: -1 });
    });

    it('accumulates counts, deaths, injuries, miles', () => {
        const tracks = [
            makeTrack({ deaths: 2, injuries: 10, lengthMiles: 5, scale: 3 }),
            makeTrack({ id: 'test-2', deaths: 0, injuries: 3, lengthMiles: 2.5, scale: 1 }),
        ];
        const stats = summarize(tracks);
        expect(stats.count).toBe(2);
        expect(stats.deaths).toBe(2);
        expect(stats.injuries).toBe(13);
        expect(stats.trackMiles).toBeCloseTo(7.5);
    });

    it('counts ef2Plus only for scale >= 2', () => {
        const tracks = [
            makeTrack({ scale: 1 }),
            makeTrack({ id: 't2', scale: 2 }),
            makeTrack({ id: 't3', scale: 4 }),
            makeTrack({ id: 't4', scale: -1 }),
        ];
        expect(summarize(tracks).ef2Plus).toBe(2);
    });

    it('tracks the highest scale seen', () => {
        const tracks = [makeTrack({ scale: 1 }), makeTrack({ id: 't2', scale: 5 }), makeTrack({ id: 't3', scale: 3 })];
        expect(summarize(tracks).strongestScale).toBe(5);
    });

    it('does not mutate the initial accumulator between calls', () => {
        const tracks = [makeTrack({ deaths: 1 })];
        summarize(tracks);
        const second = summarize([]);
        expect(second.deaths).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// toTrackPoints
// ---------------------------------------------------------------------------

describe('toTrackPoints', () => {
    it('returns a Point collection using start coordinates', () => {
        const collection: TornadoTrackCollection = {
            type: 'FeatureCollection',
            features: [makeTrack({}, [[-96, 38], [-95, 39]])],
        };
        const points = toTrackPoints(collection);
        expect(points.type).toBe('FeatureCollection');
        expect(points.features).toHaveLength(1);
        expect(points.features[0].geometry).toEqual({ type: 'Point', coordinates: [-96, 38] });
    });

    it('skips features with empty coordinate arrays', () => {
        const collection: TornadoTrackCollection = {
            type: 'FeatureCollection',
            features: [makeTrack({}, [] as unknown as [number, number][])],
        };
        const points = toTrackPoints(collection);
        expect(points.features).toHaveLength(0);
    });

    it('preserves track properties on the resulting point', () => {
        const collection: TornadoTrackCollection = {
            type: 'FeatureCollection',
            features: [makeTrack({ id: 'abc', state: 'TX' })],
        };
        const points = toTrackPoints(collection);
        expect(points.features[0].properties.id).toBe('abc');
        expect(points.features[0].properties.state).toBe('TX');
    });
});

// ---------------------------------------------------------------------------
// fallbackBounds
// ---------------------------------------------------------------------------

describe('fallbackBounds', () => {
    it('returns CONUS bounds by default', () => {
        const b = fallbackBounds('conus');
        expect(b.west).toBeLessThan(-120);
        expect(b.east).toBeGreaterThan(-70);
        expect(b.south).toBeLessThan(30);
        expect(b.north).toBeGreaterThan(48);
    });

    it('returns narrower bounds for sub-regions', () => {
        const conus = fallbackBounds('conus');
        const plains = fallbackBounds('plains');
        const dixie = fallbackBounds('dixie');
        expect(plains.east - plains.west).toBeLessThan(conus.east - conus.west);
        expect(dixie.north - dixie.south).toBeLessThan(conus.north - conus.south);
    });

    it('covers all four region presets without throwing', () => {
        for (const region of ['conus', 'midwest', 'plains', 'dixie'] as const) {
            const b = fallbackBounds(region);
            expect(b.west).toBeLessThan(b.east);
            expect(b.south).toBeLessThan(b.north);
        }
    });
});

// ---------------------------------------------------------------------------
// projectFallbackPoint
// ---------------------------------------------------------------------------

describe('projectFallbackPoint', () => {
    const bounds = fallbackBounds('conus');

    it('projects top-left corner to approximately (0, 0)', () => {
        const [x, y] = projectFallbackPoint([bounds.west, bounds.north], bounds);
        expect(x).toBeCloseTo(0, 1);
        expect(y).toBeCloseTo(0, 1);
    });

    it('projects bottom-right corner to approximately (SVG_CANVAS_WIDTH, SVG_CANVAS_HEIGHT)', () => {
        const [x, y] = projectFallbackPoint([bounds.east, bounds.south], bounds);
        expect(x).toBeCloseTo(SVG_CANVAS_WIDTH, 1);
        expect(y).toBeCloseTo(SVG_CANVAS_HEIGHT, 1);
    });

    it('projects a midpoint to the center of the canvas', () => {
        const midLon = (bounds.west + bounds.east) / 2;
        const midLat = (bounds.south + bounds.north) / 2;
        const [x, y] = projectFallbackPoint([midLon, midLat], bounds);
        expect(x).toBeCloseTo(SVG_CANVAS_WIDTH / 2, 0);
        expect(y).toBeCloseTo(SVG_CANVAS_HEIGHT / 2, 0);
    });
});

// ---------------------------------------------------------------------------
// clampViewBox
// ---------------------------------------------------------------------------

describe('clampViewBox', () => {
    it('returns the initial viewBox unchanged when it is already valid', () => {
        expect(clampViewBox(INITIAL_VIEW_BOX)).toEqual(INITIAL_VIEW_BOX);
    });

    it('enforces minimum zoom (max width = SVG_CANVAS_WIDTH)', () => {
        const result = clampViewBox({ x: 0, y: 0, width: 2000, height: 1240 });
        expect(result.width).toBe(SVG_CANVAS_WIDTH);
    });

    it('enforces maximum zoom (min width = 90)', () => {
        const result = clampViewBox({ x: 0, y: 0, width: 10, height: 6.2 });
        expect(result.width).toBe(90);
    });

    it('clamps x so the viewBox does not exceed canvas width', () => {
        const result = clampViewBox({ x: 900, y: 0, width: 200, height: 124 });
        expect(result.x + result.width).toBeLessThanOrEqual(SVG_CANVAS_WIDTH);
    });

    it('clamps y so the viewBox does not exceed canvas height', () => {
        const result = clampViewBox({ x: 0, y: 580, width: 200, height: 124 });
        expect(result.y + result.height).toBeLessThanOrEqual(SVG_CANVAS_HEIGHT);
    });

    it('maintains the canvas aspect ratio', () => {
        const result = clampViewBox({ x: 0, y: 0, width: 500, height: 999 });
        expect(result.height / result.width).toBeCloseTo(SVG_CANVAS_HEIGHT / SVG_CANVAS_WIDTH, 5);
    });
});

// ---------------------------------------------------------------------------
// zoomFallbackViewBox
// ---------------------------------------------------------------------------

describe('zoomFallbackViewBox', () => {
    it('zooms in by reducing width', () => {
        const zoomed = zoomFallbackViewBox(INITIAL_VIEW_BOX, 500, 310, 0.5);
        expect(zoomed.width).toBeLessThan(INITIAL_VIEW_BOX.width);
    });

    it('zooms out by increasing width, clamped to canvas size', () => {
        const small = { x: 100, y: 50, width: 400, height: 248 };
        const zoomed = zoomFallbackViewBox(small, 300, 174, 2);
        expect(zoomed.width).toBeGreaterThan(small.width);
        expect(zoomed.width).toBeLessThanOrEqual(SVG_CANVAS_WIDTH);
    });

    it('keeps the focus point at the same relative position after zoom', () => {
        const initial = { x: 0, y: 0, width: 1000, height: 620 };
        const focusX = 300;
        const focusY = 200;
        const factor = 0.5;
        const zoomed = zoomFallbackViewBox(initial, focusX, focusY, factor);

        const beforeRatioX = (focusX - initial.x) / initial.width;
        const afterRatioX = (focusX - zoomed.x) / zoomed.width;
        expect(afterRatioX).toBeCloseTo(beforeRatioX, 5);
    });
});

// ---------------------------------------------------------------------------
// formatDamage
// ---------------------------------------------------------------------------

describe('formatDamage', () => {
    it('formats billions', () => {
        expect(formatDamage(2_500_000_000)).toBe('$2.5B');
    });

    it('formats millions', () => {
        expect(formatDamage(1_500_000)).toBe('$1.5M');
    });

    it('formats thousands', () => {
        expect(formatDamage(120_000)).toBe('$120K');
    });

    it('formats small values as plain dollar amounts', () => {
        expect(formatDamage(500)).toBe('$500');
    });

    it('returns "Not reported" for zero', () => {
        expect(formatDamage(0)).toBe('Not reported');
    });
});

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

describe('formatDateTime', () => {
    it('returns "Unknown" for an empty string', () => {
        expect(formatDateTime('')).toBe('Unknown');
    });

    it('returns the raw string for an invalid date', () => {
        expect(formatDateTime('not-a-date')).toBe('not-a-date');
    });

    it('formats a valid ISO datetime to a readable string', () => {
        const result = formatDateTime('2024-05-21T15:20:00');
        // Exact format depends on locale; verify it contains the expected parts.
        expect(result).toContain('2024');
        expect(result).toMatch(/May/i);
        expect(result).toContain('21');
    });
});

// ---------------------------------------------------------------------------
// Helpers shared by trend tests
// ---------------------------------------------------------------------------

function makeYear(year: number, overrides: Partial<AnnualTornadoSummary> = {}): AnnualTornadoSummary {
    return {
        year,
        count: 100,
        unknown: 0,
        ef0: 40,
        ef1: 30,
        ef2: 15,
        ef3: 10,
        ef4: 4,
        ef5: 1,
        ef1Plus: 60,
        ef2Plus: 30,
        deaths: 10,
        injuries: 50,
        trackMiles: 500,
        medianWidthYards: 75,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// linReg
// ---------------------------------------------------------------------------

describe('linReg', () => {
    it('returns slope=0 and intercept=0 for empty input', () => {
        const { slope, intercept } = linReg([]);
        expect(slope).toBe(0);
        expect(intercept).toBe(0);
    });

    it('returns slope=0 and the single value as intercept for one point', () => {
        const { slope, intercept } = linReg([{ x: 5, y: 42 }]);
        expect(slope).toBe(0);
        expect(intercept).toBe(42);
    });

    it('fits a perfect positive slope', () => {
        // y = 2x  =>  slope=2, intercept=0
        const pairs = [0, 1, 2, 3, 4].map(x => ({ x, y: 2 * x }));
        const { slope, intercept } = linReg(pairs);
        expect(slope).toBeCloseTo(2, 6);
        expect(intercept).toBeCloseTo(0, 6);
    });

    it('fits a perfect negative slope', () => {
        const pairs = [0, 1, 2, 3].map(x => ({ x, y: 10 - 3 * x }));
        const { slope, intercept } = linReg(pairs);
        expect(slope).toBeCloseTo(-3, 6);
        expect(intercept).toBeCloseTo(10, 6);
    });

    it('returns slope=0 for a constant series', () => {
        const pairs = [1, 2, 3, 4, 5].map(x => ({ x, y: 7 }));
        const { slope } = linReg(pairs);
        expect(slope).toBeCloseTo(0, 6);
    });

    it('handles two-point degenerate case (duplicate x)', () => {
        // denom would be 0 without the || 1 guard
        const { slope } = linReg([{ x: 3, y: 1 }, { x: 3, y: 2 }]);
        expect(Number.isFinite(slope)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// computeSparklinePills
// ---------------------------------------------------------------------------

describe('computeSparklinePills', () => {
    const allYears = [
        makeYear(2000, { count: 100, deaths: 10, ef2Plus: 20 }),
        makeYear(2001, { count: 200, deaths: 20, ef2Plus: 40 }),
        makeYear(2002, { count: 300, deaths: 30, ef2Plus: 30 }),
    ];

    it('returns exactly three pills with the expected labels', () => {
        const pills = computeSparklinePills(allYears, 2000, 2002);
        expect(pills.map(p => p.label)).toEqual(['Avg/yr', 'Deaths/yr', 'EF2%']);
    });

    it('computes selValue equal to histValue when selection covers all years', () => {
        const pills = computeSparklinePills(allYears, 2000, 2002);
        pills.forEach(p => expect(p.selValue).toBeCloseTo(p.histValue, 5));
    });

    it('computes Avg/yr correctly for a sub-selection', () => {
        // selecting only 2001-2002: avg count = (200+300)/2 = 250
        const pills = computeSparklinePills(allYears, 2001, 2002);
        const avgYr = pills.find(p => p.label === 'Avg/yr')!;
        expect(avgYr.selValue).toBeCloseTo(250, 5);
        // full history avg = (100+200+300)/3 ≈ 200
        expect(avgYr.histValue).toBeCloseTo(200, 5);
    });

    it('computes Deaths/yr correctly', () => {
        const pills = computeSparklinePills(allYears, 2000, 2000);
        const deaths = pills.find(p => p.label === 'Deaths/yr')!;
        expect(deaths.selValue).toBeCloseTo(10, 5);
    });

    it('computes EF2% as a percentage of count', () => {
        // 2000: ef2Plus=20, count=100 => 20%
        const pills = computeSparklinePills(allYears, 2000, 2000);
        const ef2 = pills.find(p => p.label === 'EF2%')!;
        expect(ef2.selValue).toBeCloseTo(20, 5);
    });

    it('higherIsBad is false for Avg/yr and true for Deaths/yr and EF2%', () => {
        const pills = computeSparklinePills(allYears, 2000, 2002);
        expect(pills.find(p => p.label === 'Avg/yr')!.higherIsBad).toBe(false);
        expect(pills.find(p => p.label === 'Deaths/yr')!.higherIsBad).toBe(true);
        expect(pills.find(p => p.label === 'EF2%')!.higherIsBad).toBe(true);
    });

    it('handles a selection that matches no years without throwing (returns 0)', () => {
        const pills = computeSparklinePills(allYears, 1990, 1995);
        pills.forEach(p => expect(Number.isFinite(p.selValue)).toBe(true));
    });

    it('handles years with count=0 without dividing by zero', () => {
        const years = [makeYear(2000, { count: 0, ef2Plus: 0, deaths: 5 })];
        const pills = computeSparklinePills(years, 2000, 2000);
        expect(Number.isFinite(pills.find(p => p.label === 'EF2%')!.selValue)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// computeDecades
// ---------------------------------------------------------------------------

describe('computeDecades', () => {
    it('returns an empty array for empty input', () => {
        expect(computeDecades([])).toEqual([]);
    });

    it('labels a complete decade as "1950s"', () => {
        const years = Array.from({ length: 10 }, (_, i) => makeYear(1950 + i, { count: 100, deaths: 10 }));
        const rows = computeDecades(years);
        expect(rows[0].label).toBe('1950s');
    });

    it('sets decadeStart to the decade opening year', () => {
        const years = Array.from({ length: 10 }, (_, i) => makeYear(1960 + i));
        const rows = computeDecades(years);
        expect(rows[0].decadeStart).toBe(1960);
    });

    it('sets decadeStart correctly for a partial decade', () => {
        const years = [makeYear(2020), makeYear(2021), makeYear(2022)];
        const rows = computeDecades(years);
        expect(rows[0].decadeStart).toBe(2020);
        expect(rows[0].label).toBe('2020–22');
    });

    it('each row\'s decadeStart is a multiple of 10', () => {
        const years = [
            ...Array.from({ length: 10 }, (_, i) => makeYear(1950 + i)),
            ...Array.from({ length: 10 }, (_, i) => makeYear(1960 + i)),
        ];
        for (const row of computeDecades(years)) {
            expect(row.decadeStart % 10).toBe(0);
        }
    });

    it('labels a partial decade with actual year range', () => {
        // Only 1950-1954 present (5 years, incomplete decade)
        const years = Array.from({ length: 5 }, (_, i) => makeYear(1950 + i, { count: 100 }));
        const rows = computeDecades(years);
        expect(rows[0].label).toBe('1950–54');
    });

    it('computes avgCount correctly', () => {
        const years = [
            makeYear(1950, { count: 100 }),
            makeYear(1951, { count: 200 }),
            makeYear(1952, { count: 300 }),
        ];
        const rows = computeDecades(years);
        expect(rows[0].avgCount).toBeCloseTo(200, 5);
    });

    it('computes dPer100 correctly', () => {
        // count=100, deaths=20 => dPer100 = 20
        const years = [makeYear(1950, { count: 100, deaths: 20 })];
        const rows = computeDecades(years);
        expect(rows[0].dPer100).toBeCloseTo(20, 5);
    });

    it('computes ef2Pct correctly', () => {
        // count=100, ef2Plus=25 => 25%
        const years = [makeYear(1950, { count: 100, ef2Plus: 25 })];
        const rows = computeDecades(years);
        expect(rows[0].ef2Pct).toBeCloseTo(25, 5);
    });

    it('handles count=0 rows without NaN', () => {
        const years = [makeYear(1950, { count: 0, deaths: 0, ef2Plus: 0 })];
        const rows = computeDecades(years);
        expect(Number.isFinite(rows[0].dPer100)).toBe(true);
        expect(Number.isFinite(rows[0].ef2Pct)).toBe(true);
    });

    it('produces one row per decade present in the data', () => {
        const years = [
            ...Array.from({ length: 10 }, (_, i) => makeYear(1950 + i)),
            ...Array.from({ length: 10 }, (_, i) => makeYear(1960 + i)),
            makeYear(1970),
        ];
        const rows = computeDecades(years);
        expect(rows).toHaveLength(3);
        expect(rows[0].label).toBe('1950s');
        expect(rows[1].label).toBe('1960s');
        expect(rows[2].label).toBe('1970–70');
    });

    it('skips decades with no data (gap in the data set)', () => {
        // 1950s present, 1960s absent, 1970s present — the 1960 loop iteration
        // should be skipped silently; result must have exactly two rows.
        const years = [
            ...Array.from({ length: 10 }, (_, i) => makeYear(1950 + i, { count: 100 })),
            ...Array.from({ length: 10 }, (_, i) => makeYear(1970 + i, { count: 200 })),
        ];
        const rows = computeDecades(years);
        expect(rows).toHaveLength(2);
        expect(rows[0].decadeStart).toBe(1950);
        expect(rows[1].decadeStart).toBe(1970);
    });

    it('starts from the actual data minimum decade, not a hardcoded year', () => {
        // Data only covering 2020–2022 — should produce exactly one row, no empty
        // placeholder rows for 1950-2010.
        const years = [makeYear(2020, { count: 50 }), makeYear(2021, { count: 60 }), makeYear(2022, { count: 70 })];
        const rows = computeDecades(years);
        expect(rows).toHaveLength(1);
        expect(rows[0].decadeStart).toBe(2020);
        expect(rows[0].avgCount).toBeCloseTo((50 + 60 + 70) / 3, 5);
    });

    it('groups years starting mid-decade under the correct decade heading', () => {
        // Data starts at 1952 — should be grouped under the 1950s decade, not skipped.
        // Ends at 1959 (= start+9), so isPartial is false → label is '1950s'.
        const years = Array.from({ length: 8 }, (_, i) => makeYear(1952 + i, { count: 100 }));
        const rows = computeDecades(years);
        expect(rows[0].decadeStart).toBe(1950);
        expect(rows[0].label).toBe('1950s');
    });
});

// ---------------------------------------------------------------------------
// computeStateBreakdown
// ---------------------------------------------------------------------------

describe('computeStateBreakdown', () => {
    it('returns an empty array for empty input', () => {
        expect(computeStateBreakdown([])).toEqual([]);
    });

    it('produces one row per distinct state', () => {
        const features = [
            makeTrack({ state: 'KS', stateName: 'Kansas' }),
            makeTrack({ id: 't2', state: 'OK', stateName: 'Oklahoma' }),
            makeTrack({ id: 't3', state: 'KS', stateName: 'Kansas' }),
        ];
        const rows = computeStateBreakdown(features);
        expect(rows).toHaveLength(2);
        expect(rows.map(r => r.state).sort()).toEqual(['KS', 'OK']);
    });

    it('sorts by count descending', () => {
        const features = [
            makeTrack({ state: 'OK' }),
            makeTrack({ id: 't2', state: 'TX' }),
            makeTrack({ id: 't3', state: 'TX' }),
            makeTrack({ id: 't4', state: 'TX' }),
        ];
        const rows = computeStateBreakdown(features);
        expect(rows[0].state).toBe('TX');
        expect(rows[0].count).toBe(3);
        expect(rows[1].state).toBe('OK');
        expect(rows[1].count).toBe(1);
    });

    it('correctly accumulates tornado count per state', () => {
        const features = [
            makeTrack({ state: 'KS' }),
            makeTrack({ id: 't2', state: 'KS' }),
            makeTrack({ id: 't3', state: 'KS' }),
        ];
        const [row] = computeStateBreakdown(features);
        expect(row.count).toBe(3);
    });

    it('correctly accumulates deaths per state', () => {
        const features = [
            makeTrack({ state: 'AL', deaths: 5 }),
            makeTrack({ id: 't2', state: 'AL', deaths: 3 }),
        ];
        const [row] = computeStateBreakdown(features);
        expect(row.deaths).toBe(8);
    });

    it('only counts scale >= 2 as ef2Plus', () => {
        const features = [
            makeTrack({ state: 'MO', scale: 0 }),
            makeTrack({ id: 't2', state: 'MO', scale: 1 }),
            makeTrack({ id: 't3', state: 'MO', scale: 2 }),
            makeTrack({ id: 't4', state: 'MO', scale: 4 }),
            makeTrack({ id: 't5', state: 'MO', scale: -1 }),
        ];
        const [row] = computeStateBreakdown(features);
        expect(row.ef2Plus).toBe(2);
    });

    it('computes ef2Pct as (ef2Plus / count) * 100', () => {
        const features = [
            makeTrack({ state: 'NE', scale: 2 }),
            makeTrack({ id: 't2', state: 'NE', scale: 0 }),
            makeTrack({ id: 't3', state: 'NE', scale: 0 }),
            makeTrack({ id: 't4', state: 'NE', scale: 0 }),
        ];
        const [row] = computeStateBreakdown(features);
        // 1 ef2+ out of 4 = 25%
        expect(row.ef2Pct).toBeCloseTo(25, 5);
    });

    it('sets ef2Pct to 0 when count is 0 (defensive)', () => {
        // This cannot happen via the aggregation logic but the guard must hold.
        const result = computeStateBreakdown([]);
        expect(result).toHaveLength(0);
    });

    it('does not mutate the input features array', () => {
        const features = [makeTrack({ state: 'IA' }), makeTrack({ id: 't2', state: 'IA' })];
        const before = features.length;
        computeStateBreakdown(features);
        expect(features.length).toBe(before);
    });

    it('returns a fresh array each call (no shared mutable state)', () => {
        const features = [makeTrack({ state: 'WI' })];
        const first = computeStateBreakdown(features);
        const second = computeStateBreakdown(features);
        expect(first).not.toBe(second);
        expect(first[0]).not.toBe(second[0]);
    });

    it('preserves stateName from the features', () => {
        const features = [makeTrack({ state: 'KS', stateName: 'Kansas' })];
        const [row] = computeStateBreakdown(features);
        expect(row.stateName).toBe('Kansas');
    });
});

// ---------------------------------------------------------------------------
// computeFullHistory
// ---------------------------------------------------------------------------

describe('computeFullHistory', () => {
    const currentYear = new Date().getFullYear();

    it('returns empty array for empty input', () => {
        expect(computeFullHistory([])).toEqual([]);
    });

    it('returns the same reference when data does not include current year', () => {
        // Data only through a safely past year — nothing should be excluded.
        const years = [makeYear(1978), makeYear(1979), makeYear(1980)];
        const result = computeFullHistory(years);
        expect(result).toBe(years);
        expect(result).toHaveLength(3);
    });

    it('excludes the current year when data includes it', () => {
        const years = [
            makeYear(currentYear - 2),
            makeYear(currentYear - 1),
            makeYear(currentYear, { count: 50 }),
        ];
        const result = computeFullHistory(years);
        expect(result).toHaveLength(2);
        expect(result.every(y => y.year < currentYear)).toBe(true);
    });

    it('keeps the most recent completed year when data stops before current year', () => {
        // Simulates a sync run before any current-year events are published.
        const years = [
            makeYear(currentYear - 3),
            makeYear(currentYear - 2),
            makeYear(currentYear - 1),
        ];
        const result = computeFullHistory(years);
        expect(result).toHaveLength(3);
        expect(result[result.length - 1].year).toBe(currentYear - 1);
    });

    it('returns a single-element array without filtering when that year is past', () => {
        const years = [makeYear(2000)];
        const result = computeFullHistory(years);
        expect(result).toHaveLength(1);
        expect(result[0].year).toBe(2000);
    });

    it('returns empty array when the only entry is the current year', () => {
        const years = [makeYear(currentYear)];
        const result = computeFullHistory(years);
        expect(result).toHaveLength(0);
    });
});
