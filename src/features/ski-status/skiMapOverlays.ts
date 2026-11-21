import type {
    ExpressionSpecification, HillshadeLayerSpecification, Map as MapLibreMap,
    RasterDEMSourceSpecification, RasterLayerSpecification, RasterSourceSpecification,
} from '../../maps/maplibre';

export const reliefSource = 'ski-terrain-dem';
export const reliefLayer = 'ski-terrain-relief';
export const reliefMinZoom = 4;
const reliefExaggeration: ExpressionSpecification = [
    'interpolate', ['linear'], ['zoom'], reliefMinZoom, 0, 5, 0.08, 6, 0.15, 8, 0.22, 10, 0.29, 13, 0.4,
];

export const snowDepthSource = 'ski-snow-depth-tiles';
export const snowDepthLayer = 'ski-snow-depth';
export const snowDepthMinZoom = 4;
export type SkiMapOverlaySource = typeof reliefSource | typeof snowDepthSource;
export const snowDepthTileEndpoint = 'https://mapservices.weather.noaa.gov/raster/rest/services/snow/NOHRSC_Snow_Analysis/MapServer/export';
export const snowDepthAnalysis = 'https://www.nohrsc.noaa.gov/nsa/';

// Match the NOAA Snow Depth image layer's legend in inches.
export const snowDepthBands = [
    [0.39, 2, '#abc1bf'], [2, 3.9, '#66c1c4'], [3.9, 9.8, '#63a9cb'], [9.8, 20, '#5079c8'],
    [20, 39, '#3c3fc2'], [39, 59, '#5720c3'], [59, 98, '#7d01bb'], [98, 197, '#b404b1'],
    [197, 295, '#a91377'], [295, 394, '#992b50'], [394, 787, '#8b4545'],
] as const;

const reliefTiles: RasterDEMSourceSpecification = {
    type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
    encoding: 'terrarium', tileSize: 512, minzoom: reliefMinZoom, maxzoom: 12,
    attribution: '<a href="https://mapterhorn.com/attribution/">© Mapterhorn terrain</a>',
};
const relief: HillshadeLayerSpecification = {
    id: reliefLayer, type: 'hillshade', source: reliefSource, minzoom: reliefMinZoom,
    paint: { 'hillshade-exaggeration': 0, 'hillshade-shadow-color': '#09090b', 'hillshade-highlight-color': '#cbd5e1' },
};

const snowDepthTiles: RasterSourceSpecification = {
    type: 'raster', tileSize: 256, minzoom: snowDepthMinZoom, maxzoom: 7,
    bounds: [-130.52, 24.1, -62.25, 58.24],
    tiles: [`${snowDepthTileEndpoint}?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show:3&f=image`],
    attribution: `<a href="${snowDepthAnalysis}">NOAA / NWS snow depth</a>`,
};

const snowDepthOpacity: ExpressionSpecification = [
    'interpolate', ['linear'], ['zoom'], snowDepthMinZoom, 0, 5, 0.1, 6, 0.26, 8, 0.52, 10, 0.52, 13, 0.3,
];

function syncOverlay(map: MapLibreMap, source: RasterSourceSpecification | RasterDEMSourceSpecification,
    layer: RasterLayerSpecification | HillshadeLayerSpecification, enabled: boolean, before: string) {
    if (!enabled) {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id);
        if (map.getSource(layer.source)) map.removeSource(layer.source);
    } else if (!map.getLayer(layer.id)) {
        map.addSource(layer.source, source);
        map.addLayer(layer, before);
    }
}

export function syncSkiMapOverlays(map: MapLibreMap, before: string, terrain: boolean, snowDepth: boolean, duration: number) {
    syncOverlay(map, reliefTiles, relief, terrain, map.getLayer(snowDepthLayer) ? snowDepthLayer : before);
    syncOverlay(map, snowDepthTiles, {
        id: snowDepthLayer, type: 'raster', source: snowDepthSource, minzoom: snowDepthMinZoom,
        paint: {
            'raster-opacity': 0,
            'raster-resampling': 'nearest',
            'raster-fade-duration': duration,
        },
    }, snowDepth, before);
    if (snowDepth && map.getPaintProperty(snowDepthLayer, 'raster-fade-duration') !== duration) {
        map.setPaintProperty(snowDepthLayer, 'raster-fade-duration', duration);
    }
}

export function revealSkiMapOverlay(map: MapLibreMap, source: SkiMapOverlaySource, duration: number) {
    const [layer, property, value] = source === reliefSource
        ? [reliefLayer, 'hillshade-exaggeration', reliefExaggeration] as const
        : [snowDepthLayer, 'raster-opacity', snowDepthOpacity] as const;
    if (!map.getLayer(layer) || map.getPaintProperty(layer, property) !== 0) return;
    // Reveal the initial viewport together once the visible tiles have loaded.
    map.setPaintProperty(layer, `${property}-transition`, { duration });
    map.setPaintProperty(layer, property, value);
}
