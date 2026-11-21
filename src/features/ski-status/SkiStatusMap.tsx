import { useEffect, useEffectEvent, useMemo, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cartoRasterStyle, cartoVectorStyleUrl } from '../../maps/cartoBasemaps';
import { globeOverviewZoom, projectVisibleGlobeLocation } from '../../maps/globe';
import type { MapCamera } from '../../maps/mapCamera';
import * as maplibre from '../../maps/maplibre';
import { recoverBasemap, type BasemapState } from '../../maps/recoverBasemap';
import { distanceSquared, type TooltipPoint } from '../../maps/screenGeometry';
import { skiAreaBounds, type SkiPassSelection } from './browse';
import { skiAreaMapPoint, skiAreas, type SkiArea } from './catalog';
import type { Conditions, ResortStatus } from './conditions';
import type { MarkerMode } from './mapAppearance';
import { skiMapAttribution } from './mapAttribution';
import { resortFootprintLayer, resortTerrainLabel, resortTerrainSource, syncResortTerrain, visibleTerrainConventions } from './resortTerrain';
import { resortTerrainGroups, resortTerrainMinZoom, type TerrainConvention } from './resortTerrainData';
import { captureSkiMapArea, encodeSkiMapArea, encodeSkiMapCamera, skiMapMaxZoom, skiMapMinZoom, type SkiMapArea } from './skiMapArea';
import { addAreaLayers, addCountImage, addPassBadges, areaFeatures, clusterLayer, filterPassBadges, loadPassImages, markerLayers,
    pointLayer, selectionSource, sourceId, updateClusterStyle } from './skiMapLayers';
import { SkiAreaPopup } from './SkiAreaPopup';
import { SkiIcon, SkiIconButton } from './SkiIcon';
import 'maplibre-gl/dist/maplibre-gl.css';
import './skiAreaPopup.css';

const terrainSource = 'ski-terrain-dem';
const terrainLayer = 'ski-terrain-relief';
const reliefMinZoom = 8;
const pointZoom = 9;
const overviewCenter: [number, number] = [-100, 44];
const providerStyle = () => cartoVectorStyleUrl('dark-matter');
const detailStartZoom = 3;
const detailLayers = new Set(['park_nature_reserve', 'landuse', 'waterway', 'water_shadow', 'waterway_label', 'watername_ocean', 'watername_lake_line']);

const skiGlobeStyle: maplibre.TransformStyleFunction = (_, style) => {
    if (!Array.isArray(style?.layers)) return style;
    return {
        ...style,
        projection: { type: 'globe' },
        sky: { 'sky-color': '#080e16', 'fog-ground-blend': 0, 'atmosphere-blend': 0 },
        // Keep the coastline, boundaries, and place labels at the globe overview.
        layers: style.layers.map(layer => layer && detailLayers.has(layer.id)
            && (layer.maxzoom ?? 24) > detailStartZoom && (layer.minzoom ?? 0) < detailStartZoom
            ? { ...layer, minzoom: detailStartZoom } : layer),
    };
};

interface Props {
    areas: readonly SkiArea[];
    fitResults: readonly SkiArea[];
    cameraAreas: readonly SkiArea[];
    selected?: SkiArea;
    colors: MarkerMode;
    passSelection: SkiPassSelection;
    statuses: ReadonlyMap<string, ResortStatus>;
    conditions: Conditions;
    terrain: boolean;
    resortTerrain: boolean;
    visible: boolean;
    layersModified: boolean;
    searchedArea?: SkiMapArea;
    searchedAreaKey: string | null;
    initializeArea: boolean;
    terrainRequest?: { id: string };
    camera?: MapCamera;
    navigationKey: string;
    restoreHistoryCamera: boolean;
    cameraReader: RefObject<(() => string | undefined) | null>;
    onCameraChange: (value: string) => void;
    onSearchArea: (value: string) => void;
    onSelect: (id?: string, control?: HTMLElement) => void;
    onTerrainKey: (conventions: readonly TerrainConvention[]) => void;
    onOpenLayers: () => void;
}

