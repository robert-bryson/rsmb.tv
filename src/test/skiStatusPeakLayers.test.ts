import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LayerSpecification, Map as MapLibreMap, Point } from '../maps/maplibre';
import { resortNameLayer } from '../features/ski-status/skiMapLayers';
import { regionalRoadLayer } from '../features/ski-status/skiMapStyle';
import { isPeakLayer, mountainPeakLabel, peakSource, syncPeakLayers } from '../features/ski-status/skiPeakLayers';

const trailMapLayer = 'ski-trail-map-peaks';
const nearbyLayer = 'ski-nearby-peaks';

function peakRenderer() {
    const provider = { id: 'provider', type: 'vector', loaded: vi.fn(() => false), vectorLayerIds: ['roads'] };
    const layers = new Map<string, LayerSpecification>([
        [regionalRoadLayer, { id: regionalRoadLayer, type: 'line', source: provider.id }],
        [resortNameLayer, { id: resortNameLayer, type: 'symbol', source: 'ski-areas' }],
    ]);
    const sources = new Map<string, unknown>([[provider.id, provider]]);
    const images = new Set<string>();
    const renderer = {
        addLayer: vi.fn<(layer: LayerSpecification, before?: string) => void>(layer => { layers.set(layer.id, layer); }),
        addSource: vi.fn((id: string, source: unknown) => { sources.set(id, source); }),
        addImage: (id: string) => images.add(id),
        getLayer: (id: string) => layers.get(id),
        getSource: (id: string) => sources.get(id),
        getGlyphs: vi.fn<() => string | null>(() => null),
        getZoom: vi.fn(() => 7),
        hasImage: (id: string) => images.has(id),
        removeImage: (id: string) => images.delete(id),
        removeLayer: (id: string) => layers.delete(id),
        removeSource: (id: string) => sources.delete(id),
        queryRenderedFeatures: vi.fn<(...args: unknown[]) => unknown[]>(() => []),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        scale: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
        stroke: vi.fn(), fill: vi.fn(), getImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    return { map: renderer as unknown as MapLibreMap, renderer, provider, layers, sources, images };
}

afterEach(() => vi.restoreAllMocks());

describe('ski-status peak layers', () => {
    it('adds the trail-map layer before the provider metadata and adds nearby peaks only when available', () => {
        const { map, renderer, provider, layers, sources, images } = peakRenderer();
        syncPeakLayers(map, true);
        expect(renderer.addLayer.mock.calls.map(([layer, before]) => [layer.id, before])).toEqual([[trailMapLayer, resortNameLayer]]);
        expect(layers.get(trailMapLayer)).toMatchObject({ minzoom: 8, layout: { 'text-font': ['sans-serif'] } });
        expect(sources.get(peakSource)).toMatchObject({ type: 'geojson' });

        provider.loaded.mockReturnValue(true);
        syncPeakLayers(map, true);
        expect(layers.has(nearbyLayer)).toBe(false);
        renderer.getGlyphs.mockReturnValue('https://example.test/{fontstack}/{range}.pbf');
        provider.vectorLayerIds.push('pois');
        syncPeakLayers(map, true);
        syncPeakLayers(map, true);
        expect(renderer.addLayer.mock.calls.map(([layer, before]) => [layer.id, before])).toEqual([
            [trailMapLayer, resortNameLayer], [nearbyLayer, trailMapLayer],
        ]);
        expect(layers.get(nearbyLayer)).toMatchObject({ minzoom: 10, layout: { 'text-font': ['Open Sans Regular'] } });
        expect(isPeakLayer(nearbyLayer)).toBe(true);
        expect(isPeakLayer(regionalRoadLayer)).toBe(false);

        syncPeakLayers(map, false);
        syncPeakLayers(map, false);
        expect([...images]).toEqual([]);
        expect([...layers.keys()]).toEqual([regionalRoadLayer, resortNameLayer]);
        expect([...sources.keys()]).toEqual([provider.id]);
    });

    it('queries visible peak layers and formats published elevations in the selected units', () => {
        const { map, renderer, provider } = peakRenderer();
        provider.loaded.mockReturnValue(true);
        provider.vectorLayerIds.push('pois');
        syncPeakLayers(map, true);
        const point = { x: 60, y: 40 } as Point;
        expect(mountainPeakLabel(map, point, 'imperial')).toBeUndefined();
        expect(renderer.queryRenderedFeatures).not.toHaveBeenCalled();

        renderer.getZoom.mockReturnValue(9);
        renderer.queryRenderedFeatures.mockReturnValue([{ layer: { id: trailMapLayer }, properties: { name: 'Sargents', elevationFt: 7803 } }]);
        expect(mountainPeakLabel(map, point, 'metric')).toBe('Sargents · 2,378 m · Trail map');
        expect(renderer.queryRenderedFeatures).toHaveBeenLastCalledWith(point, { layers: [trailMapLayer] });

        renderer.getZoom.mockReturnValue(10);
        renderer.queryRenderedFeatures.mockReturnValue([{ layer: { id: nearbyLayer }, properties: { name: 'Nearby Peak' } }]);
        expect(mountainPeakLabel(map, point, 'imperial')).toBe('Nearby Peak');
        expect(renderer.queryRenderedFeatures).toHaveBeenLastCalledWith(point, { layers: [trailMapLayer, nearbyLayer] });
        renderer.queryRenderedFeatures.mockReturnValue([]);
        expect(mountainPeakLabel(map, point, 'imperial')).toBeUndefined();
    });
});
