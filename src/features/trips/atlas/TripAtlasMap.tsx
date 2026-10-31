import { useEffect, useEffectEvent, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './tripAtlasMap.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { formatMonthYear } from '../../../utils/formatDate';
import { routeCoordinates } from '../routeGeometry';
import { mapStyle } from '../tripMapBasemaps';
import { routeBackgroundStyle, setTripRouteTransitions } from '../tripMapView';
import { createTripMapTooltip } from '../tripMapTooltip';
import type { TripAtlasEntry } from './tripAtlasEntries';
import { combineAtlasRoutes, tripAtlasColor, type AtlasRouteState } from './tripAtlasView';
import type { AtlasCamera } from './tripAtlasSession';
import { encodeAtlasCamera } from './tripAtlasUrlState';
import { atlasTooltipPlacement } from './atlasTooltipPlacement';
import { restoreAtlasFullscreenControl, type AtlasFullscreenControl } from './AtlasFullscreenControl';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

interface Props {
    entries: TripAtlasEntry[];
    routes: Record<string, AtlasRouteState>;
    selectedId?: string;
    highlightedId?: string;
    fitVersion: number;
    fitRequest?: { tripId?: string; cancelled?: boolean };
    panelOpen: boolean;
    initialCamera?: AtlasCamera;
    cameraTarget?: AtlasCamera;
    cameraRevision?: string;
    urlKey?: string;
    fullscreenContainer?: RefObject<HTMLElement | null>;
    onSelect: (id: string | undefined, options?: { focusCard: boolean }) => void;
    onHover: (id?: string) => void;
    onCameraChange: (camera: AtlasCamera) => void;
    onCameraIdle?: (camera: AtlasCamera) => void;
    onViewChange?: (changed: boolean) => void;
}

function filterFor(id?: string): maplibregl.FilterSpecification {
    return ['==', ['get', 'tripId'], id ?? ''];
}

function layers(): maplibregl.LayerSpecification[] {
    return [
        { id: 'atlas-route-casing', type: 'line', source: 'atlas-routes', paint: { 'line-color': routeBackgroundStyle.color, 'line-width': routeBackgroundStyle.width, 'line-opacity': routeBackgroundStyle.opacity } },
        { id: 'atlas-routes', type: 'line', source: 'atlas-routes', paint: { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-opacity': 0.85 } },
        { id: 'atlas-selected-casing', type: 'line', source: 'atlas-routes', filter: filterFor(), paint: { 'line-color': routeBackgroundStyle.color, 'line-width': 8, 'line-opacity': routeBackgroundStyle.opacity } },
        { id: 'atlas-selected', type: 'line', source: 'atlas-routes', filter: filterFor(), paint: { 'line-color': ['get', 'color'], 'line-width': 5.5 } },
        { id: 'atlas-hover-casing', type: 'line', source: 'atlas-routes', filter: filterFor(), paint: { 'line-color': routeBackgroundStyle.color, 'line-width': 9, 'line-opacity': routeBackgroundStyle.opacity } },
        { id: 'atlas-hover', type: 'line', source: 'atlas-routes', filter: filterFor(), paint: { 'line-color': ['get', 'color'], 'line-width': 6.5 } },
    ].map(layer => ({ ...layer, layout: { 'line-cap': 'round', 'line-join': 'round' } })) as maplibregl.LayerSpecification[];
}

function padding(container: HTMLElement, selected: boolean) {
    // Fixed control space keeps fitting independent of attribution and tile timing.
    const phone = container.ownerDocument.defaultView?.matchMedia?.('(max-width: 767px)').matches;
    const base = { top: Math.min(72, container.clientHeight * 0.2), right: 56, bottom: phone ? 84 : 36, left: 48 };
    const breathingRoom = selected ? 16 : 0;
    return { top: base.top + breathingRoom, right: base.right + breathingRoom, bottom: base.bottom + breathingRoom, left: base.left + breathingRoom };
}

function routeBounds(routes: Record<string, AtlasRouteState>, selectedId?: string) {
    const states = selectedId ? [routes[selectedId]] : Object.values(routes);
    const points = states.flatMap(state => state?.route ? routeCoordinates(state.route) : []);
    if (!points.length) return;
    const bounds = new maplibregl.LngLatBounds(points[0] as [number, number], points[0] as [number, number]);
    for (const point of points) bounds.extend(point as [number, number]);
    return bounds;
}

export default function TripAtlasMap(props: Props) {
    const { routes, selectedId, highlightedId, fitVersion, panelOpen, entries } = props;
    const fitId = props.fitRequest ? props.fitRequest.tripId : selectedId;
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const fullscreenControl = useRef<AtlasFullscreenControl | null>(null);
    const [map, setMap] = useState<maplibregl.Map | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [failure, setFailure] = useState(false);
    const [tileFailure, setTileFailure] = useState(false);
    const [choices, setChoices] = useState<{ ids: string[]; x: number; y: number }>();
    const camera = useRef(props.initialCamera);
    const initialFitKey = useRef(`${fitId ?? 'all'}:${fitVersion}`);
    const userMoved = useRef(false);
    const suppressCameraPublish = useRef(false);
    const lastFit = useRef<{ map: maplibregl.Map; key: string } | undefined>(undefined);
    const reducedMotion = useReducedMotion();
    const tooltipId = useId();
    const tooltip = useRef<{ map: maplibregl.Map; label: ReturnType<typeof createTripMapTooltip> } | null>(null);
    const routeHover = useRef<{ id: string; coordinates: [number, number] } | null>(null);
    const choicePreview = useRef<{ hoveredId?: string; focusedId?: string }>({});
    const closeChoices = () => {
        choicePreview.current = {};
        routeHover.current = null;
        props.onHover(undefined);
        setChoices(undefined);
    };
    const dismissChoices = useEffectEvent(() => { if (choices) closeChoices(); });
    useEffect(() => {
        const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') dismissChoices(); };
        document.addEventListener('keydown', dismiss);
        return () => document.removeEventListener('keydown', dismiss);
    }, []);
    const data = useMemo(() => combineAtlasRoutes(routes), [routes]);
    const getCurrent = useEffectEvent(() => props);
    const select = useEffectEvent((id?: string) => props.onSelect(id));
    const hover = useEffectEvent((id?: string) => props.onHover(id));
    const rememberCamera = useEffectEvent((value: AtlasCamera) => props.onCameraChange(value));
    const publishCamera = useEffectEvent((value: AtlasCamera) => props.onCameraIdle?.(value));
    const compareOverview = useEffectEvent(() => {
        const instance = mapRef.current;
        if (!instance || !container.current || props.selectedId || lastFit.current?.map !== instance) return;
        if (!props.entries.every(entry => props.routes[entry.id]?.route || props.routes[entry.id]?.error)) return;
        // The initial overview animation should not expose its own reset control.
        if (!userMoved.current && props.fitVersion === 0 && instance.isMoving()) return;
        const bounds = routeBounds(props.routes);
        if (!bounds) return;
        const target = instance.cameraForBounds(bounds, { padding: padding(container.current, false), maxZoom: 10, bearing: 0 });
        if (!target?.center || target.zoom === undefined) return;
        const expected = instance.project(target.center);
        const actual = instance.project(instance.getCenter());
        const bearing = Math.abs(((instance.getBearing() + 540) % 360) - 180);
        props.onViewChange?.(Math.hypot(actual.x - expected.x, actual.y - expected.y) > 1
            || Math.abs(instance.getZoom() - target.zoom) > 0.01 || bearing > 0.1 || Math.abs(instance.getPitch()) > 0.1);
    });
    const clearTooltip = () => {
        tooltip.current?.label.remove();
        tooltip.current = null;
    };
    const showTooltip = useEffectEvent((id: string, coordinates: [number, number], anchor?: maplibregl.PositionAnchor) => {
        const instance = mapRef.current;
        const entry = props.entries.find(entry => entry.id === id);
        if (!instance || !entry?.summary || failure) return;
        if (tooltip.current?.map !== instance) {
            clearTooltip();
            tooltip.current = { map: instance, label: createTripMapTooltip(instance, tooltipId) };
        }
        tooltip.current.label.show({ label: entry.title, subtitle: formatMonthYear(entry.summary.dates.start, 'long'), color: tripAtlasColor(id), coordinates, anchor });
    });
    const refreshTooltip = useEffectEvent(() => {
        const instance = mapRef.current;
        const id = props.highlightedId;
        const route = id && props.routes[id]?.route;
        if (!instance || instance !== map || !id || !route || failure) { clearTooltip(); return; }
        const { clientWidth: width, clientHeight: height } = instance.getContainer();
        const hovered = routeHover.current?.id === id ? routeHover.current.coordinates : undefined;
        if (hovered) {
            const point = instance.project(hovered);
            if (point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height) { showTooltip(id, hovered); return; }
        }
        const placement = atlasTooltipPlacement(route, { width, height, project: coordinates => instance.project(coordinates),
            centerLongitude: instance.getRenderWorldCopies() ? instance.getCenter().lng : undefined });
        if (!placement) { clearTooltip(); return; }
        const coordinates = instance.unproject([placement.point.x, placement.point.y]);
        showTooltip(id, [coordinates.lng, coordinates.lat], placement.anchor);
    });

    useEffect(() => {
        if (!container.current) return;
        let disposed = false;
        let tooltipFrame = 0;
        const queueTooltip = () => {
            if (disposed || tooltipFrame) return;
            tooltipFrame = requestAnimationFrame(() => { tooltipFrame = 0; if (!disposed) refreshTooltip(); });
        };
        const current = getCurrent();
        const baseStyle = mapStyle('muted');
        let instance: maplibregl.Map;
        try {
            instance = new maplibregl.Map({
                container: container.current,
                style: {
                    ...baseStyle,
                    sources: { ...baseStyle.sources, 'atlas-routes': { type: 'geojson', data: combineAtlasRoutes(current.routes) } },
                    layers: [...baseStyle.layers, ...layers()],
                },
                ...(camera.current ?? { center: [-121.5, 46.5] as [number, number], zoom: 5.5 }),
                attributionControl: false,
            });
        } catch {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- An external WebGL renderer can fail during initialization.
            setFailure(true);
            return;
        }
        mapRef.current = instance;
        userMoved.current = Boolean(camera.current);
        // A retry restores the camera, but must not fulfill an outstanding fit request.
        lastFit.current = camera.current
            ? { map: instance, key: lastFit.current?.key ?? initialFitKey.current }
            : undefined;
        instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        // The atlas container outlives renderer retries. Retain its fullscreen state too.
        fullscreenControl.current = restoreAtlasFullscreenControl(
            current.fullscreenContainer?.current ?? container.current.parentElement ?? container.current,
            fullscreenControl.current,
        );
        instance.addControl(fullscreenControl.current, 'top-right');
        instance.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');
        let initialized = false;
        const ready = () => {
            if (!disposed && !initialized && instance.getLayer('atlas-selected')) {
                initialized = true;
                setMap(instance);
            }
        };
        instance.on('style.load', ready);
        instance.on('load', ready);
        instance.on('styledata', ready);
        const saveCamera = () => {
            // Strict Mode can dispose a renderer before its initial route fit.
            // Its default camera is not a view chosen by the reader.
            if (disposed || (!userMoved.current && lastFit.current?.map !== instance)) return;
            const center = instance.getCenter();
            camera.current = { center: [center.lng, center.lat], zoom: instance.getZoom(), bearing: instance.getBearing(), pitch: instance.getPitch() };
            rememberCamera(camera.current);
            return camera.current;
        };
        // Parent navigation cleanup can persist before this renderer is removed.
        // Keep its session current during animation and gestures, before moveend.
        instance.on('move', () => { saveCamera(); queueTooltip(); });
        instance.on('moveend', () => {
            const value = saveCamera();
            const current = getCurrent();
            const target = current.fitRequest ? current.fitRequest.tripId : current.selectedId;
            // An earlier animation must not publish a camera for a newer pending selection.
            if (value && !suppressCameraPublish.current && !instance.isMoving()
                && lastFit.current?.key === `${target ?? 'all'}:${current.fitVersion}`) publishCamera(value);
            compareOverview();
            queueTooltip();
        });
        instance.on('resize', () => {
            if (disposed) return;
            setChoices(undefined);
            choicePreview.current = {};
            routeHover.current = null;
            hover(undefined);
            compareOverview();
        });
        instance.on('movestart', event => {
            if (disposed || !event.originalEvent) return;
            userMoved.current = true;
            const current = getCurrent();
            // Manual movement handles this fit request, even while its route is loading.
            // A later explicit selection or overview request receives a new key.
            const target = current.fitRequest ? current.fitRequest.tripId : current.selectedId;
            lastFit.current = { map: instance, key: `${target ?? 'all'}:${current.fitVersion}` };
        });
        instance.on('error', event => {
            if (disposed) return;
            if (/webgl|context|worker/i.test(event.error?.message ?? '') || ('sourceId' in event && event.sourceId === 'atlas-routes')) setFailure(true);
            else setTileFailure(true);
        });
        instance.on('webglcontextlost', () => { if (!disposed) setFailure(true); });

        const candidates = (point: maplibregl.Point, radius: number) => {
            if (!instance.getLayer('atlas-routes')) return [];
            const bounds: [maplibregl.PointLike, maplibregl.PointLike] = [[point.x - radius, point.y - radius], [point.x + radius, point.y + radius]];
            return [...new Set(instance.queryRenderedFeatures(bounds, { layers: ['atlas-routes'] })
                .map(feature => feature.properties?.tripId as string | undefined).filter((id): id is string => Boolean(id)))];
        };
        instance.on('click', event => {
            if (disposed) return;
            const ids = candidates(event.point, 7);
            if (ids.length === 1) { setChoices(undefined); select(ids[0]); }
            else if (ids.length > 1) setChoices({ ids,
                x: Math.max(12, Math.min(event.point.x, instance.getContainer().clientWidth - 268)),
                y: Math.max(120, Math.min(event.point.y, instance.getContainer().clientHeight - 240)),
            });
            else {
                setChoices(undefined);
                routeHover.current = null;
                clearTooltip();
                // Dismiss the selection without treating this as an overview-fit request.
                lastFit.current = { map: instance, key: `all:${getCurrent().fitVersion}` };
                select(undefined);
            }
        });
        instance.on('mousemove', event => {
            if (disposed) return;
            const ids = candidates(event.point, 4);
            instance.getCanvas().style.cursor = ids.length ? 'pointer' : '';
            const selected = getCurrent().selectedId;
            const id = selected && ids.includes(selected) ? selected : ids[0];
            if (id) {
                const coordinates: [number, number] = [event.lngLat.lng, event.lngLat.lat];
                routeHover.current = { id, coordinates };
                hover(id);
                showTooltip(id, coordinates);
            } else {
                routeHover.current = null;
                hover(undefined);
            }
        });
        // Raster tiles must not hold up route paints on Linux WebKit.
        let repaintPending = false;
        const repaint = () => { repaintPending = false; if (!disposed) instance.triggerRepaint(); };
        const queueRepaint = () => {
            if (disposed || repaintPending) return;
            repaintPending = true;
            instance.once('render', repaint);
        };
        instance.on('styledata', queueRepaint);
        instance.on('sourcedata', event => { if (event.sourceId === 'atlas-routes') queueRepaint(); });

        return () => {
            saveCamera();
            disposed = true;
            cancelAnimationFrame(tooltipFrame);
            routeHover.current = null;
            if (tooltip.current?.map === instance) clearTooltip();
            instance.off('render', repaint);
            instance.remove();
            if (mapRef.current === instance) mapRef.current = null;
        };
    }, [attempt]);

    useEffect(() => {
        if (!map || mapRef.current !== map) return;
        (map.getSource('atlas-routes') as maplibregl.GeoJSONSource | undefined)?.setData(data);
    }, [map, data]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Filtering and panel layout changes invalidate the previous map choices.
        setChoices(undefined);
        choicePreview.current = {};
        routeHover.current = null;
    }, [entries, panelOpen]);

    useEffect(() => {
        if (!map || mapRef.current !== map || !map.getLayer('atlas-selected')) return;
        for (const id of ['atlas-selected', 'atlas-selected-casing']) map.setFilter(id, filterFor(highlightedId ? undefined : selectedId));
        for (const id of ['atlas-hover', 'atlas-hover-casing']) map.setFilter(id, filterFor(highlightedId));
        const emphasizedId = highlightedId ?? selectedId;
        const emphasized: maplibregl.ExpressionSpecification = ['==', ['get', 'tripId'], emphasizedId ?? ''];
        map.setFilter('atlas-route-casing', emphasizedId ? filterFor(emphasizedId) : null);
        setTripRouteTransitions(map, 'atlas-routes', reducedMotion);
        map.setPaintProperty('atlas-routes', 'line-opacity', emphasizedId ? ['case', emphasized, 1, 0.5] : 0.85);
    }, [map, selectedId, highlightedId, reducedMotion]);

    useEffect(() => {
        if (!highlightedId) routeHover.current = null;
        refreshTooltip();
    }, [map, highlightedId, entries, routes, failure]);

    useLayoutEffect(() => {
        const target = props.cameraTarget;
        if (!map || mapRef.current !== map || !target) return;
        const current: AtlasCamera = { center: [map.getCenter().lng, map.getCenter().lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
        // URL writes from this map must not interrupt movement or introduce rounding drift.
        if (encodeAtlasCamera(current) === encodeAtlasCamera(target)) return;
        // stop() can end an older animation synchronously. Its camera is not this URL's target.
        suppressCameraPublish.current = true;
        map.stop();
        suppressCameraPublish.current = false;
        userMoved.current = true;
        const currentProps = getCurrent();
        const targetId = currentProps.fitRequest ? currentProps.fitRequest.tripId : currentProps.selectedId;
        lastFit.current = { map, key: `${targetId ?? 'all'}:${currentProps.fitVersion}` };
        map.jumpTo(target);
    }, [map, props.cameraTarget, props.cameraRevision]);

    useEffect(() => {
        if (!map || mapRef.current !== map || !container.current || props.fitRequest?.cancelled) return;
        const key = `${fitId ?? 'all'}:${fitVersion}`;
        if (lastFit.current?.map === map && lastFit.current.key === key) return;
        const selected = fitId ? routes[fitId]?.route : null;
        if (fitId && !selected) return;
        if (!fitId && !entries.every(entry => routes[entry.id]?.route || routes[entry.id]?.error)) return;
        const bounds = routeBounds(routes, fitId);
        if (!bounds) return;
        suppressCameraPublish.current = true;
        map.stop();
        map.resize();
        suppressCameraPublish.current = false;
        lastFit.current = { map, key };
        map.fitBounds(bounds, { padding: padding(container.current, Boolean(fitId)), maxZoom: 10, bearing: 0, pitch: 0, duration: reducedMotion ? 0 : 500 });
    }, [map, routes, fitId, fitVersion, props.fitRequest?.cancelled, entries, reducedMotion]);

    useEffect(() => {
        // An instantaneous fit can finish before the router commits its selection URL.
        // Publish it again after that commit, without completing a still-pending fit.
        const current = getCurrent();
        const target = current.fitRequest ? current.fitRequest.tripId : current.selectedId;
        if (map && mapRef.current === map && camera.current && !map.isMoving()
            && lastFit.current?.map === map && lastFit.current.key === `${target ?? 'all'}:${current.fitVersion}`) publishCamera(camera.current);
    }, [map, props.urlKey]);

    useEffect(() => { compareOverview(); }, [map, routes, selectedId, fitVersion, panelOpen, entries]);

    const previewChoice = (kind: 'hoveredId' | 'focusedId', id?: string) => {
        choicePreview.current[kind] = id;
        routeHover.current = null;
        props.onHover(choicePreview.current.hoveredId ?? choicePreview.current.focusedId);
    };
    const retry = () => { setFailure(false); setTileFailure(false); setAttempt(value => value + 1); };
    return (
        <div className="absolute inset-0">
            <div ref={container} data-testid="trip-atlas-map" data-selected-trip={selectedId ?? ''} data-highlighted-trip={highlightedId ?? ''}
                onPointerLeave={() => { routeHover.current = null; props.onHover(undefined); }}
                onPointerOver={event => { if (event.target !== mapRef.current?.getCanvas()) { routeHover.current = null; props.onHover(undefined); } }}
                role="region" aria-label="Motorcycle trip routes. Choose a trip in the list to explore its route."
                className="trip-atlas-map h-full w-full" />
            {(failure || tileFailure) && <div role="status" className="absolute left-3 right-14 top-20 z-10 max-h-[calc(100%-7rem)] overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-900/95 p-3 text-sm text-zinc-200 md:left-auto md:max-w-64">
                <p>{failure ? 'The interactive map is unavailable. Trip reports are still available in the list.' : 'Some background tiles could not load. You can still explore the trip routes.'}</p>
                <button type="button" onClick={retry} className="min-h-11 text-violet-300 underline">Retry map</button>
            </div>}
            {choices && <div role="group" aria-label="Trips sharing this road" className="absolute z-30 w-64 rounded-xl border border-zinc-600 bg-zinc-950 p-3 shadow-xl"
                style={{ left: choices.x, top: choices.y }}>
                <p className="mb-2 flex min-h-8 items-center pr-8 text-sm font-medium">Trips sharing this road</p>
                <button type="button" onClick={closeChoices} aria-label="Close route choices"
                    className="absolute right-1 top-1 grid size-11 place-items-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-violet-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="size-4"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
                {choices.ids.map(id => <button key={id} type="button" onClick={event => { closeChoices(); props.onSelect(id, { focusCard: event.detail === 0 }); }}
                    onPointerEnter={event => { if (event.pointerType !== 'touch') previewChoice('hoveredId', id); }}
                    onPointerLeave={() => previewChoice('hoveredId')}
                    onFocus={() => previewChoice('focusedId', id)} onBlur={() => previewChoice('focusedId')}
                    style={{ color: tripAtlasColor(id) }}
                    className="block min-h-11 w-full rounded px-2 text-left text-sm hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-violet-400">{entries.find(entry => entry.id === id)?.title ?? id}</button>)}
            </div>}
        </div>
    );
}
