import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { TripRouteMap } from '../features/trips/components/TripRouteMap';
import type { TripManifest } from '../features/trips/types';

vi.mock('maplibre-gl', () => ({
    AttributionControl: vi.fn(),
    FullscreenControl: vi.fn(),
    LngLatBounds: vi.fn(),
    Map: vi.fn(),
    NavigationControl: vi.fn(),
    setWorkerUrl: vi.fn(),
}));

vi.mock('../features/flights/hooks/useReducedMotion', () => ({
    useReducedMotion: () => false,
}));

const manifest: TripManifest = {
    id: 'first-trip',
    dates: { start: '2024-05-01', end: '2024-05-03' },
    hero: 'hero',
    route: { geoJson: '/routes/first.geojson' },
    stops: [],
    photos: [{ id: 'hero', src: '/hero.webp', width: 1600, height: 1067, alt: 'Coast' }],
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('TripRouteMap', () => {
    it('rejects route geometry without usable coordinates', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [] },
            }),
        }));

        render(
            <TripStoryProvider manifest={manifest}>
                <TripRouteMap />
            </TripStoryProvider>,
        );

        expect(await screen.findByText('Route data must contain valid LineString geometry.'))
            .toBeInTheDocument();
    });

    it('clears a stale route error when the manifest changes', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 503 })
            .mockImplementationOnce(() => new Promise(() => undefined));
        vi.stubGlobal('fetch', fetchMock);

        const { rerender } = render(
            <TripStoryProvider manifest={manifest}>
                <TripRouteMap />
            </TripStoryProvider>,
        );

        expect(await screen.findByText('Route request failed with 503')).toBeInTheDocument();

        const nextManifest = {
            ...manifest,
            id: 'second-trip',
            route: { geoJson: '/routes/second.geojson' },
        };
        rerender(
            <TripStoryProvider manifest={nextManifest}>
                <TripRouteMap />
            </TripStoryProvider>,
        );

        await waitFor(() => {
            expect(screen.queryByText('Route request failed with 503')).not.toBeInTheDocument();
            expect(screen.getByText('Loading route…')).toBeInTheDocument();
        });
        expect(fetchMock).toHaveBeenLastCalledWith('/routes/second.geojson', expect.any(Object));
    });
});