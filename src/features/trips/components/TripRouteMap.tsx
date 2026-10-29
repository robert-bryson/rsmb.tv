import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTripRoute } from '../useTripRoute';
import { routeCoordinates } from '../routeGeometry';
import { useTripStory } from '../TripStoryContext';
import { dayColor, routeBackgroundStyle, routeContextColor, routeLineColor, tripMapCoordinates, tripMapDayForTrack, tripMapDays, tripMapView, type TripMapFocus } from '../tripMapView';
import { useTripMapDismiss } from '../useTripMapDismiss';
import { useTripDayHover } from '../useTripDayHover';
import { useTripMapHighlight } from '../useTripMapHighlight';
import { basemaps, mapStyle, type BasemapId, type BasemapPaintProperty } from '../tripMapBasemaps';
import { BasemapControl, CollapsedAttributionControl, DownloadRouteControl, RouteActionsControl, StopsControl } from '../tripMapControls';
import { TripMapDayControls } from './TripMapDayControls';
import { TripRoutePreview } from './TripRoutePreview';
import type { TripManifest } from '../types';

type TripRouteMapProps = TripMapFocus & { active?: boolean; onExplore?: () => void; initialDayId?: string };
type DaySelection = { scope: string; selectedId?: string };

maplibregl.setWorkerUrl(maplibreWorkerUrl);

function mapBounds(coordinates: number[][]) {
    return coordinates.reduce((bounds, point) => bounds.extend(point as [number, number]),
        new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));
}

function stopFeatures(manifest: TripManifest, stops: TripManifest['stops']): FeatureCollection<Point> {
    return {
        type: 'FeatureCollection',
        features: stops.map(stop => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: stop.coordinates },
            properties: { id: stop.id, name: stop.name, number: manifest.stops.indexOf(stop) + 1 },
        })),
    };
}

function trackFilter(trackIds: string[]): maplibregl.ExpressionSpecification {
    return ['in', ['get', 'trackId'], ['literal', trackIds]];
}

