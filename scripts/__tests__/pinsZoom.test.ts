// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createExpression, featureFilter, validateStyleMin, type StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Map } from 'maplibre-gl';
import { installPinLayers } from '../../src/features/pins/mapLayers';
import { countyDetailZooms } from '../../src/features/pins/zoom';
import { radiusMinimumZoom } from '../../src/features/pins/radii';
import { publishedPins } from './pinsFixtures';

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
        expect(minimum('county-pins')).toBe(4);
        expect(minimum('county-lines')).toBe(6);
        expect(minimum('county-circle-lines')).toBe(5);
        expect(minimum('county-labels')).toBe(6);
        expect(minimum('county-radii')).toBe(6);
        for (const id of ['selected-pin', 'selection-circle', 'selection-radius', 'selected-county-fill', 'selected-county']) {
            expect(minimum(id)).toBeUndefined();
        }
    });

    it('starts with small plain dots, then increases marker detail and fades in circles', () => {
        const dot = { countyPinZoom: 4 }, circle = { countyCircleZoom: 5 };
        expect(paint('county-pins', 'circle-radius', 4)).toBe(1.6);
        expect(paint('county-pins', 'circle-stroke-width', 4)).toBe(0);
        expect(paint('county-pins', 'circle-opacity', 4, dot)).toBe(0);
        expect(paint('county-pins', 'circle-opacity', 4.375, dot)).toBeCloseTo(0.5);
        expect(paint('county-pins', 'circle-opacity', 4.75, dot)).toBe(1);
        expect(paint('county-pins', 'circle-stroke-width', 8)).toBeGreaterThan(0);
        expect(paint('county-circle-lines', 'line-opacity', 5, circle)).toBe(0);
        expect(paint('county-circle-lines', 'line-opacity', 5.375, circle)).toBeCloseTo(0.2);
        expect(paint('county-circle-lines', 'line-opacity', 5.75, circle)).toBeCloseTo(0.4);
        expect(paint('county-circle-fill', 'fill-opacity', 10, { ...circle, context: true })).toBe(0);
    });

    it('reveals large western counties at readable scales while retaining small-county discovery', () => {
        const imperial = publishedPins.pins.find(pin => pin.id === 'county-06025')!;
        const sanBernardino = publishedPins.pins.find(pin => pin.id === 'county-06071')!;
        const fallsChurch = publishedPins.pins.find(pin => pin.id === 'county-51610')!;
        expect(countyDetailZooms(imperial)).toEqual({ countyPinZoom: 4, countyCircleZoom: 6, countyLabelZoom: 6 });
        expect(radiusMinimumZoom(imperial)).toBe(7);
        expect(radiusMinimumZoom(sanBernardino)).toBe(6);
        expect(countyDetailZooms(fallsChurch)).toEqual({ countyPinZoom: 6, countyCircleZoom: 8, countyLabelZoom: 9 });
        expect(radiusMinimumZoom(fallsChurch)).toBe(13);
        for (const pin of publishedPins.pins.filter(pin => pin.level === 'county')) {
            const detail = countyDetailZooms(pin);
            expect(detail.countyPinZoom).toBeLessThanOrEqual(6);
            expect(detail.countyCircleZoom).toBeLessThanOrEqual(8);
            expect(detail.countyLabelZoom).toBeLessThanOrEqual(9);
        }
        for (const [id, property, pin] of [
            ['county-pins', 'countyPinZoom', imperial],
            ['county-circle-lines', 'countyCircleZoom', imperial],
            ['county-labels', 'countyLabelZoom', imperial],
            ['county-radii', 'minimumZoom', imperial],
        ] as const) {
            const properties = { level: 'county', selected: false, context: false, ...countyDetailZooms(pin), minimumZoom: radiusMinimumZoom(pin) };
            const layer = style().layers.find(layer => layer.id === id)!;
            const filter = featureFilter('filter' in layer ? layer.filter : undefined, 'filter');
            const feature = { type: 'Point' as const, properties };
            const threshold = properties[property];
            expect(filter.filter({ zoom: threshold - 1 }, feature)).toBe(false);
            expect(filter.filter({ zoom: threshold }, feature)).toBe(true);
        }
    });

    it('fades individual spokes only after both the level and screen-size thresholds', () => {
        for (const minimumZoom of [6, 7, 10, 11, 14]) {
            const properties = { minimumZoom };
            expect(paint('county-radii', 'line-opacity', minimumZoom - 0.1, properties)).toBe(0);
            expect(paint('county-radii', 'line-opacity', minimumZoom, properties)).toBe(0);
            expect(paint('county-radii', 'line-opacity', minimumZoom + 0.375, properties)).toBeCloseTo(0.35);
            expect(paint('county-radii', 'line-opacity', minimumZoom + 0.75, properties)).toBeCloseTo(0.7);
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
        expect(paint('country-radii', 'line-opacity', 16, { minimumZoom: 16 })).toBeCloseTo(0.7);
        expect(paint('country-radii', 'line-opacity', 16, { minimumZoom: 17 })).toBe(0);
    });
});