function mapCameraValue(map: maplibre.Map) {
    return encodeSkiMapCamera({ center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() });
}

function fitAreas(map: maplibre.Map, areas: readonly SkiArea[], duration: number) {
    const bounds = skiAreaBounds(areas);
    if (!bounds) return;
    const { clientWidth, clientHeight } = map.getContainer();
    const padding = Math.min(46, clientWidth / 4, clientHeight / 4);
    if (!padding) return;
    map.resize();
    if (bounds[0] === bounds[2] && bounds[1] === bounds[3]) {
        map.easeTo({ center: [bounds[0], bounds[1]], zoom: pointZoom, duration });
        return;
    }
    if (bounds[2] - bounds[0] >= 180) {
        // A single face of the globe cannot show results spread around the world.
        let center: maplibre.LngLatLike = overviewCenter;
        if (areas.length !== skiAreas.length) {
            const current = map.getCenter();
            let nearestDistance = Infinity;
            for (const area of areas) {
                const location = maplibre.LngLat.convert(skiAreaMapPoint(area));
                const distance = current.distanceTo(location);
                if (distance >= nearestDistance) continue;
                nearestDistance = distance;
                center = location;
            }
        }
        const zoom = globeOverviewZoom(clientWidth, clientHeight);
        if (Math.abs(map.getZoom() - zoom) > 1e-5 || map.getCenter().distanceTo(maplibre.LngLat.convert(center)) > 0.1) {
            map.easeTo({ center, zoom, duration });
        }
        return;
    }
    map.fitBounds(bounds, { padding, maxZoom: pointZoom, duration });
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
    const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol' && layer.source !== sourceId && layer.source !== selectionSource);
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
        const position = projectVisibleGlobeLocation(map, skiAreaMapPoint(area));
        if (!position) continue;
        const distance = distanceSquared(point, position);
        if (distance >= nearestDistance) continue;
        nearest = area;
        nearestDistance = distance;
    }
    return nearest;
}

function expandCluster(map: maplibre.Map, point: TooltipPoint, duration: number) {
    const source = map.getSource<maplibre.GeoJSONSource>(sourceId);
    if (!source || !map.getLayer(clusterLayer)) return false;
    const cluster = map.queryRenderedFeatures([point.x, point.y], { layers: [clusterLayer] })[0];
    if (!cluster || cluster.geometry.type !== 'Point') return false;
    const [longitude, latitude] = cluster.geometry.coordinates;
    const center: [number, number] = [longitude, latitude];
    if (!projectVisibleGlobeLocation(map, center)) return false;
    const id: unknown = cluster.properties.cluster_id;
    if (typeof id !== 'number') return false;
    void source.getClusterExpansionZoom(id).then(zoom => {
        if (map.getSource(sourceId) !== source || map.isMoving()) return;
        map.easeTo({ center, zoom: Math.max(map.getZoom() + 0.5, zoom), duration });
    }).catch(() => { /* The source changed before the cluster could expand. */ });
    return true;
}

