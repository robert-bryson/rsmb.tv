import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cartoRasterStyle, cartoVectorStyleUrl } from '../../maps/cartoBasemaps';
import * as maplibre from '../../maps/maplibre';
import { recoverBasemap, type BasemapState } from '../../maps/recoverBasemap';
import { distanceSquared, type TooltipPoint } from '../../maps/screenGeometry';
import { skiAreaIdsInViewport } from './browse';
import { passFamilySchema, skiAreas, type PassFamily, type SkiArea } from './catalog';
import { markerAppearance, multiplePassColor, passBadgeId, passBadgeSize, passBadgeTextColor, type MarkerMode } from './mapAppearance';
import { passIconUrls } from './passIcons';
import 'maplibre-gl/dist/maplibre-gl.css';

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
const pointZoom = 9;
const providerStyle = () => cartoVectorStyleUrl('dark-matter');

interface Props {
    areas: readonly SkiArea[];
    selected?: SkiArea;
    colors: MarkerMode;
    preferredPass?: PassFamily;
    terrain: boolean;
    visible: boolean;
    inView: boolean;
    onVisibleAreasChange: (ids: ReadonlySet<string>) => void;
    onSelect: (id: string) => void;
}

function fitAreas(map: maplibre.Map, areas: readonly SkiArea[], duration: number) {
    if (!areas.length) return;
    const { clientWidth, clientHeight } = map.getContainer();
    const padding = Math.min(46, clientWidth / 4, clientHeight / 4);
    if (!padding) return;
    map.resize();
    const bounds = new maplibre.LngLatBounds();
    for (const area of areas) bounds.extend(area.location.coordinates);
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
    map.addLayer({
        id: terrainLayer, type: 'hillshade', source: terrainSource, minzoom: 8,
        paint: { 'hillshade-exaggeration': 0.4, 'hillshade-shadow-color': '#09090b', 'hillshade-highlight-color': '#cbd5e1' },
    }, firstLabel?.id ?? pointLayer);
}

function closestArea(map: maplibre.Map, point: TooltipPoint, areas: readonly SkiArea[]) {
    const layers = markerLayers.filter(layer => map.getLayer(layer));
    if (!layers.length) return;

    // Allow a tap next to the circle. Use distance instead of layer order when circles overlap.
    const padding = 10;
    const features = map.queryRenderedFeatures([
        [point.x - padding, point.y - padding], [point.x + padding, point.y + padding],
    ], { layers });
    let nearest: string | undefined;
    let nearestDistance = Infinity;
    for (const feature of features) {
        if (feature.geometry.type !== 'Point') continue;
        const center = feature.geometry.coordinates as [number, number];
        const distance = distanceSquared(point, map.project(center));
        if (distance >= nearestDistance) continue;
        const areaId: unknown = feature.properties.areaId;
        if (typeof areaId !== 'string' || !areas.some(area => area.id === areaId)) continue;
        nearest = areaId;
        nearestDistance = distance;
    }
    return nearest;
}

