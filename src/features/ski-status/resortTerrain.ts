import archive from '../../../projects/ski-status/data/resort-terrain.pmtiles?url';
import manifest from '../../../projects/ski-status/data/resort-terrain.json';
import type { CircleLayerSpecification, ExpressionSpecification, FillLayerSpecification, FilterSpecification, LineLayerSpecification, Map as MapLibreMap } from '../../maps/maplibre';
import { pmtilesSourceUrl } from '../../maps/pmtiles';
import type { TooltipPoint } from '../../maps/screenGeometry';
import type { SkiArea } from './catalog';

export const resortTerrainSource = 'ski-resort-terrain';
export const resortTerrainMinZoom = manifest.minZoom;
const resortDetailMinZoom = manifest.detailMinZoom;
export const resortFootprintLayer = 'ski-resort-footprints';
const liftLayer = 'ski-resort-lifts';
const runLayer = 'ski-resort-runs';
const runFillLayer = 'ski-resort-run-areas';
const stationLayer = 'ski-resort-lift-stations';
const groupsByArea = new Map(Object.entries(manifest.groupsByArea));
export type TerrainConvention = 'default' | 'europe' | 'japan';
const terrainColors = {
    lift: '#fbbf24', nordic: '#22d3ee', touring: '#c084fc', park: '#fb923c', connector: '#a1a1aa',
    novice: '#86efac', easy: '#4ade80', blue: '#60a5fa', red: '#fb7185', advanced: '#18181b', freeride: '#fde047', unknown: '#d4d4d8',
};

export function resortTerrainGroups(areas: readonly SkiArea[]) {
    return [...new Set(areas.flatMap(area => groupsByArea.get(area.id) ?? []))];
}

const difficulty: ExpressionSpecification = ['get', 'difficulty'];
const european: ExpressionSpecification = ['==', ['get', 'convention'], 'europe'];
const japanese: ExpressionSpecification = ['==', ['get', 'convention'], 'japan'];
const runColor: ExpressionSpecification = ['match', ['get', 'use'],
    'nordic', terrainColors.nordic, 'skitour', terrainColors.touring, 'snow_park', terrainColors.park, 'connection', terrainColors.connector,
    ['match', difficulty, 'novice', terrainColors.novice, 'easy', ['case', european, terrainColors.blue, terrainColors.easy],
        'intermediate', ['case', ['any', european, japanese], terrainColors.red, terrainColors.blue],
        ['advanced', 'expert', 'extreme'], terrainColors.advanced, 'freeride', terrainColors.freeride, terrainColors.unknown],
];
const runCasing: ExpressionSpecification = ['case', ['==', runColor, '#18181b'], '#d4d4d8', '#18181b'];

const layers: (FillLayerSpecification | LineLayerSpecification | CircleLayerSpecification)[] = [
    {
        id: resortFootprintLayer, type: 'fill', source: resortTerrainSource, 'source-layer': 'footprints', minzoom: resortTerrainMinZoom,
        paint: { 'fill-color': '#38bdf8', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.22, 11, 0.12] },
    },
    {
        id: 'ski-resort-footprint-outline', type: 'line', source: resortTerrainSource, 'source-layer': 'footprints', minzoom: resortTerrainMinZoom,
        paint: { 'line-color': '#7dd3fc', 'line-opacity': 0.72, 'line-width': 1.5, 'line-dasharray': [2, 2] },
    },
    {
        id: runFillLayer, type: 'fill', source: resortTerrainSource, 'source-layer': 'runs', minzoom: 12,
        paint: { 'fill-color': runColor, 'fill-opacity': 0.25 },
    },
    {
        id: 'ski-resort-run-outline', type: 'line', source: resortTerrainSource, 'source-layer': 'runs', minzoom: resortDetailMinZoom,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': runCasing, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 15, 5] },
    },
    {
        id: runLayer, type: 'line', source: resortTerrainSource, 'source-layer': 'runs', minzoom: resortDetailMinZoom,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': runColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.25, 15, 3] },
    },
    {
        id: liftLayer, type: 'line', source: resortTerrainSource, 'source-layer': 'lifts', minzoom: resortDetailMinZoom,
        paint: { 'line-color': terrainColors.lift, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.75, 15, 3.5], 'line-dasharray': [2.5, 1.4] },
    },
    {
        id: stationLayer, type: 'circle', source: resortTerrainSource, 'source-layer': 'stations', minzoom: manifest.stationMinZoom,
        paint: { 'circle-color': terrainColors.lift, 'circle-stroke-color': '#18181b', 'circle-stroke-width': 1, 'circle-radius': 3.5 },
    },
];