export default function SkiStatusMap({ areas, fitResults, cameraAreas, selected, colors, passSelection, statuses, conditions, terrain, resortTerrain,
    visible, layersModified, searchedArea, searchedAreaKey, initializeArea, terrainRequest, camera, navigationKey, restoreHistoryCamera, cameraReader, onCameraChange,
    onSearchArea, onSelect, onTerrainKey, onOpenLayers }: Props) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibre.Map | null>(null);
    const recoveryRef = useRef<ReturnType<typeof recoverBasemap> | null>(null);
    const passImages = useRef<ReturnType<typeof loadPassImages> | undefined>(undefined);
    const passLayers = useRef(false);
    const terrainPopupRef = useRef<maplibre.Popup | undefined>(undefined);
    const appliedCamera = useRef<{
        areas: readonly SkiArea[]; id?: string; key: string | null; historyKey?: string; visible: boolean;
    }>(undefined);
    const appliedTerrainRequest = useRef<Props['terrainRequest']>(undefined);
    const pinSelection = useRef<string | undefined>(undefined);
    const lastTerrainKey = useRef('');
    const [attempt, setAttempt] = useState(0);
    const [basemap, setBasemap] = useState<BasemapState>('loading');
    const [ready, setReady] = useState(false);
    const [rendererFailed, setRendererFailed] = useState(false);
    const [markersFailed, setMarkersFailed] = useState(false);
    const [terrainUnavailable, setTerrainUnavailable] = useState(false);
    const [resortTerrainUnavailable, setResortTerrainUnavailable] = useState(false);
    const [mapZoom, setMapZoom] = useState(1);
    const [hovered, setHovered] = useState<SkiArea>();
    const [viewport, setViewport] = useState<string>();
    const [moving, setMoving] = useState(false);
    const [searchSuggested, setSearchSuggested] = useState(false);
    const reducedMotion = useReducedMotion();
    const duration = reducedMotion ? 0 : 280;
    const areasById = useMemo(() => {
        const lookup = new Map(areas.map(area => [area.id, area]));
        if (selected) lookup.set(selected.id, selected);
        return lookup;
    }, [areas, selected]);
    const terrainGroups = useMemo(() => resortTerrainGroups(selected ? [...areas, selected] : areas), [areas, selected]);
    const showResortTerrain = visible && resortTerrain && terrainGroups.length > 0;
    const points = useMemo(() => areaFeatures(areas, colors, statuses, passSelection), [areas, colors, statuses, passSelection]);
    const selection = useMemo(() => areaFeatures(selected ? [selected] : [], colors, statuses, passSelection), [selected, colors, statuses, passSelection]);
    const current = useEffectEvent(() => ({ areasById, points, selection, selected, colors, terrain, duration }));
    const initialCamera = useEffectEvent((element: HTMLElement) => {
        if (camera) return camera;
        if (searchedArea) return { center: searchedArea.center, zoom: searchedArea.zoom };
        if (selected) return { center: skiAreaMapPoint(selected), zoom: pointZoom };
        return { center: overviewCenter, zoom: globeOverviewZoom(element.clientWidth, element.clientHeight) };
    });
    const selectArea = useEffectEvent(onSelect);
    const syncResortDetails = useEffectEvent((map: maplibre.Map) => {
        const reload = showResortTerrain && resortTerrainUnavailable && !map.getSource(resortTerrainSource)
            && map.getZoom() >= resortTerrainMinZoom && Boolean(map.getLayer(pointLayer));
        if (reload) setResortTerrainUnavailable(false);
        syncResortTerrain(map, pointLayer, showResortTerrain ? terrainGroups : [], reload);
    });
    const syncTerrainKey = useEffectEvent((map: maplibre.Map) => {
        const conventions = showResortTerrain ? visibleTerrainConventions(map) : [];
        const key = conventions.join(',');
        if (key === lastTerrainKey.current) return;
        lastTerrainKey.current = key;
        onTerrainKey(conventions);
    });
    const syncPassBadges = useEffectEvent((map: maplibre.Map) => {
        if (colors !== 'pass' || !map.getSource(sourceId) || passLayers.current) return;
        passImages.current ??= loadPassImages(map);
        void passImages.current.then(images => {
            if (mapRef.current !== map || !map.getSource(sourceId) || passLayers.current) return;
            const data = current();
            if (data.colors !== 'pass') return;
            addPassBadges(map, images);
            passLayers.current = true;
            filterPassBadges(map, data.selected);
        });
    });
    const syncCamera = useEffectEvent((map: maplibre.Map) => {
        const previous = appliedCamera.current;
        if (!visible) {
            if (previous) previous.visible = false;
            return;
        }
        if (!map.getLayer(pointLayer) || !map.getContainer().clientWidth || !map.getContainer().clientHeight) return;
        const cameraHistoryKey = restoreHistoryCamera ? navigationKey : undefined;
        appliedCamera.current = { areas: cameraAreas, id: selected?.id, key: searchedAreaKey, historyKey: cameraHistoryKey, visible: true };
        const historyChanged = cameraHistoryKey !== undefined && cameraHistoryKey !== previous?.historyKey;
        const selectionChanged = selected?.id !== previous?.id;
        const fromPin = selectionChanged && pinSelection.current === selected?.id;
        if (selectionChanged) pinSelection.current = undefined;
        const showRequestedTerrain = !(previous && historyChanged) && terrainRequest
            && terrainRequest !== appliedTerrainRequest.current && selected?.id === terrainRequest.id;
        // Map movements publish their camera without reapplying it to the live map.
        if (camera && !showRequestedTerrain && (!previous || historyChanged || !previous.visible)) {
            const atTarget = mapCameraValue(map) === encodeSkiMapCamera(camera);
            if (!atTarget || !previous || historyChanged) {
                if (!atTarget || map.isMoving()) map.jumpTo(camera);
                return;
            }
        }
        if (showRequestedTerrain) {
            appliedTerrainRequest.current = terrainRequest;
            map.resize();
            map.easeTo({ center: selected.location.coordinates, zoom: Math.max(13, map.getZoom()), duration });
        } else if (searchedArea && (historyChanged || previous?.key !== searchedAreaKey)) {
            const center = maplibre.LngLat.convert(searchedArea.center);
            if (map.getCenter().distanceTo(center) > 0.1 || Math.abs(map.getZoom() - searchedArea.zoom) > 1e-5) {
                map.jumpTo({ center, zoom: searchedArea.zoom });
            }
        } else if (selected && (historyChanged || selectionChanged)) {
            if (!fromPin) {
                map.resize();
                map.easeTo({ center: skiAreaMapPoint(selected), zoom: Math.max(pointZoom, map.getZoom()), duration: previous ? duration : 0 });
            }
        } else if (!selected && !searchedArea && (historyChanged || !previous || (previous.key === null && previous.areas !== cameraAreas &&
            (previous.areas.length !== cameraAreas.length || cameraAreas.some((area, index) => area.id !== previous.areas[index].id))))) {
            fitAreas(map, cameraAreas, previous ? duration : 0);
        }
    });
    const reportViewport = useEffectEvent((map: maplibre.Map) => {
        if (!visible || map.isMoving() || !map.getLayer(pointLayer)) return;
        const { clientWidth, clientHeight } = map.getContainer();
        if (clientWidth < 2 || clientHeight < 2) return;
        const area = captureSkiMapArea(map.getCenter().toArray(), map.getZoom(), clientWidth, clientHeight, point => map.unproject(point).toArray());
        const value = encodeSkiMapArea(area);
        setViewport(value);
        setMoving(false);
        if (initializeArea) {
            onSearchArea(value);
        } else {
            const currentCamera = mapCameraValue(map);
            if (currentCamera) onCameraChange(currentCamera);
        }
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
                    container: container.current, style: providerStyle(), transformStyle: skiGlobeStyle,
                    ...initialCamera(container.current),
                    pixelRatio: Math.min(window.devicePixelRatio, 1.5), fadeDuration: 0,
                    minZoom: skiMapMinZoom, maxZoom: skiMapMaxZoom, dragRotate: false, pitchWithRotate: false,
                    attributionControl: false,
                });
            } catch {
                setRendererFailed(true);
                return;
            }
            map = instance;
            mapRef.current = instance;
            cameraReader.current = () => instance.getLayer(pointLayer) ? mapCameraValue(instance) : undefined;
            const canvas = instance.getCanvas();
            canvas.setAttribute('aria-describedby', 'ski-map-instructions');
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
            const clearHover = () => {
                terrainPopup.remove();
                canvas.style.cursor = '';
                setHovered(undefined);
            };
            const settleViewport = () => {
                const zoom = instance.getZoom();
                setMapZoom(zoom);
                if (zoom >= resortTerrainMinZoom && !instance.getSource(resortTerrainSource)) syncResortDetails(instance);
                queueViewport();
            };
            instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
            instance.addControl(skiMapAttribution(), 'bottom-right');
            recoveryRef.current = recoverBasemap(instance, {
                dataSources: new Set([sourceId, selectionSource, terrainSource, resortTerrainSource]),
                providerStyle, neutralStyle: () => skiGlobeStyle(undefined, cartoRasterStyle('dark', '')),
            }, state => {
                setBasemap(state);
                if (state !== 'ready') setReady(false);
            });
            instance.setMissingStyleImageResolver(id => addCountImage(instance, id));
            instance.on('style.load', () => {
                clearHover();
                const data = current();
                passLayers.current = false;
                if (!instance.getSource(sourceId)) addAreaLayers(instance, data.points, data.selection, data.colors);
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
            instance.on('movestart', event => {
                setMoving(true);
                if ('originalEvent' in event && event.originalEvent) setSearchSuggested(true);
                clearHover();
            });
            instance.on('moveend', settleViewport);
            instance.on('projectiontransition', queueViewport);
            instance.on('idle', () => syncTerrainKey(instance));
            instance.on('sourcedata', event => {
                if (event.sourceId === sourceId && event.isSourceLoaded) setReady(true);
                if (event.sourceId === terrainSource && event.sourceDataType === 'metadata') setTerrainUnavailable(false);
                if (event.sourceId === resortTerrainSource && event.isSourceLoaded && event.sourceDataType === 'content') setResortTerrainUnavailable(false);
            });
            instance.on('webglcontextlost', () => setRendererFailed(true));
            instance.on('webglcontextrestored', () => setRendererFailed(false));
            instance.on('error', event => {
                const failedSource = 'sourceId' in event ? event.sourceId : undefined;
                if (failedSource === sourceId || failedSource === selectionSource) setMarkersFailed(true);
                else if (failedSource === terrainSource) setTerrainUnavailable(true);
                else if (failedSource === resortTerrainSource) setResortTerrainUnavailable(true);
                else if (/webgl|context|worker/i.test(event.error?.message ?? '')) setRendererFailed(true);
            });
            instance.on('mousemove', event => {
                if (instance.isMoving()) return;
                const data = current();
                const area = closestArea(instance, event.point, data.areasById);
                const group = instance.getLayer(clusterLayer) && instance.queryRenderedFeatures(event.point, { layers: [clusterLayer] }).length;
                setHovered(area);
                canvas.style.cursor = area || group ? 'pointer' : '';
                if (area || group) terrainPopup.remove();
                else showTerrainLabel(event);
            });
            instance.on('mouseout', clearHover);
            instance.on('click', event => {
                if (!instance.getSource(sourceId) || !instance.isSourceLoaded(sourceId)) return;
                clearHover();
                const data = current();
                const touch = 'pointerType' in event.originalEvent && event.originalEvent.pointerType === 'touch';
                const area = closestArea(instance, event.point, data.areasById, touch ? 10 : 0);
                if (area) {
                    if (area.id !== data.selected?.id) pinSelection.current = area.id;
                    selectArea(area.id, canvas);
                } else if (expandCluster(instance, event.point, data.duration)) {
                    setSearchSuggested(true);
                } else {
                    selectArea();
                    showTerrainLabel(event);
                }
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
            cameraReader.current = null;
            passImages.current = undefined;
            passLayers.current = false;
            appliedCamera.current = undefined;
        };
    }, [attempt, cameraReader]);

    useEffect(() => {
        mapRef.current?.getSource<maplibre.GeoJSONSource>(sourceId)?.setData(points);
    }, [points]);

    useEffect(() => {
        mapRef.current?.getSource<maplibre.GeoJSONSource>(selectionSource)?.setData(selection);
    }, [selection]);

    useEffect(() => {
        const map = mapRef.current;
        if (map) {
            syncCamera(map);
            reportViewport(map);
        }
    }, [camera, cameraAreas, navigationKey, restoreHistoryCamera, selected, searchedAreaKey, visible, terrainRequest]);

    useEffect(() => {
        const map = mapRef.current;
        if (map) syncTerrain(map, terrain);
    }, [terrain]);

    useEffect(() => {
        terrainPopupRef.current?.remove();
        const map = mapRef.current;
        if (map) {
            syncResortDetails(map);
            syncTerrainKey(map);
        }
    }, [terrainGroups, showResortTerrain]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map?.getLayer(clusterLayer)) return;
        updateClusterStyle(map, colors);
        syncPassBadges(map);
        filterPassBadges(map, selected);
    }, [colors, selected]);

    function retryMap() {
        container.current?.focus({ preventScroll: true });
        setViewport(undefined);
        setMoving(false);
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
    const interactive = visible && ready && !failed;
    const showReliefError = interactive && terrain && terrainUnavailable && mapZoom >= reliefMinZoom;
    const showSkiTerrainError = interactive && showResortTerrain && resortTerrainUnavailable && mapZoom >= resortTerrainMinZoom;
    const areaApplied = Boolean(searchedAreaKey && searchedAreaKey === viewport);
    const canSearch = interactive && !moving && Boolean(viewport) && !areaApplied;
    const promoteAreaSearch = canSearch && (searchSuggested || Boolean(searchedAreaKey));
    return <div className="ski-map" onKeyDown={event => {
        if (event.key !== 'Escape' || (!selected && !hovered && !terrainPopupRef.current?.isOpen())) return;
        event.preventDefault();
        terrainPopupRef.current?.remove();
        setHovered(undefined);
        if (selected) {
            onSelect();
            mapRef.current?.getCanvas().focus({ preventScroll: true });
        }
    }}>
        <div className="ski-map-actions">
            <button type="button" className={`ski-control ski-area-search${promoteAreaSearch ? ' ski-primary' : ''}`}
                aria-disabled={!canSearch} data-applied={areaApplied || undefined}
                onClick={() => {
                    if (!canSearch || !viewport) return;
                    setSearchSuggested(false);
                    onSearchArea(viewport);
                }}>
                <SkiIcon name={areaApplied ? 'check' : 'search'} />{areaApplied ? 'Area searched' : 'Search this area'}
            </button>
            <div className="ski-map-utilities" role="group" aria-label="Map controls">
                <SkiIconButton icon="fit" label="Fit results" showLabel className="ski-fit-button"
                    disabled={!interactive || !fitResults.length} onClick={() => {
                        if (mapRef.current) fitAreas(mapRef.current, fitResults, duration);
                    }} />
                <SkiIconButton icon="layers" label="Layers" hint="Map layers"
                    aria-haspopup="dialog" aria-controls="ski-map-layers" data-active={layersModified || undefined}
                    aria-description={layersModified ? 'Custom map layers' : undefined}
                    onClick={onOpenLayers} />
            </div>
        </div>
        <p id="ski-map-instructions" className="sr-only">Use the arrow keys to move the map. Use the zoom buttons or plus and minus keys to zoom. Browse Results to select areas by name.</p>
        <div ref={container} tabIndex={-1} className="h-full w-full" data-testid="ski-status-map" data-map-state={state} />
        {interactive && hovered && hovered.id !== selected?.id && areasById.has(hovered.id)
            && <SkiAreaPopup area={hovered} mapRef={mapRef} report={conditions.reports.get(hovered.id)} status={statuses.get(hovered.id) ?? 'unknown'} now={conditions.now} />}
        {(state !== 'ready' || showReliefError || showSkiTerrainError) && <div
            className="absolute bottom-10 left-2 z-2 w-fit max-w-[calc(100%-1rem)] rounded-md border border-slate-600 bg-[#152230] px-3 py-2 text-sm text-slate-100"
            role={failed ? 'alert' : 'status'}>
            {failed && <p>{markersFailed && !rendererFailed ? 'Resort markers unavailable.' : 'Map unavailable.'} <button type="button"
                className="min-h-11 text-cyan-200 underline" onClick={retryMap}>Retry map</button></p>}
            {state === 'loading' && <p>Loading map…</p>}
            {state === 'degraded' && <p>Background unavailable. <button type="button" className="min-h-11 text-cyan-200 underline"
                onClick={() => recoveryRef.current?.retry()}>Retry background</button></p>}
            {showReliefError && <p>Terrain relief unavailable.</p>}
            {showSkiTerrainError && <p><span>Ski terrain unavailable.</span> <button type="button" className="min-h-11 text-cyan-200 underline"
                onClick={retrySkiTerrain}>Retry ski terrain</button></p>}
        </div>}
    </div>;
}