export default function SkiStatusMap({ areas, selected, colors, preferredPass, terrain, visible, inView, onVisibleAreasChange, onSelect }: Props) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibre.Map | null>(null);
    const recoveryRef = useRef<ReturnType<typeof recoverBasemap> | null>(null);
    const passImages = useRef<ReturnType<typeof loadPassImages> | undefined>(undefined);
    const appliedCamera = useRef<{ areas: readonly SkiArea[]; selectedId?: string } | undefined>(undefined);
    const [attempt, setAttempt] = useState(0);
    const [basemap, setBasemap] = useState<BasemapState>('loading');
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const [terrainUnavailable, setTerrainUnavailable] = useState(false);
    const reducedMotion = useReducedMotion();
    const duration = reducedMotion ? 0 : 280;
    const points = useMemo<FeatureCollection<Point>>(() => ({
        type: 'FeatureCollection',
        features: areas.map(area => ({
            type: 'Feature', id: area.id, properties: { areaId: area.id, ...markerAppearance(area, colors, preferredPass) },
            geometry: { type: 'Point', coordinates: area.location.coordinates },
        })),
    }), [areas, colors, preferredPass]);
    const current = useEffectEvent(() => ({ areas, points, selected, colors, terrain }));
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
        onVisibleAreasChange(skiAreaIdsInViewport(skiAreas, viewport, coordinates => map.project(coordinates)));
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
                    container: container.current, style: providerStyle(), center: [-100, 44], zoom: 2.7,
                    minZoom: 1, maxZoom: 16, renderWorldCopies: false, dragRotate: false, pitchWithRotate: false,
                });
            } catch {
                setFailed(true);
                return;
            }
            map = instance;
            mapRef.current = instance;
            instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
            recoveryRef.current = recoverBasemap(instance, {
                dataSources: new Set([sourceId, terrainSource]), providerStyle, neutralStyle: () => cartoRasterStyle('dark', ''),
            }, state => {
                setBasemap(state);
                if (state !== 'ready') setReady(false);
            });
            instance.on('style.load', () => {
                const data = current();
                if (!instance.getSource(sourceId)) addAreaLayers(instance, data.points);
                highlightArea(instance, data.selected);
                syncPassBadges(instance);
                syncTerrain(instance, data.terrain);
                setTerrainUnavailable(false);
                syncCamera(instance);
                queueViewport();
            });
            instance.on('resize', () => {
                syncCamera(instance);
                queueViewport();
            });
            instance.on('moveend', queueViewport);
            instance.on('sourcedata', event => {
                if (event.sourceId === sourceId && event.isSourceLoaded) setReady(true);
                if (event.sourceId === terrainSource && event.isSourceLoaded && event.sourceDataType === 'content') setTerrainUnavailable(false);
            });
            instance.on('webglcontextlost', () => setFailed(true));
            instance.on('webglcontextrestored', () => setFailed(false));
            instance.on('error', event => {
                if ('sourceId' in event && event.sourceId === terrainSource) setTerrainUnavailable(true);
                else if (/webgl|context|worker/i.test(event.error?.message ?? '')) setFailed(true);
            });
            instance.on('mouseenter', markerLayers, () => { instance.getCanvas().style.cursor = 'pointer'; });
            instance.on('mouseleave', markerLayers, () => { instance.getCanvas().style.cursor = ''; });
            instance.on('click', event => {
                if (!instance.getSource(sourceId) || !instance.isSourceLoaded(sourceId)) return;
                const id = closestArea(instance, event.point, current().areas);
                if (id) selectArea(id);
            });
        });
        return () => {
            cancelAnimationFrame(frame);
            if (viewportFrame !== undefined) cancelAnimationFrame(viewportFrame);
            recoveryRef.current?.dispose();
            recoveryRef.current = null;
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
        const map = mapRef.current;
        if (!map?.getLayer(selectedLayer)) return;
        syncPassBadges(map);
        highlightArea(map, selected);
    }, [colors, selected]);

    const state = failed ? 'error' : !ready || basemap === 'loading' ? 'loading' : basemap === 'unavailable' ? 'degraded' : 'ready';
    return <div className="relative h-full min-h-0">
        <div ref={container} className="h-full w-full" data-testid="ski-status-map"
            data-map-state={state} />
        {ready && !failed && <button type="button" disabled={!areas.length} onClick={() => {
            if (mapRef.current) fitAreas(mapRef.current, areas, duration);
        }}
            className="absolute left-2 top-2 min-h-11 rounded-md border border-zinc-600 bg-zinc-950/95 px-3 text-sm text-zinc-100 hover:border-cyan-300 disabled:opacity-50">
            {inView ? 'Fit all results' : 'Fit results'}
        </button>}
        {state === 'ready' && terrain && terrainUnavailable && <p role="status"
            className="absolute bottom-9 left-2 w-fit max-w-[calc(100%-1rem)] rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
            Terrain relief unavailable.
        </p>}
        {state !== 'ready' && <div
            className="absolute bottom-9 left-2 right-2 w-fit max-w-[calc(100%-1rem)] rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            role={failed ? 'alert' : 'status'}>
            {failed ? <>Map unavailable. <button type="button" className="min-h-9 text-cyan-300 underline" onClick={() => {
                setReady(false);
                setBasemap('loading');
                setFailed(false);
                setAttempt(value => value + 1);
            }}>Retry map</button></> : state === 'degraded' ? <>Background unavailable. <button type="button" className="min-h-9 text-cyan-300 underline"
                onClick={() => recoveryRef.current?.retry()}>Retry background</button></> : 'Loading map…'}
        </div>}
    </div>;
}
