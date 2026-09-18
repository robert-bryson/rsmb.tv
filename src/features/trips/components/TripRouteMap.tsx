import { useEffect, useRef, useState } from 'react';
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, LineString, MultiLineString } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useReducedMotion } from '../../flights/hooks/useReducedMotion';
import { useTripStory } from '../TripStoryContext';

type RouteGeoJson = Feature<LineString | MultiLineString> | FeatureCollection<LineString | MultiLineString>;
type TripRouteMapProps = { stopId?: string; trackId?: string };
type BasemapId = 'muted' | 'street' | 'terrain';
type BasemapPaintProperty = 'raster-saturation' | 'raster-brightness-min' | 'raster-brightness-max' | 'raster-contrast';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

const basemaps: Array<{
    id: BasemapId;
    label: string;
    tiles: string[];
    paint: Record<BasemapPaintProperty, number>;
}> = [
        {
            id: 'muted',
            label: 'Muted',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            paint: {
                'raster-saturation': -1,
                'raster-brightness-min': 0.05,
                'raster-brightness-max': 0.42,
                'raster-contrast': 0.15,
            },
        },
        {
            id: 'street',
            label: 'Street',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            paint: {
                'raster-saturation': 0,
                'raster-brightness-min': 0,
                'raster-brightness-max': 1,
                'raster-contrast': 0,
            },
        },
        {
            id: 'terrain',
            label: 'Terrain',
            tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
            paint: {
                'raster-saturation': 0,
                'raster-brightness-min': 0,
                'raster-brightness-max': 0.85,
                'raster-contrast': 0.05,
            },
        },
    ];

function mapStyle(basemapId: BasemapId): maplibregl.StyleSpecification {
    const basemap = basemaps.find((candidate) => candidate.id === basemapId) ?? basemaps[0];
    return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
            openstreetmap: {
                type: 'raster',
                tiles: basemap.tiles,
                tileSize: 256,
                attribution: '&copy; OpenStreetMap contributors &copy; OpenTopoMap',
            },
        },
        layers: [{
            id: 'openstreetmap',
            type: 'raster',
            source: 'openstreetmap',
            paint: basemap.paint,
        }],
    };
}

class BasemapControl implements maplibregl.IControl {
    private readonly container: HTMLDivElement;
    private readonly button: HTMLButtonElement;

    constructor(onCycle: () => void) {
        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.addEventListener('click', onCycle);

        const icon = document.createElement('span');
        icon.className = 'trip-basemap-control-icon';
        icon.setAttribute('aria-hidden', 'true');
        this.button.append(icon);
        this.container.append(this.button);
        this.setBasemap('muted');
    }

    onAdd() {
        return this.container;
    }

    onRemove() {
        this.container.remove();
    }

    setBasemap(id: BasemapId) {
        const label = basemaps.find((basemap) => basemap.id === id)?.label ?? id;
        this.button.title = `Change basemap (current: ${label})`;
        this.button.setAttribute('aria-label', `Change basemap (current: ${label})`);
    }
}

function routeCoordinates(route: RouteGeoJson) {
    const features = route.type === 'FeatureCollection' ? route.features : [route];
    return features.flatMap((feature) => feature.geometry.type === 'LineString'
        ? feature.geometry.coordinates
        : feature.geometry.coordinates.flat());
}

function routeFeatures(route: RouteGeoJson) {
    return route.type === 'FeatureCollection' ? route.features : [route];
}

function trackRoute(route: RouteGeoJson, trackId: string): RouteGeoJson {
    return {
        type: 'FeatureCollection',
        features: routeFeatures(route).filter((feature) => feature.properties?.trackId === trackId),
    };
}

function lineDistanceKilometers(coordinates: number[][]) {
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
        distance += earthRadiusKilometers * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    }

    return distance;
}

function featureDistanceKilometers(feature: Feature<LineString | MultiLineString>) {
    const sourceDistance = feature.properties?.distanceKilometers;
    if (typeof sourceDistance === 'number' && Number.isFinite(sourceDistance) && sourceDistance >= 0) {
        return sourceDistance;
    }
    const lines = feature.geometry.type === 'LineString'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    return lines.reduce((total, coordinates) => total + lineDistanceKilometers(coordinates), 0);
}

