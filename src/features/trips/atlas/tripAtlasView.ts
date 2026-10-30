import type { FeatureCollection, LineString, MultiLineString } from 'geojson';
import { routeFeatures, type RouteGeoJson } from '../routeGeometry';

export const TRIP_ATLAS_PATH = '/projects/motorcycle-trips/map';

export function isTripAtlasLocation(value: unknown): value is string {
    return typeof value === 'string' && /^\/projects\/motorcycle-trips\/map(?:\?|$)/.test(value);
}

export function tripAtlasUrl(id: string) {
    return `${TRIP_ATLAS_PATH}?${new URLSearchParams({ trip: id })}`;
}

const colors = ['#a78bfa', '#38bdf8', '#fbbf24', '#34d399', '#fb7185', '#fb923c'];
export function tripAtlasColor(id: string) {
    let hash = 0;
    for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
    return colors[hash % colors.length];
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

export interface AtlasCamera {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
}

export interface AtlasSession {
    camera?: AtlasCamera;
    panelOpen: boolean;
    scrollTop: number;
}

const sessions = new Map<string, AtlasSession>();
export function saveAtlasSession(key: string, url: string, session: AtlasSession) {
    sessions.set(key, { ...session });
    sessions.set(url, { ...session });
    while (sessions.size > 40) sessions.delete(sessions.keys().next().value!);
}

export function readAtlasSession(key: string, returnUrl?: string) {
    return sessions.get(key) ?? (returnUrl ? sessions.get(returnUrl) : undefined);
}
