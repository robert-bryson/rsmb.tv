import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cartoRasterStyle, cartoVectorStyleUrl } from '../../maps/cartoBasemaps';
import * as maplibre from '../../maps/maplibre';
import { recoverBasemap, type BasemapState } from '../../maps/recoverBasemap';
import { distanceSquared, type TooltipPoint } from '../../maps/screenGeometry';
import type { SkiArea } from './catalog';
import 'maplibre-gl/dist/maplibre-gl.css';

const sourceId = 'ski-areas';
const clusterLayer = 'ski-area-clusters';
const pointLayer = 'ski-area-points';
const selectedLayer = 'ski-area-selected';
const pointZoom = 9;
const providerStyle = () => cartoVectorStyleUrl('dark-matter');

interface Props {
    areas: readonly SkiArea[];
    selected?: SkiArea;
    onSelect: (id: string) => void;
}

function fitAreas(map: maplibre.Map, areas: readonly SkiArea[], duration: number) {
    if (!areas.length) return;
    const bounds = new maplibre.LngLatBounds();
    for (const area of areas) bounds.extend(area.location.coordinates);
    map.fitBounds(bounds, { padding: 46, maxZoom: pointZoom, duration });
}

function highlightArea(map: maplibre.Map, area?: SkiArea) {
    map.setFilter(selectedLayer, ['==', ['get', 'areaId'], area?.id ?? '']);
}

