import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Feature, LineString } from 'geojson';
import { atlasDayBreaks, atlasTripEndpoints, useAtlasRouteMarkers } from '../features/trips/atlas/tripAtlasMarkers';
import { loadTripManifest } from '../features/trips/tripManifests';
import type { RouteGeoJson } from '../features/trips/routeGeometry';
import type { TripManifest } from '../features/trips/types';

vi.mock('../features/trips/tripManifests', () => ({ loadTripManifest: vi.fn() }));

const metadata = {
    id: 'pch-2024', route: { geoJson: '/route.geojson' }, days: [
        { id: 'first', title: 'First day', headingId: 'first', trackIds: ['morning', 'afternoon'] },
        { id: 'rest', title: 'No recording', headingId: 'rest' },
        { id: 'second', title: 'Second day', headingId: 'second', trackIds: ['second'] },
        { id: 'third', title: 'Third day', headingId: 'third', trackIds: ['third'] },
    ],
};
const track = (id: string, end: number): Feature<LineString> => ({
    type: 'Feature', properties: { trackId: id }, geometry: { type: 'LineString', coordinates: [[0, 0], [end, end]] },
});
const route: RouteGeoJson = { type: 'FeatureCollection', features: [track('third', 4), track('afternoon', 2), track('second', 3), track('morning', 1)] };

describe('atlas day break dots', () => {
    it('marks each authored day end except the final day, grouping tracks and ignoring file order', () => {
        const dots = atlasDayBreaks(metadata, route);
        expect(dots.features.map(feature => feature.geometry.coordinates)).toEqual([[2, 2], [3, 3]]);
        expect(dots.features.map(feature => feature.properties)).toEqual([
            { tripId: 'pch-2024', dayId: 'first', color: '#fbbf24' },
            { tripId: 'pch-2024', dayId: 'second', color: '#fbbf24' },
        ]);
    });

    it('uses the final part of the final recording, without dots at internal gaps or extra elevation values', () => {
        const split: RouteGeoJson = { type: 'FeatureCollection', features: [track('morning', 1), {
            type: 'Feature', properties: { trackId: 'afternoon' }, geometry: {
                type: 'MultiLineString', coordinates: [[[1, 1], [2, 2]], [[3, 3, 50], [4, 4, 60]]],
            },
        }] };
        expect(atlasDayBreaks(metadata, split).features.map(feature => feature.geometry.coordinates)).toEqual([[4, 4]]);
    });

    it('does not substitute an earlier recording when the last track of a day is missing', () => {
        expect(atlasDayBreaks(metadata, { type: 'FeatureCollection', features: [track('morning', 1)] }).features).toEqual([]);
    });

    it('leaves routes without day data, single-day trips, and unavailable geometry undecorated', () => {
        expect(atlasDayBreaks(undefined, route).features).toEqual([]);
        expect(atlasDayBreaks({ id: 'pch-2024' }, route).features).toEqual([]);
        expect(atlasDayBreaks({ ...metadata, days: metadata.days.slice(0, 1) }, route).features).toEqual([]);
        expect(atlasDayBreaks(metadata, null).features).toEqual([]);
    });
});

describe('selected trip endpoints', () => {
    it('uses the first and last authored recordings despite shuffled geometry', () => {
        expect(atlasTripEndpoints(metadata, route)).toEqual([
            { kind: 'start', coordinates: [0, 0], color: '#fbbf24' },
            { kind: 'end', coordinates: [4, 4], color: '#fbbf24' },
        ]);
    });

    it('uses declared track order without days and the outer parts of disconnected geometry', () => {
        const split: RouteGeoJson = { type: 'FeatureCollection', features: [track('last', 9), {
            type: 'Feature', properties: { trackId: 'first' }, geometry: {
                type: 'MultiLineString', coordinates: [[[1, 2, 50], [3, 4]], [[5, 6], [7, 8, 60]]],
            },
        }] };
        const tracks = [{ id: 'first', name: 'First' }, { id: 'last', name: 'Last' }];
        expect(atlasTripEndpoints({ id: metadata.id, tracks }, split).map(endpoint => endpoint.coordinates)).toEqual([[1, 2], [9, 9]]);
        expect(atlasTripEndpoints({ id: metadata.id }, split.features[1]).map(endpoint => endpoint.coordinates)).toEqual([[1, 2], [7, 8]]);
    });

    it('keeps both endpoints at the same coordinate on a round trip', () => {
        const loop: RouteGeoJson = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4], [1, 2]] } };
        expect(atlasTripEndpoints({ id: metadata.id }, loop).map(endpoint => [endpoint.kind, endpoint.coordinates])).toEqual([
            ['start', [1, 2]], ['end', [1, 2]],
        ]);
    });

    it('does not invent a trip endpoint from a middle recording when the outer recording is missing', () => {
        const partial: RouteGeoJson = { type: 'FeatureCollection', features: [track('second', 3)] };
        expect(atlasTripEndpoints(metadata, partial)).toEqual([]);
        expect(atlasTripEndpoints(undefined, route)).toEqual([]);
        expect(atlasTripEndpoints(metadata, null)).toEqual([]);
    });
});

describe('selected trip day metadata', () => {
    beforeEach(() => { vi.mocked(loadTripManifest).mockReset(); });

    it('loads only on selection and clears dots immediately when selection changes or is removed', async () => {
        vi.mocked(loadTripManifest).mockResolvedValue(metadata as TripManifest);
        const { result, rerender } = renderHook(({ id }: { id?: string }) => useAtlasRouteMarkers(id, route), { initialProps: {} });
        expect(loadTripManifest).not.toHaveBeenCalled();
        rerender({ id: 'pch-2024' });
        await waitFor(() => expect(result.current.dayBreaks.features).toHaveLength(2));
        expect(result.current.endpoints).toHaveLength(2);
        let resolveNext!: (manifest: TripManifest | undefined) => void;
        vi.mocked(loadTripManifest).mockImplementationOnce(() => new Promise(resolve => { resolveNext = resolve; }));
        rerender({ id: 'boise-2024' });
        expect(result.current.dayBreaks.features).toEqual([]);
        expect(result.current.endpoints).toEqual([]);
        await act(async () => { resolveNext({ ...metadata, id: 'boise-2024' } as TripManifest); });
        expect(result.current.dayBreaks.features[0].properties?.color).toBe('#38bdf8');
        rerender({});
        expect(result.current.dayBreaks.features).toEqual([]);
        expect(result.current.endpoints).toEqual([]);
        expect(loadTripManifest).toHaveBeenCalledTimes(2);
    });

    it('ignores late metadata from a previous selection and tolerates a failed optional load', async () => {
        let resolvePrevious!: (manifest: TripManifest | undefined) => void;
        vi.mocked(loadTripManifest).mockImplementationOnce(() => new Promise(resolve => { resolvePrevious = resolve; }));
        const { result, rerender } = renderHook(({ id }) => useAtlasRouteMarkers(id, route), { initialProps: { id: 'pch-2024' } });
        vi.mocked(loadTripManifest).mockRejectedValueOnce(new Error('Manifest unavailable'));
        rerender({ id: 'boise-2024' });
        await act(async () => { resolvePrevious(metadata as TripManifest); });
        expect(result.current.dayBreaks.features).toEqual([]);
    });
});
