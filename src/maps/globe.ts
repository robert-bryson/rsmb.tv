import { LngLat, type Map } from './maplibre';

export function applyGlobeStyle(map: Map) {
    map.setProjection({ type: 'globe' });
    map.setSky({
        'sky-color': '#080e16', 'horizon-color': '#344d60', 'fog-color': '#171f26',
        'fog-ground-blend': 0, 'atmosphere-blend': 0.8,
    });
}

export function globeOverviewZoom(width: number, height: number) {
    return Math.max(0, Math.log2(Math.max(128, Math.min(width, height)) / 256) + 0.5);
}

export function projectVisibleGlobeLocation(map: Map, [longitude, latitude]: [number, number]) {
    const wrappedLongitude = longitude + 360 * Math.round((map.getCenter().lng - longitude) / 360);
    const location = new LngLat(wrappedLongitude, latitude);
    const point = map.project(location);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    // The inverse returns the surface closest to the camera. A rear point can project onto that same pixel.
    const surface = map.unproject(point);
    return surface && surface.distanceTo(location) <= 1 ? point : undefined;
}
