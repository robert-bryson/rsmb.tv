import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type RefObject } from 'react';
import { administrativeBounds, type GeographicBounds } from '../../../shared/geography/administrativeBounds';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cartoRasterStyle, cartoVectorStyleUrl } from '../../maps/cartoBasemaps';
import { globeOverviewZoom, projectVisibleGlobeLocation } from '../../maps/globe';
import type { MapCamera } from '../../maps/mapCamera';
import * as maplibre from '../../maps/maplibre';
import { recoverBasemap, type BasemapState } from '../../maps/recoverBasemap';
import { distanceSquared, type TooltipPoint } from '../../maps/screenGeometry';
import { skiAreaBounds, type SkiPassSelection, type SkiUnits } from './browse';
import { skiAreaMapPoint, skiAreas, type SkiArea } from './catalog';
import type { Conditions, ResortStatus } from './conditions';
import type { MarkerMode } from './mapAppearance';
import { skiMapAttribution } from './mapAttribution';
import { resortFootprintLayer, resortTerrainLabel, resortTerrainSource, syncResortTerrain, visibleTerrainConventions } from './resortTerrain';
import { resortTerrainGroups, resortTerrainMinZoom, type TerrainConvention } from './resortTerrainData';
import { matchesSkiLocation, skiRegionName } from './skiGeography';
import { captureSkiMapArea, encodeSkiMapArea, encodeSkiMapCamera, skiMapMaxZoom, skiMapMinZoom, type SkiMapArea } from './skiMapArea';
import { addAreaLayers, addPassBadges, addResortImages, areaFeatures, filterPassBadges, loadPassImages, loadResortImages, markerLayers,
    pointLayer, resortIconLayer, selectionSource, sourceId } from './skiMapLayers';
import { reliefMinZoom, reliefSource, revealSkiMapOverlay, snowDepthMaxZoom, snowDepthMinZoom, snowDepthSource, syncSkiMapOverlays,
    type SkiMapOverlaySource } from './skiMapOverlays';
import { addHighwayShieldImages, regionalRoadLayer, skiGlobeStyle, stateBoundaryLayer } from './skiMapStyle';
import { isPeakLayer, mountainPeakLabel, peakSource, syncPeakLayers } from './skiPeakLayers';
import { SkiAreaPopup } from './SkiAreaPopup';
import { SkiIcon, SkiIconButton } from './SkiIcon';
import { SkiLayerPanel, type SetSkiLayer } from './SkiLayerPanel';
import type { SkiArchive } from './useSkiArchive';
import 'maplibre-gl/dist/maplibre-gl.css';
import './skiAreaPopup.css';

const pointZoom = 9;
const terrainZoom = 13;
const markerClickDelay = 300;
const overviewCenter: [number, number] = [-100, 44];
const providerStyle = () => cartoVectorStyleUrl('dark-matter');

export interface SkiTerrainRequest {
    id: string;
    previousView?: MapCamera;
}

interface Props {
    areas: readonly SkiArea[];
    fitResults: readonly SkiArea[];
    cameraAreas: readonly SkiArea[];
    cameraFitKey: string;
    selected?: SkiArea;
    colors: MarkerMode;
    units: SkiUnits;
    passSelection: SkiPassSelection;
    statuses: ReadonlyMap<string, ResortStatus>;
    conditions: Conditions;
    archive?: SkiArchive;
    terrain: boolean;
    snowDepth: boolean;
    resortTerrain: boolean;
    peaks: boolean;
    visible: boolean;
    layersModified: boolean;
    searchedArea?: SkiMapArea;
    searchedAreaKey: string | null;
    initializeArea: boolean;
    willDockDetails: boolean;
    terrainRequest?: SkiTerrainRequest;
    locationRequest?: { place: string };
    camera?: MapCamera;
    navigationKey: string;
    restoreHistoryCamera: boolean;
    cameraReader: RefObject<(() => string | undefined) | null>;
    mapRegion: RefObject<HTMLElement | null>;
    onCameraChange: (value: string) => void;
    onSearchArea: (value: string) => void;
    onSelect: (id?: string, control?: HTMLElement) => void;
    onShowTerrain: (request: SkiTerrainRequest, control: HTMLElement) => void;
    onZoomLocation: (place: string) => void;
    onLayerChange: SetSkiLayer;
}

