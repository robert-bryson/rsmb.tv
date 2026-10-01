import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTripRoute } from '../useTripRoute';
import { routeCoordinates, trackRoute } from '../routeGeometry';
import { useTripStory } from '../TripStoryContext';

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
                'raster-brightness-max': 0.65,
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

// Seed compact mode before source metadata arrives so MapLibre does not expand it.
class CollapsedAttributionControl extends maplibregl.AttributionControl {
    onAdd(map: maplibregl.Map) {
        const container = super.onAdd(map);
        container.classList.add('maplibregl-compact');
        container.classList.remove('maplibregl-compact-show');
        container.removeAttribute('open');
        return container;
    }
}

class DownloadRouteControl implements maplibregl.IControl {
    private readonly container = document.createElement('div');

    constructor(routeUrl: string) {
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group trip-route-download';
        const download = document.createElement('a');
        download.href = routeUrl;
        download.download = '';
        download.target = '_blank';
        download.rel = 'noreferrer';
        download.title = 'Download route (GeoJSON)';
        download.setAttribute('aria-label', download.title);
        download.innerHTML = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" /></svg>';
        this.container.append(download);
    }

    onAdd() {
        return this.container;
    }

    onRemove() {
        this.container.remove();
    }
}

class RouteActionsControl implements maplibregl.IControl {
    private readonly container = document.createElement('div');
    private readonly reset = document.createElement('button');
    private map?: maplibregl.Map;

    constructor(onReset: () => void, initiallyFocused: boolean) {
        this.container.className = 'maplibregl-ctrl trip-route-actions';
        this.reset.type = 'button';
        this.reset.textContent = 'Show full route';
        this.reset.hidden = !initiallyFocused;
        this.reset.addEventListener('click', () => {
            this.map?.stop();
            this.map?.once('moveend', this.hideReset);
            onReset();
        });

        this.container.append(this.reset);
    }

    private showReset = () => { this.reset.hidden = false; };
    private hideReset = () => { this.reset.hidden = true; };
    private watchMovement = () => {
        // Let the initial stop-focus animation finish before watching for changes.
        if (this.map?.isMoving()) this.map.once('moveend', this.watchMovement);
        else this.map?.on('move', this.showReset);
    };

    onAdd(map: maplibregl.Map) {
        this.map = map;
        map.once('load', this.watchMovement);
        return this.container;
    }

    onRemove() {
        this.map?.off('load', this.watchMovement);
        this.map?.off('move', this.showReset);
        this.map?.off('moveend', this.hideReset);
        this.map?.off('moveend', this.watchMovement);
        this.container.remove();
        this.map = undefined;
    }
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
    const { route, error: routeError, retry } = useTripRoute(routeUrl);
    const [mapError, setMapError] = useState<{ url: string; message: string }>();
    const [selectedStopId, setSelectedStopId] = useState(stopId);
    const [loadedMap, setLoadedMap] = useState<maplibregl.Map | null>(null);
    const initialStopId = useRef(stopId);
    const missingTrack = route && trackId && routeCoordinates(trackRoute(route, trackId)).length === 0;
    const error = routeError || (mapError?.url === routeUrl ? mapError.message : '') || (missingTrack ? `Route does not contain track "${trackId}".` : '');
    const focusStop = (id: string) => {
        setSelectedStopId(id);
        const stop = manifest.stops.find(candidate => candidate.id === id);
        if (stop && mapRef.current) mapRef.current[reducedMotion ? 'jumpTo' : 'easeTo']({ center: stop.coordinates, zoom: 9 });
    };

