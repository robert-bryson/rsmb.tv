import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapOptions } from 'maplibre-gl';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { TripRouteMap } from '../features/trips/components/TripRouteMap';
import type { TripManifest } from '../features/trips/types';

const mapMocks = vi.hoisted(() => ({
    addControl: vi.fn(),
    easeTo: vi.fn(),
    getSource: vi.fn(),
    getMinZoom: vi.fn(() => 0),
    getZoom: vi.fn(() => 7),
    Map: vi.fn(function (options: MapOptions) {
        void options;
        return {
            addControl: mapMocks.addControl,
            easeTo: mapMocks.easeTo,
            getMinZoom: mapMocks.getMinZoom,
            getSource: mapMocks.getSource,
            getZoom: mapMocks.getZoom,
            off: mapMocks.off,
            once: mapMocks.once,
            on: mapMocks.on,
            remove: vi.fn(),
            setPaintProperty: mapMocks.setPaintProperty,
            setZoom: mapMocks.setZoom,
        };
    }),
    LngLatBounds: vi.fn(function (this: { extend: ReturnType<typeof vi.fn> }) {
        this.extend = vi.fn().mockReturnValue(this);
    }),
    off: vi.fn(),
    once: vi.fn((_event: string, listener: () => void) => listener()),
    on: vi.fn(),
    setPaintProperty: vi.fn(),
    setTiles: vi.fn(),
    setZoom: vi.fn(),
}));

mapMocks.getSource.mockReturnValue({ setTiles: mapMocks.setTiles });