export function TripRouteMap({ stopId, trackId, dayId, active = true, onExplore, initialDayId }: TripRouteMapProps) {
    const { manifest } = useTripStory();
    const getManifest = useEffectEvent(() => manifest);
    const reducedMotion = useReducedMotion();
    const figureRef = useRef<HTMLElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const basemapControlRef = useRef<BasemapControl | null>(null);
    const routeActionsControlRef = useRef<RouteActionsControl | null>(null);
    const stopsControlRef = useRef<StopsControl | null>(null);
    const appliedDayRef = useRef<{ map: maplibregl.Map; selection: DaySelection }>(null);
    const originalCameraRef = useRef<{ routeUrl: string; camera: maplibregl.JumpToOptions }>(null);
    const [basemapId, setBasemapId] = useState<BasemapId>('muted');
    const basemapIdRef = useRef(basemapId);
    const routeUrl = manifest.route.geoJson;
    const stopHighlight = useTripMapHighlight(routeUrl);
    const hoveredStopId = stopHighlight.id;
    const hoverStop = useEffectEvent((id?: string) => stopHighlight.onHover(id));
    const { route, error: routeError, retry } = useTripRoute(routeUrl);
    const requestedDayId = dayId ?? initialDayId;
    const dayScope = JSON.stringify([routeUrl, requestedDayId, trackId, stopId]);
    useEffect(() => { originalCameraRef.current = null; }, [dayScope]);
    const [daySelection, setDaySelection] = useState<DaySelection>({ scope: dayScope, selectedId: requestedDayId });
    if (daySelection.scope !== dayScope) {
        setDaySelection({ scope: dayScope, selectedId: requestedDayId });
    }
    const selectedDayId = daySelection.selectedId;
    const isBaseMap = !dayId && !trackId && !stopId;
    const getIsBaseMap = useEffectEvent(() => isBaseMap);
    const isOverview = isBaseMap && tripMapDays(manifest).length > 0;
    const getIsOverview = useEffectEvent(() => isOverview);
    const highlight = useTripMapHighlight(routeUrl);
    const emphasizedDayId = highlight.id ?? selectedDayId;
    const getDaySelection = useEffectEvent(() => daySelection);
    const [showStops, setShowStops] = useState(true);
    const toggleStops = useEffectEvent(() => setShowStops(visible => !visible));
    const stopsVisible = !isBaseMap && showStops;
    const view = useMemo(() => tripMapView(manifest, route, { dayId: selectedDayId, trackId }), [manifest, route, selectedDayId, trackId]);
    const getView = useEffectEvent(() => view);
    const getShowStops = useEffectEvent(() => stopsVisible);
    const [mapError, setMapError] = useState<{
        url: string;
        route: typeof route;
        stops: typeof manifest.stops;
        trackId?: string;
        dayId?: string;
        message: string;
    }>();
    const [stopSelection, setStopSelection] = useState({ routeUrl, requestedId: stopId, selectedId: stopId });
    if (stopSelection.routeUrl !== routeUrl || stopSelection.requestedId !== stopId) {
        setStopSelection({ routeUrl, requestedId: stopId, selectedId: stopId });
    }
    const selectedStopId = stopSelection.selectedId;
    const getSelectedStopId = useEffectEvent(() => selectedStopId);
    const [loadedMap, setLoadedMap] = useState<maplibregl.Map | null>(null);
    const currentMapError = mapError?.url === routeUrl && mapError.route === route &&
        mapError.stops === manifest.stops && mapError.trackId === trackId && mapError.dayId === dayId ? mapError.message : '';
    const error = routeError || currentMapError || view.error;
    const enabled = active && !error;
    const focusStop = (id: string) => {
        setStopSelection(current => ({ ...current, selectedId: id }));
        const stop = view.stops.find(candidate => candidate.id === id);
        if (stop && mapRef.current) {
            routeActionsControlRef.current?.showReset();
            mapRef.current[reducedMotion ? 'jumpTo' : 'easeTo']({ center: stop.coordinates, zoom: 9 });
        }
    };

    const handleMapStop = useEffectEvent(focusStop);
    const selectDay = (id?: string) => {
        if (!id) {
            showFullRoute();
            return;
        }
        const map = mapRef.current;
        if (!selectedDayId && map) {
            const center = map.getCenter();
            originalCameraRef.current = { routeUrl, camera: {
                center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), padding: map.getPadding(),
            } };
        }
        setDaySelection(current => ({ ...current, selectedId: id }));
        setStopSelection(current => ({ ...current, selectedId: '' }));
        stopHighlight.dismiss();
        routeActionsControlRef.current?.showReset();
    };
    const showFullRoute = () => {
        const map = mapRef.current;
        const originalCamera = originalCameraRef.current;
        if (map && isOverview && originalCamera?.routeUrl === routeUrl) {
            map.easeTo({ ...originalCamera.camera, duration: reducedMotion ? 0 : 300 });
        } else if (map && route) {
            const points = dayId ? tripMapCoordinates(view, showStops) : routeCoordinates(route);
            if (points.length) map.fitBounds(mapBounds(points), { padding: 40, maxZoom: 11, bearing: 0, pitch: 0, duration: reducedMotion ? 0 : 300 });
        }
        // A suspended or failed map must restore this camera when it is created again.
        if (map) originalCameraRef.current = null;
        highlight.dismiss();
        stopHighlight.dismiss();
        setStopSelection(current => ({ ...current, selectedId: '' }));
        if (!dayId) {
            // This reset already fitted the camera. A newer selection still needs its own fit.
            const selection = { ...daySelection, selectedId: undefined };
            if (map) appliedDayRef.current = { map, selection };
            setDaySelection(selection);
        }
    };
    const resetRoute = useEffectEvent(showFullRoute);
    useTripMapDismiss(figureRef, isOverview && Boolean(selectedDayId || highlight.id), ({ resetSelection }) => {
        highlight.dismiss();
        if (resetSelection && selectedDayId) showFullRoute();
    });
    const dismissDay = useEffectEvent(() => {
        if (isOverview && selectedDayId) showFullRoute();
    });
    const selectMapDay = useEffectEvent((id: string) => selectDay(selectedDayId === id ? undefined : id));
    const dayTooltipId = useTripDayHover({ map: loadedMap, mapRef, enabled: Boolean(enabled && isOverview),
        manifest, route, dayId: highlight.id, onHighlight: highlight.onHover });
    useEffect(() => {
        const manifest = getManifest();
        const stopId = getSelectedStopId();
        const initialView = getView();
        if (!enabled || !containerRef.current || !route || mapRef.current) return;

        const coordinates = tripMapCoordinates(initialView, getShowStops());
        if (coordinates.length === 0) return;
        const bounds = mapBounds(coordinates);
        const stops = stopFeatures(manifest, getIsBaseMap() ? [] : initialView.stops);
        const inlineFilter = dayId ? { filter: trackFilter(initialView.trackIds ?? []) } : {};
        const savedCamera = originalCameraRef.current;
        const restoredCamera = getIsOverview() && !initialView.day && savedCamera?.routeUrl === routeUrl ? savedCamera.camera : undefined;
        const style = mapStyle(basemapIdRef.current);
        let disposed = false;
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
                    ...(dayId ? [{
                        id: 'trip-route-context',
                        type: 'line' as const,
                        source: 'trip-route',
                        paint: { 'line-color': routeBackgroundStyle.color, 'line-width': routeBackgroundStyle.width, 'line-opacity': routeBackgroundStyle.opacity },
                        layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
                    }] : []),
                    {
                        id: 'trip-route-halo',
                        type: 'line',
                        source: 'trip-route',
                        ...inlineFilter,
                        paint: { 'line-color': routeBackgroundStyle.color, 'line-width': routeBackgroundStyle.width, 'line-opacity': routeBackgroundStyle.opacity },
                        layout: { 'line-cap': 'round', 'line-join': 'round' },
                    },
                    {
                        id: 'trip-route-line',
                        type: 'line',
                        source: 'trip-route',
                        paint: { 'line-color': trackId ? routeContextColor : routeLineColor(manifest), 'line-width': trackId ? 3 : 4, 'line-opacity': trackId ? 0.55 : 1 },
                        ...inlineFilter,
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
                        ...inlineFilter,
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
                        layout: { visibility: getShowStops() ? 'visible' : 'none' },
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
                        layout: { 'text-field': ['to-string', ['get', 'number']], 'text-size': 10, visibility: getShowStops() ? 'visible' : 'none' },
                        paint: { 'text-color': '#18181b' },
                    },
                ],
            },
            ...(restoredCamera ? {
                center: restoredCamera.center, zoom: restoredCamera.zoom, bearing: restoredCamera.bearing, pitch: restoredCamera.pitch,
            } : { bounds, fitBoundsOptions: { padding: 40, maxZoom: 11 } }),
            cooperativeGestures: true,
            attributionControl: false,
        });
        if (restoredCamera) {
            map.jumpTo({ padding: restoredCamera.padding });
            originalCameraRef.current = null;
        }
        if (getIsOverview() && initialView.day && originalCameraRef.current?.routeUrl !== routeUrl) {
            // A day may be chosen in the SVG before the interactive overview exists.
            const camera = map.cameraForBounds(mapBounds(routeCoordinates(route)), { padding: 40, maxZoom: 11 });
            if (camera?.zoom !== undefined) originalCameraRef.current = { routeUrl, camera: {
                ...camera, zoom: Math.max(map.getMinZoom(), camera.zoom - 1), pitch: 0,
            } };
        }
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
            if (disposed) return;
            const hoveredId = event.features?.[0]?.properties?.id;
            if (typeof hoveredId === 'string') hoverStop(hoveredId);
        });
        map.on('mouseleave', 'trip-stops', () => {
            if (disposed) return;
            hoverStop();
        });
        if (!trackId && !initialView.day && !restoredCamera) {
            map.once('load', () => {
                // An empty string marks an explicit reset; only undefined is the initial overview.
                if (!disposed && !getView().day && getSelectedStopId() === undefined) map.setZoom(Math.max(map.getMinZoom(), map.getZoom() - 1));
            });
        }

        if (!getIsBaseMap() && initialView.stops.length > 0) {
            const stopsControl = new StopsControl(() => toggleStops(), getShowStops());
            map.addControl(stopsControl, 'top-left');
            stopsControlRef.current = stopsControl;
        }
        const routeActionsControl = new RouteActionsControl(() => resetRoute(),
            Boolean(getSelectedStopId() || trackId || (!dayId && initialView.day)), dayId ? 'Show whole day' : 'Show full route');
        map.addControl(routeActionsControl, 'top-left');

        map.on('error', () => { if (!disposed) setMapError({
            url: routeUrl, route, stops: manifest.stops, trackId, dayId,
            message: 'The map could not load. You can still view the route preview.',
        }); });
        map.on('click', 'trip-stops', (event) => {
            if (disposed) return;
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === 'string') handleMapStop(id);
        });
        map.on('click', event => {
            if (disposed || map.queryRenderedFeatures(event.point, { layers: ['trip-stops'] }).length) return;
            const day = getIsOverview() ? map.queryRenderedFeatures(event.point, { layers: ['trip-route-halo'] })
                .map(feature => tripMapDayForTrack(getManifest(), feature.properties?.trackId)).find(Boolean) : undefined;
            if (day) selectMapDay(day.id);
            else dismissDay();
        });
        map.once('load', () => { if (!disposed) setLoadedMap(map); });
        mapRef.current = map;
        appliedDayRef.current = { map, selection: getDaySelection() };
        basemapControlRef.current = basemapControl;
        routeActionsControlRef.current = routeActionsControl;
        return () => {
            disposed = true;
            map.remove();
            mapRef.current = null;
            basemapControlRef.current = null;
            routeActionsControlRef.current = null;
            stopsControlRef.current = null;
        };
    }, [manifest.stops, manifest.days, route, routeUrl, trackId, dayId, isBaseMap, enabled]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || loadedMap !== map || view.error || !view.focusedRoute) return;
        // Each button press is a new camera request, including a press on the current day.
        const dayChanged = appliedDayRef.current?.map === map && appliedDayRef.current.selection !== daySelection;
        appliedDayRef.current = { map, selection: daySelection };
        const filter = view.trackIds
            ? trackFilter(view.trackIds) : null;
        map.setFilter('trip-route-line', dayId ? filter : null);
        map.setFilter('trip-route-halo', dayId ? filter : null);
        map.setFilter('trip-route-direction', filter);
        const stopsSource = map.getSource('trip-stops') as maplibregl.GeoJSONSource | undefined;
        stopsSource?.setData(stopFeatures(manifest, isBaseMap ? [] : view.stops));
        // A stop focus takes precedence when a suspended map is restored.
        if (dayChanged && !getSelectedStopId()) {
            const coordinates = tripMapCoordinates(view, getShowStops());
            if (coordinates.length) {
                map.fitBounds(mapBounds(coordinates), { padding: 40, maxZoom: 11, duration: reducedMotion ? 0 : 300 });
                if (selectedDayId) routeActionsControlRef.current?.showReset();
            }
        }
    }, [view, daySelection, selectedDayId, dayId, manifest, trackId, loadedMap, reducedMotion, isBaseMap]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || loadedMap !== map || trackId) return;
        const tracks = manifest.days?.find(day => day.id === emphasizedDayId)?.trackIds;
        const focused: maplibregl.ExpressionSpecification = tracks ? trackFilter(tracks) : ['literal', true];
        for (const property of ['line-color-transition', 'line-opacity-transition', 'line-width-transition'] as const) {
            map.setPaintProperty('trip-route-line', property, { duration: reducedMotion ? 0 : 300, delay: 0 });
        }
        map.setPaintProperty('trip-route-line', 'line-color', isOverview && emphasizedDayId
            ? ['case', focused, dayColor(manifest, emphasizedDayId), routeContextColor] : routeLineColor(manifest));
        map.setPaintProperty('trip-route-line', 'line-opacity', isOverview && emphasizedDayId ? ['case', focused, 1, 0.25] : 1);
        map.setPaintProperty('trip-route-line', 'line-width', emphasizedDayId ? ['case', focused, 6, 2] : 4);
    }, [manifest, emphasizedDayId, isOverview, trackId, loadedMap, reducedMotion]);

    useEffect(() => {
        stopsControlRef.current?.setVisible(stopsVisible);
        const map = mapRef.current;
        if (!map || loadedMap !== map) return;
        map.setLayoutProperty('trip-stops', 'visibility', stopsVisible ? 'visible' : 'none');
        map.setLayoutProperty('trip-stop-numbers', 'visibility', stopsVisible ? 'visible' : 'none');
    }, [stopsVisible, loadedMap]);

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
        const stop = getView().stops.find((candidate) => candidate.id === getSelectedStopId());
        const map = mapRef.current;
        if (!stop || !map || loadedMap !== map) return;
        map[reducedMotion ? 'jumpTo' : 'easeTo']({ center: stop.coordinates, zoom: 9 });
    }, [manifest.stops, reducedMotion, stopId, loadedMap]);

    if (!enabled) return <TripRoutePreview dayId={selectedDayId} trackId={trackId} stopId={selectedStopId}
        figureRef={figureRef} showStops={stopsVisible} onExplore={error ? undefined : onExplore} allowDaySelection={isBaseMap} onDaySelect={selectDay}
        onToggleStops={() => setShowStops(visible => !visible)}
        routeState={{ route, error: routeError, retry }}
        mapError={error} onRetry={error ? () => { setMapError(undefined); retry(); } : undefined} />;

    return (
        <figure ref={figureRef} className="trip-breakout my-10">
            <div className="relative aspect-[16/10] min-h-72 w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
                {manifest.route.staticImage && (
                    <img src={manifest.route.staticImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <div className="absolute inset-0">
                    <div ref={containerRef} role="region" aria-label={view.alt} className="h-full w-full" />
                </div>
                {!route && (
                    <div className="absolute inset-0 grid place-items-center bg-zinc-950/80 text-sm text-zinc-400">Loading route…</div>
                )}
            </div>
            <figcaption className="mt-3">
                {isBaseMap ? <TripMapDayControls manifest={manifest} dayId={selectedDayId} highlightedDayId={highlight.id} tooltipId={highlight.id ? dayTooltipId : undefined} onSelect={selectDay} onHighlight={highlight.onHover} onFocusDay={highlight.onFocus} />
                    : <ol hidden={!showStops} className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
                    {view.stops.map((stop) => (
                        <li
                            key={stop.id}
                            onMouseEnter={() => stopHighlight.onHover(stop.id)}
                            onMouseLeave={() => stopHighlight.onHover()}
                            className={`rounded px-1.5 py-0.5 transition-colors ${stop.id === (hoveredStopId ?? selectedStopId ?? stopId) ? 'bg-amber-400 text-zinc-950' : 'hover:text-zinc-200'}`}
                        >
                            <button type="button" aria-pressed={stop.id === (selectedStopId ?? stopId)} onClick={() => focusStop(stop.id)} onFocus={() => stopHighlight.onFocus(stop.id)} onBlur={() => stopHighlight.onFocus()} className="min-h-11 text-left">
                                <span className={`mr-1 ${stop.id === (hoveredStopId ?? selectedStopId ?? stopId) ? 'text-zinc-800' : 'text-zinc-400'}`}>
                                    {manifest.stops.indexOf(stop) + 1}.
                                </span>
                                {stop.name}{!view.day && (stop === view.stops[0] ? ' · Start' : stop === view.stops.at(-1) ? ' · Finish' : '')}
                            </button>
                            {stop.id === (selectedStopId ?? stopId) && <p className="text-xs">{[stop.date, stop.description].filter(Boolean).join(' · ')}</p>}
                        </li>
                    ))}
                </ol>}
            </figcaption>
        </figure>
    );
}
