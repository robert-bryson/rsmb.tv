import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LayerSpecification, Map as MapLibreMap, StyleSpecification } from '../maps/maplibre';
import { SkiLayerPanel } from '../features/ski-status/SkiLayerPanel';
import {
    reliefLayer, reliefSource, revealSkiMapOverlay, snowDepthLayer, snowDepthSource, syncSkiMapOverlays,
} from '../features/ski-status/skiMapOverlays';
import { highwayShieldLayer, regionalRoadLayer, skiGlobeStyle } from '../features/ski-status/skiMapStyle';

describe('ski-status map layers', () => {
    it('shows instructions, map keys, and independent overlay controls', () => {
        const onChange = vi.fn();
        const onClose = vi.fn();
        render(<SkiLayerPanel colors="pass" units="metric" indyDiscounts={false} terrain={false} snowDepth
            resortTerrain peaks conventions={['europe']} onChange={onChange} onClose={onClose} />);
        const markers = screen.getByLabelText('Map markers');
        expect(markers).toHaveFocus();
        expect(screen.getByRole('list', { name: 'Resort map key' })).toHaveTextContent('Multiple passes');
        expect(screen.getByRole('region', { name: 'Estimated snow depth (cm)' })).toHaveTextContent('1–5.1');
        expect(screen.getByRole('region', { name: 'Mapped runs and lifts' })).toHaveTextContent('European convention');
        fireEvent.change(markers, { target: { value: 'operatingStatus' } });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Terrain relief' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Snow depth' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Ski terrain' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Mountain peaks' }));
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onChange.mock.calls).toEqual([['color', 'operatingStatus'], ['terrain', '1'], ['snowDepth', undefined], ['skiTerrain', '0'], ['peaks', '0']]);
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('installs hidden overlays below labels, reveals them once, and removes them cleanly', () => {
        const sources = new Set<string>();
        const layers = new Map<string, { paint?: Record<string, unknown> }>();
        const renderer = {
            getSource: (id: string) => sources.has(id),
            getLayer: (id: string) => layers.get(id),
            addSource: vi.fn((id: string) => { sources.add(id); }),
            addLayer: vi.fn<(layer: LayerSpecification, before: string) => void>(layer => { layers.set(layer.id, layer); }),
            removeLayer: vi.fn((id: string) => { layers.delete(id); }),
            removeSource: vi.fn((id: string) => { sources.delete(id); }),
            getPaintProperty: (id: string, key: string) => layers.get(id)?.paint?.[key],
            setPaintProperty: vi.fn((id: string, key: string, value: unknown) => {
                const layer = layers.get(id);
                if (layer) layer.paint = { ...layer.paint, [key]: value };
            }),
        };
        const map = renderer as unknown as MapLibreMap;
        syncSkiMapOverlays(map, 'labels', false, true, 280);
        syncSkiMapOverlays(map, 'labels', true, true, 0);
        expect(renderer.addLayer.mock.calls.map(([layer, before]) => [layer.id, before])).toEqual([
            [snowDepthLayer, 'labels'], [reliefLayer, snowDepthLayer],
        ]);
        expect(renderer.getPaintProperty(snowDepthLayer, 'raster-opacity')).toBe(0);
        expect(renderer.getPaintProperty(snowDepthLayer, 'raster-fade-duration')).toBe(0);
        revealSkiMapOverlay(map, reliefSource, 280);
        revealSkiMapOverlay(map, reliefSource, 280);
        revealSkiMapOverlay(map, snowDepthSource, 0);
        expect(renderer.setPaintProperty.mock.calls.filter(([, key]) => key.endsWith('-transition'))).toEqual([
            [reliefLayer, 'hillshade-exaggeration-transition', { duration: 280 }], [snowDepthLayer, 'raster-opacity-transition', { duration: 0 }],
        ]);
        syncSkiMapOverlays(map, 'labels', false, false, 0);
        expect(layers.size).toBe(0);
        expect(sources.size).toBe(0);
    });

    it('adds roads to vector basemaps and includes shields only when glyphs are present', () => {
        const base: StyleSpecification = {
            version: 8,
            sources: { basemap: { type: 'vector', tiles: ['https://example.test/{z}/{x}/{y}.pbf'] } },
            layers: [
                { id: 'landuse', type: 'fill', source: 'basemap', 'source-layer': 'landuse', minzoom: 1 },
                { id: 'roads', type: 'line', source: 'basemap', 'source-layer': 'roads' },
                { id: 'places', type: 'symbol', source: 'basemap', 'source-layer': 'places' },
            ],
        };
        const layerIds = (style: StyleSpecification) => style.layers.map(layer => layer.id);
        expect(layerIds(skiGlobeStyle(undefined, base))).toEqual(['landuse', 'roads', regionalRoadLayer, 'places']);
        const result = skiGlobeStyle(undefined, { ...base, glyphs: 'https://example.test/{fontstack}/{range}.pbf' });
        expect(layerIds(result)).toEqual(['landuse', 'roads', regionalRoadLayer, highwayShieldLayer, 'places']);
        expect(result.layers[0].minzoom).toBe(3);
        expect(base.layers[0].minzoom).toBe(1);
        expect(skiGlobeStyle(undefined, { ...base, sources: {}, layers: [] })).toMatchObject({
            layers: [], projection: { type: 'globe' },
        });
    });
});
