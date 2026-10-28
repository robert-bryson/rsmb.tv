import type { ExpressionSpecification } from 'maplibre-gl';
import { routeCoordinates, routeFeatures, type RouteGeoJson } from './routeGeometry';
import type { TripManifest } from './types';

export type TripMapFocus = { stopId?: string; trackId?: string; dayId?: string };
export const routeColor = '#f59e0b';
export const routeContextColor = '#71717a';
export const routeBackgroundStyle = { color: '#09090b', width: 7, opacity: 0.85 };
// Labels and selected states accompany these colors in both map renderers.
const dayColors = ['#fbbf24', '#38bdf8', '#e879f9', '#34d399', '#fb7185', '#a78bfa', '#fb923c', '#a3e635'];

export function tripMapDays(manifest: TripManifest) {
    return (manifest.days ?? []).filter(day => day.trackIds?.length);
}

export function dayColor(manifest: TripManifest, dayId: string) {
    const index = tripMapDays(manifest).findIndex(day => day.id === dayId);
    return dayColors[Math.max(0, index) % dayColors.length];
}

export function trackColor(manifest: TripManifest, trackId?: string) {
    const day = tripMapDayForTrack(manifest, trackId);
    return day ? dayColor(manifest, day.id) : routeColor;
}

export function tripMapDayForTrack(manifest: TripManifest, trackId: unknown) {
    return typeof trackId === 'string'
        ? tripMapDays(manifest).find(day => day.trackIds?.includes(trackId)) : undefined;
}

export function tripMapDayAnchor(manifest: TripManifest, route: RouteGeoJson, dayId: string): [number, number] | undefined {
    const coordinates = tripMapCoordinates(tripMapView(manifest, route, { dayId }), false);
    const point = coordinates[Math.floor(coordinates.length / 2)];
    return point ? [point[0], point[1]] : undefined;
}

export function routeLineColor(manifest: TripManifest): string | ExpressionSpecification {
    const days = tripMapDays(manifest);
    const [first, ...rest] = days;
    if (!first) return routeColor;
    return ['match', ['get', 'trackId'], first.trackIds!, dayColor(manifest, first.id),
        ...rest.flatMap(day => [day.trackIds!, dayColor(manifest, day.id)]), routeColor] as ExpressionSpecification;
}

export function tripMapView(manifest: TripManifest, route: RouteGeoJson | null, { dayId, trackId }: TripMapFocus) {
    const day = dayId ? manifest.days?.find(day => day.id === dayId) : undefined;
    const track = manifest.route.tracks?.find(track => track.id === trackId);
    const trackIds = dayId ? day?.trackIds ?? [] : trackId ? [trackId] : undefined;
    const features = route ? routeFeatures(route) : [];
    const focusedRoute: RouteGeoJson | null = route && trackIds
        ? { type: 'FeatureCollection', features: features.filter(feature => trackIds.includes(feature.properties?.trackId)) }
        : route;
    let error = '';
    if (dayId && !day) error = `Unknown trip day: ${dayId}.`;
    else if (dayId && !trackIds?.length) error = `Day "${dayId}" has no route tracks.`;
    else if (route && trackIds) {
        const present = new Set(features.map(feature => feature.properties?.trackId));
        const missing = trackIds.find(id => !present.has(id));
        if (missing) error = `Route does not contain track "${missing}".`;
    }
    // Explicit membership permits shared camps and avoids guessing from location or date.
    const stops = day ? (day.stopIds ?? []).flatMap(id => {
        const stop = manifest.stops.find(stop => stop.id === id);
        return stop ? [stop] : [];
    }) : manifest.stops;
    return {
        day, trackIds, focusedRoute, stops, error,
        title: day?.title ?? track?.name ?? 'Route overview',
        alt: day ? `Map of ${day.title}.` : track ? `Map focused on ${track.name}.`
            : manifest.route.alt ?? 'Map of the trip route.',
    };
}

export function tripMapCoordinates(view: ReturnType<typeof tripMapView>, includeStops = true) {
    const coordinates = view.focusedRoute ? routeCoordinates(view.focusedRoute) : [];
    if (!coordinates.length || view.error) return [];
    return view.day && includeStops ? [...coordinates, ...view.stops.map(stop => stop.coordinates)] : coordinates;
}
