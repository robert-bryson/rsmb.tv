import { describe, expect, it } from 'vitest';
import { combineAtlasRoutes, isTripAtlasLocation, readAtlasSession, saveAtlasSession, tripAtlasColor, tripAtlasUrl } from '../features/trips/atlas/tripAtlasView';
import type { RouteGeoJson } from '../features/trips/routeGeometry';

const route: RouteGeoJson = {
    type: 'FeatureCollection', features: [{
        type: 'Feature', id: 0, properties: { trackId: 'morning' },
        geometry: { type: 'MultiLineString', coordinates: [[[-122, 47], [-123, 46]], [[-124, 45], [-125, 44]]] },
    }],
};

describe('trip atlas view data', () => {
    it('preserves identity colors across geometry arrival order and filtered subsets', () => {
        const state = { route, error: '', retry: () => {} };
        const first = combineAtlasRoutes({ 'pch-2024': state, 'route-66ish-2025': state });
        const reordered = combineAtlasRoutes({ 'route-66ish-2025': state, 'pch-2024': state });
        const subset = combineAtlasRoutes({ 'route-66ish-2025': state });
        const colors = (features: typeof first.features) => Object.fromEntries(features.map(feature => [feature.properties!.tripId, feature.properties!.color]));
        expect(colors(first.features)).toEqual({ 'pch-2024': '#fbbf24', 'route-66ish-2025': '#34d399' });
        expect(colors(reordered.features)).toEqual(colors(first.features));
        expect(colors(subset.features)).toEqual({ 'route-66ish-2025': '#34d399' });
        expect(tripAtlasColor('ocean-shores-2024')).toBe('#a78bfa');
        expect(tripAtlasColor('boise-2024')).toBe('#38bdf8');
        expect(tripAtlasColor('kalaloch-2024')).toBe('#fb7185');
        expect(tripAtlasColor('constructor')).toBe(tripAtlasColor('unconfigured-trip'));
    });

    it('preserves disconnected segments and cached geometry while namespacing identical source IDs', () => {
        const before = JSON.stringify(route);
        const combined = combineAtlasRoutes({
            first: { route, error: '', retry: () => {} },
            second: { route, error: '', retry: () => {} },
            failed: { route: null, error: 'Failed', retry: () => {} },
        });
        expect(combined.features.map(feature => feature.id)).toEqual(['first:0', 'second:0']);
        expect(combined.features.map(feature => feature.properties?.tripId)).toEqual(['first', 'second']);
        expect(combined.features[0].geometry).toEqual(route.features[0].geometry);
        expect(JSON.stringify(route)).toBe(before);
    });

    it.each([
        ['/projects/motorcycle-trips/map', true],
        ['/projects/motorcycle-trips/map?trip=coast', true],
        ['/projects/motorcycle-trips/map/elsewhere', false],
        ['/projects/motorcycle-trips/map-elsewhere', false],
        ['https://example.com/projects/motorcycle-trips/map', false],
        ['//example.com/projects/motorcycle-trips/map', false],
        [undefined, false],
    ])('accepts only exact local atlas return locations: %s', (url, valid) => {
        expect(isTripAtlasLocation(url)).toBe(valid);
    });

    it('encodes selected trip IDs in report-to-map links', () => {
        expect(new URL(tripAtlasUrl('coast & hills'), 'https://rsmb.tv').searchParams.get('trip')).toBe('coast & hills');
    });

    it('restores history entries and explicit return URLs without restoring unrelated fresh visits', () => {
        const saved = { panelOpen: true, scrollTop: 320, camera: { center: [-122, 47] as [number, number], zoom: 8, bearing: 0, pitch: 0 } };
        saveAtlasSession('history-key', '/atlas-session-test?trip=first', saved);
        saved.scrollTop = 0;
        expect(readAtlasSession('history-key')?.scrollTop).toBe(320);
        expect(readAtlasSession('new-key', '/atlas-session-test?trip=first')?.camera?.zoom).toBe(8);
        expect(readAtlasSession('unrelated-key')).toBeUndefined();
    });
});
