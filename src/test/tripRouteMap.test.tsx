import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapOptions } from 'maplibre-gl';
import { clearTripRouteCache } from '../features/trips/useTripRoute';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { TripRouteMap } from '../features/trips/components/TripRouteMap';
import type { TripManifest } from '../features/trips/types';

const mapMocks = vi.hoisted(() => ({
    addControl: vi.fn(),
    easeTo: vi.fn(),
    fitBounds: vi.fn(),
    getSource: vi.fn(),
    getMinZoom: vi.fn(() => 0),
    getZoom: vi.fn(() => 7),
    Map: vi.fn(function (options: MapOptions) {
        void options;
        return {
            addControl: mapMocks.addControl,
            easeTo: mapMocks.easeTo,
            fitBounds: mapMocks.fitBounds,
            getMinZoom: mapMocks.getMinZoom,
            getSource: mapMocks.getSource,
            getZoom: mapMocks.getZoom,
            isMoving: () => false,
            stop: vi.fn(),
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

vi.mock('../hooks/useReducedMotion', () => ({
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
    clearTripRouteCache();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    mapMocks.once.mockImplementation((_event: string, listener: () => void) => listener());
});

describe('TripRouteMap', () => {
    it('restores the requested stop after a track replacement loads', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: async () => ({
                type: 'Feature', properties: { trackId: 'return' },
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        const tripManifest: TripManifest = {
            ...manifest, stops: [{ id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] }],
        };
        const story = (trackId?: string) => <TripStoryProvider manifest={tripManifest}>
            <TripRouteMap stopId="camp" trackId={trackId} />
        </TripStoryProvider>;
        const { rerender } = render(story());
        await waitFor(() => expect(mapMocks.easeTo).toHaveBeenCalledWith({ center: [-122.5, 46.5], zoom: 9 }));
        mapMocks.easeTo.mockClear();
        mapMocks.once.mockClear();
        mapMocks.once.mockImplementation(() => undefined);

        rerender(story('return'));

        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(mapMocks.easeTo).not.toHaveBeenCalled();
        act(() => {
            for (const [event, listener] of mapMocks.once.mock.calls) if (event === 'load') listener();
        });
        expect(mapMocks.easeTo).toHaveBeenCalledOnce();
        expect(mapMocks.easeTo).toHaveBeenCalledWith({ center: [-122.5, 46.5], zoom: 9 });
        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('keeps route downloads available when route loading fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
        render(<TripStoryProvider manifest={manifest}><TripRouteMap /></TripStoryProvider>);
        await screen.findByText('Route request failed with 503');
        expect(screen.getByRole('link', { name: 'Download route (GeoJSON)' })).toHaveAttribute('href', manifest.route.geoJson);
        expect(mapMocks.Map).not.toHaveBeenCalled();
    });

    it('does not paint a replacement map before its own load event', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: async () => ({
                type: 'Feature', properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            })
        }));
        const stops = [{ id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] as [number, number] }];
        const { rerender } = render(<TripStoryProvider manifest={{ ...manifest, stops }}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.setPaintProperty).toHaveBeenCalledWith('trip-stops', 'circle-radius', expect.anything()));
        mapMocks.once.mockImplementation(() => undefined);
        mapMocks.setPaintProperty.mockClear();
        mapMocks.once.mockClear();
        rerender(<TripStoryProvider manifest={{ ...manifest, stops, route: { geoJson: '/second.geojson' } }}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        fireEvent.mouseEnter(screen.getByRole('button', { name: /Camp/ }).closest('li')!);
        expect(mapMocks.setPaintProperty).not.toHaveBeenCalled();
        act(() => {
            for (const [event, listener] of mapMocks.once.mock.calls) if (event === 'load') listener();
        });
        expect(mapMocks.setPaintProperty).toHaveBeenCalledWith('trip-stops', 'circle-radius', expect.anything());
    });

    it('discards map errors when a different route loads', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: async () => ({
                type: 'Feature', properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            })
        }));
        const { rerender } = render(<TripStoryProvider manifest={manifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const fail = mapMocks.on.mock.calls.find(([event]) => event === 'error')?.[1];
        act(() => fail());
        expect(screen.getByText(/The map could not load/)).toBeInTheDocument();
        rerender(<TripStoryProvider manifest={{ ...manifest, route: { geoJson: '/second.geojson' } }}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(screen.queryByText(/The map could not load/)).not.toBeInTheDocument();
    });

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

    it('shows the on-map reset after movement and hides it after fitting the full route', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'Feature', properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        render(<TripStoryProvider manifest={manifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        expect(screen.queryByRole('combobox', { name: 'Map style' })).not.toBeInTheDocument();

        const control = mapMocks.addControl.mock.calls
            .map(([control]) => control)
            .find(control => control?.constructor.name === 'RouteActionsControl');
        const map = mapMocks.Map.mock.results[0].value;
        const element = control.onAdd(map);
        const reset = element.querySelector('button');
        const downloadControl = mapMocks.addControl.mock.calls
            .map(([control]) => control)
            .find(control => control?.constructor.name === 'DownloadRouteControl');
        const download = downloadControl.onAdd().querySelector('a');
        expect(reset.hidden).toBe(true);
        expect(download).toHaveAccessibleName('Download route (GeoJSON)');
        expect(download).toHaveAttribute('href', manifest.route.geoJson);
        expect(download).toHaveAttribute('download');
        expect(download.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

        const move = mapMocks.on.mock.calls.find(([event]) => event === 'move')?.[1];
        act(() => move());
        expect(reset.hidden).toBe(false);
        mapMocks.once.mockImplementationOnce(() => undefined);
        fireEvent.click(reset);
        expect(mapMocks.fitBounds).toHaveBeenCalledWith(expect.anything(), {
            padding: 40, maxZoom: 11, bearing: 0, pitch: 0, duration: 300,
        });
        const moveEnd = mapMocks.once.mock.calls.find(([event]) => event === 'moveend')?.[1];
        act(() => moveEnd?.());
        expect(reset.hidden).toBe(true);
        act(() => move());
        expect(reset.hidden).toBe(false);
        control.onRemove();
        expect(mapMocks.off).toHaveBeenCalledWith('move', move);
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

        await waitFor(() => expect(mapMocks.once).toHaveBeenCalledWith('load', expect.any(Function)));
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
        const resetControl = mapMocks.addControl.mock.calls.map(([control]) => control)
            .find(control => control?.constructor.name === 'RouteActionsControl');
        expect(resetControl.onAdd(mapMocks.Map.mock.results[0].value).querySelector('button').hidden).toBe(false);
        expect(mapMocks.setZoom).not.toHaveBeenCalled();
        expect(mapMocks.easeTo).toHaveBeenCalledWith({ center: [-122.5, 46.5], zoom: 9 });
    });

    it('updates stop selection when the requested stop changes without rebuilding the map', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'Feature', properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        const tripManifest: TripManifest = {
            ...manifest,
            stops: [
                { id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] },
                { id: 'finish', name: 'Finish', coordinates: [-123, 46] },
            ],
        };
        const story = (stopId?: string) => (
            <TripStoryProvider manifest={tripManifest}><TripRouteMap stopId={stopId} /></TripStoryProvider>
        );
        const { rerender } = render(story('camp'));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'true');

        rerender(story('finish'));

        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: /Finish/ })).toHaveAttribute('aria-pressed', 'true');
        expect(mapMocks.easeTo).toHaveBeenLastCalledWith({ center: [-123, 46], zoom: 9 });
        expect(mapMocks.setPaintProperty).toHaveBeenCalledWith(
            'trip-stops', 'circle-color', ['case', ['==', ['get', 'id'], 'finish'], '#f59e0b', '#fafafa'],
        );
        expect(mapMocks.Map).toHaveBeenCalledOnce();

        rerender(story());

        expect(screen.getByRole('button', { name: /Finish/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it('clears a selected stop when another route loads', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'Feature', properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        const stops: TripManifest['stops'] = [{ id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] }];
        const { rerender } = render(
            <TripStoryProvider manifest={{ ...manifest, stops }}><TripRouteMap /></TripStoryProvider>,
        );
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const selectMarker = mapMocks.on.mock.calls.find(([event]) => event === 'click')?.[2];
        act(() => selectMarker({ features: [{ properties: { id: 'camp' } }] }));
        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'true');
        expect(mapMocks.easeTo).toHaveBeenLastCalledWith({ center: [-122.5, 46.5], zoom: 9 });
        act(() => selectMarker({ features: [{ properties: { id: 42 } }] }));
        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'true');

        rerender(<TripStoryProvider manifest={{ ...manifest, stops, route: { geoJson: '/second.geojson' } }}>
            <TripRouteMap />
        </TripStoryProvider>);

        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it('uses the current stop when a track change creates another map', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'Feature', properties: { trackId: 'return' },
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        const tripManifest: TripManifest = {
            ...manifest,
            stops: [
                { id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] },
                { id: 'finish', name: 'Finish', coordinates: [-123, 46] },
            ],
        };
        const { rerender } = render(<TripStoryProvider manifest={tripManifest}>
            <TripRouteMap stopId="camp" />
        </TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());

        rerender(<TripStoryProvider manifest={tripManifest}>
            <TripRouteMap stopId="finish" trackId="return" />
        </TripStoryProvider>);

        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        const options = mapMocks.Map.mock.calls[1][0] as MapOptions;
        const layers = options.style && typeof options.style === 'object' ? options.style.layers : [];
        expect(layers.find(layer => layer.id === 'trip-stops')?.paint).toMatchObject({
            'circle-color': ['case', ['==', ['get', 'id'], 'finish'], '#f59e0b', '#fafafa'],
        });
        fireEvent.click(screen.getByRole('button', { name: /Camp/ }));
        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'true');
        expect(mapMocks.easeTo).toHaveBeenLastCalledWith({ center: [-122.5, 46.5], zoom: 9 });
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
        const description = screen.getByRole('button', { name: /Camp/ }).closest('li')!;

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
