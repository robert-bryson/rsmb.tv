import { describe, expect, it, vi } from 'vitest';
import { skiAreas } from '../features/ski-status/catalog';
import { resortFootprintLayer, resortTerrainGroups, resortTerrainLabel, resortTerrainMinZoom, resortTerrainSource, syncResortTerrain } from '../features/ski-status/resortTerrain';
import type { LayerSpecification, Map as MapLibreMap, SourceSpecification } from '../maps/maplibre';

vi.mock('../maps/maplibre', () => ({ addProtocol: vi.fn() }));

const markers = 'resort-markers';
const pointer = { x: 10, y: 20 };

function mockMap(zoom = 13) {
    const layers = new Set([markers]);
    const sources = new Set<string>();
    const renderer = {
        getZoom: vi.fn(() => zoom),
        getLayer: vi.fn((id: string) => layers.has(id)),
        getSource: vi.fn((id: string) => sources.has(id)),
        addSource: vi.fn<(id: string, source: SourceSpecification) => void>(id => { sources.add(id); }),
        addLayer: vi.fn<(layer: LayerSpecification, before: string) => void>(layer => { layers.add(layer.id); }),
        setFilter: vi.fn(),
        removeSource: vi.fn((id: string) => { sources.delete(id); }),
        removeLayer: vi.fn((id: string) => { layers.delete(id); }),
        queryRenderedFeatures: vi.fn((): object[] => []),
    };
    return { map: renderer as unknown as MapLibreMap, renderer };
}

describe('ski-status terrain overlay', () => {
    it('gathers each shared terrain group once and skips areas without data', () => {
        const area = skiAreas.find(item => item.id === 'heavenly')!;
        expect(resortTerrainGroups([area, area, { ...area, id: 'unknown-terrain' }])).toEqual(resortTerrainGroups([area]));
        expect(resortTerrainGroups([area]).length).toBeGreaterThan(0);
    });

    it('adds terrain below the markers at the minimum zoom and updates its filters in place', () => {
        const { map, renderer } = mockMap(resortTerrainMinZoom - 0.1);
        syncResortTerrain(map, 'missing-markers', [1]);
        syncResortTerrain(map, markers, [1]);
        expect(renderer.addSource).not.toHaveBeenCalled();

        renderer.getZoom.mockReturnValue(resortTerrainMinZoom);
        syncResortTerrain(map, markers, [1]);
        expect(renderer.addSource).toHaveBeenCalledWith(resortTerrainSource, expect.objectContaining({
            minzoom: resortTerrainMinZoom, url: expect.stringMatching(/^pmtiles:\/\/http/),
        }));
        const installed = renderer.addLayer.mock.calls;
        expect(installed.some(([layer]) => layer.id === resortFootprintLayer)).toBe(true);
        for (const [layer, before] of installed) {
            expect(layer).toMatchObject({ filter: ['in', ['get', 'group'], ['literal', [1]]] });
            expect(before).toBe(markers);
        }

        syncResortTerrain(map, markers, [2, 3]);
        expect(renderer.addSource).toHaveBeenCalledOnce();
        for (const [layer] of installed) expect(renderer.setFilter).toHaveBeenCalledWith(layer.id, ['in', ['get', 'group'], ['literal', [2, 3]]]);
    });

    it('keeps marker layers when it replaces or disables terrain', () => {
        const { map, renderer } = mockMap();
        syncResortTerrain(map, markers, [1]);
        syncResortTerrain(map, markers, [1], true);
        expect(renderer.removeSource).toHaveBeenCalledExactlyOnceWith(resortTerrainSource);
        expect(renderer.addSource).toHaveBeenCalledTimes(2);

        renderer.removeLayer(resortFootprintLayer);
        renderer.removeLayer.mockClear();
        syncResortTerrain(map, markers, []);
        expect(renderer.removeLayer).not.toHaveBeenCalledWith(resortFootprintLayer);
        expect(renderer.removeLayer).not.toHaveBeenCalledWith(markers);
        expect(renderer.removeSource).toHaveBeenCalledTimes(2);
        expect(map.getSource(resortTerrainSource)).toBeFalsy();
        expect(map.getLayer(markers)).toBeTruthy();
    });

    it('does not inspect terrain before it is available and returns no label at an empty point', () => {
        const { map, renderer } = mockMap();
        expect(resortTerrainLabel(map, pointer)).toBeUndefined();
        renderer.addSource(resortTerrainSource, { type: 'vector' });
        expect(resortTerrainLabel(map, pointer)).toBeUndefined();
        expect(renderer.queryRenderedFeatures).not.toHaveBeenCalled();

        syncResortTerrain(map, markers, []);
        syncResortTerrain(map, markers, [1]);
        expect(resortTerrainLabel(map, pointer)).toBeUndefined();
        expect(renderer.queryRenderedFeatures).toHaveBeenCalledOnce();
        renderer.getZoom.mockReturnValue(resortTerrainMinZoom - 1);
        expect(resortTerrainLabel(map, pointer)).toBeUndefined();
        expect(renderer.queryRenderedFeatures).toHaveBeenCalledOnce();
    });

    it.each([
        ['ski-resort-lift-stations', { name: 'Summit' }, 'Summit · Lift station'],
        ['ski-resort-lifts', { name: 'Top Lift', liftType: 'chair_lift' }, 'Top Lift · chair lift'],
        ['ski-resort-lifts', {}, 'Lift'],
        ['ski-resort-runs', { ref: '7B', use: 'nordic', difficulty: 'easy' }, '7B · Nordic trail · easy'],
        ['ski-resort-runs', { use: 'unmapped', difficulty: 'other' }, 'Ski run'],
        ['ski-resort-runs', {}, 'Ski run'],
    ])('reads the mapped feature label from %s', (layer, properties, label) => {
        const { map, renderer } = mockMap();
        syncResortTerrain(map, markers, [1]);
        renderer.queryRenderedFeatures.mockReturnValue([{ layer: { id: layer }, properties }]);
        expect(resortTerrainLabel(map, pointer)).toBe(label);
    });
});
