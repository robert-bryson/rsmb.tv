import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PinsMap } from '../../src/features/pins/PinsMap';
import { createPinsRenderer, POINT_SOURCE_TIMEOUT_MS } from '../../src/features/pins/mapRenderer';
import { pinPoints } from '../../src/features/pins/geometry';
import type { PinsMapProps } from '../../src/features/pins/types';
import { colorado, fallsChurch, national } from './pinsFixtures';

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
        features: Array<{ layer: { id: string }; properties: { id: string } }> = [];
        getContainer: () => HTMLElement;
        style: unknown;
        constructor(options: { container: HTMLElement; style: unknown }) {
            if (MapStub.fail) throw new Error('no WebGL');
            MapStub.instances.push(this);
            this.getContainer = () => options.container;
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
        setFilter = vi.fn();
        fitBounds = vi.fn();
        resize = vi.fn();
        remove = vi.fn(() => this.handlers.clear());
        getZoom = () => 8;
        getCenter = () => ({ lng: -100 });
        getBounds = () => ({ getWest: () => -180, getEast: () => 180, getSouth: () => -85, getNorth: () => 85 });
        project = ([lng, lat]: number[]) => ({ x: lng + 180, y: 90 - lat });
        queryRenderedFeatures = vi.fn((_point: unknown, options: { layers: string[] }) => this.features.filter(feature => options.layers.includes(feature.layer.id)));
    }
    class PopupStub {
        static instances: PopupStub[] = [];
        content: HTMLElement | null = null;
        constructor() { PopupStub.instances.push(this); }
        remove = vi.fn();
        setLngLat() { return this; }
        setDOMContent(content: HTMLElement) { this.content = content; return this; }
        addTo() { return this; }
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
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('map lifecycle', () => {
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
        second.unmount();
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

    it('rebuilds data after a background failure and retries only the background', () => {
        render(<PinsMap {...props()} />); flushFrames();
        act(() => { map().emit('style.load'); map().emit('render'); map().emit('error', { error: { message: 'tile unavailable' } }); });
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
        expect(source.setData.mock.calls.at(-1)![0].features).toHaveLength(1);
        expect(map().setFilter).toHaveBeenCalledWith('state-fill', ['==', ['get', 'stateFips'], '08']);
    });

    it('prioritizes pins over underlying polygons and renders safe, current tooltip text', () => {
        const current = props();
        const view = render(<PinsMap {...current} />); flushFrames();
        act(() => map().emit('style.load'));
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
            onError: vi.fn(), onBasemapState: vi.fn(), onReady: vi.fn() })).toThrow('canvas failed');
        expect(map().remove).toHaveBeenCalledOnce();
    });
});