function readCamera(map: maplibre.Map): MapCamera {
    return { center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
}

function mapCameraValue(map: maplibre.Map) {
    return encodeSkiMapCamera(readCamera(map));
}

function fitBounds(map: maplibre.Map, bounds: GeographicBounds, duration: number, overview?: () => maplibre.LngLatLike) {
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
        const center = overview?.() ?? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] as const;
        const zoom = globeOverviewZoom(clientWidth, clientHeight);
        if (Math.abs(map.getZoom() - zoom) > 1e-5 || map.getCenter().distanceTo(maplibre.LngLat.convert(center)) > 0.1) {
            map.easeTo({ center, zoom, duration });
        }
        return;
    }
    map.fitBounds(bounds, { padding, maxZoom: pointZoom, duration });
}

function fitAreas(map: maplibre.Map, areas: readonly SkiArea[], duration: number) {
    const bounds = skiAreaBounds(areas);
    if (!bounds) return;
    fitBounds(map, bounds, duration, () => {
        if (areas.length === skiAreas.length) return overviewCenter;
        const current = map.getCenter();
        let center: maplibre.LngLatLike = overviewCenter;
        let nearestDistance = Infinity;
        for (const area of areas) {
            const location = maplibre.LngLat.convert(skiAreaMapPoint(area));
            const distance = current.distanceTo(location);
            if (distance >= nearestDistance) continue;
            nearestDistance = distance;
            center = location;
        }
        return center;
    });
}

