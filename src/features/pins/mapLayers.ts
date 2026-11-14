import type { Map, ExpressionSpecification } from '../../maps/maplibre';
import type { FilterSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { CONTEXT_COLOR, COUNTY_COLOR, NATIONAL_COLOR, STATE_COLOR } from './geometry';
import { RADIUS_MIN_ZOOM, radiusOpacity } from './radii';
import { COUNTY_BOUNDARY_ZOOM, COUNTY_CIRCLE_ZOOM, COUNTY_LABEL_ZOOM, COUNTY_ZOOM, featureZoomFade, zoomFade } from './zoom';

export const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
export const DATA_SOURCES = new Set(['pin-states', 'pin-counties', 'pin-points', 'pin-circles', 'pin-county-circles', 'pin-selection', 'pin-radii']);
const CIRCLE_COLOR: ExpressionSpecification = ['match', ['get', 'level'], 'country', NATIONAL_COLOR, 'county', COUNTY_COLOR, STATE_COLOR];
const SELECTION_COLOR: ExpressionSpecification = ['case', ['==', ['get', 'level'], 'country'], '#deceff', '#ffe3ad'];
const IS_CONTEXT: ExpressionSpecification = ['==', ['get', 'context'], true];
const ACTIVE_LABEL: ExpressionSpecification = ['!=', ['get', 'context'], true];
const IS_COUNTY: ExpressionSpecification = ['==', ['get', 'level'], 'county'];
const COUNTY_SIZE: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], COUNTY_ZOOM, 1.6, 6, 2.3, 9, 3.2, 12, 4];
const COUNTY_STROKE: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], COUNTY_ZOOM, 0, 6, 0.4, 9, 1.1];
const LABEL_PRIORITY: ExpressionSpecification = ['*', -1, ['get', 'radiusMeters']];

export function countyPinFilter(context: boolean, automatic = true): FilterSpecification {
    return ['all', IS_COUNTY, context ? IS_CONTEXT : ACTIVE_LABEL,
        automatic ? ['<=', ['get', 'countyPinZoom'], ['zoom']] : true];
}

