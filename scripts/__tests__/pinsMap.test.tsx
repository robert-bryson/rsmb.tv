import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PinsMap } from '../../src/features/pins/PinsMap';
import { BACKGROUND_CLICK_DELAY_MS, createPinsRenderer, POINT_SOURCE_TIMEOUT_MS } from '../../src/features/pins/mapRenderer';
import { pinPoints } from '../../src/features/pins/geometry';
import type { PinsMapProps } from '../../src/features/pins/types';
import { colorado, fallsChurch, national, publishedPins } from './pinsFixtures';

const mocks = vi.hoisted(() => {
    class MapStub {
        static instances: MapStub[] = [];
        static fail = false;
        static failCanvas = false;
        handlers = new Map<string, Set<(event: unknown) => void>>();
        sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
        layers = new Map<string, unknown>();
        canvas = document.createElement('canvas');
        loaded = true;
        features: Array<{ layer: { id: string }; properties: { id: string }; geometry?: { type: 'Point'; coordinates: number[] } }> = [];
        getContainer: () => HTMLElement;
        style: unknown;
        constructor(options: { container: HTMLElement; style: unknown }) {
            if (MapStub.fail) throw new Error('no WebGL');
            MapStub.instances.push(this);
            this.getContainer = () => options.container;
            options.container.append(this.canvas);
            this.style = options.style;
        }
        on(name: string, callback: (event: unknown) => void) {
            if (!this.handlers.has(name)) this.handlers.set(name, new Set());
            this.handlers.get(name)!.add(callback);
        }
        off(name: string, callback: (event: unknown) => void) { this.handlers.get(name)?.delete(callback); }
        emit(name: string, event: unknown = {}) { for (const callback of this.handlers.get(name) ?? []) callback(event); }
        getCanvas = () => { if (MapStub.failCanvas) throw new Error('canvas failed'); return this.canvas; };
        addControl = vi.fn();
        addSource = vi.fn((id: string) => this.sources.set(id, { setData: vi.fn() }));
        getSource = (id: string) => this.sources.get(id);
        addLayer = vi.fn((layer: { id: string }) => this.layers.set(layer.id, layer));
        getLayer = (id: string) => this.layers.get(id);
        getStyle = () => ({ sources: { background: {} } });
        isSourceLoaded = () => this.loaded;
        setStyle = vi.fn((style: unknown) => { this.style = style; this.sources.clear(); this.layers.clear(); this.emit('style.load'); });
        setLayoutProperty = vi.fn();
        setProjection = vi.fn();
        setSky = vi.fn();
        setFilter = vi.fn();
        fitBounds = vi.fn();
        flyTo = vi.fn();
        resize = vi.fn();
        remove = vi.fn(() => this.handlers.clear());
        getZoom = () => 8;
        getCenter = () => ({ lng: -100 });
        getBounds = () => ({ getWest: () => -180, getEast: () => 180, getSouth: () => -85, getNorth: () => 85 });
        project = ([lng, lat]: number[]) => ({ x: lng + 180, y: 90 - lat });
        unproject = ({ x, y }: { x: number; y: number }) => ({ lng: x - 180, lat: 90 - y });
        queryRenderedFeatures = vi.fn((_point: unknown, options: { layers: string[] }) => this.features.filter(feature => options.layers.includes(feature.layer.id)));
    }
    class PopupStub {
        static instances: PopupStub[] = [];
        content: HTMLElement | null = null;
        visible = false;
        constructor() { PopupStub.instances.push(this); }
        remove = vi.fn(() => { this.visible = false; });
        setLngLat() { return this; }
        setDOMContent(content: HTMLElement) { this.content = content; return this; }
        addTo() { this.visible = true; return this; }
    }
    return { MapStub, PopupStub };
});
vi.mock('../../src/maps/maplibre', async importOriginal => ({
    ...await importOriginal<typeof import('../../src/maps/maplibre')>(), Map: mocks.MapStub, Popup: mocks.PopupStub,
}));

const empty = { type: 'FeatureCollection' as const, features: [] };
function props(overrides: Partial<PinsMapProps> = {}): PinsMapProps {
    return { pins: [national, colorado, fallsChurch], states: null, counties: null, stateFips: '', showCounties: false,
        circles: true, zoom: 3, selected: null, view: null, unit: 'mi', reducedMotion: true, dataState: 'ready',
        onSelect: vi.fn(), onZoom: vi.fn(), ...overrides };
}
let frames: Map<number, FrameRequestCallback>;
const flushFrames = () => act(() => {
    const pending = [...frames.values()]; frames.clear();
    for (const frame of pending) frame(0);
});
const map = () => mocks.MapStub.instances.at(-1)!;