function fitLocation(map: maplibre.Map, place: string, duration: number) {
    const [, country, code] = place.split(':');
    const bounds = administrativeBounds({ country, region: code && skiRegionName(country, code) });
    if (bounds) fitBounds(map, bounds, duration);
    else fitAreas(map, skiAreas.filter(area => matchesSkiLocation(area, place)), duration);
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

export default function SkiStatusMap({ areas, fitResults, cameraAreas, cameraFitKey, selected, colors, units, passSelection, statuses, conditions, archive, terrain, snowDepth, resortTerrain, peaks,
    visible, layersModified, searchedArea, searchedAreaKey, initializeArea, willDockDetails, terrainRequest, locationRequest, camera, navigationKey, restoreHistoryCamera,
    cameraReader, mapRegion, onCameraChange, onSearchArea, onSelect, onShowTerrain, onZoomLocation, onLayerChange }: Props) {
    const container = useRef<HTMLDivElement>(null);
    const layersButton = useRef<HTMLButtonElement>(null);
    const mapRef = useRef<maplibre.Map | null>(null);
    const recoveryRef = useRef<ReturnType<typeof recoverBasemap> | null>(null);
    const passImages = useRef<ReturnType<typeof loadPassImages> | undefined>(undefined);
    const resortImages = useRef<{ archive?: SkiArchive; loading: ReturnType<typeof loadResortImages> }>(undefined);
    const passLayers = useRef(false);
    const terrainPopupRef = useRef<maplibre.Popup | undefined>(undefined);
    const appliedCamera = useRef<{
        areas: readonly SkiArea[]; fitKey: string; id?: string; key: string | null; historyKey?: string; visible: boolean;
    }>(undefined);
    const appliedTerrainRequest = useRef<Props['terrainRequest']>(undefined);
    const terrainAnimation = useRef<SkiTerrainRequest>(undefined);
    const appliedLocationRequest = useRef<Props['locationRequest']>(undefined);
    const hoverDismissal = useRef<number>(undefined);
    const pinSelection = useRef<string | undefined>(undefined);
    const lastTerrainKey = useRef('');
    const [attempt, setAttempt] = useState(0);
    const [basemap, setBasemap] = useState<BasemapState>('loading');
    const [ready, setReady] = useState(false);
    const [rendererFailed, setRendererFailed] = useState(false);
    const [markersFailed, setMarkersFailed] = useState(false);
    const [terrainUnavailable, setTerrainUnavailable] = useState(false);
    const [snowDepthUnavailable, setSnowDepthUnavailable] = useState(false);
    const [resortTerrainUnavailable, setResortTerrainUnavailable] = useState(false);
    const [mapZoom, setMapZoom] = useState(1);
    const [previousView, setPreviousView] = useState<MapCamera>();
    const [hovered, setHovered] = useState<SkiArea>();
    const [layersOpen, setLayersOpen] = useState(false);
    const [terrainConventions, setTerrainConventions] = useState<readonly TerrainConvention[]>([]);
    if (!visible && layersOpen) setLayersOpen(false);
    const keepHoverOpen = useCallback(() => {
        window.clearTimeout(hoverDismissal.current);
        hoverDismissal.current = undefined;
    }, []);
    const dismissHover = useCallback(() => {
        // Leave time for the pointer to travel from the marker into its preview.
        hoverDismissal.current ??= window.setTimeout(() => {
            hoverDismissal.current = undefined;
            setHovered(undefined);
        }, 220);
    }, []);
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
    const current = useEffectEvent(() => ({ areasById, points, selection, selected, colors, visible, willDockDetails }));
    const initialCamera = useEffectEvent((element: HTMLElement) => {
        if (camera) return camera;
        if (searchedArea) return { center: searchedArea.center, zoom: searchedArea.zoom };
        if (selected) return { center: skiAreaMapPoint(selected), zoom: pointZoom };
        return { center: overviewCenter, zoom: globeOverviewZoom(element.clientWidth, element.clientHeight) };
    });
    const selectArea = useEffectEvent(onSelect);
    const showTerrain = useEffectEvent(onShowTerrain);
    const syncOverlays = useEffectEvent((map: maplibre.Map) => {
        if (!map.getLayer(pointLayer)) return;
        const foreground = map.getStyle().layers.find(layer => layer.id === stateBoundaryLayer || layer.id === regionalRoadLayer
            || (layer.type === 'symbol' && layer.source !== sourceId && layer.source !== selectionSource && !isPeakLayer(layer.id)));
        const before = foreground?.id ?? (map.getLayer(resortFootprintLayer) ? resortFootprintLayer : pointLayer);
        syncSkiMapOverlays(map, before, terrain, snowDepth, duration);
    });
    const syncPeaks = useEffectEvent((map: maplibre.Map) => {
        if (map.getLayer(pointLayer)) syncPeakLayers(map, peaks);
    });
    const peakLabel = useEffectEvent((map: maplibre.Map, point: maplibre.Point) => mountainPeakLabel(map, point, units));
    const revealOverlay = useEffectEvent((map: maplibre.Map, source: SkiMapOverlaySource) => revealSkiMapOverlay(map, source, duration));
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
        setTerrainConventions(conventions);
    });
    const syncPassBadges = useEffectEvent((map: maplibre.Map) => {
        if (colors !== 'pass' || !map.getSource(sourceId) || passLayers.current) return;
        const request = passImages.current ??= loadPassImages(map);
        void request.then(images => {
            if (passImages.current !== request || mapRef.current !== map || !map.getSource(sourceId) || passLayers.current) return;
            const data = current();
            if (data.colors !== 'pass') return;
            addPassBadges(map, images);
            passLayers.current = true;
            filterPassBadges(map, data.selected);
        });
    });
    const syncResortIcons = useEffectEvent((map: maplibre.Map) => {
        if (colors !== 'default' || !map.getLayer(resortIconLayer)) return;
        if (!resortImages.current || resortImages.current.archive !== archive) {
            resortImages.current = { archive, loading: loadResortImages(archive) };
        }
        const request = resortImages.current;
        void request.loading.then(images => {
            if (resortImages.current === request && mapRef.current === map
                && current().colors === 'default' && map.getLayer(resortIconLayer)) addResortImages(map, images);
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
        appliedCamera.current = { areas: cameraAreas, fitKey: cameraFitKey, id: selected?.id, key: searchedAreaKey, historyKey: cameraHistoryKey, visible: true };
        const historyChanged = cameraHistoryKey !== undefined && cameraHistoryKey !== previous?.historyKey;
        if (previous && historyChanged) {
            appliedTerrainRequest.current = terrainRequest;
            setPreviousView(undefined);
        }
        const selectionChanged = selected?.id !== previous?.id;
        const fromPin = selectionChanged && pinSelection.current === selected?.id;
        if (selectionChanged) pinSelection.current = undefined;
        const showRequestedTerrain = !(previous && historyChanged) && terrainRequest
            && terrainRequest !== appliedTerrainRequest.current && selected?.id === terrainRequest.id;
        const zoomToRequestedLocation = !(previous && historyChanged) && locationRequest && locationRequest !== appliedLocationRequest.current;
        appliedLocationRequest.current = locationRequest;
        if (zoomToRequestedLocation) {
            fitLocation(map, locationRequest.place, previous ? duration : 0);
            return;
        }
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
            if (terrainAnimation.current?.id === terrainRequest.id) return;
            const before = readCamera(map);
            const center = selected.location.coordinates;
            const zoom = Math.max(terrainZoom, before.zoom);
            if (zoom - before.zoom < 1e-5 && map.getCenter().distanceTo(maplibre.LngLat.convert(center)) < 0.5) return;
            setPreviousView(terrainRequest.previousView ?? before);
            map.resize();
            terrainAnimation.current = terrainRequest;
            map.easeTo({ center, zoom, duration }, { skiTerrainRequest: terrainRequest });
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
        } else if (!selected && !searchedArea) {
            // Pass filters update the results in the current view. Discovery filters can request a new fit.
            const refit = previous?.key === null && previous.fitKey !== cameraFitKey && previous.areas !== cameraAreas
                && (previous.areas.length !== cameraAreas.length || cameraAreas.some((area, index) => area.id !== previous.areas[index].id));
            if (historyChanged || !previous || refit) fitAreas(map, cameraAreas, previous ? duration : 0);
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
        let markerClickTimer: number | undefined;
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
            const focused = document.activeElement;
            if (focused && (focused === instance.getContainer() || focused === mapRegion.current)) canvas.focus({ preventScroll: true });
            const terrainPopup = new maplibre.Popup({
                closeButton: false, closeOnClick: false, closeOnMove: true, focusAfterOpen: false, offset: 9,
                className: 'ski-area-popup ski-area-popup-hover', maxWidth: '15rem',
            });
            terrainPopupRef.current = terrainPopup;
            let previousLabel: string | undefined;
            const loadedOverlays = new Set<SkiMapOverlaySource>();
            let clickedMarker: string | undefined;
            const showMapLabel = (event: maplibre.MapMouseEvent, label: string | undefined) => {
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
                keepHoverOpen();
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
                dataSources: new Set([sourceId, selectionSource, reliefSource, snowDepthSource, resortTerrainSource, peakSource]),
                providerStyle,
                neutralStyle: () => {
                    const style = cartoRasterStyle('dark', '');
                    delete style.glyphs;
                    return skiGlobeStyle(undefined, style);
                },
            }, state => {
                setBasemap(state);
                if (state !== 'ready') setReady(false);
            });
            instance.on('style.load', () => {
                clearHover();
                const data = current();
                passImages.current = undefined;
                passLayers.current = false;
                resortImages.current = undefined;
                addHighwayShieldImages(instance);
                if (!instance.getSource(sourceId)) addAreaLayers(instance, data.points, data.selection);
                syncPeaks(instance);
                syncPassBadges(instance);
                syncResortIcons(instance);
                loadedOverlays.clear();
                setTerrainUnavailable(false);
                setSnowDepthUnavailable(false);
                syncOverlays(instance);
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
                window.clearTimeout(markerClickTimer);
                clickedMarker = undefined;
                setMoving(true);
                if ('originalEvent' in event && event.originalEvent) setSearchSuggested(true);
                clearHover();
            });
            instance.on('moveend', event => {
                if ('skiTerrainRequest' in event && event.skiTerrainRequest === terrainAnimation.current) terrainAnimation.current = undefined;
                settleViewport();
            });
            instance.on('projectiontransition', queueViewport);
            instance.on('idle', () => {
                syncTerrainKey(instance);
                for (const source of loadedOverlays) {
                    if (instance.getSource(source) && instance.isSourceLoaded(source)) revealOverlay(instance, source);
                }
            });
            instance.on('sourcedata', event => {
                const source = event.sourceId;
                if (source === sourceId && event.isSourceLoaded) setReady(true);
                if (event.sourceDataType === 'metadata' && source === instance.getLayer(regionalRoadLayer)?.source) syncPeaks(instance);
                if (source === reliefSource || source === snowDepthSource) {
                    if (event.sourceDataType === 'metadata') {
                        loadedOverlays.delete(source);
                        if (source === reliefSource) setTerrainUnavailable(false);
                        else setSnowDepthUnavailable(false);
                    }
                    const tile: maplibre.Tile | undefined = event.tile;
                    if (source === reliefSource ? tile?.dem : tile?.state === 'loaded') loadedOverlays.add(source);
                    if (loadedOverlays.has(source) && event.isSourceLoaded) revealOverlay(instance, source);
                }
                if (source === resortTerrainSource && event.isSourceLoaded && event.sourceDataType === 'content') setResortTerrainUnavailable(false);
            });
            instance.on('webglcontextlost', () => setRendererFailed(true));
            instance.on('webglcontextrestored', () => setRendererFailed(false));
            instance.on('error', event => {
                const failedSource = 'sourceId' in event ? event.sourceId : undefined;
                if (failedSource === sourceId || failedSource === selectionSource) setMarkersFailed(true);
                else if (failedSource === reliefSource) setTerrainUnavailable(true);
                else if (failedSource === snowDepthSource) setSnowDepthUnavailable(true);
                else if (failedSource === resortTerrainSource) setResortTerrainUnavailable(true);
                else if (/webgl|context|worker/i.test(event.error?.message ?? '')) setRendererFailed(true);
            });
            instance.on('mousemove', event => {
                if (instance.isMoving()) return;
                const data = current();
                const area = closestArea(instance, event.point, data.areasById);
                const peak = area ? undefined : peakLabel(instance, event.point);
                canvas.style.cursor = area || peak ? 'pointer' : '';
                if (area) {
                    keepHoverOpen();
                    setHovered(area);
                    terrainPopup.remove();
                } else {
                    dismissHover();
                    showMapLabel(event, peak ?? resortTerrainLabel(instance, event.point));
                }
            });
            instance.on('mouseout', () => {
                terrainPopup.remove();
                canvas.style.cursor = '';
                dismissHover();
            });
            instance.on('click', event => {
                if (event.originalEvent.detail > 1) return;
                window.clearTimeout(markerClickTimer);
                clickedMarker = undefined;
                if (!instance.getSource(sourceId) || !instance.isSourceLoaded(sourceId)) return;
                clearHover();
                const data = current();
                const touch = 'pointerType' in event.originalEvent && event.originalEvent.pointerType === 'touch';
                const area = closestArea(instance, event.point, data.areasById, touch ? 10 : 0);
                if (area) {
                    clickedMarker = area.id;
                    const open = () => {
                        const latest = current();
                        if (!latest.visible || !latest.areasById.has(area.id)) return;
                        if (area.id !== latest.selected?.id) pinSelection.current = area.id;
                        selectArea(area.id, canvas);
                    };
                    // Keep the marker under the pointer while a second click can still arrive on a narrow map.
                    if (!touch && data.willDockDetails) markerClickTimer = window.setTimeout(open, markerClickDelay);
                    else open();
                } else {
                    const peak = peakLabel(instance, event.point);
                    if (!peak) selectArea();
                    showMapLabel(event, peak ?? resortTerrainLabel(instance, event.point));
                }
            });
            instance.on('dblclick', event => {
                const { areasById } = current();
                const area = (clickedMarker && areasById.get(clickedMarker)) || closestArea(instance, event.point, areasById);
                clickedMarker = undefined;
                if (!area) return;
                event.preventDefault();
                window.clearTimeout(markerClickTimer);
                clearHover();
                showTerrain({ id: area.id, previousView: readCamera(instance) }, canvas);
            });
        });
        return () => {
            cancelAnimationFrame(frame);
            if (viewportFrame !== undefined) cancelAnimationFrame(viewportFrame);
            window.clearTimeout(markerClickTimer);
            keepHoverOpen();
            recoveryRef.current?.dispose();
            recoveryRef.current = null;
            terrainPopupRef.current?.remove();
            terrainPopupRef.current = undefined;
            map?.remove();
            mapRef.current = null;
            cameraReader.current = null;
            passImages.current = undefined;
            resortImages.current = undefined;
            passLayers.current = false;
            appliedCamera.current = undefined;
            terrainAnimation.current = undefined;
        };
    }, [attempt, cameraReader, mapRegion, dismissHover, keepHoverOpen]);

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
    }, [camera, cameraAreas, cameraFitKey, navigationKey, restoreHistoryCamera, selected, searchedAreaKey, visible, terrainRequest, locationRequest]);

    useEffect(() => {
        const map = mapRef.current;
        if (map) syncOverlays(map);
    }, [terrain, snowDepth, duration]);

    useEffect(() => {
        terrainPopupRef.current?.remove();
        const map = mapRef.current;
        if (map) syncPeaks(map);
    }, [peaks, units]);

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
        if (!map) return;
        syncPassBadges(map);
        filterPassBadges(map, selected);
    }, [colors, selected]);

    useEffect(() => {
        if (mapRef.current) syncResortIcons(mapRef.current);
    }, [colors, archive]);

    useEffect(() => {
        if (!layersOpen) return;
        const dismissOutsideMap = (event: PointerEvent) => {
            if (event.target instanceof Node && !mapRegion.current?.contains(event.target)) setLayersOpen(false);
        };
        document.addEventListener('pointerdown', dismissOutsideMap);
        return () => document.removeEventListener('pointerdown', dismissOutsideMap);
    }, [layersOpen, mapRegion]);

    function closeLayers() {
        setLayersOpen(false);
        layersButton.current?.focus({ preventScroll: true });
    }

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
    const showSnowDepthError = interactive && snowDepth && snowDepthUnavailable
        && mapZoom >= snowDepthMinZoom && mapZoom < snowDepthMaxZoom;
    const showSkiTerrainError = interactive && showResortTerrain && resortTerrainUnavailable && mapZoom >= resortTerrainMinZoom;
    const areaApplied = Boolean(searchedAreaKey && searchedAreaKey === viewport);
    const canSearch = interactive && !moving && Boolean(viewport) && !areaApplied;
    const promoteAreaSearch = canSearch && (searchSuggested || Boolean(searchedAreaKey));
    const indyDiscounts = passSelection.passes?.length === 1 && passSelection.passes[0] === 'indy-discounts';
    return <div className="ski-map" onBlur={event => {
        if (layersOpen && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setLayersOpen(false);
    }} onKeyDown={event => {
        if (event.key !== 'Escape') return;
        if (layersOpen) {
            event.preventDefault();
            event.stopPropagation();
            closeLayers();
            return;
        }
        if (!selected && !hovered && !terrainPopupRef.current?.isOpen()) return;
        event.preventDefault();
        keepHoverOpen();
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
                <SkiIconButton ref={layersButton} icon="layers" label="Layers" hint="Map layers"
                    aria-haspopup="dialog" aria-expanded={layersOpen} aria-controls={layersOpen ? 'ski-map-layers' : undefined}
                    data-active={layersModified || layersOpen || undefined}
                    aria-description={layersModified ? 'Custom map layers' : undefined}
                    onClick={() => { if (layersOpen) closeLayers(); else setLayersOpen(true); }} />
            </div>
            {layersOpen && <SkiLayerPanel colors={colors} units={units} indyDiscounts={indyDiscounts}
                terrain={terrain} snowDepth={snowDepth} resortTerrain={resortTerrain} peaks={peaks} conventions={terrainConventions}
                onChange={onLayerChange} onClose={closeLayers} />}
            {previousView && <SkiIconButton icon="back" label="Previous view" hint="Return to previous map view" showLabel
                className="ski-previous-view" disabled={!interactive} onClick={() => {
                    const map = mapRef.current;
                    if (!map) return;
                    setPreviousView(undefined);
                    map.getCanvas().focus({ preventScroll: true });
                    map.easeTo({ ...previousView, duration });
                }} />}
        </div>
        <p id="ski-map-instructions" className="sr-only">Use the arrow keys to move the map. Use the zoom buttons or plus and minus keys to zoom. Browse Results to select areas by name.</p>
        <div ref={container} tabIndex={-1} className="h-full w-full" data-testid="ski-status-map" data-map-state={state} />
        {interactive && hovered && hovered.id !== selected?.id && areasById.has(hovered.id)
            && <SkiAreaPopup area={hovered} mapRef={mapRef} report={conditions.reports.get(hovered.id)} status={statuses.get(hovered.id) ?? 'unknown'}
                now={conditions.now} onZoomLocation={onZoomLocation} onKeepOpen={keepHoverOpen} onDismiss={dismissHover} />}
        {(state !== 'ready' || showReliefError || showSnowDepthError || showSkiTerrainError) && <div
            className="absolute bottom-10 left-2 z-2 w-fit max-w-[calc(100%-1rem)] rounded-md border border-slate-600 bg-[#152230] px-3 py-2 text-sm text-slate-100"
            role={failed ? 'alert' : 'status'}>
            {failed && <p>{markersFailed && !rendererFailed ? 'Resort markers unavailable.' : 'Map unavailable.'} <button type="button"
                className="min-h-11 text-cyan-200 underline" onClick={retryMap}>Retry map</button></p>}
            {state === 'loading' && <p>Loading map…</p>}
            {state === 'degraded' && <p>Background unavailable. <button type="button" className="min-h-11 text-cyan-200 underline"
                onClick={() => recoveryRef.current?.retry()}>Retry background</button></p>}
            {showReliefError && <p>Terrain relief unavailable.</p>}
            {showSnowDepthError && <p>Snow depth unavailable.</p>}
            {showSkiTerrainError && <p><span>Ski terrain unavailable.</span> <button type="button" className="min-h-11 text-cyan-200 underline"
                onClick={retrySkiTerrain}>Retry ski terrain</button></p>}
        </div>}
    </div>;
}
