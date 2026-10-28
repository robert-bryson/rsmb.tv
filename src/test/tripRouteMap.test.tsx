import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'react-dom';
import type { MapOptions, StyleSpecification } from 'maplibre-gl';
import { clearTripRouteCache } from '../features/trips/useTripRoute';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { TripRouteMap } from '../features/trips/components/TripRouteMap';
import type { TripManifest } from '../features/trips/types';
import { dayMapManifest, dayMapRoute } from './fixtures/tripDayMap';

const mapMocks = vi.hoisted(() => ({
    addControl: vi.fn(),
    easeTo: vi.fn(),
    fitBounds: vi.fn(),
    jumpTo: vi.fn(),
    reducedMotion: false,
    getSource: vi.fn(),
    getMinZoom: vi.fn(() => 0),
    getZoom: vi.fn(() => 7),
    getCenter: vi.fn(() => ({ lng: -122.5, lat: 46.5 })),
    getBearing: vi.fn(() => 12),
    getPitch: vi.fn(() => 20),
    getPadding: vi.fn(() => ({ top: 10, bottom: 20, left: 30, right: 40 })),
    cameraForBounds: vi.fn(() => ({ center: [-122.5, 46.5], zoom: 7, bearing: 0 })),
    popupCreate: vi.fn(),
    popupPosition: vi.fn(),
    popupText: vi.fn(),
    popupRemove: vi.fn(),
    queryRenderedFeatures: vi.fn<(point: unknown, options?: { layers?: string[] }) => Array<{ properties?: Record<string, unknown> }>>(() => []),
    Map: vi.fn(function (options: MapOptions) {
        void options;
        const canvas = document.createElement('canvas');
        return {
            addControl: mapMocks.addControl,
            easeTo: mapMocks.easeTo,
            fitBounds: mapMocks.fitBounds,
            jumpTo: mapMocks.jumpTo,
            getMinZoom: mapMocks.getMinZoom,
            getSource: mapMocks.getSource,
            getZoom: mapMocks.getZoom,
            getCenter: mapMocks.getCenter,
            getBearing: mapMocks.getBearing,
            getPitch: mapMocks.getPitch,
            getPadding: mapMocks.getPadding,
            getCanvas: () => canvas,
            getBounds: () => ({ contains: () => true }),
            cameraForBounds: mapMocks.cameraForBounds,
            queryRenderedFeatures: mapMocks.queryRenderedFeatures,
            isMoving: () => false,
            stop: vi.fn(),
            off: mapMocks.off,
            once: mapMocks.once,
            on: mapMocks.on,
            remove: vi.fn(),
            setPaintProperty: mapMocks.setPaintProperty,
            setFilter: mapMocks.setFilter,
            setLayoutProperty: mapMocks.setLayoutProperty,
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
    setFilter: vi.fn(),
    setLayoutProperty: vi.fn(),
    setData: vi.fn(),
    setTiles: vi.fn(),
    setZoom: vi.fn(),
}));

mapMocks.getSource.mockReturnValue({ setTiles: mapMocks.setTiles, setData: mapMocks.setData });

vi.mock('maplibre-gl', () => ({
    Popup: class {
        element = document.createElement('div');
        constructor(options: unknown) { mapMocks.popupCreate(options); }
        setLngLat(coordinates: unknown) { mapMocks.popupPosition(coordinates); return this; }
        setText(text: string) { mapMocks.popupText(text); this.element.textContent = text; return this; }
        addTo() { document.body.append(this.element); return this; }
        getElement() { return this.element; }
        remove() { mapMocks.popupRemove(); this.element.remove(); return this; }
    },
    AttributionControl: class {
        onAdd() {
            const container = document.createElement('details');
            container.className = 'maplibregl-ctrl-attrib maplibregl-compact-show';
            container.setAttribute('open', '');
            return container;
        }
    },
    FullscreenControl: vi.fn(),
    LngLatBounds: mapMocks.LngLatBounds,
    Map: mapMocks.Map,
    NavigationControl: vi.fn(),
    setWorkerUrl: vi.fn(),
}));

vi.mock('../hooks/useReducedMotion', () => ({
    useReducedMotion: () => mapMocks.reducedMotion,
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
    mapMocks.getSource.mockReturnValue({ setTiles: mapMocks.setTiles, setData: mapMocks.setData });
    mapMocks.reducedMotion = false;
    mapMocks.once.mockImplementation((_event: string, listener: () => void) => listener());
    mapMocks.queryRenderedFeatures.mockReset().mockReturnValue([]);
});

describe('TripRouteMap', () => {
    it.each(['pointer', 'keyboard'] as const)('clears stop %s feedback when the route changes', async input => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        const story = (geoJson: string) => <TripStoryProvider manifest={{
            ...dayMapManifest, route: { ...dayMapManifest.route, geoJson },
        }}><TripRouteMap trackId="morning" /></TripStoryProvider>;
        const { rerender } = render(story('/first.geojson'));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const camp = screen.getByRole('button', { name: /Shared camp/ });
        if (input === 'pointer') fireEvent.mouseEnter(camp.closest('li')!);
        else fireEvent.focus(camp);
        expect(camp.closest('li')).toHaveClass('bg-amber-400');

        rerender(story('/second.geojson'));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(camp.closest('li')).not.toHaveClass('bg-amber-400');
        expect(mapMocks.setPaintProperty.mock.calls.filter(([layer, property]) =>
            layer === 'trip-stops' && property === 'circle-color').at(-1)?.[2])
            .toEqual(['case', ['==', ['get', 'id'], ''], '#f59e0b', '#fafafa']);
    });

    it('restores stop keyboard feedback when the pointer leaves another stop', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap dayId="coastbound" /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const camp = screen.getByRole('button', { name: /Shared camp/ });
        const harbor = screen.getByRole('button', { name: /Harbor/ });
        fireEvent.focus(camp);
        fireEvent.mouseEnter(harbor.closest('li')!);
        expect(harbor.closest('li')).toHaveClass('bg-amber-400');
        expect(camp.closest('li')).not.toHaveClass('bg-amber-400');
        fireEvent.mouseLeave(harbor.closest('li')!);
        expect(camp.closest('li')).toHaveClass('bg-amber-400');
        fireEvent.blur(camp);
        expect(camp.closest('li')).not.toHaveClass('bg-amber-400');
    });

    it('keeps Escape scoped to the stable viewport during the preview-to-map handoff', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        const story = (active: boolean) => <div data-trip-map-viewport>
            <TripStoryProvider manifest={dayMapManifest}><TripRouteMap active={active} /></TripStoryProvider>
        </div>;
        const { rerender } = render(story(false));
        await screen.findByRole('img');
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        fireEvent.click(day);
        // Map loading can replace the focused preview before the event reaches document.
        day.addEventListener('keydown', () => flushSync(() => rerender(story(true))), { once: true });
        fireEvent.keyDown(day, { key: 'Escape' });
        expect(mapMocks.Map).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', { name: '1. Coastbound' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('discards a saved camera when routes change while the map is suspended', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        const story = (active: boolean, geoJson: string) => <TripStoryProvider manifest={{ ...dayMapManifest, route: { ...dayMapManifest.route, geoJson } }}>
            <TripRouteMap active={active} />
        </TripStoryProvider>;
        const { rerender } = render(story(true, '/first.geojson'));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        fireEvent.click(screen.getByRole('button', { name: '1. Coastbound' }));
        rerender(story(false, '/first.geojson'));
        rerender(story(false, '/second.geojson'));
        rerender(story(false, '/first.geojson'));
        rerender(story(true, '/first.geojson'));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(mapMocks.Map.mock.calls[1][0]).toHaveProperty('bounds');
        expect(mapMocks.Map.mock.calls[1][0]).not.toHaveProperty('center');
        expect(mapMocks.jumpTo).not.toHaveBeenCalled();
    });

    it('preserves a selected day when Escape is used outside its map', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        fireEvent.click(day);
        fireEvent.mouseEnter(day);
        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(day).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(mapMocks.easeTo).not.toHaveBeenCalled();
    });

    it('clears route hover and focus feedback when another route replaces the current one', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        const story = (geoJson: string) => <TripStoryProvider manifest={{ ...dayMapManifest, route: { ...dayMapManifest.route, geoJson } }}>
            <TripRouteMap />
        </TripStoryProvider>;
        const { rerender } = render(story('/first.geojson'));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        fireEvent.focus(day);
        fireEvent.mouseEnter(day);
        rerender(story('/second.geojson'));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(day).not.toHaveAttribute('data-highlighted');
        expect(day).not.toHaveAttribute('aria-describedby');
    });

    it('retains keyboard feedback after pointer hover ends on a label or route', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        fireEvent.focus(day);
        fireEvent.mouseEnter(day);
        fireEvent.mouseLeave(day);
        expect(day).toHaveAttribute('data-highlighted', 'true');
        expect(day).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
        const move = mapMocks.on.mock.calls.find(([event, layer]) => event === 'mousemove' && layer === 'trip-route-halo')?.[2];
        const leave = mapMocks.on.mock.calls.find(([event, layer]) => event === 'mouseleave' && layer === 'trip-route-halo')?.[2];
        for (const trackId of ['morning', 'return']) {
            act(() => move({ features: [{ properties: { trackId } }], lngLat: { lng: -123, lat: 46 } }));
            act(() => leave());
            expect(screen.getByRole('tooltip')).toHaveTextContent('Coastbound');
            expect(day).toHaveAttribute('data-highlighted', 'true');
        }
        fireEvent.blur(day);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(mapMocks.fitBounds).not.toHaveBeenCalled();
    });

    it.each(['focus', 'pointer'])('dismisses an unselected %s tooltip with Escape without moving the camera', async input => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        if (input === 'focus') fireEvent.focus(day);
        else fireEvent.mouseEnter(day);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        fireEvent.keyDown(input === 'focus' ? day : document.body, { key: 'Escape' });
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(day).not.toHaveAttribute('aria-describedby');
        expect(day).toHaveAttribute('aria-pressed', 'false');
        expect(mapMocks.fitBounds).not.toHaveBeenCalled();
        expect(mapMocks.easeTo).not.toHaveBeenCalled();
    });

    it.each(['suspension', 'failure'])('restores the saved camera after dismissing a day during %s', async reason => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        const story = (active: boolean) => <TripStoryProvider manifest={dayMapManifest}><TripRouteMap active={active} /></TripStoryProvider>;
        const { rerender } = render(story(true));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        fireEvent.click(screen.getByRole('button', { name: '1. Coastbound' }));
        if (reason === 'failure') {
            const fail = mapMocks.on.mock.calls.find(([event]) => event === 'error')?.[1];
            act(() => fail());
        } else rerender(story(false));
        expect(mapMocks.Map.mock.results[0].value.remove).toHaveBeenCalledOnce();
        fireEvent.click(document.body);
        expect(screen.getByRole('button', { name: '1. Coastbound' })).toHaveAttribute('aria-pressed', 'false');
        mapMocks.setZoom.mockClear();
        if (reason === 'failure') fireEvent.click(screen.getByRole('button', { name: 'Retry route' }));
        else rerender(story(true));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(mapMocks.Map.mock.calls[1][0]).toMatchObject({ center: [-122.5, 46.5], zoom: 7, bearing: 12, pitch: 20 });
        expect(mapMocks.jumpTo).toHaveBeenCalledWith({ padding: { top: 10, bottom: 20, left: 30, right: 40 } });
        expect(mapMocks.setZoom).not.toHaveBeenCalled();
    });

    it.each([false, true])('selects, switches, and resets days through track clicks (reduced motion: %s)', async reducedMotion => {
        mapMocks.reducedMotion = reducedMotion;
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        const { unmount } = render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        for (const property of ['line-color', 'line-opacity', 'line-width']) {
            expect(mapMocks.setPaintProperty).toHaveBeenCalledWith('trip-route-line', `${property}-transition`, {
                duration: reducedMotion ? 0 : 300, delay: 0,
            });
        }
        const click = mapMocks.on.mock.calls.find(([event, listener]) => event === 'click' && typeof listener === 'function')?.[1];
        const clickTrack = (trackId: unknown) => {
            mapMocks.queryRenderedFeatures.mockImplementation((_point, options) => options?.layers?.includes('trip-route-halo')
                ? [{ properties: { trackId } }] : []);
            act(() => click({ point: { x: 10, y: 10 } }));
        };
        const coastbound = screen.getByRole('button', { name: '1. Coastbound' });
        const homebound = screen.getByRole('button', { name: '2. Homebound' });
        fireEvent.click(coastbound);
        const buttonExtent = mapMocks.LngLatBounds.mock.results.at(-1)?.value.extend.mock.calls;
        const buttonOptions = mapMocks.fitBounds.mock.lastCall?.[1];
        fireEvent.click(coastbound);
        mapMocks.fitBounds.mockClear();
        mapMocks.easeTo.mockClear();
        clickTrack('morning');
        expect(coastbound).toHaveAttribute('aria-pressed', 'true');
        expect(mapMocks.fitBounds).toHaveBeenCalledOnce();
        expect(mapMocks.fitBounds.mock.lastCall?.[1]).toEqual(buttonOptions);
        expect(mapMocks.LngLatBounds.mock.results.at(-1)?.value.extend.mock.calls).toEqual(buttonExtent);
        clickTrack('return');
        expect(homebound).toHaveAttribute('aria-pressed', 'true');
        expect(coastbound).toHaveAttribute('aria-pressed', 'false');
        expect(mapMocks.fitBounds).toHaveBeenCalledTimes(2);
        expect(mapMocks.easeTo).not.toHaveBeenCalled();
        clickTrack('return');
        expect(homebound).toHaveAttribute('aria-pressed', 'false');
        expect(mapMocks.easeTo).toHaveBeenLastCalledWith({ center: [-122.5, 46.5], zoom: 7, bearing: 12, pitch: 20,
            padding: { top: 10, bottom: 20, left: 30, right: 40 }, duration: reducedMotion ? 0 : 300 });
        clickTrack('morning');
        clickTrack('unassigned');
        expect(coastbound).toHaveAttribute('aria-pressed', 'false');
        expect(mapMocks.fitBounds).toHaveBeenCalledTimes(3);
        unmount();
        clickTrack('return');
        expect(mapMocks.fitBounds).toHaveBeenCalledTimes(3);
    });

    it('keeps inline day maps scoped when their background route is clicked', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap dayId="coastbound" /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const click = mapMocks.on.mock.calls.find(([event, listener]) => event === 'click' && typeof listener === 'function')?.[1];
        mapMocks.queryRenderedFeatures.mockImplementation((_point, options) => options?.layers?.includes('trip-route-halo')
            ? [{ properties: { trackId: 'return' } }] : []);
        act(() => click({ point: { x: 10, y: 10 } }));
        expect(screen.getByRole('region')).toHaveAccessibleName('Map of Coastbound.');
        expect(mapMocks.fitBounds).not.toHaveBeenCalled();
        expect(mapMocks.easeTo).not.toHaveBeenCalled();
    });

    it('links route hover to the day label and a popup without selecting or zooming', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const move = mapMocks.on.mock.calls.find(([event, layer]) => event === 'mousemove' && layer === 'trip-route-halo')?.[2];
        const leave = mapMocks.on.mock.calls.find(([event, layer]) => event === 'mouseleave' && layer === 'trip-route-halo')?.[2];
        const event = { features: [{ properties: { trackId: 'return' } }], lngLat: { lng: -123, lat: 46 } };
        act(() => move(event));
        const day = screen.getByRole('button', { name: '2. Homebound' });
        expect(day).toHaveAttribute('data-highlighted', 'true');
        expect(day).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('tooltip')).toHaveTextContent('Homebound');
        expect(day).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
        expect(mapMocks.popupPosition).toHaveBeenLastCalledWith([-123, 46]);
        expect(mapMocks.fitBounds).not.toHaveBeenCalled();
        expect(mapMocks.easeTo).not.toHaveBeenCalled();
        act(() => move({ ...event, lngLat: { lng: -123.1, lat: 46.1 } }));
        expect(mapMocks.popupCreate).toHaveBeenCalledOnce();
        expect(mapMocks.popupPosition).toHaveBeenLastCalledWith([-123.1, 46.1]);
        act(() => leave());
        expect(day).not.toHaveAttribute('data-highlighted');
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('shows a safely rendered day popup when its label is hovered', async () => {
        const title = '<img src=x onerror=alert(1)>';
        const trip = { ...dayMapManifest, days: [{ ...dayMapManifest.days![0], title }] };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={trip}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const day = screen.getByRole('button', { name: `1. ${title}` });
        fireEvent.mouseEnter(day);
        expect(screen.getByRole('tooltip')).toHaveTextContent(title);
        expect(screen.getByRole('tooltip').querySelector('img')).toBeNull();
        expect(mapMocks.popupPosition).toHaveBeenLastCalledWith([-124, 45]);
        expect(mapMocks.fitBounds).not.toHaveBeenCalled();
        fireEvent.mouseLeave(day);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('removes day hover popups for unassigned tracks and ignores callbacks from a suspended map', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        const story = (active: boolean) => <TripStoryProvider manifest={dayMapManifest}><TripRouteMap active={active} /></TripStoryProvider>;
        const { rerender } = render(story(true));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const move = mapMocks.on.mock.calls.find(([event, layer]) => event === 'mousemove' && layer === 'trip-route-halo')?.[2];
        const hover = (trackId: unknown) => move({ features: [{ properties: { trackId } }], lngLat: { lng: -123, lat: 46 } });
        act(() => hover('morning'));
        expect(screen.getByRole('tooltip')).toHaveTextContent('Coastbound');
        act(() => hover('unassigned'));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        act(() => hover(42));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        act(() => hover('morning'));
        rerender(story(false));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        act(() => hover('morning'));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(mapMocks.popupCreate).toHaveBeenCalledTimes(2);
    });

    it.each([true, false])('omits stops from base maps and their previews (day groups: %s)', async withDays => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        const trip = withDays ? dayMapManifest : { ...dayMapManifest, days: undefined };
        const story = (active: boolean) => <TripStoryProvider manifest={trip}><TripRouteMap active={active} /></TripStoryProvider>;
        const { container, rerender } = render(story(true));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const style = mapMocks.Map.mock.calls[0][0].style as StyleSpecification;
        expect(style.sources['trip-stops']).toMatchObject({ data: { features: [] } });
        for (const id of ['trip-stops', 'trip-stop-numbers']) {
            expect(style.layers.find(layer => layer.id === id)?.layout).toMatchObject({ visibility: 'none' });
        }
        expect(screen.queryByRole('checkbox', { name: 'Show stops' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Shared camp/ })).not.toBeInTheDocument();
        rerender(story(false));
        expect(container.querySelectorAll('circle')).toHaveLength(0);
        expect(screen.queryByText('Stops')).not.toBeInTheDocument();
        expect(screen.queryByText('Stops hidden')).not.toBeInTheDocument();
    });

    it('keeps a day chosen before the interactive map loads and can restore the original overview', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap initialDayId="coastbound" /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        expect(screen.getByRole('button', { name: '1. Coastbound' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(document.body);
        expect(mapMocks.easeTo).toHaveBeenCalledWith({ center: [-122.5, 46.5], zoom: 6, bearing: 0, pitch: 0, duration: 300 });
    });

    it.each([false, true])('restores the original camera after switching days and clicking away (reduced motion: %s)', async reducedMotion => {
        mapMocks.reducedMotion = reducedMotion;
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        fireEvent.click(screen.getByRole('button', { name: '1. Coastbound' }));
        fireEvent.click(screen.getByRole('button', { name: '2. Homebound' }));
        expect(mapMocks.fitBounds).toHaveBeenCalledTimes(2);
        fireEvent.click(document.body);
        expect(mapMocks.easeTo).toHaveBeenLastCalledWith({ center: [-122.5, 46.5], zoom: 7, bearing: 12, pitch: 20,
            padding: { top: 10, bottom: 20, left: 30, right: 40 }, duration: reducedMotion ? 0 : 300 });
        expect(screen.getByRole('button', { name: '2. Homebound' })).toHaveAttribute('aria-pressed', 'false');
        expect(mapMocks.Map).toHaveBeenCalledOnce();
    });

    it('places color-matched day controls below the map and emphasizes hovered tracks without zooming', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        expect(day.closest('figcaption')).not.toBeNull();
        expect(day.style.getPropertyValue('--trip-day-color')).toBe('#fbbf24');
        expect(screen.queryByRole('button', { name: 'All days' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Shared camp/ })).not.toBeInTheDocument();
        mapMocks.setData.mockClear();
        fireEvent.mouseEnter(day);
        expect(mapMocks.setPaintProperty).toHaveBeenCalledWith('trip-route-line', 'line-opacity',
            ['case', ['in', ['get', 'trackId'], ['literal', ['morning', 'afternoon']]], 1, 0.25]);
        expect(mapMocks.fitBounds).not.toHaveBeenCalled();
        expect(mapMocks.setData).not.toHaveBeenCalled();
        expect(day).toHaveAttribute('aria-pressed', 'false');
        fireEvent.mouseLeave(day);
        expect(mapMocks.setPaintProperty).toHaveBeenCalledWith('trip-route-line', 'line-opacity', 1);
        fireEvent.focus(day);
        expect(mapMocks.setPaintProperty).toHaveBeenLastCalledWith('trip-route-line', 'line-width',
            ['case', ['in', ['get', 'trackId'], ['literal', ['morning', 'afternoon']]], 6, 2]);
    });

    it.each(['day button', 'map background', 'Escape'])('restores the original camera with %s', async action => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        const { unmount } = render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        fireEvent.click(day);
        if (action === 'day button') fireEvent.click(day);
        else if (action === 'Escape') fireEvent.keyDown(day, { key: 'Escape' });
        else {
            const click = mapMocks.on.mock.calls.find(([event, listener]) => event === 'click' && typeof listener === 'function')?.[1];
            act(() => click({ point: { x: 10, y: 10 } }));
        }
        expect(day).toHaveAttribute('aria-pressed', 'false');
        expect(mapMocks.easeTo).toHaveBeenLastCalledWith({ center: [-122.5, 46.5], zoom: 7, bearing: 12, pitch: 20,
            padding: { top: 10, bottom: 20, left: 30, right: 40 }, duration: 300 });
        unmount();
        mapMocks.easeTo.mockClear();
        fireEvent.click(document.body);
        expect(mapMocks.easeTo).not.toHaveBeenCalled();
    });

    it.each([false, true])('fits the latest day after a reset during loading (reduced motion: %s)', async reducedMotion => {
        mapMocks.reducedMotion = reducedMotion;
        mapMocks.once.mockImplementation(() => undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const control = mapMocks.addControl.mock.calls.map(([control]) => control)
            .find(control => control?.constructor.name === 'RouteActionsControl');
        const reset = control.onAdd(mapMocks.Map.mock.results[0].value).querySelector('button');
        fireEvent.click(screen.getByRole('button', { name: '1. Coastbound' }));
        fireEvent.click(reset);
        fireEvent.click(screen.getByRole('button', { name: '2. Homebound' }));
        mapMocks.fitBounds.mockClear();
        act(() => { for (const [event, listener] of [...mapMocks.once.mock.calls]) if (event === 'load') listener(); });
        expect(mapMocks.fitBounds).toHaveBeenCalledWith(expect.anything(), { padding: 40, maxZoom: 11, duration: reducedMotion ? 0 : 300 });
        expect(mapMocks.LngLatBounds.mock.results.at(-1)?.value.extend).not.toHaveBeenCalledWith([-124.5, 45]);
        expect(mapMocks.LngLatBounds.mock.results.at(-1)?.value.extend).not.toHaveBeenCalledWith([-124.1, 45]);
    });

    it('uses the overview black outline for the full route behind day-scoped layers before loading', async () => {
        mapMocks.once.mockImplementation(() => undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap dayId="coastbound" /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const style = mapMocks.Map.mock.calls[0][0].style as StyleSpecification;
        const context = style.layers.find(layer => layer.id === 'trip-route-context');
        expect(style.sources['trip-route']).toMatchObject({ data: dayMapRoute });
        expect(context).not.toHaveProperty('filter');
        expect(context?.paint).toMatchObject({ 'line-color': '#09090b', 'line-width': 7, 'line-opacity': 0.85 });
        expect(context?.paint).toEqual(style.layers.find(layer => layer.id === 'trip-route-halo')?.paint);
        expect(screen.queryByText('Coastbound', { exact: true })).not.toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Map of Coastbound.' })).toBeInTheDocument();
        expect(style.layers.indexOf(context!)).toBeLessThan(style.layers.findIndex(layer => layer.id === 'trip-route-halo'));
        for (const id of ['trip-route-halo', 'trip-route-line', 'trip-route-direction']) {
            expect(style.layers.find(layer => layer.id === id)).toHaveProperty('filter',
                ['in', ['get', 'trackId'], ['literal', ['morning', 'afternoon']]]);
        }
    });

    it('retains a usable route preview and error when a failed map changes days', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        const { container } = render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const map = mapMocks.Map.mock.results[0].value;
        const fail = mapMocks.on.mock.calls.find(([event]) => event === 'error')?.[1];
        act(() => fail());
        expect(screen.getByRole('status')).toHaveTextContent('The map could not load');
        await waitFor(() => expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0));
        expect(map.remove).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('button', { name: '1. Coastbound' }));
        expect(screen.getByRole('status')).toHaveTextContent('The map could not load');
        expect(screen.getByRole('button', { name: 'Retry route' })).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Retry route' }));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '1. Coastbound' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('keeps the base map free of stops when switching days without replacing or fetching it again', async () => {
        const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute });
        vi.stubGlobal('fetch', fetch);
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        fireEvent.click(screen.getByRole('button', { name: '1. Coastbound' }));
        expect(screen.getByRole('button', { name: '1. Coastbound' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('button', { name: /^3\. Home/ })).not.toBeInTheDocument();
        expect(mapMocks.setFilter).toHaveBeenLastCalledWith('trip-route-direction', ['in', ['get', 'trackId'], ['literal', ['morning', 'afternoon']]]);
        expect(mapMocks.setData.mock.lastCall?.[0].features).toHaveLength(0);
        expect(mapMocks.Map).toHaveBeenCalledOnce();
        expect(fetch).toHaveBeenCalledOnce();
        expect(screen.queryByRole('checkbox', { name: 'Show stops' })).not.toBeInTheDocument();
        expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('trip-stops', 'visibility', 'none');
        expect(screen.queryByRole('button', { name: /Shared camp/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '1. Coastbound' }));
        expect(screen.getByRole('button', { name: '1. Coastbound' })).toHaveAttribute('aria-pressed', 'false');
        expect(mapMocks.setData.mock.lastCall?.[0].features).toHaveLength(0);
    });

    it('limits inline maps and their reset to the whole selected day', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap dayId="coastbound" /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        expect(screen.getByRole('region')).toHaveAccessibleName('Map of Coastbound.');
        expect(screen.queryByRole('group', { name: 'Map days' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^3\. Home/ })).not.toBeInTheDocument();
        expect(mapMocks.setFilter).toHaveBeenCalledWith('trip-route-line', ['in', ['get', 'trackId'], ['literal', ['morning', 'afternoon']]]);
        expect(mapMocks.setFilter).not.toHaveBeenCalledWith('trip-route-context', expect.anything());
        const control = mapMocks.addControl.mock.calls.map(([control]) => control).find(control => control?.constructor.name === 'RouteActionsControl');
        const reset = control.onAdd(mapMocks.Map.mock.results[0].value).querySelector('button');
        expect(reset).toHaveTextContent('Show whole day');
        fireEvent.click(screen.getByRole('button', { name: /Shared camp/ }));
        fireEvent.click(reset);
        expect(screen.getByRole('region')).toHaveAccessibleName('Map of Coastbound.');
        const bounds = mapMocks.LngLatBounds.mock.results.at(-1)?.value;
        expect(bounds.extend).toHaveBeenCalledWith([-124.5, 45]);
        expect(bounds.extend).not.toHaveBeenCalledWith([-120, 44]);
    });

    it.each([false, true])('applies the latest day after delayed loading (reduced motion: %s)', async (reducedMotion) => {
        mapMocks.reducedMotion = reducedMotion;
        mapMocks.once.mockImplementation(() => undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        fireEvent.click(screen.getByRole('button', { name: '1. Coastbound' }));
        fireEvent.click(screen.getByRole('button', { name: '2. Homebound' }));
        expect(mapMocks.setFilter).not.toHaveBeenCalled();
        act(() => { for (const [event, listener] of mapMocks.once.mock.calls) if (event === 'load') listener(); });
        expect(mapMocks.setFilter).toHaveBeenCalledWith('trip-route-direction', ['in', ['get', 'trackId'], ['literal', ['return']]]);
        expect(mapMocks.fitBounds).toHaveBeenLastCalledWith(expect.anything(), { padding: 40, maxZoom: 11, duration: reducedMotion ? 0 : 300 });
        expect(mapMocks.setZoom).not.toHaveBeenCalled();
        expect(mapMocks.Map).toHaveBeenCalledOnce();
    });

    it('keeps an early day reset after the map loads', async () => {
        mapMocks.once.mockImplementation(() => undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        render(<TripStoryProvider manifest={dayMapManifest}><TripRouteMap dayId="coastbound" stopId="camp" /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const control = mapMocks.addControl.mock.calls.map(([control]) => control).find(control => control?.constructor.name === 'RouteActionsControl');
        const reset = control.onAdd(mapMocks.Map.mock.results[0].value).querySelector('button');
        fireEvent.click(reset);
        act(() => { for (const [event, listener] of [...mapMocks.once.mock.calls]) if (event === 'load' || event === 'moveend') listener(); });
        expect(mapMocks.easeTo).not.toHaveBeenCalled();
        expect(reset.hidden).toBe(true);
        expect(screen.getByRole('region')).toHaveAccessibleName('Map of Coastbound.');
    });

    it('releases offscreen maps and restores the selected day, stop, and POI preference', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dayMapRoute }));
        const story = (active: boolean) => <TripStoryProvider manifest={dayMapManifest}><TripRouteMap dayId="homebound" active={active} /></TripStoryProvider>;
        const { rerender } = render(story(true));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const selectMarker = mapMocks.on.mock.calls.find(([event]) => event === 'click')?.[2];
        act(() => selectMarker({ features: [{ properties: { id: 'camp' } }] }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Show stops' }));
        const oldMap = mapMocks.Map.mock.results[0].value;
        const oldLoad = mapMocks.once.mock.calls.find(([event]) => event === 'load')?.[1];
        rerender(story(false));
        expect(oldMap.remove).toHaveBeenCalledOnce();
        expect(screen.getByRole('img')).toHaveAccessibleName('Map of Homebound.');
        act(() => oldLoad?.());
        mapMocks.easeTo.mockClear();
        rerender(story(true));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(mapMocks.easeTo).toHaveBeenCalledWith({ center: [-124.5, 45], zoom: 9 });
        const style = mapMocks.Map.mock.calls[1][0].style as StyleSpecification;
        expect(style.layers.find(layer => layer.id === 'trip-stops')?.paint).toMatchObject({
            'circle-color': ['case', ['==', ['get', 'id'], 'camp'], '#f59e0b', '#fafafa'],
        });
        expect(screen.getByRole('checkbox', { name: 'Show stops' })).not.toBeChecked();
        expect(screen.getByRole('region')).toHaveAccessibleName('Map of Homebound.');
    });

    it.each([false, true])('allows a stop selection to be reset before map load (reduced motion: %s)', async (reducedMotion) => {
        mapMocks.reducedMotion = reducedMotion;
        mapMocks.once.mockImplementation(() => undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: async () => ({
                type: 'Feature', properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        render(<TripStoryProvider manifest={{
            ...manifest, stops: [{ id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] }],
        }}><TripRouteMap stopId="camp" /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const control = mapMocks.addControl.mock.calls.map(([control]) => control)
            .find(control => control?.constructor.name === 'RouteActionsControl');
        const reset = control.onAdd(mapMocks.Map.mock.results[0].value).querySelector('button');
        expect(reset.hidden).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: /Camp/ }));
        expect(reset.hidden).toBe(false);
        fireEvent.click(reset);
        const moveEnd = mapMocks.once.mock.calls.find(([event]) => event === 'moveend')?.[1];
        act(() => moveEnd!());
        expect(reset.hidden).toBe(true);
        mapMocks.easeTo.mockClear();
        mapMocks.jumpTo.mockClear();
        act(() => {
            for (const [event, listener] of mapMocks.once.mock.calls) if (event === 'load') listener();
        });
        expect(mapMocks.setZoom).not.toHaveBeenCalled();
        expect(mapMocks.easeTo).not.toHaveBeenCalled();
        expect(mapMocks.jumpTo).not.toHaveBeenCalled();
        expect(reset.hidden).toBe(true);
        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it.each([false, true])('does not restore the initial stop after an early reset (reduced motion: %s)', async (reducedMotion) => {
        mapMocks.reducedMotion = reducedMotion;
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: async () => ({
                type: 'Feature', properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        mapMocks.once.mockImplementation(() => undefined);
        render(<TripStoryProvider manifest={{
            ...manifest, stops: [{ id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] }],
        }}><TripRouteMap stopId="camp" /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const control = mapMocks.addControl.mock.calls
            .map(([control]) => control)
            .find(control => control?.constructor.name === 'RouteActionsControl');
        const map = mapMocks.Map.mock.results[0].value;
        const reset = control.onAdd(map).querySelector('button');
        expect(reset.hidden).toBe(false);
        fireEvent.click(reset);
        expect(mapMocks.fitBounds).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
            padding: 40, maxZoom: 11, bearing: 0, pitch: 0, duration: reducedMotion ? 0 : 300,
        });
        const moveEnd = mapMocks.once.mock.calls.find(([event]) => event === 'moveend')?.[1];
        expect(moveEnd).toEqual(expect.any(Function));
        act(() => moveEnd!());
        expect(reset.hidden).toBe(true);
        act(() => {
            for (const [event, listener] of mapMocks.once.mock.calls) if (event === 'load') listener();
        });
        expect(mapMocks.easeTo).not.toHaveBeenCalled();
        expect(mapMocks.jumpTo).not.toHaveBeenCalled();
        expect(reset.hidden).toBe(true);
        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'false');
        const move = mapMocks.on.mock.calls.find(([event]) => event === 'move')?.[1];
        expect(move).toEqual(expect.any(Function));
        act(() => move!());
        expect(reset.hidden).toBe(false);
        control.onRemove();
        expect(mapMocks.off).toHaveBeenCalledWith('load', expect.any(Function));
        expect(mapMocks.off).toHaveBeenCalledWith('move', move);
        expect(mapMocks.off).toHaveBeenCalledWith('moveend', moveEnd);
    });

    it.each([false, true])('retains a user-selected stop after track replacement (reduced motion: %s)', async (reducedMotion) => {
        mapMocks.reducedMotion = reducedMotion;
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: async () => ({
                type: 'Feature', properties: { trackId: 'return' },
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        const tripManifest: TripManifest = {
            ...manifest, stops: [
                { id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] },
                { id: 'finish', name: 'Finish', coordinates: [-123, 46] },
            ],
        };
        const story = (trackId?: string) => <TripStoryProvider manifest={tripManifest}>
            <TripRouteMap stopId="camp" trackId={trackId} />
        </TripStoryProvider>;
        const { rerender } = render(story());
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
        mapMocks.easeTo.mockClear();
        mapMocks.jumpTo.mockClear();
        mapMocks.once.mockClear();
        mapMocks.once.mockImplementation(() => undefined);
        rerender(story('return'));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(mapMocks.easeTo).not.toHaveBeenCalled();
        expect(mapMocks.jumpTo).not.toHaveBeenCalled();
        act(() => {
            for (const [event, listener] of mapMocks.once.mock.calls) if (event === 'load') listener();
        });
        const camera = reducedMotion ? mapMocks.jumpTo : mapMocks.easeTo;
        expect(camera).toHaveBeenCalledExactlyOnceWith({ center: [-123, 46], zoom: 9 });
        expect(screen.getByRole('button', { name: /Finish/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'false');
    });

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
        const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
        vi.stubGlobal('fetch', fetch);
        render(<TripStoryProvider manifest={manifest}><TripRouteMap /></TripStoryProvider>);
        await screen.findByText('Route request failed with 503');
        expect(screen.getByRole('link', { name: 'Download route (GeoJSON)' })).toHaveAttribute('href', manifest.route.geoJson);
        expect(mapMocks.Map).not.toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledOnce();
    });

    it('does not paint a replacement map before its own load event', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: async () => ({
                type: 'Feature', properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            })
        }));
        const stops = [{ id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] as [number, number] }];
        const { rerender } = render(<TripStoryProvider manifest={{ ...manifest, stops }}><TripRouteMap stopId="camp" /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.setPaintProperty).toHaveBeenCalledWith('trip-stops', 'circle-radius', expect.anything()));
        mapMocks.once.mockImplementation(() => undefined);
        mapMocks.setPaintProperty.mockClear();
        mapMocks.once.mockClear();
        rerender(<TripStoryProvider manifest={{ ...manifest, stops, route: { geoJson: '/second.geojson' } }}><TripRouteMap stopId="camp" /></TripStoryProvider>);
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

    it.each(['track', 'stops'] as const)('discards an old map error when %s replacement uses the same route URL', async (replacement) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: async () => ({
                type: 'Feature', properties: { trackId: 'return' },
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        const { rerender } = render(<TripStoryProvider manifest={manifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const fail = mapMocks.on.mock.calls.find(([event]) => event === 'error')?.[1];
        act(() => fail());
        expect(screen.getByText(/The map could not load/)).toBeInTheDocument();
        rerender(<TripStoryProvider manifest={replacement === 'stops' ? {
            ...manifest, stops: [{ id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] }],
        } : manifest}><TripRouteMap trackId={replacement === 'track' ? 'return' : undefined} /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(screen.queryByText(/The map could not load/)).not.toBeInTheDocument();
        expect(screen.getByRole('region')).toBeInTheDocument();
        const nextFail = mapMocks.on.mock.calls.filter(([event]) => event === 'error').at(-1)?.[1];
        act(() => nextFail());
        expect(screen.getByText(/The map could not load/)).toBeInTheDocument();
    });

    it('retries a failed map with a fresh route and removes the previous instance', async () => {
        const fetchRoute = vi.fn().mockResolvedValue({
            ok: true, json: async () => ({
                type: 'Feature', properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        });
        vi.stubGlobal('fetch', fetchRoute);
        render(<TripStoryProvider manifest={manifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const previousMap = mapMocks.Map.mock.results[0].value;
        const fail = mapMocks.on.mock.calls.find(([event]) => event === 'error')?.[1];
        act(() => fail());
        fireEvent.click(screen.getByRole('button', { name: 'Retry route' }));
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(2));
        expect(previousMap.remove).toHaveBeenCalledOnce();
        expect(fetchRoute).toHaveBeenCalledTimes(2);
        expect(screen.queryByText(/The map could not load/)).not.toBeInTheDocument();
        expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('reports a missing track without creating an unusable map', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: async () => ({
                type: 'Feature', properties: { trackId: 'outbound' },
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        render(<TripStoryProvider manifest={manifest}><TripRouteMap trackId="missing" /></TripStoryProvider>);
        expect(await screen.findByText('Route does not contain track "missing".')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Download route (GeoJSON)' })).toHaveAttribute('href', manifest.route.geoJson);
        expect(mapMocks.Map).not.toHaveBeenCalled();
    });

    it('starts attribution collapsed even when the base control opens it', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, json: async () => ({
                type: 'Feature', properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        render(<TripStoryProvider manifest={manifest}><TripRouteMap /></TripStoryProvider>);
        await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledOnce());
        const control = mapMocks.addControl.mock.calls.map(([control]) => control)
            .find(control => control?.constructor.name === 'CollapsedAttributionControl');
        const attribution = control.onAdd(mapMocks.Map.mock.results[0].value);
        expect(attribution).toHaveClass('maplibregl-compact');
        expect(attribution).not.toHaveClass('maplibregl-compact-show');
        expect(attribution).not.toHaveAttribute('open');
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
        const host = document.createElement('div');
        host.append(downloadControl.onAdd());
        downloadControl.onRemove();
        expect(host).toBeEmptyDOMElement();

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

        expect(screen.queryByRole('button', { name: /Finish/ })).not.toBeInTheDocument();
        expect(mapMocks.setData.mock.lastCall?.[0].features).toHaveLength(0);
    });

    it('clears a selected stop when another route loads', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                type: 'Feature', properties: {},
                geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46]] },
            }),
        }));
        const stops: TripManifest['stops'] = [
            { id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] },
            { id: 'finish', name: 'Finish', coordinates: [-123, 46] },
        ];
        const { rerender } = render(
            <TripStoryProvider manifest={{ ...manifest, stops }}><TripRouteMap stopId="finish" /></TripStoryProvider>,
        );
        // This scenario starts after the requested stop has finished its initial focus.
        await waitFor(() => expect(mapMocks.easeTo).toHaveBeenLastCalledWith({ center: [-123, 46], zoom: 9 }));
        const selectMarker = mapMocks.on.mock.calls.find(([event]) => event === 'click')?.[2];
        act(() => selectMarker({ features: [{ properties: { id: 'camp' } }] }));
        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'true');
        expect(mapMocks.easeTo).toHaveBeenLastCalledWith({ center: [-122.5, 46.5], zoom: 9 });
        act(() => selectMarker({ features: [{ properties: { id: 42 } }] }));
        expect(screen.getByRole('button', { name: /Camp/ })).toHaveAttribute('aria-pressed', 'true');

        rerender(<TripStoryProvider manifest={{ ...manifest, stops, route: { geoJson: '/second.geojson' } }}>
            <TripRouteMap stopId="finish" />
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
                stops: [
                    { id: 'camp', name: 'Camp', coordinates: [-122.5, 46.5] },
                    { id: 'finish', name: 'Finish', coordinates: [-123, 46] },
                ],
            }}>
                <TripRouteMap stopId="finish" />
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
        const markerLeave = mapMocks.on.mock.calls.find(([event]) => event === 'mouseleave')?.[2];
        fireEvent.mouseLeave(description);
        act(() => markerEnter({ features: [{ properties: { id: 'camp' } }] }));
        expect(description).toHaveClass('bg-amber-400', 'text-zinc-950');
        act(() => markerLeave());
        expect(description).not.toHaveClass('bg-amber-400');
    });
});