export function installPinLayers(map: Map) {
    for (const id of DATA_SOURCES) map.addSource(id, { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'state-fill', type: 'fill', source: 'pin-states', paint: { 'fill-color': '#7790a2', 'fill-opacity': 0.055 } });
    map.addLayer({ id: 'county-fill', type: 'fill', source: 'pin-counties', minzoom: COUNTY_BOUNDARY_ZOOM, paint: { 'fill-color': COUNTY_COLOR, 'fill-opacity': zoomFade(COUNTY_BOUNDARY_ZOOM, 0.025) } });
    map.addLayer({ id: 'county-lines', type: 'line', source: 'pin-counties', minzoom: COUNTY_BOUNDARY_ZOOM, paint: { 'line-color': '#86a99f', 'line-opacity': zoomFade(COUNTY_BOUNDARY_ZOOM, 0.3), 'line-width': 0.65 } });
    map.addLayer({ id: 'state-lines', type: 'line', source: 'pin-states', paint: { 'line-color': '#9aa8b5', 'line-opacity': 0.4, 'line-width': 0.8 } });
    map.addLayer({ id: 'circle-fill', type: 'fill', source: 'pin-circles', filter: ['!', IS_COUNTY], paint: { 'fill-color': CIRCLE_COLOR, 'fill-opacity': ['case', IS_CONTEXT, 0, 0.025] } });
    map.addLayer({ id: 'circle-lines', type: 'line', source: 'pin-circles', filter: ['!', IS_COUNTY], paint: { 'line-color': ['case', IS_CONTEXT, CONTEXT_COLOR, CIRCLE_COLOR], 'line-opacity': ['case', IS_CONTEXT, 0.23, 0.4], 'line-width': ['case', IS_CONTEXT, 0.9, 1.1] } });
    map.addLayer({ id: 'county-circle-fill', type: 'fill', source: 'pin-county-circles', minzoom: COUNTY_CIRCLE_ZOOM,
        filter: ['<=', ['get', 'countyCircleZoom'], ['zoom']],
        paint: { 'fill-color': COUNTY_COLOR, 'fill-opacity': featureZoomFade(COUNTY_CIRCLE_ZOOM, 'countyCircleZoom', ['case', IS_CONTEXT, 0, 0.025]) } });
    map.addLayer({ id: 'county-circle-lines', type: 'line', source: 'pin-county-circles', minzoom: COUNTY_CIRCLE_ZOOM,
        filter: ['<=', ['get', 'countyCircleZoom'], ['zoom']],
        paint: { 'line-color': ['case', IS_CONTEXT, CONTEXT_COLOR, COUNTY_COLOR],
            'line-opacity': featureZoomFade(COUNTY_CIRCLE_ZOOM, 'countyCircleZoom', ['case', IS_CONTEXT, 0.23, 0.4]),
            'line-width': ['case', IS_CONTEXT, 0.9, 1] } });
    map.addLayer({ id: 'selected-county-fill', type: 'fill', source: 'pin-counties', filter: ['==', ['get', 'id'], ''], paint: { 'fill-color': COUNTY_COLOR, 'fill-opacity': 0.025 } });
    for (const level of ['state', 'county']) {
        map.addLayer({ id: `selected-${level}`, type: 'line', source: level === 'state' ? 'pin-states' : 'pin-counties',
            filter: ['==', ['get', 'id'], ''], paint: { 'line-color': '#f8e2bf', 'line-width': 2, 'line-opacity': 0.85 } });
    }
    map.addLayer({ id: 'selection-fill', type: 'fill', source: 'pin-selection', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': CIRCLE_COLOR, 'fill-opacity': 0.08 } });
    map.addLayer({ id: 'selection-circle', type: 'line', source: 'pin-selection', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': SELECTION_COLOR, 'line-width': 2 } });
    for (const [level, minimumZoom] of Object.entries(RADIUS_MIN_ZOOM)) {
        map.addLayer({ id: `${level}-radii`, type: 'line', source: 'pin-radii', minzoom: minimumZoom,
            filter: ['all', ['==', ['get', 'level'], level], ['==', ['get', 'selected'], false], ['<=', ['get', 'minimumZoom'], ['zoom']]],
            layout: { 'line-cap': 'round' }, paint: { 'line-color': CIRCLE_COLOR, 'line-width': 1.3, 'line-opacity': radiusOpacity(minimumZoom), 'line-dasharray': [3, 3] } });
    }
    map.addLayer({ id: 'selection-radius', type: 'line', source: 'pin-radii', filter: ['==', ['get', 'selected'], true],
        layout: { 'line-cap': 'round' }, paint: { 'line-color': SELECTION_COLOR, 'line-width': 1.8, 'line-dasharray': [3, 3] } });
    // Context must sit below active markers, including coincident country and
    // territory poles. A large muted marker must not cover a smaller active one.
    map.addLayer({ id: 'context-pins', type: 'circle', source: 'pin-points', filter: ['all', IS_CONTEXT, ['!', IS_COUNTY]],
        paint: { 'circle-color': CONTEXT_COLOR, 'circle-opacity': 0.8, 'circle-radius': 4, 'circle-stroke-width': 1.3, 'circle-stroke-color': '#18232b' } });
    map.addLayer({ id: 'context-county-pins', type: 'circle', source: 'pin-points', minzoom: COUNTY_ZOOM, filter: countyPinFilter(true),
        paint: { 'circle-color': CONTEXT_COLOR, 'circle-opacity': featureZoomFade(COUNTY_ZOOM, 'countyPinZoom', 0.8), 'circle-stroke-opacity': featureZoomFade(COUNTY_ZOOM, 'countyPinZoom', 0.8),
            'circle-radius': COUNTY_SIZE, 'circle-stroke-width': COUNTY_STROKE, 'circle-stroke-color': '#18232b' } });
    map.addLayer({ id: 'county-pins', type: 'circle', source: 'pin-points', minzoom: COUNTY_ZOOM, filter: countyPinFilter(false),
        paint: { 'circle-color': COUNTY_COLOR, 'circle-opacity': featureZoomFade(COUNTY_ZOOM, 'countyPinZoom', 1), 'circle-stroke-opacity': featureZoomFade(COUNTY_ZOOM, 'countyPinZoom', 1),
            'circle-radius': COUNTY_SIZE, 'circle-stroke-width': COUNTY_STROKE, 'circle-stroke-color': '#101b20' } });
    map.addLayer({ id: 'state-pins', type: 'circle', source: 'pin-points', filter: ['all', ['==', ['get', 'level'], 'state'], ACTIVE_LABEL],
        paint: { 'circle-color': STATE_COLOR, 'circle-radius': 5, 'circle-stroke-width': 2, 'circle-stroke-color': '#161b20' } });
    map.addLayer({ id: 'country-pins', type: 'circle', source: 'pin-points', filter: ['all', ['==', ['get', 'level'], 'country'], ACTIVE_LABEL],
        paint: { 'circle-color': NATIONAL_COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 3.5, 2, 4.5, 6, 7], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#211a2e' } });
    map.addLayer({ id: 'selected-pin', type: 'circle', source: 'pin-points', filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-color': '#fff2d5', 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#b77b2a' } });
    map.addLayer({ id: 'state-labels', type: 'symbol', source: 'pin-points', filter: ['all', ['==', ['get', 'level'], 'state'], ACTIVE_LABEL], minzoom: 3,
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Open Sans Bold'], 'text-size': 10, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 1, 'text-justify': 'auto', 'symbol-sort-key': LABEL_PRIORITY },
        paint: { 'text-color': '#eed5b2', 'text-halo-color': '#111820', 'text-halo-width': 1.5 } });
    map.addLayer({ id: 'country-label', type: 'symbol', source: 'pin-points', filter: ['all', ['==', ['get', 'level'], 'country'], ACTIVE_LABEL],
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Open Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 5, 12], 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 1, 'text-justify': 'auto', 'symbol-sort-key': LABEL_PRIORITY, 'text-allow-overlap': false },
        paint: { 'text-color': '#deceff', 'text-halo-color': '#111820', 'text-halo-width': 2 } });
    map.addLayer({ id: 'county-labels', type: 'symbol', source: 'pin-points', filter: ['all', IS_COUNTY, ACTIVE_LABEL, ['<=', ['get', 'countyLabelZoom'], ['zoom']]], minzoom: COUNTY_LABEL_ZOOM,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Open Sans Regular'], 'text-size': 10, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.9, 'text-justify': 'auto', 'symbol-sort-key': LABEL_PRIORITY },
        paint: { 'text-color': COUNTY_COLOR, 'text-opacity': featureZoomFade(COUNTY_LABEL_ZOOM, 'countyLabelZoom', 1), 'text-halo-color': '#111820', 'text-halo-width': 1.5 } });
}
