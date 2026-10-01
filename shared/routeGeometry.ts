import type { Feature, FeatureCollection, LineString, MultiLineString } from 'geojson';
export type RouteGeoJson = Feature<LineString | MultiLineString> | FeatureCollection<LineString | MultiLineString>;
export function routeCoordinates(route: RouteGeoJson) {
    const features = route.type === 'FeatureCollection' ? route.features : [route];
    return features.flatMap((feature) => feature.geometry.type === 'LineString'
        ? feature.geometry.coordinates
        : feature.geometry.coordinates.flat());
}

export function routeFeatures(route: RouteGeoJson) {
    return route.type === 'FeatureCollection' ? route.features : [route];
}

export function trackRoute(route: RouteGeoJson, trackId: string): RouteGeoJson {
    return {
        type: 'FeatureCollection',
        features: routeFeatures(route).filter((feature) => feature.properties?.trackId === trackId),
    };
}

export function lineDistanceKilometers(coordinates: number[][]) {
    const earthRadiusKilometers = 6371.0088;
    const radians = (degrees: number) => degrees * Math.PI / 180;
    let distance = 0;

    for (let index = 1; index < coordinates.length; index++) {
        const [previousLongitude, previousLatitude] = coordinates[index - 1];
        const [longitude, latitude] = coordinates[index];
        const latitudeDelta = radians(latitude - previousLatitude);
        const longitudeDelta = radians(longitude - previousLongitude);
        const haversine = Math.sin(latitudeDelta / 2) ** 2
            + Math.cos(radians(previousLatitude)) * Math.cos(radians(latitude))
            * Math.sin(longitudeDelta / 2) ** 2;
        distance += earthRadiusKilometers * 2 * Math.atan2(Math.sqrt(Math.min(1, haversine)), Math.sqrt(Math.max(0, 1 - haversine)));
    }

    return distance;
}

export function featureDistanceKilometers(feature: Feature<LineString | MultiLineString>) {
    const sourceDistance = feature.properties?.distanceKilometers;
    if (typeof sourceDistance === 'number' && Number.isFinite(sourceDistance) && sourceDistance >= 0) {
        return sourceDistance;
    }
    const lines = feature.geometry.type === 'LineString'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    return lines.reduce((total, coordinates) => total + lineDistanceKilometers(coordinates), 0);
}

export function formatDistance(distanceKilometers: number) {
    const distanceMiles = distanceKilometers * 0.6213711922;
    return `${Math.round(distanceMiles)} mi / ${distanceKilometers.toFixed(1)} km`;
}

export function isRoutePosition(value: unknown): boolean {
    if (!Array.isArray(value) || value.length < 2) return false;
    const [longitude, latitude] = value;
    return Number.isFinite(longitude) && Number.isFinite(latitude)
        && longitude >= -180 && longitude <= 180
        && latitude >= -90 && latitude <= 90;
}

export function hasValidRouteGeometry(value: unknown): value is LineString | MultiLineString {
    if (!value || typeof value !== 'object') return false;
    const geometry = value as { type?: unknown; coordinates?: unknown };
    const isLine = (line: unknown): line is number[][] => Array.isArray(line)
        && line.length >= 2 && line.every(isRoutePosition);
    if (geometry.type === 'LineString') {
        return isLine(geometry.coordinates);
    }
    if (geometry.type === 'MultiLineString') {
        return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0
            && geometry.coordinates.every(isLine);
    }
    return false;
}

export function isRouteFeature(value: unknown): value is Feature<LineString | MultiLineString> {
    if (!value || typeof value !== 'object') return false;
    const feature = value as { type?: unknown; geometry?: unknown; properties?: unknown };
    return feature.type === 'Feature' && hasValidRouteGeometry(feature.geometry)
        && (feature.properties === null || (typeof feature.properties === 'object'
            && !Array.isArray(feature.properties)));
}

export function isRouteGeoJson(value: unknown): value is RouteGeoJson {
    if (!value || typeof value !== 'object') return false;
    const geoJson = value as { type?: string; features?: unknown };
    if (geoJson.type === 'Feature') return isRouteFeature(geoJson);
    return geoJson.type === 'FeatureCollection'
        && Array.isArray(geoJson.features)
        && geoJson.features.length > 0
        && geoJson.features.every(isRouteFeature);
}
