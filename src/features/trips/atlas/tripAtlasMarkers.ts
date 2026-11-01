import { useEffect, useMemo, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import { routeFeatures, type RouteGeoJson } from '../routeGeometry';
import { loadTripManifest } from '../tripManifests';
import type { TripManifest } from '../types';
import { tripAtlasColor } from './tripAtlasColors';

type DayMetadata = Pick<TripManifest, 'id' | 'days'> & { tracks?: TripManifest['route']['tracks'] };
type EndpointKind = 'start' | 'end';
type RouteFeature = ReturnType<typeof routeFeatures>[number];

function routeEndpoint(feature: RouteFeature | undefined, kind: EndpointKind): [number, number] | undefined {
    if (!feature) return;
    const geometry = feature.geometry;
    const line = geometry.type === 'LineString' ? geometry.coordinates
        : kind === 'start' ? geometry.coordinates[0] : geometry.coordinates.at(-1);
    const point = kind === 'start' ? line?.[0] : line?.at(-1);
    return point ? [point[0], point[1]] : undefined;
}

/** Preserve the authored trip order, including days with several recordings. */
export function atlasTripEndpoints(manifest?: DayMetadata, route?: RouteGeoJson | null) {
    const endpoints: { kind: EndpointKind; coordinates: [number, number]; color: string }[] = [];
    if (!manifest || !route) return endpoints;
    const features = routeFeatures(route);
    const days = (manifest.days ?? []).filter(day => day.trackIds?.length);
    const trackIds = days.length ? days.flatMap(day => day.trackIds!) : manifest.tracks?.map(track => track.id);
    const first = trackIds?.length ? features.find(feature => feature.properties?.trackId === trackIds[0]) : features[0];
    const last = trackIds?.length ? features.filter(feature => feature.properties?.trackId === trackIds.at(-1)).at(-1) : features.at(-1);
    for (const kind of ['start', 'end'] as const) {
        const coordinates = routeEndpoint(kind === 'start' ? first : last, kind);
        if (coordinates) endpoints.push({ kind, coordinates, color: tripAtlasColor(manifest.id) });
    }
    return endpoints;
}

/** Mark recording ends between authored days, never gaps or extra tracks within a day. */
export function atlasDayBreaks(manifest?: DayMetadata, route?: RouteGeoJson | null): FeatureCollection<Point> {
    const result: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
    if (!manifest || !route) return result;
    const days = (manifest.days ?? []).filter(day => day.trackIds?.length);
    const features = routeFeatures(route);
    for (const day of days.slice(0, -1)) {
        // Membership and recording order come from the authored day, not GeoJSON file order.
        const trackId = day.trackIds!.at(-1);
        const feature = features.filter(feature => feature.properties?.trackId === trackId).at(-1);
        const coordinates = routeEndpoint(feature, 'end');
        if (!coordinates) continue;
        result.features.push({
            type: 'Feature', id: day.id,
            properties: { tripId: manifest.id, dayId: day.id, color: tripAtlasColor(manifest.id) },
            geometry: { type: 'Point', coordinates },
        });
    }
    return result;
}

/** Day metadata is optional and loaded only for the selected trip. */
export function useAtlasRouteMarkers(id: string | undefined, route: RouteGeoJson | null | undefined) {
    const [metadata, setMetadata] = useState<DayMetadata>();
    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        void loadTripManifest(id).then(manifest => {
            if (!cancelled) setMetadata(manifest ? { id: manifest.id, days: manifest.days, tracks: manifest.route.tracks } : undefined);
        }).catch(() => {
            // Optional decoration must not interrupt route selection or recovery.
            if (!cancelled) setMetadata(undefined);
        });
        return () => { cancelled = true; };
    }, [id]);
    return useMemo(() => {
        const selected = metadata?.id === id ? metadata : undefined;
        return { dayBreaks: atlasDayBreaks(selected, route), endpoints: atlasTripEndpoints(selected, route) };
    }, [metadata, id, route]);
}
