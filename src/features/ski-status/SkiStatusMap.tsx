import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cartoRasterStyle, cartoVectorStyleUrl } from '../../maps/cartoBasemaps';
import { applyGlobeStyle, globeOverviewZoom, projectVisibleGlobeLocation } from '../../maps/globe';
import * as maplibre from '../../maps/maplibre';
import { recoverBasemap, type BasemapState } from '../../maps/recoverBasemap';
import { distanceSquared, type TooltipPoint } from '../../maps/screenGeometry';
import { skiAreaBounds, skiAreaIdsInViewport, type PassFilter, type SkiUnits } from './browse';
import { passFamilySchema, skiAreas, type SkiArea } from './catalog';
import { markerAppearance, multiplePassColor, passBadgeId, passBadgeSize, passBadgeTextColor, type MarkerMode } from './mapAppearance';
import { passIconUrls } from './passIcons';
import { resortFootprintLayer, resortTerrainGroups, resortTerrainLabel, resortTerrainMinZoom, resortTerrainSource, syncResortTerrain } from './resortTerrain';
import { SkiAreaPopup } from './SkiAreaPopup';
import 'maplibre-gl/dist/maplibre-gl.css';
import './skiAreaPopup.css';

const sourceId = 'ski-areas';
const pointLayer = 'ski-area-points';
const selectedLayer = 'ski-area-selected';
const passBadgeLayer = 'ski-status-pass-badges';
const selectedPassBadgeLayer = 'ski-status-selected-pass-badge';
const passImagePrefix = 'ski-status-pass-badge-';
const selectedPassImagePrefix = 'ski-status-selected-pass-badge-';
const markerLayers = [selectedLayer, pointLayer, passBadgeLayer, selectedPassBadgeLayer];
const terrainSource = 'ski-terrain-dem';
const terrainLayer = 'ski-terrain-relief';
const reliefMinZoom = 8;
const pointZoom = 9;
const minZoom = -2;
const maxZoom = 16;
const overviewCenter: [number, number] = [-100, 44];
const providerStyle = () => cartoVectorStyleUrl('dark-matter');

interface Props {
    areas: readonly SkiArea[];
    selected?: SkiArea;
    colors: MarkerMode;
    passFilter?: PassFilter;
    terrain: boolean;
    resortTerrain: boolean;
    visible: boolean;
    inView: boolean;
    units: SkiUnits;
    onVisibleAreasChange: (ids: ReadonlySet<string>) => void;
    onSelect: (id?: string) => void;
}

function fitAreas(map: maplibre.Map, areas: readonly SkiArea[], duration: number) {
    const bounds = skiAreaBounds(areas);
    if (!bounds) return;
    const { clientWidth, clientHeight } = map.getContainer();
    const padding = Math.min(46, clientWidth / 4, clientHeight / 4);
    if (!padding) return;
    map.resize();
    if (bounds[2] - bounds[0] >= 180) {
        // A single face of the globe cannot show results spread around the world.
        let center: maplibre.LngLatLike = overviewCenter;
        if (areas.length !== skiAreas.length) {
            const current = map.getCenter();
            let nearestDistance = Infinity;
            for (const area of areas) {
                const location = maplibre.LngLat.convert(area.location.coordinates);
                const distance = current.distanceTo(location);
                if (distance >= nearestDistance) continue;
                nearestDistance = distance;
                center = location;
            }
        }
        map.easeTo({ center, zoom: globeOverviewZoom(clientWidth, clientHeight), duration });
        return;
    }
    map.fitBounds(bounds, { padding, maxZoom: pointZoom, duration });
}

function highlightArea(map: maplibre.Map, area?: SkiArea) {
    const selectedId = area?.id ?? '';
    const isSelected: maplibre.FilterSpecification = ['==', ['get', 'areaId'], selectedId];
    map.setFilter(selectedLayer, isSelected);
    if (map.getLayer(passBadgeLayer)) {
        const badges = map.listImages().filter(id => id.startsWith(passImagePrefix)).map(id => id.slice(passImagePrefix.length));
        const hasBadge: maplibre.FilterSpecification = ['in', ['get', 'passBadge'], ['literal', badges]];
        map.setFilter(passBadgeLayer, ['all', hasBadge, ['!=', ['get', 'areaId'], selectedId]]);
        map.setFilter(selectedPassBadgeLayer, ['all', hasBadge, isSelected]);
    }
}

