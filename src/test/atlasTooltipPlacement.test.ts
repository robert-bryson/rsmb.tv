import { describe, expect, it } from 'vitest';
import { atlasTooltipPlacement } from '../features/trips/atlas/atlasTooltipPlacement';
import type { RouteGeoJson } from '../features/trips/routeGeometry';

const viewport = { width: 100, height: 100, project: ([x, y]: [number, number]) => ({ x: x * 10, y: y * 10 }) };
const route = (lines: number[][][]): RouteGeoJson => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines.map(line => line.map(([x, y]) => [x / 10, y / 10])) } });

describe('atlas route tooltip placement', () => {
    it.each([
        ['right', [[130, 20], [130, 80]], { x: 88, y: 50 }],
        ['left', [[-30, 20], [-30, 80]], { x: 12, y: 50 }],
        ['top', [[20, -30], [80, -30]], { x: 50, y: 12 }],
        ['bottom', [[20, 130], [80, 130]], { x: 50, y: 88 }],
        ['top-right', [[130, -30], [150, -50]], { x: 88, y: 12 }],
        ['top-left', [[-30, -30], [-50, -50]], { x: 12, y: 12 }],
        ['bottom-right', [[130, 130], [150, 150]], { x: 88, y: 88 }],
        ['bottom-left', [[-30, 130], [-50, 150]], { x: 12, y: 88 }],
    ] as const)('places an off-screen %s route at the corresponding edge', (anchor, points, point) => {
        expect(atlasTooltipPlacement(route([points.map(point => [...point])]), viewport)).toEqual({ point, anchor });
    });

    it('anchors to a visible segment even when both endpoints are outside the viewport', () => {
        expect(atlasTooltipPlacement(route([[[-30, 30], [130, 30]]]), viewport)).toEqual({ point: { x: 50, y: 30 } });
    });

    it('uses visible geometry instead of an off-screen midpoint and never joins disconnected tracks', () => {
        const value = route([[[10, 20], [90, 20]], [[130, 130], [140, 140]]]);
        expect(atlasTooltipPlacement(value, viewport)).toEqual({ point: { x: 50, y: 20 } });
        expect(atlasTooltipPlacement(route([[[-20, 0], [-20, 100]], [[120, 0], [120, 100]]]), viewport)?.anchor).toBe('left');
    });

    it('uses the closest part of the actual track rather than its bounding-box center', () => {
        expect(atlasTooltipPlacement(route([[[130, 20], [160, 80]], [[250, 50], [260, 50]]]), viewport))
            .toEqual({ point: { x: 88, y: 20 }, anchor: 'right' });
    });

    it('finds the closest interior point of an off-screen diagonal segment', () => {
        expect(atlasTooltipPlacement(route([[[80, -50], [150, 20]]]), viewport))
            .toEqual({ point: { x: 88, y: 12 }, anchor: 'top-right' });
    });

    it('compares separate LineString and MultiLineString features without connecting them', () => {
        const value: RouteGeoJson = { type: 'FeatureCollection', features: [
            { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-3, 0], [-3, 10]] } },
            { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [[[12, 0], [12, 10]]] } },
        ] };
        expect(atlasTooltipPlacement(value, viewport)).toEqual({ point: { x: 88, y: 50 }, anchor: 'right' });
    });

    it('follows the map projection when the screen is rotated', () => {
        const rotated = { ...viewport, project: ([x, y]: [number, number]) => ({ x: y * 10, y: 100 - x * 10 }) };
        expect(atlasTooltipPlacement(route([[[130, 20], [130, 80]]]), rotated)).toEqual({ point: { x: 50, y: 12 }, anchor: 'top' });
    });

    it('chooses the nearest repeated world without inventing a segment across disconnected dateline tracks', () => {
        const value: RouteGeoJson = { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [[[178, 0], [180, 0]], [[-180, 0], [-178, 0]]] } };
        const wrapped = { width: 100, height: 100, centerLongitude: 181, project: ([lng, lat]: [number, number]) => ({ x: 50 + (lng - 181) * 10, y: 50 + lat }) };
        expect(atlasTooltipPlacement(value, wrapped)).toEqual({ point: { x: 50, y: 50 } });
    });

    it('handles duplicate points and ignores unprojectable or absent geometry', () => {
        expect(atlasTooltipPlacement(route([[[50, 50], [50, 50]]]), viewport)).toEqual({ point: { x: 50, y: 50 } });
        expect(atlasTooltipPlacement(route([]), viewport)).toBeUndefined();
        expect(atlasTooltipPlacement(route([[[0, 0], [10, 10]]]), { ...viewport, width: 0 })).toBeUndefined();
        expect(atlasTooltipPlacement(route([[[0, 0], [10, 10]]]), { ...viewport, project: () => ({ x: NaN, y: Infinity }) })).toBeUndefined();
    });
});
