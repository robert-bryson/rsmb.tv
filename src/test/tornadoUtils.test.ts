import { describe, expect, it } from 'vitest';
import type { TornadoTrackFeature, TornadoTrackCollection } from '../features/tornadoes/types';
import {
    clampViewBox,
    fallbackBounds,
    formatDamage,
    formatDateTime,
    INITIAL_VIEW_BOX,
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

    it('passes when scale meets or exceeds minimum', () => {
        expect(trackPassesScale(2, 2)).toBe(true);
        expect(trackPassesScale(4, 2)).toBe(true);
    });

    it('fails when scale is below minimum', () => {
        expect(trackPassesScale(1, 2)).toBe(false);
        expect(trackPassesScale(0, 3)).toBe(false);
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
