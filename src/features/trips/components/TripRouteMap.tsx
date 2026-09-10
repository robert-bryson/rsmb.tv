import { useEffect, useRef, useState } from 'react';
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, LineString, MultiLineString } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useReducedMotion } from '../../flights/hooks/useReducedMotion';
import { useTripStory } from '../TripStoryContext';

type RouteGeoJson = Feature<LineString | MultiLineString> | FeatureCollection<LineString | MultiLineString>;

maplibregl.setWorkerUrl(maplibreWorkerUrl);

const mapStyle: maplibregl.StyleSpecification = {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
        openstreetmap: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
        },
    },
    layers: [{
        id: 'openstreetmap',
        type: 'raster',
        source: 'openstreetmap',
        paint: {
            'raster-saturation': -1,
            'raster-brightness-min': 0.05,
            'raster-brightness-max': 0.42,
            'raster-contrast': 0.15,
        },
    }],
};

function routeCoordinates(route: RouteGeoJson) {
    const features = route.type === 'FeatureCollection' ? route.features : [route];
    return features.flatMap((feature) => feature.geometry.type === 'LineString'
        ? feature.geometry.coordinates
        : feature.geometry.coordinates.flat());
}

function isRoutePosition(value: unknown): boolean {
    if (!Array.isArray(value) || value.length < 2) return false;
    const [longitude, latitude] = value;
    return Number.isFinite(longitude) && Number.isFinite(latitude)
        && longitude >= -180 && longitude <= 180
        && latitude >= -90 && latitude <= 90;
}

function hasValidRouteGeometry(geometry: Geometry | undefined): geometry is LineString | MultiLineString {
    if (geometry?.type === 'LineString') {
        return geometry.coordinates.length >= 2 && geometry.coordinates.every(isRoutePosition);
    }
    if (geometry?.type === 'MultiLineString') {
        return geometry.coordinates.length > 0
            && geometry.coordinates.every((line) => line.length >= 2 && line.every(isRoutePosition));
    }
    return false;
}

function isRouteGeoJson(value: unknown): value is RouteGeoJson {
    if (!value || typeof value !== 'object') return false;
    const geoJson = value as { type?: string; geometry?: Geometry; features?: Array<{ geometry?: Geometry }> };
    if (geoJson.type === 'Feature') return hasValidRouteGeometry(geoJson.geometry);
    return geoJson.type === 'FeatureCollection'
        && Boolean(geoJson.features?.length)
        && geoJson.features!.every((feature) => hasValidRouteGeometry(feature.geometry));
}

export function TripRouteMap({ stopId }: { stopId?: string }) {
    const { manifest } = useTripStory();
    const reducedMotion = useReducedMotion();
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const routeUrl = manifest.route.geoJson;
    const [routeState, setRouteState] = useState<{
        url: string;
        route: RouteGeoJson | null;
        error: string;
    }>({ url: routeUrl, route: null, error: '' });
    const route = routeState.url === routeUrl ? routeState.route : null;
    const error = routeState.url === routeUrl ? routeState.error : '';

    useEffect(() => {
        const controller = new AbortController();
        fetch(routeUrl, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error(`Route request failed with ${response.status}`);
                return response.json();
            })
            .then((value: unknown) => {
                if (!isRouteGeoJson(value)) throw new Error('Route data must contain valid LineString geometry.');
                setRouteState({ url: routeUrl, route: value, error: '' });
            })
            .catch((reason: unknown) => {
                if (reason instanceof DOMException && reason.name === 'AbortError') return;
                setRouteState({
                    url: routeUrl,
                    route: null,
                    error: reason instanceof Error ? reason.message : 'The route could not be loaded.',
                });
            });
        return () => controller.abort();
    }, [routeUrl]);

    useEffect(() => {
        if (!containerRef.current || !route || mapRef.current) return;

        const coordinates = routeCoordinates(route);
        const bounds = coordinates.reduce(
            (current, coordinate) => current.extend(coordinate as [number, number]),
            new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]),
        );
        const stops: FeatureCollection = {
            type: 'FeatureCollection',
            features: manifest.stops.map((stop, index): Feature => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: stop.coordinates },
                properties: { id: stop.id, name: stop.name, number: index + 1 } satisfies GeoJsonProperties,
            })),
        };
        const map = new maplibregl.Map({
            container: containerRef.current,
            style: {
                ...mapStyle,
                sources: {
                    ...mapStyle.sources,
                    'trip-route': { type: 'geojson', data: route },
                    'trip-stops': { type: 'geojson', data: stops },
                },
                layers: [
                    ...mapStyle.layers,
                    {
                        id: 'trip-route-halo',
                        type: 'line',
                        source: 'trip-route',
                        paint: { 'line-color': '#09090b', 'line-width': 7, 'line-opacity': 0.85 },
                        layout: { 'line-cap': 'round', 'line-join': 'round' },
                    },
                    {
                        id: 'trip-route-line',
                        type: 'line',
                        source: 'trip-route',
                        paint: { 'line-color': '#f59e0b', 'line-width': 4 },
                        layout: { 'line-cap': 'round', 'line-join': 'round' },
                    },
                    {
                        id: 'trip-stops',
                        type: 'circle',
                        source: 'trip-stops',
                        paint: {
                            'circle-color': '#fafafa',
                            'circle-radius': 8,
                            'circle-stroke-color': '#18181b',
                            'circle-stroke-width': 2,
                        },
                    },
                    {
                        id: 'trip-stop-numbers',
                        type: 'symbol',
                        source: 'trip-stops',
                        layout: { 'text-field': ['to-string', ['get', 'number']], 'text-size': 10 },
                        paint: { 'text-color': '#18181b' },
                    },
                ],
            },
            bounds,
            fitBoundsOptions: { padding: 40, maxZoom: 11 },
            cooperativeGestures: true,
            attributionControl: false,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibregl.FullscreenControl(), 'top-right');
        map.addControl(new maplibregl.AttributionControl({ compact: true }));

        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [manifest.stops, route]);

    useEffect(() => {
        const stop = manifest.stops.find((candidate) => candidate.id === stopId);
        if (!stop || !mapRef.current) return;
        mapRef.current[reducedMotion ? 'jumpTo' : 'easeTo']({ center: stop.coordinates, zoom: 9 });
    }, [manifest.stops, reducedMotion, stopId]);

    const mapAlt = manifest.route.alt ?? `Map of the route with ${manifest.stops.length} marked stops.`;

    return (
        <figure className="trip-breakout my-10">
            <div className="relative aspect-[16/10] min-h-72 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
                {manifest.route.staticImage && (
                    <img src={manifest.route.staticImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                {!error && (
                    <div className="absolute inset-0">
                        <div ref={containerRef} role="region" aria-label={mapAlt} className="h-full w-full" />
                    </div>
                )}
                {!route && !error && (
                    <div className="absolute inset-0 grid place-items-center bg-zinc-950/80 text-sm text-zinc-400">Loading route…</div>
                )}
                {error && !manifest.route.staticImage && (
                    <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-zinc-400">{error}</div>
                )}
            </div>
            <figcaption className="mt-3">
                <ol className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
                    {manifest.stops.map((stop, index) => (
                        <li key={stop.id} className={stop.id === stopId ? 'text-amber-400' : ''}>
                            <span className="mr-1 text-zinc-500">{index + 1}.</span>{stop.name}
                        </li>
                    ))}
                </ol>
            </figcaption>
        </figure>
    );
}