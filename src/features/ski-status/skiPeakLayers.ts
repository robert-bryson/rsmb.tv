import type { FeatureCollection, MultiPoint, Point } from 'geojson';
import type { ExpressionSpecification, Map as MapLibreMap, Point as ScreenPoint, SymbolLayerSpecification } from '../../maps/maplibre';
import { formatElevation, type SkiUnits } from './browse';
import { skiAreas } from './catalog';
import { resortPeaks } from './resortPeaks';
import { drawImage, resortNameLayer } from './skiMapLayers';
import { regionalRoadLayer } from './skiMapStyle';

export const peakSource = 'ski-resort-peaks';
const trailMapPeakLayer = 'ski-trail-map-peaks';
const nearbyPeakLayer = 'ski-nearby-peaks';
const peakLayers = [trailMapPeakLayer, nearbyPeakLayer];
const nearbyDistanceMeters = 10_000;
const duplicateDistanceMeters = 200;

const peakPoints: FeatureCollection<Point> = {
    type: 'FeatureCollection', features: resortPeaks.map(({ id, name, coordinates, elevationFt }) => ({
        type: 'Feature', id,
        properties: { name, elevationFt },
        geometry: { type: 'Point', coordinates },
    })),
};
const skiAreaLocations: MultiPoint = {
    type: 'MultiPoint', coordinates: skiAreas.map(area => area.location.coordinates),
};
const trailMapLocations: MultiPoint = {
    type: 'MultiPoint', coordinates: resortPeaks.map(peak => peak.coordinates),
};
const nearbyPeakFilter: ExpressionSpecification = ['all',
    ['==', ['get', 'kind'], 'peak'], ['==', ['typeof', ['get', 'name']], 'string'], ['!=', ['get', 'name'], ''],
    ['<=', ['distance', skiAreaLocations], nearbyDistanceMeters],
    trailMapLocations.coordinates.length === 0 || ['>', ['distance', trailMapLocations], duplicateDistanceMeters],
];

function addPeakLayer(map: MapLibreMap, layer: SymbolLayerSpecification, appearance: {
    labelZoom: number; color: string; iconSize: number; textSize: number;
}, before?: string) {
    const { labelZoom, color, iconSize, textSize } = appearance;
    const minzoom = labelZoom - 2;
    const mediumZoom = labelZoom - 1;
    drawImage(map, layer.id, 14, context => {
        context.beginPath();
        context.moveTo(7, 2);
        context.lineTo(12, 11);
        context.lineTo(2, 11);
        context.closePath();
        context.lineJoin = 'round';
        context.lineWidth = 2;
        context.strokeStyle = '#182938';
        context.stroke();
        context.fillStyle = color;
        context.fill();
    });
    map.addLayer({
        ...layer, minzoom,
        layout: {
            'icon-image': layer.id,
            'icon-size': ['interpolate', ['linear'], ['zoom'], minzoom, 0.55 * iconSize, mediumZoom, 0.78 * iconSize, labelZoom, iconSize],
            'text-field': ['step', ['zoom'], '', labelZoom, ['get', 'name']],
            'text-font': map.getGlyphs() ? ['Open Sans Regular'] : ['sans-serif'],
            'text-size': textSize, 'text-anchor': 'top', 'text-offset': [0, 0.65],
            'text-max-width': 12, 'text-optional': true,
        },
        paint: {
            'icon-opacity': ['interpolate', ['linear'], ['zoom'], minzoom, 0.28, mediumZoom, 0.65, labelZoom, 0.85, labelZoom + 1.5, 1],
            'text-opacity': ['interpolate', ['linear'], ['zoom'], labelZoom, 0.5, labelZoom + 1.5, 1],
            'text-color': color,
            'text-halo-color': '#182938', 'text-halo-width': 1.5,
        },
    }, before);
}

export function isPeakLayer(id: string) {
    return peakLayers.includes(id);
}

export function syncPeakLayers(map: MapLibreMap, enabled: boolean) {
    if (!enabled) {
        for (const id of peakLayers) {
            if (map.getLayer(id)) map.removeLayer(id);
            if (map.hasImage(id)) map.removeImage(id);
        }
        if (map.getSource(peakSource)) map.removeSource(peakSource);
        return;
    }
    if (!map.getSource(peakSource)) {
        map.addSource(peakSource, { type: 'geojson', data: peakPoints });
        addPeakLayer(map, { id: trailMapPeakLayer, type: 'symbol', source: peakSource },
            { labelZoom: 10, color: '#f2e2bd', iconSize: 1, textSize: 13 }, map.getLayer(resortNameLayer) ? resortNameLayer : undefined);
    }
    if (map.getLayer(nearbyPeakLayer)) return;
    const sourceId = map.getLayer(regionalRoadLayer)?.source;
    const source = sourceId ? map.getSource(sourceId) : undefined;
    // Wait for TileJSON so a basemap without POIs can still draw its own layers.
    if (source?.type !== 'vector' || !source.loaded() || (source.vectorLayerIds && !source.vectorLayerIds.includes('pois'))) return;
    addPeakLayer(map, {
        id: nearbyPeakLayer, type: 'symbol', source: source.id, 'source-layer': 'pois', filter: nearbyPeakFilter,
    }, { labelZoom: 12, color: '#bac9cf', iconSize: 0.78, textSize: 11 }, trailMapPeakLayer);
}

export function mountainPeakLabel(map: MapLibreMap, point: ScreenPoint, units: SkiUnits) {
    const zoom = map.getZoom();
    const layers = peakLayers.filter(id => {
        const layer = map.getLayer(id);
        return layer && zoom >= layer.minzoom;
    });
    if (!layers.length) return;
    const feature = map.queryRenderedFeatures(point, { layers })[0];
    const name: unknown = feature?.properties.name;
    if (typeof name !== 'string') return;
    const trailMap = feature.layer.id === trailMapPeakLayer;
    const label = trailMap ? `${name} · Trail map` : name;
    const value: unknown = trailMap ? feature.properties.elevationFt : feature.properties.elevation;
    const elevation = typeof value === 'number' && Number.isFinite(value)
        ? formatElevation(value, units, trailMap ? 'imperial' : 'metric') : undefined;
    return elevation ? `${label}\n${elevation}` : label;
}
