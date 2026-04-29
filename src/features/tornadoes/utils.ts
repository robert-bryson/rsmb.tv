import type { FeatureCollection, Point, Position } from 'geojson';
import type {
    AnnualTornadoSummary,
    FilteredTornadoStats,
    StateAggregateSummary,
    TornadoRegionPreset,
    TornadoTrackCollection,
    TornadoTrackFeature,
    TornadoTrackProperties,
} from './types';

// SVG canvas coordinate-space dimensions used by the WebGL fallback renderer.
export const SVG_CANVAS_WIDTH = 1000;
export const SVG_CANVAS_HEIGHT = 620;

export interface FallbackViewBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const INITIAL_VIEW_BOX: FallbackViewBox = {
    x: 0,
    y: 0,
    width: SVG_CANVAS_WIDTH,
    height: SVG_CANVAS_HEIGHT,
};

/**
 * Returns true if a track's EF scale falls within [minScale, maxScale].
 * When minScale is -1 (the 'all' sentinel), the track always passes.
 * maxScale defaults to Infinity, making the check a one-sided minimum filter —
 * pass the upper bound from scaleFilterBounds() when using exact-EF filters.
 */
export function trackPassesScale(scale: number, minScale: number, maxScale = Infinity): boolean {
    if (minScale < 0) return true;
    return scale >= minScale && scale <= maxScale;
}

/** Accumulates aggregate stats from a set of tornado track features. */
export function summarize(features: TornadoTrackFeature[]): FilteredTornadoStats {
    return features.reduce<FilteredTornadoStats>(
        (stats, feature) => {
            const p = feature.properties;
            stats.count += 1;
            stats.deaths += p.deaths;
            stats.injuries += p.injuries;
            stats.trackMiles += p.lengthMiles;
            stats.ef2Plus += p.scale >= 2 ? 1 : 0;
            stats.strongestScale = Math.max(stats.strongestScale, p.scale);
            return stats;
        },
        { count: 0, deaths: 0, injuries: 0, trackMiles: 0, ef2Plus: 0, strongestScale: -1 },
    );
}

/**
 * Converts a track line collection to a point collection using each track's
 * start coordinate. Features with empty coordinate arrays are skipped.
 */
export function toTrackPoints(collection: TornadoTrackCollection): FeatureCollection<Point, TornadoTrackProperties> {
    return {
        type: 'FeatureCollection',
        features: collection.features.flatMap((feature) => {
            const start = feature.geometry.coordinates[0];
            if (!start) return [];
            return [{
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: start },
                properties: feature.properties,
            }];
        }),
    };
}

/** Returns the geographic bounds for a given region preset (degrees). */
export function fallbackBounds(region: TornadoRegionPreset): { west: number; east: number; south: number; north: number } {
    if (region === 'midwest') return { west: -105, east: -78, south: 35, north: 50 };
    if (region === 'plains') return { west: -108, east: -94, south: 25, north: 50 };
    if (region === 'dixie') return { west: -95, east: -78, south: 28, north: 38 };
    return { west: -126, east: -66, south: 24, north: 50 };
}

/** Projects a [lon, lat] coordinate into SVG canvas coordinate space. */
export function projectFallbackPoint(
    [lon, lat]: Position,
    bounds: ReturnType<typeof fallbackBounds>,
): [number, number] {
    const x = ((lon - bounds.west) / (bounds.east - bounds.west)) * SVG_CANVAS_WIDTH;
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * SVG_CANVAS_HEIGHT;
    return [x, y];
}

/** Clamps a fallback viewBox to valid canvas bounds, enforcing min/max zoom levels. */
export function clampViewBox(viewBox: FallbackViewBox): FallbackViewBox {
    const minWidth = 90;
    const maxWidth = SVG_CANVAS_WIDTH;
    const width = Math.max(minWidth, Math.min(maxWidth, viewBox.width));
    const height = width * (SVG_CANVAS_HEIGHT / SVG_CANVAS_WIDTH);
    const x = Math.max(0, Math.min(SVG_CANVAS_WIDTH - width, viewBox.x));
    const y = Math.max(0, Math.min(SVG_CANVAS_HEIGHT - height, viewBox.y));
    return { x, y, width, height };
}

/** Returns a new viewBox zoomed toward the given focus point by the given factor. */
export function zoomFallbackViewBox(
    viewBox: FallbackViewBox,
    focusX: number,
    focusY: number,
    factor: number,
): FallbackViewBox {
    const width = viewBox.width * factor;
    const height = viewBox.height * factor;
    const focusRatioX = (focusX - viewBox.x) / viewBox.width;
    const focusRatioY = (focusY - viewBox.y) / viewBox.height;
    return clampViewBox({
        x: focusX - width * focusRatioX,
        y: focusY - height * focusRatioY,
        width,
        height,
    });
}

