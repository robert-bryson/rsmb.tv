import type { PositionAnchor } from 'maplibre-gl';
import { routeFeatures, type RouteGeoJson } from '../routeGeometry';

interface Point { x: number; y: number }
interface Viewport {
    width: number;
    height: number;
    project: (coordinates: [number, number]) => Point;
    /** Omit when repeated world copies are disabled. */
    centerLongitude?: number;
}
export interface AtlasTooltipPlacement { point: Point; anchor?: PositionAnchor }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distanceSquared = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const interpolate = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const finite = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);

function nearestOnSegment(point: Point, a: Point, b: Point): Point {
    const length = distanceSquared(a, b);
    return interpolate(a, b, length ? clamp(((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length, 0, 1) : 0);
}

function clipSegment(a: Point, b: Point, width: number, height: number): [Point, Point] | undefined {
    let from = 0;
    let to = 1;
    for (const [origin, delta, max] of [[a.x, b.x - a.x, width], [a.y, b.y - a.y, height]]) {
        if (!delta) { if (origin < 0 || origin > max) return; }
        else {
            const first = -origin / delta;
            const last = (max - origin) / delta;
            from = Math.max(from, Math.min(first, last));
            to = Math.min(to, Math.max(first, last));
            if (from > to) return;
        }
    }
    return [interpolate(a, b, from), interpolate(a, b, to)];
}

/** Work in projected pixels so bearing, pitch, and disconnected tracks retain their actual screen direction. */
export function atlasTooltipPlacement(route: RouteGeoJson, viewport: Viewport): AtlasTooltipPlacement | undefined {
    const { width, height, project, centerLongitude } = viewport;
    if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return;
    const center = { x: width / 2, y: height / 2 };
    const corners = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: 0, y: height }, { x: width, y: height }];
    let visible: { point: Point; distance: number } | undefined;
    let nearest: { track: Point; edge: Point; distance: number; centerDistance: number } | undefined;
    for (const feature of routeFeatures(route)) {
        const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        for (const line of lines) {
            if (!line.length) continue;
            let minLongitude = Infinity;
            let maxLongitude = -Infinity;
            for (const point of line) { minLongitude = Math.min(minLongitude, point[0]); maxLongitude = Math.max(maxLongitude, point[0]); }
            const shift = centerLongitude === undefined ? 0 : 360 * Math.round((centerLongitude - (minLongitude + maxLongitude) / 2) / 360);
            const copies = centerLongitude === undefined ? [0] : [shift, shift - 360, shift + 360];
            for (const copy of copies) {
                let a = project([line[0][0] + copy, line[0][1]]);
                for (let index = 1; index < line.length; index++) {
                    const b = project([line[index][0] + copy, line[index][1]]);
                    if (finite(a) && finite(b)) {
                        const clipped = clipSegment(a, b, width, height);
                        if (clipped) {
                            const point = nearestOnSegment(center, ...clipped);
                            const distance = distanceSquared(point, center);
                            if (!visible || distance < visible.distance) visible = { point, distance };
                        } else if (!visible) {
                            const dx = Math.max(0, Math.min(a.x, b.x) - width, -Math.max(a.x, b.x));
                            const dy = Math.max(0, Math.min(a.y, b.y) - height, -Math.max(a.y, b.y));
                            // A segment cannot be closer than its projected bounding rectangle.
                            if (nearest && dx * dx + dy * dy > nearest.distance + 1e-6) { a = b; continue; }
                            // Segment endpoints and projections of rectangle corners contain the closest pair.
                            // The center candidate keeps parallel tracks centered when distances tie.
                            for (const track of [a, b, ...[center, ...corners].map(point => nearestOnSegment(point, a, b))]) {
                                const edge = { x: clamp(track.x, 0, width), y: clamp(track.y, 0, height) };
                                const distance = distanceSquared(track, edge);
                                const centerDistance = distanceSquared(edge, center);
                                if (!nearest || distance < nearest.distance - 1e-6
                                    || (Math.abs(distance - nearest.distance) <= 1e-6 && centerDistance < nearest.centerDistance)) {
                                    nearest = { track, edge, distance, centerDistance };
                                }
                            }
                        }
                    }
                    a = b;
                }
            }
        }
    }
    if (visible) return { point: visible.point };
    if (!nearest) return;
    const horizontal = nearest.track.x < 0 ? 'left' : nearest.track.x > width ? 'right' : '';
    const vertical = nearest.track.y < 0 ? 'top' : nearest.track.y > height ? 'bottom' : '';
    const anchor = [vertical, horizontal].filter(Boolean).join('-') as PositionAnchor;
    const margin = Math.min(12, width / 4, height / 4);
    return { point: { x: clamp(nearest.edge.x, margin, width - margin), y: clamp(nearest.edge.y, margin, height - margin) }, anchor };
}