function addAreaLayers(map: maplibre.Map, data: FeatureCollection<Point>) {
    map.addSource(sourceId, {
        type: 'geojson', data,
        attribution: '<a href="https://www.openskidata.org/">OpenSkiData</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    });
    map.addLayer({
        id: pointLayer, type: 'circle', source: sourceId,
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 6, 4, 10, 6],
            'circle-color': ['get', 'color'], 'circle-stroke-color': '#18181b', 'circle-stroke-width': 1,
        },
    });
    map.addLayer({
        id: selectedLayer, type: 'circle', source: sourceId,
        paint: { 'circle-radius': 7, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fbbf24', 'circle-stroke-width': 3 },
    });
}

async function loadPassImages(map: maplibre.Map) {
    return Promise.all(passFamilySchema.options.map(async family => {
        try {
            return { family, image: (await map.loadImage(passIconUrls[family])).data };
        } catch {
            return { family };
        }
    }));
}

function drawPassBadge(context: CanvasRenderingContext2D, image: CanvasImageSource, multiple: boolean, selected: boolean) {
    context.clearRect(0, 0, passBadgeSize, passBadgeSize);
    const inset = 1.5;
    const size = passBadgeSize - 2 * inset;
    context.beginPath();
    context.roundRect(inset, inset, size, size, 4);
    context.fillStyle = passBadgeTextColor;
    context.fill();
    context.save();
    context.clip();
    context.drawImage(image, inset, inset, size, size);
    context.restore();
    context.strokeStyle = selected ? '#fbbf24' : passBadgeTextColor;
    context.lineWidth = selected ? 2.5 : 1.5;
    context.stroke();

    if (!multiple) return;
    const corner = passBadgeSize - 6;
    context.beginPath();
    context.arc(corner, corner, 5.5, 0, Math.PI * 2);
    context.fillStyle = multiplePassColor;
    context.fill();
    context.strokeStyle = passBadgeTextColor;
    context.lineWidth = 1;
    context.stroke();
    context.beginPath();
    context.moveTo(corner - 2.5, corner);
    context.lineTo(corner + 2.5, corner);
    context.moveTo(corner, corner - 2.5);
    context.lineTo(corner, corner + 2.5);
    context.lineWidth = 1.6;
    context.stroke();
}

function addPassBadges(map: maplibre.Map, images: Awaited<ReturnType<typeof loadPassImages>>) {
    if (map.getLayer(passBadgeLayer) || !images.some(({ image }) => image)) return;
    const pixelRatio = 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = passBadgeSize * pixelRatio;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.scale(pixelRatio, pixelRatio);
    for (const { family, image } of images) {
        if (!image) continue;
        for (const multiple of [false, true]) {
            for (const selected of [false, true]) {
                drawPassBadge(context, image, multiple, selected);
                const id = (selected ? selectedPassImagePrefix : passImagePrefix) + passBadgeId(family, multiple);
                map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio });
            }
        }
    }

    for (const [id, prefix] of [[passBadgeLayer, passImagePrefix], [selectedPassBadgeLayer, selectedPassImagePrefix]]) {
        map.addLayer({
            id, type: 'symbol', source: sourceId,
            layout: {
                'icon-image': ['image', ['concat', prefix, ['get', 'passBadge']]],
                'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.68, 5, 0.8, 9, 0.95, 12, 1],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-rotation-alignment': 'viewport',
            },
        });
    }
}