/** Formats a dollar damage value as a human-readable string. */
export function formatDamage(value: number): string {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1_000).toLocaleString()}K`;
    return value > 0 ? `$${value.toLocaleString()}` : 'Not reported';
}

/**
 * Formats an ISO date/datetime string for display.
 * Falls back to the raw string on invalid input.
 */
export function formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || 'Unknown';
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

// ---------------------------------------------------------------------------
// Trend analytics — pure functions used by the Trends panel sub-components.
// Extracted from component render bodies so they are testable in isolation
// and can be memoized cheaply.
// ---------------------------------------------------------------------------

/**
 * Computes the ordinary least-squares linear regression of (x, y) pairs.
 * Returns slope = 0 and the single y-value as intercept when n < 2.
 */
export function linReg(pairs: { x: number; y: number }[]): { slope: number; intercept: number } {
    const n = pairs.length;
    if (n < 2) return { slope: 0, intercept: n === 1 ? pairs[0].y : 0 };
    const xMean = pairs.reduce((s, p) => s + p.x, 0) / n;
    const yMean = pairs.reduce((s, p) => s + p.y, 0) / n;
    const denom = pairs.reduce((s, p) => s + (p.x - xMean) ** 2, 0) || 1;
    const slope = pairs.reduce((s, p) => s + (p.x - xMean) * (p.y - yMean), 0) / denom;
    return { slope, intercept: yMean - slope * xMean };
}

export interface SparklinePill {
    label: string;
    /** Raw numeric value for the selected period — use this for comparisons. */
    selValue: number;
    /** Raw numeric value for the full history baseline. */
    histValue: number;
    /** When true, a value higher than the baseline is considered unfavourable. */
    higherIsBad: boolean;
}

/**
 * Derives the three comparison pills (Avg/yr, Deaths/yr, EF2%) for the
 * sparkline panel. Returns raw numeric values — formatting is left to the UI.
 */
export function computeSparklinePills(
    allYears: AnnualTornadoSummary[],
    startYear: number,
    endYear: number,
): SparklinePill[] {
    const selData = allYears.filter(d => d.year >= startYear && d.year <= endYear);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    const ef2Pct = (row: AnnualTornadoSummary) => (row.count > 0 ? (row.ef2Plus / row.count) * 100 : 0);

    return [
        { label: 'Avg/yr', selValue: avg(selData.map(d => d.count)), histValue: avg(allYears.map(d => d.count)), higherIsBad: false },
        { label: 'Deaths/yr', selValue: avg(selData.map(d => d.deaths)), histValue: avg(allYears.map(d => d.deaths)), higherIsBad: true },
        { label: 'EF2%', selValue: avg(selData.map(ef2Pct)), histValue: avg(allYears.map(ef2Pct)), higherIsBad: true },
    ];
}

export interface DecadeRow {
    /** E.g. "1990s" or "2020–25" for the most recent partial decade. */
    label: string;
    /** The decade's starting year, e.g. 1990 for the 1990s. */
    decadeStart: number;
    avgCount: number;
    avgDeaths: number;
    ef2Pct: number;
    dPer100: number;
}

/**
 * Aggregates tornado track features into per-state stats sorted by tornado
 * count descending. Useful for the "by state" chart in the Trends panel.
 *
 * Returns an immutable result — callers may sort/slice without side effects.
 */
export function computeStateBreakdown(features: TornadoTrackFeature[]): StateAggregateSummary[] {
    const map = new Map<string, { state: string; stateName: string; count: number; ef2Plus: number; deaths: number }>();
    for (const f of features) {
        const { state, stateName, scale, deaths } = f.properties;
        let row = map.get(state);
        if (!row) {
            row = { state, stateName, count: 0, ef2Plus: 0, deaths: 0 };
            map.set(state, row);
        }
        row.count += 1;
        row.deaths += deaths;
        if (scale >= 2) row.ef2Plus += 1;
    }
    return [...map.values()]
        .map(({ state, stateName, count, ef2Plus, deaths }) => ({
            state,
            stateName,
            count,
            ef2Plus,
            deaths,
            ef2Pct: (ef2Plus / count) * 100,
        }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Returns `allYears` filtered to exclude the current calendar year if it
 * appears in the data. The current year is always a partial year (events
 * still being recorded), so including it in trend charts would skew averages
 * and regression lines downward.
 *
 * If the data does not yet include the current year — e.g. the sync ran
 * before the first events of the year were published — all years are returned
 * unchanged so that a fully-completed final year is never accidentally
 * excluded.
 */
export function computeFullHistory(allYears: AnnualTornadoSummary[]): AnnualTornadoSummary[] {
    if (allYears.length === 0) return allYears;
    const currentYear = new Date().getFullYear();
    const latestYear = allYears[allYears.length - 1].year;
    return latestYear >= currentYear ? allYears.filter(y => y.year < currentYear) : allYears;
}

/**
 * Summarises `allYears` into per-decade rows starting from 1950.
 * The most recent decade is labelled with its actual year range when
 * it is incomplete (fewer than 10 years of data present).
 */
export function computeDecades(allYears: AnnualTornadoSummary[]): DecadeRow[] {
    const rows: DecadeRow[] = [];
    if (allYears.length === 0) return rows;
    const maxYear = allYears[allYears.length - 1].year;
    // Floor to the nearest decade so partial leading decades (e.g. data
    // starting at 1952) are still grouped under their decade heading (1950s).
    const minDecade = Math.floor(allYears[0].year / 10) * 10;

    for (let start = minDecade; start <= maxYear; start += 10) {
        const slice = allYears.filter(y => y.year >= start && y.year < start + 10);
        if (!slice.length) continue;
        const len = slice.length;
        const isPartial = slice[slice.length - 1].year < start + 9;
        const label = isPartial
            ? `${start}–${String(slice[slice.length - 1].year).slice(2)}`
            : `${start}s`;
        rows.push({
            label,
            decadeStart: start,
            avgCount: slice.reduce((s, y) => s + y.count, 0) / len,
            avgDeaths: slice.reduce((s, y) => s + y.deaths, 0) / len,
            ef2Pct: slice.reduce((s, y) => s + (y.count > 0 ? y.ef2Plus / y.count * 100 : 0), 0) / len,
            dPer100: slice.reduce((s, y) => s + (y.count > 0 ? y.deaths / y.count * 100 : 0), 0) / len,
        });
    }
    return rows;
}