beforeEach(() => {
    vi.useFakeTimers(); frames = new Map(); let nextFrame = 0;
    mocks.MapStub.instances = []; mocks.PopupStub.instances = []; mocks.MapStub.fail = false; mocks.MapStub.failCanvas = false;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = vi.fn(); });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('map lifecycle', () => {
    it('draws context below active pins and preserves layer switches for muted features', () => {
        const current = props({ selected: colorado });
        const view = render(<PinsMap {...current} />); flushFrames();
        act(() => map().emit('style.load'));
        const order = [...map().layers.keys()];
        for (const active of ['country-pins', 'state-pins', 'county-pins', 'selected-pin']) {
            expect(order.indexOf('context-pins')).toBeLessThan(order.indexOf(active));
        }
        view.rerender(<PinsMap {...current} showRegions={false} showCounties={false} />);
        expect(map().setFilter).toHaveBeenCalledWith('context-pins', ['all', ['==', ['get', 'context'], true],
            ['!=', ['get', 'level'], 'county'], ['!=', ['get', 'level'], 'state']]);
    });
    it('keeps the selected point below controls when the narrow map center would be obscured', () => {
        render(<main><div className="pins-map-tools" /><PinsMap {...props({ selected: fallsChurch, view: { key: 1, bounds: fallsChurch.bounds } })} /></main>);
        flushFrames();
        const canvas = screen.getByTestId('pins-map');
        Object.defineProperties(canvas, { clientWidth: { value: 320 }, clientHeight: { value: 400 } });
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 320, 400));
        vi.spyOn(document.querySelector('.pins-map-tools')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(12, 12, 236, 198));
        act(() => map().emit('style.load'));
        expect(map().fitBounds.mock.calls[0][1].padding.top).toBe(226);
    });

    it('moves up when clicking a sibling polygon but allows direct selection of its marker', () => {
        const fairfax = publishedPins.pins.find(pin => pin.id === 'county-51059')!;
        const current = props({ pins: [national, fallsChurch, fairfax], selected: fallsChurch, stateFips: '51', showCounties: true, onNavigateUp: vi.fn() });
        render(<PinsMap {...current} />); flushFrames();
        act(() => { map().emit('style.load'); map().emit('render'); });
        map().features = [{ layer: { id: 'county-fill' }, properties: { id: fallsChurch.id } }];
        act(() => { map().emit('click', { point: { x: 1, y: 1 } }); vi.advanceTimersByTime(BACKGROUND_CLICK_DELAY_MS); });
        expect(current.onNavigateUp).not.toHaveBeenCalled();
        expect(current.onSelect).not.toHaveBeenCalled();
        map().features = [{ layer: { id: 'county-fill' }, properties: { id: fairfax.id } }];
        act(() => { map().emit('click', { point: { x: 1, y: 1 } }); vi.advanceTimersByTime(BACKGROUND_CLICK_DELAY_MS); });
        expect(current.onNavigateUp).toHaveBeenCalledOnce();
        expect(current.onSelect).not.toHaveBeenCalled();
        map().features = [{ layer: { id: 'county-pins' }, properties: { id: fairfax.id } }];
        act(() => map().emit('click', { point: { x: 1, y: 1 } }));
        expect(current.onSelect).toHaveBeenCalledWith(fairfax.id);
    });
    it('navigates up on empty map clicks and cancels pending clicks for zoom gestures and changed locations', () => {
        const current = props({ onNavigateUp: vi.fn(), navigationKey: 'USA:08:state-08', selected: colorado });
        const view = render(<PinsMap {...current} />); flushFrames();
        act(() => { map().emit('style.load'); map().emit('render'); });
        const click = () => map().emit('click', { point: { x: 10, y: 10 } });
        act(() => { click(); vi.advanceTimersByTime(BACKGROUND_CLICK_DELAY_MS - 1); });
        expect(current.onNavigateUp).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(current.onNavigateUp).toHaveBeenCalledOnce();
        for (const gesture of ['dblclick', 'movestart', 'mousedown', 'touchstart']) {
            act(() => { click(); map().emit(gesture); vi.advanceTimersByTime(BACKGROUND_CLICK_DELAY_MS); });
        }
        act(() => { click(); fireEvent.keyDown(document, { key: 'Escape' }); vi.advanceTimersByTime(BACKGROUND_CLICK_DELAY_MS); });
        expect(current.onNavigateUp).toHaveBeenCalledOnce();
        act(click);
        view.rerender(<PinsMap {...current} navigationKey="CAN::" />);
        act(() => vi.advanceTimersByTime(BACKGROUND_CLICK_DELAY_MS));
        expect(current.onNavigateUp).toHaveBeenCalledOnce();
        act(click);
        view.unmount();
        act(() => vi.advanceTimersByTime(BACKGROUND_CLICK_DELAY_MS));
        expect(current.onNavigateUp).toHaveBeenCalledOnce();
    });

    it('leaves controls, modified clicks, loading maps, and double-clicks out of background navigation', () => {
        const current = props({ onNavigateUp: vi.fn() });
        const view = render(<PinsMap {...current} />); flushFrames();
        act(() => { map().emit('style.load'); map().emit('render'); });
        const prevented = new MouseEvent('click', { cancelable: true });
        prevented.preventDefault();
        for (const originalEvent of [prevented, ...['ctrlKey', 'metaKey', 'shiftKey', 'altKey'].map(key => new MouseEvent('click', { [key]: true })), new MouseEvent('click', { button: 2 }), new MouseEvent('click', { detail: 2 })]) {
            act(() => map().emit('click', { point: { x: 10, y: 10 }, originalEvent }));
        }
        const control = document.createElement('button');
        control.addEventListener('click', originalEvent => map().emit('click', { point: { x: 10, y: 10 }, originalEvent }));
        fireEvent.click(control);
        view.rerender(<PinsMap {...current} dataState="loading" />);
        act(() => { map().emit('click', { point: { x: 10, y: 10 } }); vi.advanceTimersByTime(BACKGROUND_CLICK_DELAY_MS); });
        expect(current.onNavigateUp).not.toHaveBeenCalled();
    });

    it('uses larger touch targets and chooses the closest marker over an already selected marker', () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        const current = props({ selected: colorado, onNavigateUp: vi.fn() });
        render(<PinsMap {...current} />); flushFrames();
        act(() => { map().emit('style.load'); map().emit('render'); });
        map().features = [
            { layer: { id: 'selected-pin' }, properties: { id: colorado.id }, geometry: { type: 'Point', coordinates: [colorado.lng, colorado.lat] } },
            { layer: { id: 'country-pins' }, properties: { id: national.id }, geometry: { type: 'Point', coordinates: [national.lng, national.lat] } },
        ];
        const point = map().project([national.lng, national.lat]);
        act(() => map().emit('click', { point }));
        expect(current.onSelect).toHaveBeenCalledWith(national.id);
        expect(map().queryRenderedFeatures).toHaveBeenLastCalledWith([[point.x - 22, point.y - 22], [point.x + 22, point.y + 22]], expect.anything());
        act(() => vi.advanceTimersByTime(BACKGROUND_CLICK_DELAY_MS));
        expect(current.onNavigateUp).not.toHaveBeenCalled();
    });

    it('prefers an active marker when a context marker occupies the same position', () => {
        const current = props();
        render(<PinsMap {...current} />); flushFrames();
        act(() => { map().emit('style.load'); map().emit('render'); });
        const geometry = { type: 'Point' as const, coordinates: [colorado.lng, colorado.lat] };
        map().features = [
            { layer: { id: 'context-pins' }, properties: { id: national.id }, geometry },
            { layer: { id: 'state-pins' }, properties: { id: colorado.id }, geometry },
        ];
        act(() => map().emit('click', { point: map().project([colorado.lng, colorado.lat]) }));
        expect(current.onSelect).toHaveBeenCalledWith(colorado.id);
    });

    it('reserves spoke measurements for selection while retaining muted point context', () => {
        render(<PinsMap {...props({ selected: colorado, zoom: 16, showCounties: true })} />); flushFrames();
        act(() => { map().emit('style.load'); map().emit('render'); });
        const points = map().sources.get('pin-points')!.setData.mock.calls[0][0].features;
        expect(points.map((feature: { properties: { id: string; context: boolean } }) => [feature.properties.id, feature.properties.context]))
            .toEqual([[national.id, true], [colorado.id, false], [fallsChurch.id, true]]);
        const radii = map().sources.get('pin-radii')!.setData.mock.calls[0][0].features;
        expect(radii.length).toBeGreaterThan(0);
        expect(radii.every((feature: { properties: { pinId: string } }) => feature.properties.pinId === colorado.id)).toBe(true);
    });
    it('keeps CARTO on a globe through background failure and recovery', () => {
        render(<PinsMap {...props()} />); flushFrames();
        const renderer = map();
        act(() => { renderer.emit('style.load'); renderer.emit('render'); });
        expect(renderer.setProjection).toHaveBeenLastCalledWith({ type: 'globe' });
        expect(renderer.setSky).toHaveBeenLastCalledWith(expect.objectContaining({ 'atmosphere-blend': 0.8 }));
        act(() => { renderer.emit('error', { error: { message: 'tile unavailable' } }); renderer.emit('render'); });
        expect(renderer.setProjection).toHaveBeenCalledTimes(2);
        fireEvent.click(screen.getByRole('button', { name: 'Retry background' }));
        expect(renderer.setProjection).toHaveBeenCalledTimes(3);
        expect(renderer.setProjection).toHaveBeenLastCalledWith({ type: 'globe' });
        expect(renderer.sources.get('pin-points')!.setData.mock.calls[0][0].features).toHaveLength(3);
    });

    it('frames the world as a sphere rather than fitting the date-line seam', () => {
        render(<PinsMap {...props({ view: { key: 1, bounds: [-180, -60, 180, 83] } })} />); flushFrames();
        Object.defineProperty(screen.getByTestId('pins-map'), 'clientHeight', { value: 640 });
        Object.defineProperty(screen.getByTestId('pins-map'), 'clientWidth', { value: 900 });
        act(() => map().emit('style.load'));
        expect(map().fitBounds).not.toHaveBeenCalled();
        expect(map().flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [0, 20], duration: 0, pitch: 0, bearing: 0 }));
        expect(map().flyTo.mock.calls[0][0].zoom).toBeGreaterThan(1);
        expect(map().flyTo.mock.calls[0][0].zoom).toBeLessThan(2);
    });

    it('cancels startup before unmount and cleans up a mounted renderer', () => {
        const first = render(<PinsMap {...props()} />);
        first.unmount(); flushFrames();
        expect(mocks.MapStub.instances).toHaveLength(0);
        const second = render(<PinsMap {...props()} />); flushFrames();
        const mounted = map();
        expect(mounted.style).toMatch(/^https:\/\/basemaps\.cartocdn\.com\/gl\/dark-matter-gl-style\/style\.json(?:\?key=.+)?$/);
        act(() => mounted.emit('style.load'));
        expect(mounted.sources.size).toBe(6);
        expect(screen.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'loading');
        act(() => mounted.emit('render'));
        expect(screen.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'ready');
        const popup = mocks.PopupStub.instances.at(-1)!;
        second.unmount();
        popup.remove.mockClear();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(popup.remove).not.toHaveBeenCalled();
        expect(mounted.remove).toHaveBeenCalledOnce();
        expect(mounted.handlers.size).toBe(0);
        expect(frames.size).toBe(0);
    });

    it('offers retry after constructor failure and preserves data error status', () => {
        mocks.MapStub.fail = true;
        const view = render(<PinsMap {...props()} />); flushFrames();
        expect(screen.getByRole('alert')).toHaveTextContent('could not start');
        mocks.MapStub.fail = false;
        fireEvent.click(screen.getByRole('button', { name: 'Retry map' })); flushFrames();
        act(() => { map().emit('style.load'); map().emit('render'); });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        view.rerender(<PinsMap {...props({ dataState: 'error' })} />);
        expect(screen.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'error');
    });

    it.each([
        ['webglcontextlost', {}], ['error', { error: { message: 'Worker failed to initialize' } }],
        ['error', { sourceId: 'pin-points', error: { message: 'invalid GeoJSON' } }],
    ])('recovers a %s failure without losing selection or fullscreen state', (event, detail) => {
        const current = props({ selected: colorado });
        const view = render(<main><PinsMap {...current} /></main>); flushFrames();
        const original = map();
        act(() => original.emit('style.load'));
        view.container.querySelector('main')!.classList.add('maplibregl-pseudo-fullscreen');
        const control = original.addControl.mock.calls[1][0];
        act(() => original.emit(event, detail));
        expect(screen.getByRole('alert')).toBeVisible();
        // A restored graphics event is insufficient proof that source data can render.
        act(() => original.emit('webglcontextrestored'));
        expect(screen.getByRole('alert')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Retry map' })); flushFrames();
        expect(original.remove).toHaveBeenCalledOnce();
        expect(map().addControl.mock.calls[1][0]).toBe(control);
        act(() => { map().emit('style.load'); map().emit('render'); });
        expect(map().setFilter).toHaveBeenCalledWith('selected-pin', ['==', ['get', 'id'], colorado.id]);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it.each([false, true])('reports a worker that stalls before source readiness (style loaded: %s)', styleLoaded => {
        render(<PinsMap {...props()} />); flushFrames(); map().loaded = false;
        if (styleLoaded) act(() => map().emit('style.load'));
        act(() => vi.advanceTimersByTime(POINT_SOURCE_TIMEOUT_MS + 1));
        expect(screen.getByRole('button', { name: 'Retry map' })).toBeVisible();
    });

    it('does not time out while pin data is loading or after source readiness', () => {
        const view = render(<PinsMap {...props({ pins: [], dataState: 'loading' })} />); flushFrames();
        act(() => { map().emit('style.load'); vi.advanceTimersByTime(POINT_SOURCE_TIMEOUT_MS * 2); });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        view.rerender(<PinsMap {...props()} />);
        act(() => { map().emit('sourcedata'); vi.advanceTimersByTime(POINT_SOURCE_TIMEOUT_MS * 2); });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('waits for replacement pin batches and reports a later stalled worker', () => {
        const current = props();
        const view = render(<PinsMap {...current} />); flushFrames();
        act(() => { map().emit('style.load'); map().emit('render'); });
        expect(screen.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'ready');
        map().loaded = false;
        view.rerender(<PinsMap {...current} pins={[colorado]} />);
        expect(screen.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'loading');
        act(() => map().emit('sourcedata'));
        expect(screen.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'loading');
        map().loaded = true;
        act(() => map().emit('render'));
        expect(screen.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'ready');
        map().loaded = false;
        view.rerender(<PinsMap {...current} pins={[national]} />);
        act(() => vi.advanceTimersByTime(POINT_SOURCE_TIMEOUT_MS + 1));
        expect(screen.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'error');
        expect(screen.getByRole('button', { name: 'Retry map' })).toBeVisible();
    });

    it.each(['mouseleave', 'Escape', 'movestart'])('dismisses a hovered pin on %s and can show it again', event => {
        render(<PinsMap {...props()} />); flushFrames();
        act(() => map().emit('style.load'));
        map().features = [{ layer: { id: 'state-pins' }, properties: { id: colorado.id } }];
        act(() => map().emit('mousemove', { point: { x: 1, y: 1 } }));
        const popup = mocks.PopupStub.instances.at(-1)!;
        expect(popup.visible).toBe(true);
        if (event === 'Escape') {
            fireEvent.keyDown(document, { key: 'ArrowLeft' });
            expect(popup.visible).toBe(true);
            fireEvent.keyDown(document, { key: 'Escape' });
        }
        else if (event === 'mouseleave') {
            fireEvent.mouseLeave(map().canvas);
            expect(popup.visible).toBe(true);
            fireEvent.mouseLeave(map().getContainer());
        }
        else act(() => map().emit(event));
        expect(popup.visible).toBe(false);
        act(() => map().emit('mousemove', { point: { x: 1, y: 1 } }));
        expect(popup.visible).toBe(true);
    });

    it('removes stale hover details when the country or units change', () => {
        const current = props();
        const view = render(<PinsMap {...current} />); flushFrames();
        act(() => map().emit('style.load'));
        map().features = [{ layer: { id: 'state-pins' }, properties: { id: colorado.id } }];
        act(() => map().emit('mousemove', { point: { x: 1, y: 1 } }));
        const popup = mocks.PopupStub.instances.at(-1)!;
        expect(popup.visible).toBe(true);
        view.rerender(<PinsMap {...current} pins={[national]} />);
        expect(popup.visible).toBe(false);
        view.rerender(<PinsMap {...current} />);
        act(() => map().emit('mousemove', { point: { x: 1, y: 1 } }));
        expect(popup.visible).toBe(true);
        view.rerender(<PinsMap {...current} unit="km" />);
        expect(popup.visible).toBe(false);
        act(() => map().emit('mousemove', { point: { x: 1, y: 1 } }));
        expect(popup.content).toHaveTextContent('km');
    });

    it('rebuilds data after a background failure and retries only the background', () => {
        render(<PinsMap {...props()} />); flushFrames();
        act(() => { map().emit('style.load'); map().emit('render'); map().emit('error', { error: { message: 'tile unavailable' } }); });
        expect(screen.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'loading');
        act(() => map().emit('render'));
        expect(screen.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'degraded');
        const restored = map().sources.get('pin-points')!;
        expect(restored.setData.mock.calls[0][0].features).toHaveLength(3);
        const renderer = map();
        fireEvent.click(screen.getByRole('button', { name: 'Retry background' }));
        expect(map()).toBe(renderer);
        expect(renderer.setStyle).toHaveBeenCalledTimes(2);
        expect(renderer.setStyle.mock.calls.at(-1)![0]).toMatch(/^https:\/\/basemaps\.cartocdn\.com\/gl\/dark-matter-gl-style\/style\.json(?:\?key=.+)?$/);
        act(() => renderer.emit('render'));
        expect(screen.queryByRole('button', { name: 'Retry background' })).not.toBeInTheDocument();
    });

    it('updates source data and filters without duplicate writes or repeated camera moves', () => {
        const current = props({ view: { key: 1, bounds: colorado.bounds } });
        const view = render(<PinsMap {...current} />); flushFrames();
        Object.defineProperty(screen.getByTestId('pins-map'), 'clientHeight', { value: 100 });
        Object.defineProperty(screen.getByTestId('pins-map'), 'clientWidth', { value: 160 });
        act(() => map().emit('style.load'));
        expect(map().fitBounds.mock.calls[0][1].padding).toEqual({ top: 25, right: 40, bottom: 25, left: 40 });
        const source = map().sources.get('pin-points')!;
        view.rerender(<PinsMap {...current} unit="km" showCounties />);
        expect(source.setData).toHaveBeenCalledOnce();
        expect(map().fitBounds).toHaveBeenCalledOnce();
        expect(map().setLayoutProperty).toHaveBeenCalledWith('county-pins', 'visibility', 'visible');
        view.rerender(<PinsMap {...current} stateFips="08" selected={colorado} />);
        const points = source.setData.mock.calls.at(-1)![0].features;
        expect(points).toHaveLength(2);
        expect(points.find((feature: { properties: { id: string } }) => feature.properties.id === national.id).properties.context).toBe(true);
        expect(points.find((feature: { properties: { id: string } }) => feature.properties.id === colorado.id).properties.context).toBe(false);
        expect(map().setFilter).toHaveBeenCalledWith('state-fill', ['==', ['get', 'stateFips'], '08']);
    });

    it('prioritizes pins over underlying polygons and renders safe, current tooltip text', () => {
        const current = props();
        const view = render(<PinsMap {...current} />); flushFrames();
        act(() => { map().emit('style.load'); map().emit('render'); });
        map().features = [
            { layer: { id: 'state-fill' }, properties: { id: colorado.id } },
            { layer: { id: 'country-pins' }, properties: { id: national.id } },
        ];
        act(() => map().emit('click', { point: { x: 1, y: 1 } }));
        expect(current.onSelect).toHaveBeenCalledWith(national.id);
        act(() => map().emit('mousemove', { point: { x: 1, y: 1 } }));
        const popup = mocks.PopupStub.instances.at(-1)!;
        expect(popup.content).toHaveTextContent('678.2 mi');
        view.rerender(<PinsMap {...current} unit="km" />);
        act(() => map().emit('mousemove', { point: { x: 1, y: 1 } }));
        expect(popup.content).toHaveTextContent('1,091.5 km');
        map().features = [{ layer: { id: 'county-pins' }, properties: { id: fallsChurch.id } }];
        view.rerender(<PinsMap {...current} pins={[{ ...fallsChurch, name: '<img src=x onerror=alert(1)>' }]} />);
        act(() => map().emit('mousemove', { point: { x: 1, y: 1 } }));
        expect(popup.content?.querySelector('img')).toBeNull();
        expect(popup.content).toHaveTextContent('<img src=x onerror=alert(1)>, VA');
        map().features = [];
        act(() => map().emit('mousemove', { point: { x: 1, y: 1 } }));
        expect(map().canvas.style.cursor).toBe('');
    });

    it('removes a partially initialized map when control setup throws', () => {
        mocks.MapStub.failCanvas = true;
        const container = document.createElement('div');
        expect(() => createPinsRenderer({ container, overlay: document.createElement('div'), previousFullscreen: null,
            getProps: () => props(), getData: () => ({ points: pinPoints([colorado]), circles: empty, selection: empty, radii: empty }),
            onError: vi.fn(), onBasemapState: vi.fn(), onLoading: vi.fn(), onReady: vi.fn() })).toThrow('canvas failed');
        expect(map().remove).toHaveBeenCalledOnce();
    });
});
