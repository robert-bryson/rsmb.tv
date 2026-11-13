// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createExpression, featureFilter, validateStyleMin, type StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Map } from 'maplibre-gl';
import { installPinLayers } from '../../src/features/pins/mapLayers';

function style() {
    const result: StyleSpecification = { version: 8, glyphs: 'https://example.com/{fontstack}/{range}.pbf', sources: {}, layers: [] };
    installPinLayers({
        addSource(id, source) { result.sources[id] = source; },
        addLayer(layer) { result.layers.push(layer); },
    } as Map);
    return result;
}

function paint(id: string, property: string, zoom: number, properties: Record<string, unknown> = {}) {
    const layer = style().layers.find(layer => layer.id === id)!;
    const expression = createExpression((layer as { paint: Record<string, unknown> }).paint[property], 'paint');
    if (expression.result === 'error') throw new Error(JSON.stringify(expression.value));
    return expression.value.evaluate({ zoom }, { type: 'Point', properties });
}

describe('progressive pin detail', () => {
    it('passes the real style validator and separates discovery, circles, labels, and measurements', () => {
        const installed = style();
        expect(validateStyleMin(installed)).toEqual([]);
        const minimum = (id: string) => installed.layers.find(layer => layer.id === id)!.minzoom;
        expect(minimum('state-radii')).toBe(5);
        expect(minimum('county-pins')).toBe(6);
        expect(minimum('county-lines')).toBe(7);
        expect(minimum('county-circle-lines')).toBe(8);
        expect(minimum('county-labels')).toBe(9);
        expect(minimum('county-radii')).toBe(10);
        for (const id of ['selected-pin', 'selection-circle', 'selection-radius', 'selected-county-fill', 'selected-county']) {
            expect(minimum(id)).toBeUndefined();
        }
    });

    it('starts with small plain dots, then increases marker detail and fades in circles', () => {
        expect(paint('county-pins', 'circle-radius', 6)).toBe(1.8);
        expect(paint('county-pins', 'circle-stroke-width', 6.9)).toBe(0);
        expect(paint('county-pins', 'circle-opacity', 6)).toBe(0);
        expect(paint('county-pins', 'circle-opacity', 6.375)).toBeCloseTo(0.5);
        expect(paint('county-pins', 'circle-opacity', 6.75)).toBe(1);
        expect(paint('county-pins', 'circle-stroke-width', 8)).toBeGreaterThan(0);
        expect(paint('county-circle-lines', 'line-opacity', 8)).toBe(0);
        expect(paint('county-circle-lines', 'line-opacity', 8.375)).toBeCloseTo(0.275);
        expect(paint('county-circle-lines', 'line-opacity', 8.75)).toBeCloseTo(0.55);
        expect(paint('county-circle-fill', 'fill-opacity', 10, { context: true })).toBe(0);
    });

    it('fades individual spokes only after both the level and screen-size thresholds', () => {
        for (const minimumZoom of [10, 11, 14]) {
            const properties = { minimumZoom };
            expect(paint('county-radii', 'line-opacity', minimumZoom - 0.1, properties)).toBe(0);
            expect(paint('county-radii', 'line-opacity', minimumZoom, properties)).toBe(0);
            expect(paint('county-radii', 'line-opacity', minimumZoom + 0.375, properties)).toBeCloseTo(0.4);
            expect(paint('county-radii', 'line-opacity', minimumZoom + 0.75, properties)).toBeCloseTo(0.8);
        }
    });

    it('reveals terminal-zoom measurements without revealing smaller, unreadable features', () => {
        const layer = style().layers.find(layer => layer.id === 'country-radii')!;
        const filter = featureFilter('filter' in layer ? layer.filter : undefined, 'filter');
        const feature = { type: 'Point' as const, properties: { level: 'country', selected: false, minimumZoom: 16 } };
        // Native filters evaluate at integer zoom levels. A paint value between
        // the final two stops cannot expose a feature rejected by this filter.
        expect(filter.filter({ zoom: 15 }, feature)).toBe(false);
        expect(filter.filter({ zoom: 16 }, feature)).toBe(true);
        expect(paint('country-radii', 'line-opacity', 16, { minimumZoom: 16 })).toBeCloseTo(0.8);
        expect(paint('country-radii', 'line-opacity', 16, { minimumZoom: 17 })).toBe(0);
    });
});
