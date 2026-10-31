import type { PositionAnchor } from 'maplibre-gl';
import { routeFeatures, type RouteGeoJson } from '../routeGeometry';
import { clamp, clipSegment, distanceSquared, nearestOnSegment, type TooltipPoint as Point, type TooltipSegment } from './atlasTooltipGeometry';
import { layoutAtlasTooltip, type AtlasTooltipLayout, type AtlasTooltipPlacement } from './atlasTooltipLayout';

interface Viewport {
    width: number;
    height: number;
    project: (coordinates: [number, number]) => Point;
    /** Omit when repeated world copies are disabled. */
    centerLongitude?: number;
    popup?: AtlasTooltipLayout;
}
export type { AtlasTooltipPlacement } from './atlasTooltipLayout';

const finite = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);

/** Work in projected pixels so bearing, pitch, and disconnected tracks retain their actual screen direction. */
export function atlasTooltipPlacement(route: RouteGeoJson, viewport: Viewport): AtlasTooltipPlacement | undefined {
    const { width, height, project, centerLongitude } = viewport;
    if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return;
    const center = { x: width / 2, y: height / 2 };
    const bounds = { left: 0, top: 0, right: width, bottom: height };
    const segments: TooltipSegment[] = [];
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
                        const clipped = clipSegment(a, b, bounds);
                        if (clipped) {
                            if (viewport.popup) segments.push(clipped);
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
    if (visible) {
        const base = { point: visible.point };
        return viewport.popup ? layoutAtlasTooltip(base, segments, width, height, viewport.popup) : base;
    }
    if (!nearest) return;
    const horizontal = nearest.track.x < 0 ? 'left' : nearest.track.x > width ? 'right' : '';
    const vertical = nearest.track.y < 0 ? 'top' : nearest.track.y > height ? 'bottom' : '';
    const anchor = [vertical, horizontal].filter(Boolean).join('-') as PositionAnchor;
    const margin = Math.min(12, width / 4, height / 4);
    const base = { point: { x: clamp(nearest.edge.x, margin, width - margin), y: clamp(nearest.edge.y, margin, height - margin) }, anchor };
    return viewport.popup ? layoutAtlasTooltip(base, segments, width, height, viewport.popup) : base;
}
