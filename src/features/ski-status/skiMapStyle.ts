import type {
    ExpressionSpecification, LineLayerSpecification, Map as MapLibreMap, SymbolLayerSpecification, TransformStyleFunction,
} from '../../maps/maplibre';

const detailStartZoom = 3;
const detailLayers = new Set(['park_nature_reserve', 'landuse', 'waterway', 'water_shadow', 'waterway_label', 'watername_ocean', 'watername_lake_line']);
const roadStartZoom = 5.75;
const roadEndZoom = 12;
export const regionalRoadLayer = 'ski-regional-roads';
export const highwayShieldLayer = 'ski-highway-shields';
const shieldStartZoom = 8.75;
const shieldOpacity: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], shieldStartZoom, 0, 9.6, 1];
const roadClass: ExpressionSpecification = ['get', 'kind_detail'];
const shieldNumber: ExpressionSpecification = ['to-string', ['get', 'shield_text']];
const shieldNetwork: ExpressionSpecification = ['case',
    ['!=', shieldNumber, ''], ['to-string', ['get', 'network']], '',
];
const routeReference: ExpressionSpecification = ['let', 'ref', ['to-string', ['get', 'ref']],
    ['let', 'separator', ['index-of', ';', ['var', 'ref']],
        ['case',
            ['==', ['var', 'ref'], ''], shieldNumber,
            ['==', ['var', 'separator'], -1], ['var', 'ref'],
            ['slice', ['var', 'ref'], 0, ['var', 'separator']],
        ],
    ],
];
const interstateImage = 'ski-shield-interstate';
const usHighwayImage = 'ski-shield-us-highway';
const genericHighwayImage = 'ski-shield-route';

function highwayShields(source: string): SymbolLayerSpecification {
    const routeNumber: ExpressionSpecification = ['match', shieldNetwork,
        ['US:I', 'US:US'], shieldNumber, routeReference,
    ];
    return {
        id: highwayShieldLayer, type: 'symbol', source, 'source-layer': 'roads', minzoom: shieldStartZoom,
        filter: ['all',
            ['in', roadClass, ['literal', ['motorway', 'trunk', 'primary']]],
            ['!=', routeNumber, ''],
        ],
        layout: {
            'symbol-placement': 'line', 'symbol-spacing': 340,
            'symbol-sort-key': ['match', roadClass, 'motorway', 0, 'trunk', 1, 2],
            'icon-image': ['image', ['match', shieldNetwork, 'US:I', interstateImage, 'US:US', usHighwayImage, genericHighwayImage]],
            'icon-text-fit': 'both', 'icon-text-fit-padding': [4, 5, 4, 5],
            'icon-rotation-alignment': 'viewport', 'icon-padding': 6,
            'text-field': routeNumber, 'text-font': ['Open Sans Regular'],
            'text-rotation-alignment': 'viewport', 'text-padding': 5,
            'text-size': ['interpolate', ['linear'], ['zoom'], shieldStartZoom, 10.5, 11, 11.5, 14, 12],
        },
        paint: {
            'icon-opacity': shieldOpacity, 'text-opacity': shieldOpacity,
            'text-color': ['match', shieldNetwork, 'US:US', '#16222e', '#f8fafc'],
        },
    };
}

export function addHighwayShieldImages(map: MapLibreMap) {
    if (!map.getLayer(highwayShieldLayer) || map.hasImage(genericHighwayImage)) return;
    const size = 24;
    const pixelRatio = 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size * pixelRatio;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(pixelRatio, pixelRatio);
    const interstate = new Path2D('M 2 5 Q 6 5 8 2 Q 12 5 16 2 Q 18 5 22 5 C 24 11 20 19 12 22 C 4 19 0 11 2 5 Z');
    const usHighway = new Path2D('M 2 4 Q 5 4 7 2 Q 10 4 12 2 Q 14 4 17 2 Q 19 4 22 4 C 19 8 23 10 23 14 C 23 19 19 21 12 22 C 5 21 1 19 1 14 C 1 10 5 8 2 4 Z');
    const route = new Path2D();
    route.roundRect(1, 3, 22, 18, 4);
    for (const [id, shape, fill, stroke] of [
        [interstateImage, interstate, '#21548a', '#e2e8f0'],
        [usHighwayImage, usHighway, '#f1f5f9', '#1c2a36'],
        [genericHighwayImage, route, '#203346', '#aebdca'],
    ] as const) {
        context.clearRect(0, 0, size, size);
        context.fillStyle = fill;
        context.fill(shape);
        if (id === interstateImage) {
            context.save();
            context.clip(shape);
            context.fillStyle = '#ac3947';
            context.fillRect(0, 0, size, 7);
            context.restore();
        }
        context.lineWidth = 1.35;
        context.strokeStyle = stroke;
        context.stroke(shape);
        map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio });
    }
}

export const skiGlobeStyle: TransformStyleFunction = (_, style) => {
    if (!Array.isArray(style?.layers)) return style;
    // Keep the coastline, boundaries, and place labels at the globe overview.
    const layers = style.layers.map(layer => layer && detailLayers.has(layer.id)
        && (layer.maxzoom ?? 24) > detailStartZoom && (layer.minzoom ?? 0) < detailStartZoom
        ? { ...layer, minzoom: detailStartZoom } : layer);
    const providerRoads = layers.find((layer): layer is LineLayerSpecification => layer?.type === 'line'
        && layer['source-layer'] === 'roads' && style.sources?.[layer.source]?.type === 'vector');
    if (providerRoads) {
        const roads: LineLayerSpecification = {
            id: regionalRoadLayer, type: 'line', source: providerRoads.source, 'source-layer': 'roads',
            minzoom: roadStartZoom, maxzoom: roadEndZoom,
            filter: ['in', roadClass, ['literal', ['motorway', 'trunk']]],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
                'line-color': ['interpolate', ['linear'], ['zoom'], 7, '#92a0ad', 9.6, '#bccfdd'],
                'line-width': ['interpolate', ['linear'], ['zoom'], roadStartZoom, 0.6, 7, 0.95, 8.75, 1.4, 9.6, 2, 11, 2.4],
                'line-opacity': ['interpolate', ['linear'], ['zoom'],
                    roadStartZoom, 0, 6.25, 0.06, 7, 0.18, 8.75, 0.38, 9.6, 0.68, 10.5, 0.68, roadEndZoom, 0],
            },
        };
        // Place and resort labels have priority over route shields.
        const firstSymbol = layers.findIndex(layer => layer?.type === 'symbol');
        const roadLayers = style.glyphs ? [roads, highwayShields(providerRoads.source)] : [roads];
        layers.splice(firstSymbol === -1 ? layers.length : firstSymbol, 0, ...roadLayers);
    }
    return {
        ...style, layers,
        projection: { type: 'globe' },
        sky: { 'sky-color': '#080e16', 'fog-ground-blend': 0, 'atmosphere-blend': 0 },
    };
};