    const handleMapStop = useEffectEvent(focusStop);
    const showFullRoute = useEffectEvent(() => {
        if (!route || !mapRef.current) return;
        const points = routeCoordinates(route);
        const bounds = points.reduce((bounds, point) => bounds.extend(point as [number, number]), new maplibregl.LngLatBounds());
        mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 11, bearing: 0, pitch: 0, duration: reducedMotion ? 0 : 300 });
        setSelectedStopId('');
    });
    useEffect(() => {
        const stopId = initialStopId.current;
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
        map.addControl(new DownloadRouteControl(routeUrl), 'top-right');
        map.addControl(new CollapsedAttributionControl({ compact: true }));
        map.on('mouseenter', 'trip-stops', (event) => {
            const hoveredId = event.features?.[0]?.properties?.id;
            if (typeof hoveredId === 'string') setHoveredStopId(hoveredId);
        });
        map.on('mouseleave', 'trip-stops', () => {
            setHoveredStopId(null);
        });
        if (!trackId) {
            map.once('load', () => {
                if (!stopId) map.setZoom(Math.max(map.getMinZoom(), map.getZoom() - 1));
            });
        }

        map.addControl(new RouteActionsControl(() => showFullRoute(), Boolean(stopId || trackId)), 'top-left');

        map.on('error', () => setMapError({ url: routeUrl, message: 'The map could not load. You can still read the stops below.' }));
        map.on('click', 'trip-stops', (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === 'string') handleMapStop(id);
        });
        map.once('load', () => setLoadedMap(map));
        mapRef.current = map;
        basemapControlRef.current = basemapControl;
        return () => {
            map.remove();
            mapRef.current = null;
            basemapControlRef.current = null;
        };
    }, [manifest.stops, route, routeUrl, trackId]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || loadedMap !== map) return;
        const activeStopId = hoveredStopId ?? selectedStopId ?? stopId ?? '';
        const isActiveStop: maplibregl.ExpressionSpecification = ['==', ['get', 'id'], activeStopId];
        map.setPaintProperty('trip-stops', 'circle-color', ['case', isActiveStop, '#f59e0b', '#fafafa']);
        map.setPaintProperty('trip-stops', 'circle-radius', ['case', isActiveStop, 11, 8]);
    }, [hoveredStopId, selectedStopId, stopId, loadedMap]);

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
    }, [basemapId, loadedMap]);

    useEffect(() => {
        const stop = manifest.stops.find((candidate) => candidate.id === stopId);
        if (!stop || !mapRef.current) return;
        mapRef.current[reducedMotion ? 'jumpTo' : 'easeTo']({ center: stop.coordinates, zoom: 9 });
    }, [manifest.stops, reducedMotion, stopId, route]);

    const selectedTrack = manifest.route.tracks?.find((track) => track.id === trackId);
    const mapAlt = selectedTrack
        ? `Map focused on ${selectedTrack.name}.`
        : manifest.route.alt ?? `Map of the route with ${manifest.stops.length} marked stops.`;

    return (
        <figure className="trip-breakout my-10">
            <div className="relative aspect-[16/10] min-h-72 w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
                {manifest.route.staticImage && (
                    <img src={manifest.route.staticImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                {(
                    <div className="absolute inset-0" inert={Boolean(error)} aria-hidden={Boolean(error)}>
                        <div ref={containerRef} role="region" aria-label={mapAlt} className="h-full w-full" />
                    </div>
                )}
                {!route && !error && (
                    <div className="absolute inset-0 grid place-items-center bg-zinc-950/80 text-sm text-zinc-400">Loading route…</div>
                )}
                {error && (
                    <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-zinc-300"><div role="status">{error}<button type="button" className="mx-auto mt-3 block min-h-11 rounded border border-zinc-600 px-4" onClick={() => { setMapError(undefined); retry(); }}>Retry route</button></div></div>
                )}
            </div>
            <figcaption className="mt-3">
                {error && <a href={routeUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm text-violet-300 underline">Download route (GeoJSON)</a>}
                <ol className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
                    {manifest.stops.map((stop, index) => (
                        <li
                            key={stop.id}
                            onMouseEnter={() => setHoveredStopId(stop.id)}
                            onMouseLeave={() => setHoveredStopId(null)}
                            className={`rounded px-1.5 py-0.5 transition-colors ${stop.id === (hoveredStopId ?? selectedStopId ?? stopId) ? 'bg-amber-400 text-zinc-950' : 'hover:text-zinc-200'}`}
                        >
                            <button type="button" aria-pressed={stop.id === (selectedStopId ?? stopId)} onClick={() => focusStop(stop.id)} onFocus={() => setHoveredStopId(stop.id)} onBlur={() => setHoveredStopId(null)} className="min-h-11 text-left">
                            <span className={`mr-1 ${stop.id === (hoveredStopId ?? selectedStopId ?? stopId) ? 'text-zinc-800' : 'text-zinc-400'}`}>
                                {index + 1}.
                            </span>
                            {stop.name}{index === 0 ? ' · Start' : index === manifest.stops.length - 1 ? ' · Finish' : ''}
                            </button>
                            {stop.id === (selectedStopId ?? stopId) && <p className="text-xs">{[stop.date, stop.description].filter(Boolean).join(' · ')}</p>}
                        </li>
                    ))}
                </ol>
            </figcaption>
        </figure>
    );
}