function syncTerrain(map: maplibre.Map, enabled: boolean) {
    if (!enabled) {
        if (map.getLayer(terrainLayer)) map.removeLayer(terrainLayer);
        if (map.getSource(terrainSource)) map.removeSource(terrainSource);
        return;
    }
    if (map.getLayer(terrainLayer) || !map.getLayer(pointLayer)) return;
    map.addSource(terrainSource, {
        type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
        encoding: 'terrarium', tileSize: 512, minzoom: 8, maxzoom: 12,
        attribution: '<a href="https://mapterhorn.com/attribution/">© Mapterhorn terrain</a>',
    });
    const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol' && !markerLayers.includes(layer.id));
    const before = firstLabel?.id ?? (map.getLayer(resortFootprintLayer) ? resortFootprintLayer : pointLayer);
    map.addLayer({
        id: terrainLayer, type: 'hillshade', source: terrainSource, minzoom: reliefMinZoom,
        paint: { 'hillshade-exaggeration': 0.4, 'hillshade-shadow-color': '#09090b', 'hillshade-highlight-color': '#cbd5e1' },
    }, before);
}

function closestArea(map: maplibre.Map, point: TooltipPoint, areas: ReadonlyMap<string, SkiArea>, padding = 0) {
    const layers = markerLayers.filter(layer => map.getLayer(layer));
    if (!layers.length) return;

    const features = map.queryRenderedFeatures(padding ? [
        [point.x - padding, point.y - padding], [point.x + padding, point.y + padding],
    ] : [point.x, point.y], { layers });
    let nearest: SkiArea | undefined;
    let nearestDistance = Infinity;
    for (const feature of features) {
        const id: unknown = feature.properties.areaId;
        const area = typeof id === 'string' ? areas.get(id) : undefined;
        if (!area) continue;
        const position = projectVisibleGlobeLocation(map, area.location.coordinates);
        if (!position) continue;
        const distance = distanceSquared(point, position);
        if (distance >= nearestDistance) continue;
        nearest = area;
        nearestDistance = distance;
    }
    return nearest;
}