function formatDistance(distanceKilometers: number) {
    const distanceMiles = distanceKilometers * 0.6213711922;
    return `${Math.round(distanceMiles)} mi / ${distanceKilometers.toFixed(1)} km`;
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

function isRouteFeature(value: unknown): value is Feature<LineString | MultiLineString> {
    if (!value || typeof value !== 'object') return false;
    const feature = value as { type?: string; geometry?: Geometry };
    return feature.type === 'Feature' && hasValidRouteGeometry(feature.geometry);
}

function isRouteGeoJson(value: unknown): value is RouteGeoJson {
    if (!value || typeof value !== 'object') return false;
    const geoJson = value as { type?: string; features?: unknown };
    if (geoJson.type === 'Feature') return isRouteFeature(geoJson);
    return geoJson.type === 'FeatureCollection'
        && Array.isArray(geoJson.features)
        && geoJson.features.length > 0
        && geoJson.features.every(isRouteFeature);
}

export function TripRouteMap({ stopId, trackId }: TripRouteMapProps) {
    const { manifest } = useTripStory();
    const reducedMotion = useReducedMotion();
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const basemapControlRef = useRef<BasemapControl | null>(null);
    const [basemapId, setBasemapId] = useState<BasemapId>('muted');
    const basemapIdRef = useRef(basemapId);
    const [hoveredStopId, setHoveredStopId] = useState<string | null>(null);
    const routeUrl = manifest.route.geoJson;
    const [routeState, setRouteState] = useState<{
        url: string;
        route: RouteGeoJson | null;
        error: string;
    }>({ url: routeUrl, route: null, error: '' });
    const route = routeState.url === routeUrl ? routeState.route : null;
    const routeError = routeState.url === routeUrl ? routeState.error : '';
    const missingTrack = route && trackId && routeCoordinates(trackRoute(route, trackId)).length === 0;
    const error = routeError || (missingTrack ? `Route does not contain track "${trackId}".` : '');

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

        const focusedRoute = trackId ? trackRoute(route, trackId) : route;
        const coordinates = routeCoordinates(focusedRoute);
        if (coordinates.length === 0) return;
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
        const style = mapStyle(basemapIdRef.current);
        const map = new maplibregl.Map({
            container: containerRef.current,
            style: {
                ...style,
                sources: {
                    ...style.sources,
                    'trip-route': { type: 'geojson', data: route },
                    'trip-stops': { type: 'geojson', data: stops },
                },
                layers: [
                    ...style.layers,
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
                        paint: { 'line-color': trackId ? '#71717a' : '#f59e0b', 'line-width': trackId ? 3 : 4, 'line-opacity': trackId ? 0.55 : 1 },
                        layout: { 'line-cap': 'round', 'line-join': 'round' },
                    },
                    ...(trackId ? [{
                        id: 'trip-route-selected',
                        type: 'line' as const,
                        source: 'trip-route',
                        filter: ['==', ['get', 'trackId'], trackId] as maplibregl.FilterSpecification,
                        paint: { 'line-color': '#f59e0b', 'line-width': 5 },
                        layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
                    }] : []),
                    {
                        id: 'trip-route-direction',
                        type: 'symbol',
                        source: 'trip-route',
                        ...(trackId ? { filter: ['==', ['get', 'trackId'], trackId] } : {}),
                        layout: {
                            'symbol-placement': 'line',
                            'symbol-spacing': 75,
                            'text-field': '›',
                            'text-size': 30,
                            'text-rotation-alignment': 'map',
                            'text-keep-upright': false,
                            'text-allow-overlap': true,
                        },
                        paint: { 'text-color': '#09090b', 'text-opacity': 1.0 },
                    },
                    {
                        id: 'trip-stops',
                        type: 'circle',
                        source: 'trip-stops',
                        paint: {
                            'circle-color': ['case', ['==', ['get', 'id'], stopId ?? ''], '#f59e0b', '#fafafa'],
                            'circle-radius': ['case', ['==', ['get', 'id'], stopId ?? ''], 11, 8],
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
        const basemapControl = new BasemapControl(() => {
            setBasemapId((currentId) => {
                const currentIndex = basemaps.findIndex((basemap) => basemap.id === currentId);
                const nextId = basemaps[(currentIndex + 1) % basemaps.length].id;
                basemapIdRef.current = nextId;
                return nextId;
            });
        });
        basemapControl.setBasemap(basemapIdRef.current);
        map.addControl(basemapControl, 'top-right');
        map.addControl(new maplibregl.AttributionControl({ compact: true }));
        map.on('mouseenter', 'trip-stops', (event) => {
            const hoveredId = event.features?.[0]?.properties?.id;
            if (typeof hoveredId === 'string') setHoveredStopId(hoveredId);
        });
        map.on('mouseleave', 'trip-stops', () => {
            setHoveredStopId(null);
        });
        if (!stopId && !trackId) {
            map.once('load', () => {
                map.setZoom(Math.max(map.getMinZoom(), map.getZoom() - 1));
            });
        }

        mapRef.current = map;
        basemapControlRef.current = basemapControl;
        return () => {
            map.remove();
            mapRef.current = null;
            basemapControlRef.current = null;
        };
    }, [manifest.stops, route, routeUrl, stopId, trackId]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const activeStopId = hoveredStopId ?? stopId ?? '';
        const isActiveStop: maplibregl.ExpressionSpecification = ['==', ['get', 'id'], activeStopId];
        map.setPaintProperty('trip-stops', 'circle-color', ['case', isActiveStop, '#f59e0b', '#fafafa']);
        map.setPaintProperty('trip-stops', 'circle-radius', ['case', isActiveStop, 11, 8]);
    }, [hoveredStopId, stopId]);

    useEffect(() => {
        const map = mapRef.current;
        const basemap = basemaps.find((candidate) => candidate.id === basemapId);
        if (!map || !basemap) return;

        const applyBasemap = () => {
            if (mapRef.current !== map) return false;
            const source = map.getSource('openstreetmap') as maplibregl.RasterTileSource | undefined;
            if (!source) return false;
            source.setTiles(basemap.tiles);
            for (const [property, value] of Object.entries(basemap.paint) as Array<[BasemapPaintProperty, number]>) {
                map.setPaintProperty('openstreetmap', property, value);
            }
            basemapControlRef.current?.setBasemap(basemapId);
            return true;
        };

        if (applyBasemap()) return;
        map.once('load', applyBasemap);
        return () => {
            map.off('load', applyBasemap);
        };
    }, [basemapId]);

    useEffect(() => {
        const stop = manifest.stops.find((candidate) => candidate.id === stopId);
        if (!stop || !mapRef.current) return;
        mapRef.current[reducedMotion ? 'jumpTo' : 'easeTo']({ center: stop.coordinates, zoom: 9 });
    }, [manifest.stops, reducedMotion, stopId]);

    const selectedTrack = manifest.route.tracks?.find((track) => track.id === trackId);
    const displayedRoute = route && trackId ? trackRoute(route, trackId) : route;
    const displayedDistance = displayedRoute
        ? routeFeatures(displayedRoute).reduce((total, feature) => total + featureDistanceKilometers(feature), 0)
        : 0;
    const trackDistances = route && !trackId
        ? (manifest.route.tracks ?? []).map((track) => ({
            ...track,
            distance: routeFeatures(trackRoute(route, track.id))
                .reduce((total, feature) => total + featureDistanceKilometers(feature), 0),
        })).filter((track) => track.distance > 0)
        : [];
    const mapAlt = selectedTrack
        ? `Map focused on ${selectedTrack.name}.`
        : manifest.route.alt ?? `Map of the route with ${manifest.stops.length} marked stops.`;

    return (
        <figure className="trip-breakout my-10">
            <div className="relative aspect-[16/10] min-h-72 w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
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
                {displayedDistance > 0 && (
                    <p className="text-sm font-medium text-zinc-300">
                        {selectedTrack?.name ?? 'Overall route'}: {formatDistance(displayedDistance)}
                    </p>
                )}
                {trackDistances.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-400">
                        {trackDistances.map((track) => (
                            <li key={track.id}>{track.name}: {formatDistance(track.distance)}</li>
                        ))}
                    </ul>
                )}
                <ol className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
                    {manifest.stops.map((stop, index) => (
                        <li
                            key={stop.id}
                            onMouseEnter={() => setHoveredStopId(stop.id)}
                            onMouseLeave={() => setHoveredStopId(null)}
                            className={`rounded px-1.5 py-0.5 transition-colors ${stop.id === (hoveredStopId ?? stopId) ? 'bg-amber-400 text-zinc-950' : 'hover:text-zinc-200'}`}
                        >
                            <span className={`mr-1 ${stop.id === (hoveredStopId ?? stopId) ? 'text-zinc-800' : 'text-zinc-500'}`}>
                                {index + 1}.
                            </span>
                            {stop.name}
                        </li>
                    ))}
                </ol>
            </figcaption>
        </figure>
    );
}