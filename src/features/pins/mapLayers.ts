import type { Map, ExpressionSpecification } from '../../maps/maplibre';
import type { FeatureCollection } from 'geojson';
import { COUNTY_COLOR, NATIONAL_COLOR, STATE_COLOR } from './geometry';
import { RADIUS_MIN_ZOOM } from './radii';

export const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
export const DATA_SOURCES = new Set(['pin-states', 'pin-counties', 'pin-points', 'pin-circles', 'pin-selection', 'pin-radii']);
const CIRCLE_COLOR: ExpressionSpecification = ['match', ['get', 'level'], 'country', NATIONAL_COLOR, 'county', COUNTY_COLOR, STATE_COLOR];
const SELECTION_COLOR: ExpressionSpecification = ['case', ['==', ['get', 'level'], 'country'], '#deceff', '#ffe3ad'];

export function installPinLayers(map: Map) {
    for (const id of DATA_SOURCES) map.addSource(id, { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'state-fill', type: 'fill', source: 'pin-states', paint: { 'fill-color': '#7790a2', 'fill-opacity': 0.055 } });
    map.addLayer({ id: 'county-fill', type: 'fill', source: 'pin-counties', paint: { 'fill-color': COUNTY_COLOR, 'fill-opacity': 0.025 } });
    map.addLayer({ id: 'county-lines', type: 'line', source: 'pin-counties', paint: { 'line-color': '#86a99f', 'line-opacity': 0.3, 'line-width': 0.65 } });
    map.addLayer({ id: 'state-lines', type: 'line', source: 'pin-states', paint: { 'line-color': '#9aa8b5', 'line-opacity': 0.6, 'line-width': 1 } });
    map.addLayer({ id: 'circle-fill', type: 'fill', source: 'pin-circles', paint: { 'fill-color': CIRCLE_COLOR, 'fill-opacity': 0.045 } });
    map.addLayer({ id: 'circle-lines', type: 'line', source: 'pin-circles', paint: { 'line-color': CIRCLE_COLOR, 'line-opacity': 0.55, 'line-width': ['case', ['==', ['get', 'level'], 'country'], 1.8, 1.2] } });
    for (const level of ['state', 'county']) {
        map.addLayer({ id: `selected-${level}`, type: 'line', source: level === 'state' ? 'pin-states' : 'pin-counties',
            filter: ['==', ['get', 'id'], ''], paint: { 'line-color': '#f8e2bf', 'line-width': 2, 'line-opacity': 0.85 } });
    }
    map.addLayer({ id: 'selection-fill', type: 'fill', source: 'pin-selection', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': CIRCLE_COLOR, 'fill-opacity': 0.08 } });
    map.addLayer({ id: 'selection-circle', type: 'line', source: 'pin-selection', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': SELECTION_COLOR, 'line-width': 2 } });
    for (const [level, minimumZoom] of Object.entries(RADIUS_MIN_ZOOM)) {
        map.addLayer({ id: `${level}-radii`, type: 'line', source: 'pin-radii', minzoom: minimumZoom,
            filter: ['all', ['==', ['get', 'level'], level], ['==', ['get', 'selected'], false]],
            layout: { 'line-cap': 'round' }, paint: { 'line-color': CIRCLE_COLOR, 'line-width': 1.3, 'line-opacity': 0.8, 'line-dasharray': [3, 3] } });
    }
    map.addLayer({ id: 'selection-radius', type: 'line', source: 'pin-radii', filter: ['==', ['get', 'selected'], true],
        layout: { 'line-cap': 'round' }, paint: { 'line-color': SELECTION_COLOR, 'line-width': 1.8, 'line-dasharray': [3, 3] } });
    map.addLayer({ id: 'county-pins', type: 'circle', source: 'pin-points', filter: ['==', ['get', 'level'], 'county'],
        paint: { 'circle-color': COUNTY_COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2, 8, 4], 'circle-stroke-width': 1.3, 'circle-stroke-color': '#101b20' } });
    map.addLayer({ id: 'state-pins', type: 'circle', source: 'pin-points', filter: ['==', ['get', 'level'], 'state'],
        paint: { 'circle-color': STATE_COLOR, 'circle-radius': 5, 'circle-stroke-width': 2, 'circle-stroke-color': '#161b20' } });
    map.addLayer({ id: 'country-pins', type: 'circle', source: 'pin-points', filter: ['==', ['get', 'level'], 'country'],
        paint: { 'circle-color': NATIONAL_COLOR, 'circle-radius': 7.5, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#211a2e' } });
    map.addLayer({ id: 'selected-pin', type: 'circle', source: 'pin-points', filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-color': '#fff2d5', 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#b77b2a' } });
    map.addLayer({ id: 'state-labels', type: 'symbol', source: 'pin-points', filter: ['==', ['get', 'level'], 'state'], minzoom: 3,
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Open Sans Bold'], 'text-size': 10, 'text-offset': [0, 1.55] },
        paint: { 'text-color': '#eed5b2', 'text-halo-color': '#111820', 'text-halo-width': 1.5 } });
    map.addLayer({ id: 'country-label', type: 'symbol', source: 'pin-points', filter: ['==', ['get', 'level'], 'country'],
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Open Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.7], 'text-allow-overlap': false },
        paint: { 'text-color': '#deceff', 'text-halo-color': '#111820', 'text-halo-width': 2 } });
    map.addLayer({ id: 'county-labels', type: 'symbol', source: 'pin-points', filter: ['==', ['get', 'level'], 'county'], minzoom: 9,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Open Sans Regular'], 'text-size': 10, 'text-offset': [0, 1.4] },
        paint: { 'text-color': COUNTY_COLOR, 'text-halo-color': '#111820', 'text-halo-width': 1.5 } });
}