function addAreaLayers(map: maplibre.Map, data: FeatureCollection<Point>) {
    map.addSource(sourceId, {
        type: 'geojson', data, cluster: true, clusterMaxZoom: pointZoom - 1, clusterRadius: 34,
        attribution: '<a href="https://www.openskidata.org/">OpenSkiData</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    });
    map.addLayer({
        id: clusterLayer, type: 'circle', source: sourceId, filter: ['has', 'point_count'],
        paint: { 'circle-radius': ['step', ['get', 'point_count'], 12, 5, 15, 10, 18], 'circle-color': '#0e7490', 'circle-stroke-color': '#a5f3fc', 'circle-stroke-width': 1.5 },
    });
    if (map.getStyle().glyphs) map.addLayer({
        id: 'ski-area-cluster-count', type: 'symbol', source: sourceId, filter: ['has', 'point_count'],
        layout: { 'text-field': ['to-string', ['get', 'point_count_abbreviated']], 'text-font': ['Open Sans Regular'], 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': '#ffffff' },
    });
    map.addLayer({
        id: pointLayer, type: 'circle', source: sourceId, filter: ['!', ['has', 'point_count']],
        paint: { 'circle-radius': 6, 'circle-color': '#67e8f9', 'circle-stroke-color': '#083344', 'circle-stroke-width': 2 },
    });
    map.addLayer({
        id: selectedLayer, type: 'circle', source: sourceId,
        paint: { 'circle-radius': 8, 'circle-color': '#fbbf24', 'circle-stroke-color': '#1c1917', 'circle-stroke-width': 2 },
    });
}

function closestMarker(map: maplibre.Map, point: TooltipPoint, areas: readonly SkiArea[]) {
    const layers = [selectedLayer, pointLayer, clusterLayer].filter(layer => map.getLayer(layer));
    if (!layers.length) return;

    // Allow a tap next to the circle. Use distance instead of layer order when circles overlap.
    const padding = 10;
    const features = map.queryRenderedFeatures([
        [point.x - padding, point.y - padding], [point.x + padding, point.y + padding],
    ], { layers });
    let nearest: { areaId: string } | { clusterId: number; center: [number, number] } | undefined;
    let nearestDistance = Infinity;
    for (const feature of features) {
        if (feature.geometry.type !== 'Point') continue;
        const center = feature.geometry.coordinates as [number, number];
        const distance = distanceSquared(point, map.project(center));
        if (distance >= nearestDistance) continue;
        const areaId: unknown = feature.properties.areaId;
        const clusterId: unknown = feature.properties.cluster_id;
        if (typeof areaId === 'string' && areas.some(area => area.id === areaId)) nearest = { areaId };
        else if (typeof clusterId === 'number') nearest = { clusterId, center };
        else continue;
        nearestDistance = distance;
    }
    return nearest;
}

export default function SkiStatusMap({ areas, selected, onSelect }: Props) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibre.Map | null>(null);
    const recoveryRef = useRef<ReturnType<typeof recoverBasemap> | null>(null);
    const cameraRevision = useRef(0);
    const [attempt, setAttempt] = useState(0);
    const [basemap, setBasemap] = useState<BasemapState>('loading');
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const reducedMotion = useReducedMotion();
    const duration = reducedMotion ? 0 : 280;
    const points = useMemo<FeatureCollection<Point>>(() => ({
        type: 'FeatureCollection',
        features: areas.map(area => ({
            type: 'Feature', id: area.id, properties: { areaId: area.id },
            geometry: { type: 'Point', coordinates: area.location.coordinates },
        })),
    }), [areas]);
    const current = useEffectEvent(() => ({ areas, points, selected, duration }));
    const selectArea = useEffectEvent(onSelect);

    useEffect(() => {
        let map: maplibre.Map | undefined;
        let active = true;
        let fitted = false;
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
                dataSources: new Set([sourceId]), providerStyle, neutralStyle: () => cartoRasterStyle('dark', ''),
            }, state => {
                setBasemap(state);
                if (state !== 'ready') setReady(false);
            });
            instance.on('style.load', () => {
                cameraRevision.current++;
                const data = current();
                if (!instance.getSource(sourceId)) addAreaLayers(instance, data.points);
                highlightArea(instance, data.selected);
                if (!fitted) {
                    if (data.selected) instance.jumpTo({ center: data.selected.location.coordinates, zoom: pointZoom });
                    else fitAreas(instance, data.areas, 0);
                    fitted = true;
                }
            });
            instance.on('sourcedata', event => {
                if (event.sourceId === sourceId && event.isSourceLoaded) setReady(true);
            });
            instance.on('webglcontextlost', () => setFailed(true));
            instance.on('webglcontextrestored', () => setFailed(false));
            instance.on('error', ({ error }) => {
                if (/webgl|context|worker/i.test(error?.message ?? '')) setFailed(true);
            });
            for (const layer of [pointLayer, selectedLayer, clusterLayer]) {
                instance.on('mouseenter', layer, () => { instance.getCanvas().style.cursor = 'pointer'; });
                instance.on('mouseleave', layer, () => { instance.getCanvas().style.cursor = ''; });
            }
            instance.on('movestart', () => { cameraRevision.current++; });
            instance.on('click', event => {
                const revision = ++cameraRevision.current;
                const source = instance.getSource<maplibre.GeoJSONSource>(sourceId);
                if (!source || !instance.isSourceLoaded(sourceId)) return;
                const marker = closestMarker(instance, event.point, current().areas);
                if (!marker) return;
                if ('areaId' in marker) {
                    selectArea(marker.areaId);
                    return;
                }
                void source.getClusterExpansionZoom(marker.clusterId).then(zoom => {
                    // A later click, movement, selection, or data change takes precedence.
                    if (active && revision === cameraRevision.current && instance.getSource(sourceId) === source) {
                        instance.easeTo({ center: marker.center, zoom, duration: current().duration });
                    }
                }).catch(() => { /* A filter can replace the clicked cluster before the worker replies. */ });
            });
        });
        return () => {
            active = false;
            cancelAnimationFrame(frame);
            recoveryRef.current?.dispose();
            recoveryRef.current = null;
            map?.remove();
            mapRef.current = null;
        };
    }, [attempt]);

    useEffect(() => {
        cameraRevision.current++;
        const map = mapRef.current;
        const source = map?.getSource<maplibre.GeoJSONSource>(sourceId);
        if (!map || !source) return;
        source.setData(points);
        const { selected, duration } = current();
        if (!selected) fitAreas(map, areas, duration);
    }, [areas, points]);

    useEffect(() => {
        cameraRevision.current++;
        const map = mapRef.current;
        if (!map?.getLayer(selectedLayer)) return;
        highlightArea(map, selected);
        if (selected) map.easeTo({ center: selected.location.coordinates, zoom: Math.max(pointZoom, map.getZoom()), duration: current().duration });
    }, [selected]);

    const state = failed ? 'error' : !ready || basemap === 'loading' ? 'loading' : basemap === 'unavailable' ? 'degraded' : 'ready';
    return <div className="relative h-full min-h-0">
        <div ref={container} className="h-full w-full" data-testid="ski-status-map"
            data-map-state={state} />
        {ready && !failed && <button type="button" disabled={!areas.length} onClick={() => {
            cameraRevision.current++;
            if (mapRef.current) fitAreas(mapRef.current, areas, duration);
        }}
            className="absolute left-2 top-2 min-h-11 rounded-md border border-zinc-600 bg-zinc-950/95 px-3 text-sm text-zinc-100 hover:border-cyan-300 disabled:opacity-50">
            Fit results
        </button>}
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
