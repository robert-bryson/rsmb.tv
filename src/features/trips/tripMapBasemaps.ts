import { BASEMAP_ATTRIBUTION, cartoRasterUrl } from '../../maps/cartoBasemaps';
import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'muted' | 'street' | 'terrain';
export type BasemapPaintProperty = 'raster-saturation' | 'raster-brightness-min' | 'raster-brightness-max' | 'raster-contrast';

export const basemaps: Array<{
    id: BasemapId;
    label: string;
    tiles: string[];
    paint: Record<BasemapPaintProperty, number>;
}> = [
        {
            id: 'muted',
            label: 'Muted',
            tiles: [cartoRasterUrl('positron')],
            paint: {
                'raster-saturation': -1,
                'raster-brightness-min': 0.05,
                'raster-brightness-max': 0.65,
                'raster-contrast': 0.15,
            },
        },
        {
            id: 'street',
            label: 'Street',
            tiles: [cartoRasterUrl('voyager')],
            paint: {
                'raster-saturation': 0,
                'raster-brightness-min': 0,
                'raster-brightness-max': 1,
                'raster-contrast': 0,
            },
        },
        {
            id: 'terrain',
            label: 'Light',
            tiles: [cartoRasterUrl('positron-nolabels')],
            paint: {
                'raster-saturation': 0,
                'raster-brightness-min': 0,
                'raster-brightness-max': 0.85,
                'raster-contrast': 0.05,
            },
        },
    ];

export function mapStyle(basemapId: BasemapId): StyleSpecification {
    const basemap = basemaps.find((candidate) => candidate.id === basemapId) ?? basemaps[0];
    return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
            openstreetmap: {
                type: 'raster',
                tiles: basemap.tiles,
                tileSize: 256,
                attribution: BASEMAP_ATTRIBUTION,
            },
        },
        layers: [{ id: 'basemap-background', type: 'background', paint: { 'background-color': '#171b24' } }, {
            id: 'openstreetmap',
            type: 'raster',
            source: 'openstreetmap',
            paint: basemap.paint,
        }],
    };
}
