import type { FeatureCollection, Point, Position } from 'geojson';
import type {
    FilteredTornadoStats,
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

/** Returns true if a track passes the active minimum scale filter. */
export function trackPassesScale(scale: number, minScale: number): boolean {
    return minScale < 0 || scale >= minScale;
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