export default function SkiStatusMap({ areas, selected, colors, passFilter, terrain, resortTerrain, visible, inView, units, onVisibleAreasChange, onSelect }: Props) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibre.Map | null>(null);
    const recoveryRef = useRef<ReturnType<typeof recoverBasemap> | null>(null);
    const passImages = useRef<ReturnType<typeof loadPassImages> | undefined>(undefined);
    const terrainPopupRef = useRef<maplibre.Popup | undefined>(undefined);
    const appliedCamera = useRef<{ areas: readonly SkiArea[]; selectedId?: string } | undefined>(undefined);
    const [attempt, setAttempt] = useState(0);
    const [basemap, setBasemap] = useState<BasemapState>('loading');
    const [ready, setReady] = useState(false);
    const [rendererFailed, setRendererFailed] = useState(false);
    const [markersFailed, setMarkersFailed] = useState(false);
    const [terrainUnavailable, setTerrainUnavailable] = useState(false);
    const [resortTerrainUnavailable, setResortTerrainUnavailable] = useState(false);
    const [mapZoom, setMapZoom] = useState(1);
    const [hovered, setHovered] = useState<SkiArea>();
    const reducedMotion = useReducedMotion();
    const duration = reducedMotion ? 0 : 280;
    const areasById = useMemo(() => new Map(areas.map(area => [area.id, area])), [areas]);
    const terrainGroups = useMemo(() => resortTerrainGroups(areas), [areas]);
    const showResortTerrain = visible && resortTerrain && terrainGroups.length > 0;
    const points = useMemo<FeatureCollection<Point>>(() => ({
        type: 'FeatureCollection',
        features: areas.map(area => ({
            type: 'Feature', id: area.id, properties: { areaId: area.id, ...markerAppearance(area, colors, passFilter) },
            geometry: { type: 'Point', coordinates: area.location.coordinates },
        })),
    }), [areas, colors, passFilter]);
    const current = useEffectEvent(() => ({ areasById, points, selected, colors, terrain }));
    const syncResortDetails = useEffectEvent((map: maplibre.Map) => {
        const reload = showResortTerrain && resortTerrainUnavailable && !map.getSource(resortTerrainSource)
            && map.getZoom() >= resortTerrainMinZoom && Boolean(map.getLayer(pointLayer));
        if (reload) setResortTerrainUnavailable(false);
        syncResortTerrain(map, pointLayer, showResortTerrain ? terrainGroups : [], reload);
    });
    const selectArea = useEffectEvent(onSelect);
    const syncPassBadges = useEffectEvent((map: maplibre.Map) => {
        if (colors !== 'pass' || !map.getSource(sourceId) || map.getLayer(passBadgeLayer)) return;
        passImages.current ??= loadPassImages(map);
        void passImages.current.then(images => {
            if (mapRef.current !== map || !map.getSource(sourceId)) return;
            const data = current();
            if (data.colors !== 'pass') return;
            addPassBadges(map, images);
            highlightArea(map, data.selected);
        });
    });
    const syncCamera = useEffectEvent((map: maplibre.Map) => {
        if (!visible || !map.getLayer(pointLayer)) return;
        const { clientWidth, clientHeight } = map.getContainer();
        if (!clientWidth || !clientHeight) return;

        // Keep changes pending while the map is hidden or a replacement style loads.
        const previous = appliedCamera.current;
        appliedCamera.current = { areas, selectedId: selected?.id };
        if (inView && previous) return;
        if (selected && selected.id !== previous?.selectedId) {
            map.resize();
            map.easeTo({
                center: selected.location.coordinates,
                zoom: previous ? Math.max(pointZoom, map.getZoom()) : pointZoom,
                duration: previous ? duration : 0,
            });
        } else if (!selected && areas !== previous?.areas) {
            fitAreas(map, areas, previous ? duration : 0);
        }
    });
    const reportViewport = useEffectEvent((map: maplibre.Map) => {
        if (!visible || map.isMoving() || !map.getLayer(pointLayer)) return;
        const { clientWidth, clientHeight } = map.getContainer();
        if (!clientWidth || !clientHeight) return;
        // Use all locations so filters can change while the map is hidden in Table view.
        const viewport = { left: 0, top: 0, right: clientWidth, bottom: clientHeight };
        onVisibleAreasChange(skiAreaIdsInViewport(skiAreas, viewport, coordinates => projectVisibleGlobeLocation(map, coordinates)));
    });

    useEffect(() => {
        let map: maplibre.Map | undefined;
        let viewportFrame: number | undefined;
        function queueViewport() {
            if (viewportFrame !== undefined) return;
            viewportFrame = requestAnimationFrame(() => {
                viewportFrame = undefined;
                if (map) reportViewport(map);
            });
        }
        const frame = requestAnimationFrame(() => {
            if (!container.current) return;
            let instance: maplibre.Map;
            try {
                instance = new maplibre.Map({
                    container: container.current, style: providerStyle(), center: overviewCenter, zoom: 1,
                    minZoom, maxZoom, dragRotate: false, pitchWithRotate: false,
                });
            } catch {
                setRendererFailed(true);
                return;
            }
            map = instance;
            mapRef.current = instance;
            const canvas = instance.getCanvas();
            if (document.activeElement === instance.getContainer()) canvas.focus({ preventScroll: true });
            const terrainPopup = new maplibre.Popup({
                closeButton: false, closeOnClick: false, closeOnMove: true, focusAfterOpen: false, offset: 9,
                className: 'ski-area-popup ski-area-popup-hover', maxWidth: '15rem',
            });
            terrainPopupRef.current = terrainPopup;
            let previousLabel: string | undefined;
            const showTerrainLabel = (event: maplibre.MapMouseEvent) => {
                const label = resortTerrainLabel(instance, event.point);
                if (!label) {
                    terrainPopup.remove();
                    return;
                }
                if (label !== previousLabel) {
                    terrainPopup.setText(label);
                    previousLabel = label;
                }
                terrainPopup.setLngLat(event.lngLat);
                if (!terrainPopup.isOpen()) terrainPopup.addTo(instance);
            };
            const updateHover = (area?: SkiArea) => {
                canvas.style.cursor = area ? 'pointer' : '';
                setHovered(area);
            };
            const clearHover = () => {
                terrainPopup.remove();
                updateHover();
            };
            const settleViewport = () => {
                const zoom = instance.getZoom();
                setMapZoom(zoom);
                if (zoom >= resortTerrainMinZoom && !instance.getSource(resortTerrainSource)) syncResortDetails(instance);
                queueViewport();
            };
            instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
            recoveryRef.current = recoverBasemap(instance, {
                dataSources: new Set([sourceId, terrainSource, resortTerrainSource]), providerStyle, neutralStyle: () => cartoRasterStyle('dark', ''),
            }, state => {
                setBasemap(state);
                if (state !== 'ready') setReady(false);
            });
            instance.on('style.load', () => {
                clearHover();
                applyGlobeStyle(instance);
                const data = current();
                if (!instance.getSource(sourceId)) addAreaLayers(instance, data.points);
                highlightArea(instance, data.selected);
                syncPassBadges(instance);
                syncTerrain(instance, data.terrain);
                setTerrainUnavailable(false);
                setResortTerrainUnavailable(false);
                syncCamera(instance);
                settleViewport();
            });
            instance.on('resize', () => {
                clearHover();
                syncCamera(instance);
                queueViewport();
            });
            instance.on('movestart', clearHover);
            instance.on('moveend', settleViewport);
            instance.on('projectiontransition', queueViewport);
            instance.on('sourcedata', event => {
                if (event.sourceId === sourceId && event.isSourceLoaded) setReady(true);
                // A new relief source emits metadata before its tiles can fail again.
                if (event.sourceId === terrainSource && event.sourceDataType === 'metadata') setTerrainUnavailable(false);
                if (event.sourceId === resortTerrainSource && event.isSourceLoaded && event.sourceDataType === 'content') setResortTerrainUnavailable(false);
            });
            instance.on('webglcontextlost', () => setRendererFailed(true));
            instance.on('webglcontextrestored', () => setRendererFailed(false));
            instance.on('error', event => {
                const failedSource = 'sourceId' in event ? event.sourceId : undefined;
                if (failedSource === sourceId) setMarkersFailed(true);
                else if (failedSource === terrainSource) setTerrainUnavailable(true);
                else if (failedSource === resortTerrainSource) setResortTerrainUnavailable(true);
                else if (/webgl|context|worker/i.test(event.error?.message ?? '')) setRendererFailed(true);
            });
            instance.on('mousemove', event => {
                if (instance.isMoving()) return;
                const area = closestArea(instance, event.point, current().areasById);
                updateHover(area);
                if (area) terrainPopup.remove();
                else showTerrainLabel(event);
            });
            instance.on('mouseout', clearHover);
            instance.on('click', event => {
                if (!instance.getSource(sourceId) || !instance.isSourceLoaded(sourceId)) return;
                clearHover();
                const touch = 'pointerType' in event.originalEvent && event.originalEvent.pointerType === 'touch';
                const area = closestArea(instance, event.point, current().areasById, touch ? 10 : 0);
                selectArea(area?.id);
                if (!area) showTerrainLabel(event);
            });
        });
        return () => {
            cancelAnimationFrame(frame);
            if (viewportFrame !== undefined) cancelAnimationFrame(viewportFrame);
            recoveryRef.current?.dispose();
            recoveryRef.current = null;
            terrainPopupRef.current?.remove();
            terrainPopupRef.current = undefined;
            map?.remove();
            mapRef.current = null;
            passImages.current = undefined;
            appliedCamera.current = undefined;
        };
    }, [attempt]);

    useEffect(() => {
        mapRef.current?.getSource<maplibre.GeoJSONSource>(sourceId)?.setData(points);
    }, [points]);

    useEffect(() => {
        const map = mapRef.current;
        if (map) syncCamera(map);
    }, [areas, selected, visible, inView]);

    useEffect(() => {
        const map = mapRef.current;
        if (map) syncTerrain(map, terrain);
    }, [terrain]);

    useEffect(() => {
        terrainPopupRef.current?.remove();
        const map = mapRef.current;
        if (map) syncResortDetails(map);
    }, [terrainGroups, showResortTerrain]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map?.getLayer(selectedLayer)) return;
        syncPassBadges(map);
        highlightArea(map, selected);
    }, [colors, selected]);

    function closePopup() {
        setHovered(undefined);
        mapRef.current?.getCanvas().focus({ preventScroll: true });
        onSelect();
    }

    function retryMap() {
        container.current?.focus({ preventScroll: true });
        setReady(false);
        setBasemap('loading');
        setRendererFailed(false);
        setMarkersFailed(false);
        setAttempt(value => value + 1);
    }

    function retrySkiTerrain() {
        const map = mapRef.current;
        if (!map) return;
        map.getCanvas().focus({ preventScroll: true });
        setResortTerrainUnavailable(false);
        syncResortTerrain(map, pointLayer, terrainGroups, true);
    }

    const failed = rendererFailed || markersFailed;
    const state = failed ? 'error' : !ready || basemap === 'loading' ? 'loading' : basemap === 'unavailable' ? 'degraded' : 'ready';
    const showPopups = visible && ready && !failed;
    const showReliefError = showPopups && terrain && terrainUnavailable && mapZoom >= reliefMinZoom;
    const showSkiTerrainError = showPopups && showResortTerrain && resortTerrainUnavailable && mapZoom >= resortTerrainMinZoom;
    const fitLabel = inView ? 'Fit all results' : 'Fit results';
    return <div className="relative h-full min-h-0" onKeyDown={event => {
        if (event.key !== 'Escape' || (!selected && !hovered && !terrainPopupRef.current?.isOpen())) return;
        event.preventDefault();
        terrainPopupRef.current?.remove();
        if (selected) closePopup();
        else setHovered(undefined);
    }}>
        <div ref={container} tabIndex={-1} className="h-full w-full" data-testid="ski-status-map"
            data-map-state={state} />
        {showPopups && hovered && hovered.id !== selected?.id && areasById.has(hovered.id)
            && <SkiAreaPopup area={hovered} mapRef={mapRef} />}
        {showPopups && selected && <SkiAreaPopup area={selected} mapRef={mapRef} units={units} onClose={closePopup} />}
        {ready && !failed && <button type="button" disabled={!areas.length} aria-label={fitLabel} onClick={() => {
            if (mapRef.current) fitAreas(mapRef.current, areas, duration);
        }}
            className="absolute left-2 top-2 z-2 min-h-11 min-w-11 rounded-md border border-zinc-600 bg-zinc-950/95 px-3 text-sm text-zinc-100 hover:border-cyan-300 disabled:opacity-50">
            {selected && <span className="sm:hidden">Fit</span>}
            <span className={selected ? 'hidden sm:inline' : undefined}>{fitLabel}</span>
        </button>}
        {(state !== 'ready' || showReliefError || showSkiTerrainError) && <div
            className="absolute bottom-9 left-2 right-2 z-2 w-fit max-w-[calc(100%-1rem)] rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            role={failed ? 'alert' : 'status'}>
            {failed && <p>{markersFailed && !rendererFailed ? 'Resort markers unavailable.' : 'Map unavailable.'} <button type="button"
                className="min-h-9 text-cyan-300 underline" onClick={retryMap}>Retry map</button></p>}
            {state === 'loading' && <p>Loading map…</p>}
            {state === 'degraded' && <p>Background unavailable. <button type="button" className="min-h-9 text-cyan-300 underline"
                onClick={() => recoveryRef.current?.retry()}>Retry background</button></p>}
            {showReliefError && <p>Terrain relief unavailable.</p>}
            {showSkiTerrainError && <p><span>Ski terrain unavailable.</span> <button type="button" className="min-h-9 text-cyan-300 underline"
                onClick={retrySkiTerrain}>Retry ski terrain</button></p>}
        </div>}
    </div>;
}
