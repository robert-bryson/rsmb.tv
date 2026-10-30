import type { FeatureCollection, LineString, MultiLineString } from 'geojson';
import { routeFeatures, type RouteGeoJson } from '../routeGeometry';
import { tripAtlasColor } from './tripAtlasColors';

export { tripAtlasColor };

export const TRIP_ATLAS_PATH = '/projects/adv-atlas/map';

export function isTripAtlasLocation(value: unknown): value is string {
    return typeof value === 'string' && /^\/projects\/(?:adv-atlas|motorcycle-trips)\/map(?:\?|$)/.test(value);
}

export function tripAtlasUrl(id: string) {
    return `${TRIP_ATLAS_PATH}?${new URLSearchParams({ trip: id })}`;
}

export interface AtlasRouteState {
    route: RouteGeoJson | null;
    error: string;
    retry: () => void;
}

export function combineAtlasRoutes(routes: Readonly<Record<string, AtlasRouteState>>): FeatureCollection<LineString | MultiLineString> {
    return {
        type: 'FeatureCollection',
        features: Object.entries(routes).flatMap(([tripId, state]) => state.route ? routeFeatures(state.route).map((feature, index) => ({
            ...feature,
            id: `${tripId}:${index}`,
            properties: { ...feature.properties, tripId, color: tripAtlasColor(tripId) },
        })) : []),
    };
}
