import type { StyleSpecification } from 'maplibre-gl';

export type CartoRasterStyle = 'dark' | 'positron' | 'voyager' | 'positron-nolabels' | 'voyager-nolabels' | 'dark-nolabels';
const rasterPaths: Record<CartoRasterStyle, string> = {
    dark: 'dark_all', positron: 'light_all', voyager: 'rastertiles/voyager',
    'positron-nolabels': 'light_nolabels', 'voyager-nolabels': 'rastertiles/voyager_nolabels', 'dark-nolabels': 'dark_nolabels',
};

export const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY?.trim() ?? '';
export const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attribution/">CARTO</a>';
export const BASEMAP_ATTRIBUTION = CARTO_ATTRIBUTION + (CARTO_API_KEY ? '' : ' · Basemap unavailable');

// Without a local development key, render a neutral map instead of requesting watermarked tiles.
const EMPTY_TILE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';

export function cartoRasterUrl(style: CartoRasterStyle, key = CARTO_API_KEY): string {
    if (!key.trim()) return EMPTY_TILE;
    return `https://basemaps.cartocdn.com/${rasterPaths[style]}/{z}/{x}/{y}.png?key=${encodeURIComponent(key.trim())}`;
}

export function cartoRasterStyle(style: CartoRasterStyle = 'dark', key = CARTO_API_KEY): StyleSpecification {
    return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: { 'carto-basemap': { type: 'raster', tiles: [cartoRasterUrl(style, key)], tileSize: 256, maxzoom: 20, attribution: CARTO_ATTRIBUTION + (key.trim() ? '' : ' · Basemap unavailable') } },
        layers: [
            { id: 'basemap-background', type: 'background', paint: { 'background-color': '#171b24' } },
            { id: 'carto-basemap', type: 'raster', source: 'carto-basemap' },
        ],
    };
}

export function cartoVectorStyle(style: 'dark-matter' | 'positron' | 'voyager' = 'dark-matter', key = CARTO_API_KEY): string | StyleSpecification {
    return key.trim()
        ? `https://basemaps.cartocdn.com/gl/${style}-gl-style/style.json?key=${encodeURIComponent(key.trim())}`
        : cartoRasterStyle('dark', '');
}
