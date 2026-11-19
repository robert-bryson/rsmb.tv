import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cartoRasterStyle, cartoVectorStyleUrl } from '../../maps/cartoBasemaps';
import * as maplibre from '../../maps/maplibre';
import { recoverBasemap, type BasemapState } from '../../maps/recoverBasemap';
import { distanceSquared, type TooltipPoint } from '../../maps/screenGeometry';
import type { SkiArea } from './catalog';
import { markerColor, type MarkerMode } from './mapAppearance';
import 'maplibre-gl/dist/maplibre-gl.css';

const sourceId = 'ski-areas';
const pointLayer = 'ski-area-points';
const selectedLayer = 'ski-area-selected';
const terrainSource = 'ski-terrain-dem';
const terrainLayer = 'ski-terrain-relief';
const pointZoom = 9;
const providerStyle = () => cartoVectorStyleUrl('dark-matter');

interface Props {
    areas: readonly SkiArea[];
    selected?: SkiArea;
    colors: MarkerMode;
    terrain: boolean;
    visible: boolean;
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
    map.setFilter(selectedLayer, ['==', ['get', 'areaId'], area?.id ?? '']);
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
    const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol');
    map.addLayer({
        id: terrainLayer, type: 'hillshade', source: terrainSource, minzoom: 8,
        paint: { 'hillshade-exaggeration': 0.4, 'hillshade-shadow-color': '#09090b', 'hillshade-highlight-color': '#cbd5e1' },
    }, firstLabel?.id ?? pointLayer);
}

function closestArea(map: maplibre.Map, point: TooltipPoint, areas: readonly SkiArea[]) {
    const layers = [selectedLayer, pointLayer].filter(layer => map.getLayer(layer));
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

export default function SkiStatusMap({ areas, selected, colors, terrain, visible, onSelect }: Props) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibre.Map | null>(null);
    const recoveryRef = useRef<ReturnType<typeof recoverBasemap> | null>(null);
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
            type: 'Feature', id: area.id, properties: { areaId: area.id, color: markerColor(area, colors) },
            geometry: { type: 'Point', coordinates: area.location.coordinates },
        })),
    }), [areas, colors]);
    const current = useEffectEvent(() => ({ areas, points, selected, terrain }));
    const selectArea = useEffectEvent(onSelect);
    const syncCamera = useEffectEvent((map: maplibre.Map) => {
        if (!visible || !map.getLayer(pointLayer)) return;
        const { clientWidth, clientHeight } = map.getContainer();
        if (!clientWidth || !clientHeight) return;

        // Keep changes pending while the map is hidden or a replacement style loads.
        const previous = appliedCamera.current;
        appliedCamera.current = { areas, selectedId: selected?.id };
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

    useEffect(() => {
        let map: maplibre.Map | undefined;
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
                syncTerrain(instance, data.terrain);
                setTerrainUnavailable(false);
                syncCamera(instance);
            });
            instance.on('resize', () => syncCamera(instance));
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
            for (const layer of [pointLayer, selectedLayer]) {
                instance.on('mouseenter', layer, () => { instance.getCanvas().style.cursor = 'pointer'; });
                instance.on('mouseleave', layer, () => { instance.getCanvas().style.cursor = ''; });
            }
            instance.on('click', event => {
                if (!instance.getSource(sourceId) || !instance.isSourceLoaded(sourceId)) return;
                const id = closestArea(instance, event.point, current().areas);
                if (id) selectArea(id);
            });
        });
        return () => {
            cancelAnimationFrame(frame);
            recoveryRef.current?.dispose();
            recoveryRef.current = null;
            map?.remove();
            mapRef.current = null;
            appliedCamera.current = undefined;
        };
    }, [attempt]);

    useEffect(() => {
        mapRef.current?.getSource<maplibre.GeoJSONSource>(sourceId)?.setData(points);
    }, [points]);

    useEffect(() => {
        const map = mapRef.current;
        if (map) syncCamera(map);
    }, [areas, selected, visible]);

    useEffect(() => {
        const map = mapRef.current;
        if (map) syncTerrain(map, terrain);
    }, [terrain]);

    useEffect(() => {
        const map = mapRef.current;
        if (map?.getLayer(selectedLayer)) highlightArea(map, selected);
    }, [selected]);

    const state = failed ? 'error' : !ready || basemap === 'loading' ? 'loading' : basemap === 'unavailable' ? 'degraded' : 'ready';
    return <div className="relative h-full min-h-0">
        <div ref={container} className="h-full w-full" data-testid="ski-status-map"
            data-map-state={state} />
        {ready && !failed && <button type="button" disabled={!areas.length} onClick={() => {
            if (mapRef.current) fitAreas(mapRef.current, areas, duration);
        }}
            className="absolute left-2 top-2 min-h-11 rounded-md border border-zinc-600 bg-zinc-950/95 px-3 text-sm text-zinc-100 hover:border-cyan-300 disabled:opacity-50">
            Fit results
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