vi.mock('maplibre-gl', () => ({
    AttributionControl: vi.fn(),
    FullscreenControl: vi.fn(),
    LngLatBounds: mapMocks.LngLatBounds,
    Map: mapMocks.Map,
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
    vi.clearAllMocks();
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

    it('rejects feature collections that contain non-feature objects', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'FeatureCollection',
                features: [{
                    properties: {},
                    geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
                }],
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

    it('calculates distance from geometry when source metadata is negative', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'Feature',
                properties: { distanceKilometers: -10 },
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));

        render(
            <TripStoryProvider manifest={manifest}>
                <TripRouteMap />
            </TripStoryProvider>,
        );

        expect(await screen.findByText(/^Overall route:/)).toHaveTextContent(/^Overall route: \d+ mi \/ \d+\.\d km$/);
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

    it('fits and highlights one track while retaining muted route context and arrows', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: { trackId: 'outbound', trackOrder: 0 },
                        geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
                    },
                    {
                        type: 'Feature',
                        properties: { trackId: 'return', trackOrder: 1 },
                        geometry: { type: 'LineString', coordinates: [[-124, 45], [-125, 44]] },
                    },
                ],
            }),
        }));

        render(
            <TripStoryProvider manifest={{
                ...manifest,
                route: {
                    ...manifest.route,
                    tracks: [
                        { id: 'outbound', name: 'Outbound' },
                        { id: 'return', name: 'Return' },
                    ],
                },
            }}>
                <TripRouteMap trackId="return" />
            </TripStoryProvider>,
        );

        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalled());
        expect(mapMocks.LngLatBounds).toHaveBeenCalledWith([-124, 45], [-124, 45]);

        const options = mapMocks.Map.mock.calls[0][0] as MapOptions;
        const layers = options.style && typeof options.style === 'object' ? options.style.layers : [];
        expect(layers.find((layer) => layer.id === 'trip-route-line')?.paint).toMatchObject({
            'line-color': '#71717a',
            'line-opacity': 0.55,
        });
        expect((layers.find((layer) => layer.id === 'trip-route-selected') as { filter?: unknown })?.filter)
            .toEqual(['==', ['get', 'trackId'], 'return']);
        expect((layers.find((layer) => layer.id === 'trip-route-direction') as { filter?: unknown })?.filter)
            .toEqual(['==', ['get', 'trackId'], 'return']);
        expect(layers.find((layer) => layer.id === 'trip-route-direction')?.paint).toMatchObject({
            'text-color': '#09090b',
            'text-opacity': 1,
        });
        expect(screen.getByText(/^Return:/)).toHaveTextContent(/mi \/ .*km/);
    });

    it('renders the combined overview as one uniformly styled route', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: { trackId: 'outbound', trackOrder: 0 },
                        geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
                    },
                    {
                        type: 'Feature',
                        properties: { trackId: 'return', trackOrder: 1 },
                        geometry: { type: 'LineString', coordinates: [[-124, 45], [-125, 44]] },
                    },
                ],
            }),
        }));

        render(
            <TripStoryProvider manifest={manifest}>
                <TripRouteMap />
            </TripStoryProvider>,
        );

        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalled());
        const options = mapMocks.Map.mock.calls[0][0] as MapOptions;
        const layers = options.style && typeof options.style === 'object' ? options.style.layers : [];
        const routeLayer = layers.find((layer) => layer.id === 'trip-route-line');
        expect(routeLayer?.paint).toMatchObject({ 'line-color': '#f59e0b', 'line-width': 4 });
        expect(routeLayer).not.toHaveProperty('filter');
        expect(layers).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'trip-route-even' }),
            expect.objectContaining({ id: 'trip-route-odd' }),
        ]));
        expect(mapMocks.setZoom).toHaveBeenCalledWith(6);
    });

    it('switches basemaps without rebuilding the map', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));

        const { rerender } = render(
            <TripStoryProvider manifest={manifest}>
                <TripRouteMap />
            </TripStoryProvider>,
        );

        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const basemapControl = mapMocks.addControl.mock.calls
            .map(([control]) => control)
            .find((control) => control?.constructor.name === 'BasemapControl');
        const controlElement = basemapControl.onAdd();
        const button = controlElement.querySelector('button');

        expect(button).toHaveAccessibleName('Change basemap (current: Muted)');
        fireEvent.click(button);
        fireEvent.click(button);

        expect(mapMocks.setTiles).toHaveBeenCalledWith(['https://tile.opentopomap.org/{z}/{x}/{y}.png']);
        expect(mapMocks.setPaintProperty).toHaveBeenCalledWith('openstreetmap', 'raster-brightness-max', 0.85);
        expect(button).toHaveAccessibleName('Change basemap (current: Terrain)');
        expect(mapMocks.Map).toHaveBeenCalledOnce();

        rerender(
            <TripStoryProvider manifest={{
                ...manifest,
                id: 'second-trip',
                route: { geoJson: '/routes/second.geojson' },
            }}>
                <TripRouteMap />
            </TripStoryProvider>,
        );

        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        const nextOptions = mapMocks.Map.mock.calls[1][0] as MapOptions;
        const nextStyle = nextOptions.style && typeof nextOptions.style === 'object' ? nextOptions.style : undefined;
        expect(nextStyle?.sources.openstreetmap).toMatchObject({
            tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
        });
        const nextBasemapControl = mapMocks.addControl.mock.calls
            .map(([control]) => control)
            .filter((control) => control?.constructor.name === 'BasemapControl')
            .at(-1);
        expect(nextBasemapControl.onAdd().querySelector('button'))
            .toHaveAccessibleName('Change basemap (current: Terrain)');
    });

    it('applies the selected basemap after the map source loads', async () => {
        mapMocks.getSource.mockReturnValue(undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));

        render(
            <TripStoryProvider manifest={manifest}>
                <TripRouteMap />
            </TripStoryProvider>,
        );

        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalled());
        const basemapControl = mapMocks.addControl.mock.calls
            .map(([control]) => control)
            .find((control) => control?.constructor.name === 'BasemapControl');
        fireEvent.click(basemapControl.onAdd().querySelector('button'));

        await waitFor(() => expect(mapMocks.once).toHaveBeenCalledTimes(2));
        expect(mapMocks.setTiles).not.toHaveBeenCalled();

        const loadListener = mapMocks.once.mock.calls
            .filter(([event]) => event === 'load')
            .at(-1)?.[1];
        if (!loadListener) throw new Error('Expected a basemap load listener.');
        mapMocks.getSource.mockReturnValue({ setTiles: mapMocks.setTiles });
        act(() => loadListener());

        expect(mapMocks.setTiles).toHaveBeenCalledWith([
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        ]);
        expect(mapMocks.setPaintProperty).toHaveBeenCalledWith('openstreetmap', 'raster-brightness-max', 1);
        expect(mapMocks.once).toHaveBeenCalledWith('load', expect.any(Function));
    });

    it('keeps the existing zoom behavior for a stop-focused map', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));

        render(
            <TripStoryProvider manifest={{
                ...manifest,
                stops: [{ id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] }],
            }}>
                <TripRouteMap stopId="camp" />
            </TripStoryProvider>,
        );

        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalled());
        expect(mapMocks.setZoom).not.toHaveBeenCalled();
    });

    it('highlights matching markers and descriptions from either hover target', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));

        render(
            <TripStoryProvider manifest={{
                ...manifest,
                stops: [{ id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] }],
            }}>
                <TripRouteMap />
            </TripStoryProvider>,
        );

        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalled());
        const description = screen.getByText('Camp').closest('li')!;

        fireEvent.mouseEnter(description);
        expect(description).toHaveClass('bg-amber-400', 'text-zinc-950');
        expect(mapMocks.setPaintProperty).toHaveBeenCalledWith(
            'trip-stops',
            'circle-color',
            ['case', ['==', ['get', 'id'], 'camp'], '#f59e0b', '#fafafa'],
        );

        const markerEnter = mapMocks.on.mock.calls.find(([event]) => event === 'mouseenter')?.[2];
        fireEvent.mouseLeave(description);
        act(() => markerEnter({ features: [{ properties: { id: 'camp' } }] }));
        expect(description).toHaveClass('bg-amber-400', 'text-zinc-950');
    });
});