export function visibleTerrainConventions(map: MapLibreMap): TerrainConvention[] {
    if (!map.getLayer(runLayer) || map.getZoom() < resortDetailMinZoom) return [];
    const conventions = new Set<TerrainConvention>();
    for (const feature of map.queryRenderedFeatures({ layers: [runLayer] })) {
        const convention = feature.properties.convention;
        conventions.add(convention === 'europe' || convention === 'japan' ? convention : 'default');
    }
    return [...conventions].sort();
}

export function skiRunLegend(convention: TerrainConvention) {
    return [
        { label: 'Novice', color: terrainColors.novice },
        { label: 'Easy', color: convention === 'europe' ? terrainColors.blue : terrainColors.easy },
        { label: 'Intermediate', color: convention === 'default' ? terrainColors.blue : terrainColors.red },
        { label: 'Advanced and harder', color: terrainColors.advanced },
    ];
}

export const skiTerrainLegend = [
    { label: 'Lift', color: terrainColors.lift, dashed: true }, { label: 'Nordic', color: terrainColors.nordic },
    { label: 'Ski touring', color: terrainColors.touring }, { label: 'Terrain park', color: terrainColors.park },
    { label: 'Freeride', color: terrainColors.freeride }, { label: 'Connector', color: terrainColors.connector },
    { label: 'Unrated run', color: terrainColors.unknown },
];

export function syncResortTerrain(map: MapLibreMap, before: string, groups: number[], reload = false) {
    if (!map.getLayer(before)) return;
    const installed = Boolean(map.getSource(resortTerrainSource));
    if (installed && (!groups.length || reload)) {
        for (const { id } of layers) if (map.getLayer(id)) map.removeLayer(id);
        map.removeSource(resortTerrainSource);
    }
    if (!groups.length) return;

    const filter: FilterSpecification = ['in', ['get', 'group'], ['literal', groups]];
    if (installed && !reload) {
        for (const layer of layers) map.setFilter(layer.id, filter);
    } else if (map.getZoom() >= resortTerrainMinZoom) {
        map.addSource(resortTerrainSource, {
            type: 'vector', url: pmtilesSourceUrl(archive, reload), minzoom: manifest.minZoom, maxzoom: manifest.maxZoom,
            attribution: '<a href="https://www.openskidata.org/">OpenSkiData</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
        });
        for (const layer of layers) map.addLayer({ ...layer, filter }, before);
    }
}

const runTypes = new Map([
    ['nordic', 'Nordic trail'], ['skitour', 'Ski touring'], ['snow_park', 'Terrain park'], ['connection', 'Connector'],
]);

export function resortTerrainLabel(map: MapLibreMap, point: TooltipPoint) {
    if (map.getZoom() < resortDetailMinZoom || !map.getSource(resortTerrainSource)) return;
    const inspectable = [stationLayer, liftLayer, runLayer, runFillLayer].filter(id => map.getLayer(id));
    if (!inspectable.length) return;
    const [feature] = map.queryRenderedFeatures([
        [point.x - 3, point.y - 3], [point.x + 3, point.y + 3],
    ], { layers: inspectable });
    if (!feature) return;
    const { name, ref, liftType, use, difficulty }: Record<string, unknown> = feature.properties;
    const title = typeof name === 'string' ? name : typeof ref === 'string' ? ref : undefined;
    let kind = 'Ski run';
    if (feature.layer.id === stationLayer) kind = 'Lift station';
    else if (feature.layer.id === liftLayer) kind = typeof liftType === 'string' ? liftType.replaceAll('_', ' ') : 'Lift';
    else if (typeof use === 'string') kind = runTypes.get(use) ?? kind;
    const description = typeof difficulty === 'string' && difficulty !== 'other' ? `${kind} · ${difficulty}` : kind;
    return title ? `${title} · ${description}` : description;
}
