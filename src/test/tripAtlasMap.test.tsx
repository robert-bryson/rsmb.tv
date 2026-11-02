import { createRef, StrictMode, useEffect, useLayoutEffect, useRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TripAtlasEntry } from '../features/trips/atlas/tripAtlasEntries';
import type { RouteGeoJson } from '../features/trips/routeGeometry';
import TripAtlasMap from '../features/trips/atlas/TripAtlasMap';
import { tripAtlasColor } from '../features/trips/atlas/tripAtlasView';
import { readAtlasSession, saveAtlasSession, type AtlasCamera, type AtlasSession } from '../features/trips/atlas/tripAtlasSession';

type RendererListener = (event?: {
    originalEvent?: Event; error?: Error; sourceId?: string;
    point?: { x: number; y: number }; lngLat?: { lng: number; lat: number };
}) => void;
type InitialCamera = { center: [number, number]; zoom: number };

const fake = vi.hoisted(() => ({
    failInitialization: false,
    instances: [] as Array<{
        events: Map<string, RendererListener[]>;
        fitBounds: ReturnType<typeof vi.fn>;
        jumpTo: ReturnType<typeof vi.fn>;
        once: ReturnType<typeof vi.fn>;
        off: ReturnType<typeof vi.fn>;
        triggerRepaint: ReturnType<typeof vi.fn>;
        queryRenderedFeatures: ReturnType<typeof vi.fn>;
        canvas: HTMLCanvasElement;
        isMoving: () => boolean;
        project: (point: [number, number] | { lng: number; lat: number }) => { x: number; y: number };
        center: { lng: number; lat: number };
        options: InitialCamera;
    }>,
    popupOptions: [] as unknown[],
    fullscreenOptions: [] as Array<{ container?: HTMLElement } | undefined>,
}));

vi.mock('maplibre-gl', () => ({
    setWorkerUrl: vi.fn(),
    NavigationControl: class {},
    FullscreenControl: class {
        constructor(options?: { container?: HTMLElement }) { fake.fullscreenOptions.push(options); }
        on() { return this; }
    },
    AttributionControl: class {},
    Popup: class {
        element = document.createElement('div');
        constructor(options: unknown) { fake.popupOptions.push(options); }
        setLngLat() { return this; }
        setMaxWidth() { return this; }
        setOffset() { return this; }
        setText(text: string) { this.element.textContent = text; return this; }
        setDOMContent(content: Node) { this.element.replaceChildren(content); return this; }
        addTo() { document.body.append(this.element); return this; }
        getElement() { return this.element; }
        remove() { this.element.remove(); return this; }
    },
    LngLatBounds: class {
        bounds: unknown[];
        constructor(...bounds: unknown[]) { this.bounds = bounds; }
        extend() { return this; }
    },
    Map: class {
        events = new Map<string, RendererListener[]>();
        triggerRepaint = vi.fn();
        queryRenderedFeatures = vi.fn(() => []);
        fitBounds = vi.fn();
        jumpTo = vi.fn((camera: AtlasCamera) => { this.center = { lng: camera.center[0], lat: camera.center[1] }; });
        center = { lng: -121.5, lat: 46.5 };
        canvas = document.createElement('canvas');
        container: HTMLElement;
        options: InitialCamera;
        constructor(options: InitialCamera & { container: HTMLElement }) {
            if (fake.failInitialization) throw new Error('WebGL initialization failed');
            this.options = options;
            this.container = options.container;
            Object.defineProperties(this.container, { clientWidth: { configurable: true, value: 800 }, clientHeight: { configurable: true, value: 600 } });
            this.center = { lng: options.center[0], lat: options.center[1] };
            fake.instances.push(this);
        }
        on(event: string, listener: RendererListener) {
            const listeners = this.events.get(event) ?? [];
            listeners.push(listener);
            this.events.set(event, listeners);
        }
        once = vi.fn();
        off = vi.fn();
        addControl() {}
        getCanvas() { return this.canvas; }
        getContainer() { return this.container; }
        getRenderWorldCopies() { return false; }
        resize() { return this; }
        stop() { this.events.get('moveend')?.forEach(listener => listener()); return this; }
        getLayer() { return {}; }
        getSource() { return { setData: vi.fn() }; }
        getCenter() { return this.center; }
        getBounds() { return { contains: () => true }; }
        getZoom() { return 5.5; }
        getBearing() { return 0; }
        getPitch() { return 0; }
        isMoving() { return false; }
        cameraForBounds() { return { center: [-121.5, 46.5], zoom: 5.5 }; }
        project(point: [number, number] | { lng: number; lat: number }) {
            return Array.isArray(point) ? { x: (point[0] + 125) * 100, y: (50 - point[1]) * 100 }
                : { x: (point.lng + 125) * 100, y: (50 - point.lat) * 100 };
        }
        unproject([x, y]: [number, number]) { return { lng: x / 100 - 125, lat: 50 - y / 100 }; }
        setFilter() {}
        setPaintProperty() {}
        remove() {}
    },
}));
vi.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

afterEach(() => { vi.unstubAllGlobals(); fake.failInitialization = false; fake.instances.length = 0; fake.popupOptions.length = 0; fake.fullscreenOptions.length = 0; });

const entry = {
    id: 'coast', title: 'Coast', description: 'A coastal journey.', reports: [],
    summary: {
        id: 'coast', dates: { start: '2024-01-01', end: '2024-01-02' },
        hero: { id: 'hero', src: '/hero.webp', alt: 'Coast', width: 800, height: 600 },
        route: { geoJson: '/route.geojson' },
    },
} satisfies TripAtlasEntry;
const route: RouteGeoJson = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-122, 47], [-124, 45]] } };

describe('atlas route hit testing', () => {
    const pointer = { point: { x: 100, y: 100 }, lngLat: { lng: -122, lat: 47 } };

    it('ignores removed routes while the renderer still returns their old features', () => {
        const onSelect = vi.fn();
        const onHover = vi.fn();
        const props = { entries: [entry], routes: { coast: { route, error: '', retry: vi.fn() } },
            fitVersion: 0, panelOpen: true, onSelect, onHover, onCameraChange: vi.fn() };
        const { rerender } = render(<TripAtlasMap {...props} />);
        const instance = fake.instances[0];
        instance.queryRenderedFeatures.mockReturnValue([{ properties: { tripId: 'coast' } }]);
        act(() => { instance.events.get('click')?.forEach(listener => listener(pointer)); });
        expect(onSelect).toHaveBeenCalledWith('coast');

        rerender(<TripAtlasMap {...props} entries={[]} routes={{}} />);
        onSelect.mockClear();
        onHover.mockClear();
        act(() => {
            instance.events.get('mousemove')?.forEach(listener => listener(pointer));
            instance.events.get('click')?.forEach(listener => listener(pointer));
        });
        expect(onSelect).toHaveBeenCalledExactlyOnceWith(undefined);
        expect(onHover).toHaveBeenCalledWith(undefined);
        expect(instance.canvas.style.cursor).toBe('');
        expect(screen.queryByRole('group', { name: 'Trips sharing this road' })).not.toBeInTheDocument();
    });

    it('deduplicates current routes and rejects unknown, malformed, and unavailable rendered features', () => {
        const onSelect = vi.fn();
        render(<TripAtlasMap entries={[entry, { ...entry, id: 'loading' }]}
            routes={{ coast: { route, error: '', retry: vi.fn() }, loading: { route: null, error: '', retry: vi.fn() } }}
            fitVersion={0} panelOpen onSelect={onSelect} onHover={vi.fn()} onCameraChange={vi.fn()} />);
        const instance = fake.instances[0];
        instance.queryRenderedFeatures.mockReturnValue([
            { properties: { tripId: 'excluded' } }, { properties: { tripId: 'loading' } },
            { properties: { tripId: 42 } }, { properties: null },
            { properties: { tripId: 'coast' } }, { properties: { tripId: 'coast' } },
        ]);
        act(() => { instance.events.get('click')?.forEach(listener => listener(pointer)); });
        expect(onSelect).toHaveBeenCalledExactlyOnceWith('coast');
        expect(screen.queryByRole('group', { name: 'Trips sharing this road' })).not.toBeInTheDocument();
    });

    it.each([
        ['keyboard', 0, true], ['pointer', 1, false],
    ] as const)('previews current shared routes and preserves %s selection intent', (_name, detail, focusCard) => {
        const onSelect = vi.fn();
        const onHover = vi.fn();
        render(<TripAtlasMap entries={[entry, { ...entry, id: 'inland', title: 'Inland' }]}
            routes={{ coast: { route, error: '', retry: vi.fn() }, inland: { route, error: '', retry: vi.fn() } }}
            selectedId="inland" fitVersion={0} panelOpen onSelect={onSelect} onHover={onHover} onCameraChange={vi.fn()} />);
        const instance = fake.instances[0];
        instance.queryRenderedFeatures.mockReturnValue(['coast', 'inland', 'coast', 'excluded'].map(tripId => ({ properties: { tripId } })));
        act(() => {
            instance.events.get('mousemove')?.forEach(listener => listener(pointer));
            instance.events.get('click')?.forEach(listener => listener(pointer));
        });
        expect(onHover).toHaveBeenLastCalledWith('inland');
        expect(instance.canvas.style.cursor).toBe('pointer');
        expect(screen.getByRole('group', { name: 'Trips sharing this road' })).toBeVisible();
        expect(screen.queryByRole('button', { name: 'excluded' })).not.toBeInTheDocument();
        const inland = screen.getByRole('button', { name: 'Inland' });
        const coast = screen.getByRole('button', { name: 'Coast' });
        fireEvent.focus(inland);
        fireEvent.pointerEnter(coast, { pointerType: 'mouse' });
        expect(onHover).toHaveBeenLastCalledWith('coast');
        fireEvent.pointerLeave(coast);
        expect(onHover).toHaveBeenLastCalledWith('inland');
        fireEvent.click(inland, { detail });
        expect(onSelect).toHaveBeenCalledExactlyOnceWith('inland', { focusCard });
        expect(onHover).toHaveBeenLastCalledWith(undefined);
        expect(screen.queryByRole('group', { name: 'Trips sharing this road' })).not.toBeInTheDocument();
    });
});

describe('atlas renderer lifecycle', () => {
    it.each([
        ['camera movement', 'moveend', undefined],
        ['style changes', 'styledata', undefined],
        ['route updates', 'sourcedata', 'atlas-routes'],
        ['day-break updates', 'sourcedata', 'atlas-day-breaks'],
    ] as const)('coalesces final paints after %s and cancels them on removal', async (_name, type, sourceId) => {
        const { Evented } = await vi.importActual<typeof import('maplibre-gl')>('maplibre-gl');
        const events = new class extends Evented {}();
        const { unmount } = render(<TripAtlasMap entries={[entry]} routes={{}} fitVersion={0} panelOpen
            onSelect={vi.fn()} onHover={vi.fn()} onCameraChange={vi.fn()} />);
        const instance = fake.instances[0];
        for (const [eventType, listeners] of instance.events) {
            for (const listener of listeners) events.on(eventType, event => listener({
                sourceId: 'sourceId' in event && typeof event.sourceId === 'string' ? event.sourceId : undefined,
            }));
        }
        instance.once.mockImplementation((type, listener) => events.once(type, listener));
        instance.off.mockImplementation((type, listener) => events.off(type, listener));
        act(() => { events.fire('sourcedata', { sourceId: 'basemap' }); events.fire('render'); });
        expect(instance.triggerRepaint).not.toHaveBeenCalled();
        act(() => { events.fire(type, { sourceId }); events.fire(type, { sourceId }); });
        expect(instance.triggerRepaint).not.toHaveBeenCalled();
        act(() => { events.fire('render'); });
        expect(instance.triggerRepaint).toHaveBeenCalledOnce();
        act(() => { events.fire('render'); });
        expect(instance.triggerRepaint).toHaveBeenCalledOnce();
        act(() => { events.fire(type, { sourceId }); });
        unmount();
        expect(instance.off).toHaveBeenCalledWith('render', expect.any(Function));
        act(() => { events.fire('render'); events.fire(type, { sourceId }); events.fire('render'); });
        expect(instance.triggerRepaint).toHaveBeenCalledOnce();
    });

    it('fits a requested geographic region without waiting for routes or fitting again when they arrive', () => {
        const props = { entries: [entry], routes: {}, fitVersion: 1, fitRequest: { bounds: [-125, 45, -116, 49] as [number, number, number, number] },
            panelOpen: true, onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn() };
        const { rerender } = render(<TripAtlasMap {...props} />);
        const instance = fake.instances[0];
        act(() => { instance.events.get('styledata')?.forEach(listener => listener()); });
        expect(instance.fitBounds).toHaveBeenCalledOnce();
        expect(instance.fitBounds.mock.calls[0][0].bounds).toEqual([[-125, 45], [-116, 49]]);
        rerender(<TripAtlasMap {...props} routes={{ coast: { route, error: '', retry: vi.fn() } }} />);
        expect(instance.fitBounds).toHaveBeenCalledOnce();
    });

    it('applies an external camera before layout-driven movement can publish the old view', () => {
        const idle = vi.fn();
        const target: AtlasCamera = { center: [-100, 40], zoom: 5.5, bearing: 0, pitch: 0 };
        function Layout({ camera }: { camera?: AtlasCamera }) {
            useLayoutEffect(() => {
                if (camera) fake.instances.at(-1)?.events.get('moveend')?.forEach(listener => listener());
            }, [camera]);
            return <TripAtlasMap entries={[entry]} routes={{ coast: { route, error: '', retry: vi.fn() } }} fitVersion={0} panelOpen
                initialCamera={{ center: [-121.5, 46.5], zoom: 5.5, bearing: 0, pitch: 0 }} cameraTarget={camera}
                onSelect={vi.fn()} onHover={vi.fn()} onCameraChange={vi.fn()} onCameraIdle={idle} />;
        }
        const { rerender } = render(<Layout />);
        act(() => { fake.instances[0].events.get('styledata')?.forEach(listener => listener()); });
        idle.mockClear();
        rerender(<Layout camera={target} />);
        expect(idle).toHaveBeenCalledExactlyOnceWith(target);
    });

    it('reapplies the same camera on a new history revision when a movement URL was never committed', () => {
        const camera: AtlasCamera = { center: [-121.5, 46.5], zoom: 5.5, bearing: 0, pitch: 0 };
        const props = { entries: [entry], routes: {}, fitVersion: 0, panelOpen: true, initialCamera: camera, cameraTarget: camera,
            onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn() };
        const { rerender } = render(<TripAtlasMap {...props} cameraRevision="initial-visit" />);
        const instance = fake.instances[0];
        act(() => { instance.events.get('styledata')?.forEach(listener => listener()); });
        instance.center = { lng: -100, lat: 40 };
        rerender(<TripAtlasMap {...props} cameraRevision="returned-visit" />);
        expect(instance.jumpTo).toHaveBeenCalledExactlyOnceWith(camera);
    });

    it('restores an external URL camera without refitting and does not round its own movement back into the map', () => {
        const props = { entries: [entry], routes: { coast: { route, error: '', retry: vi.fn() } }, fitVersion: 0, panelOpen: true,
            onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn(), initialCamera: { center: [-121.5, 46.5] as [number, number], zoom: 5.5, bearing: 0, pitch: 0 } };
        const { rerender } = render(<TripAtlasMap {...props} />);
        const instance = fake.instances[0];
        act(() => { instance.events.get('styledata')?.forEach(listener => listener()); });
        const target = { center: [-100, 40] as [number, number], zoom: 5.5, bearing: 0, pitch: 0 };
        rerender(<TripAtlasMap {...props} cameraTarget={target} />);
        expect(instance.jumpTo).toHaveBeenCalledExactlyOnceWith(target);
        expect(instance.fitBounds).not.toHaveBeenCalled();
        instance.center = { lng: -99.99999999, lat: 40.00000001 };
        rerender(<TripAtlasMap {...props} cameraTarget={{ ...target }} />);
        expect(instance.jumpTo).toHaveBeenCalledOnce();
    });

    it('publishes the camera only at movement end and rejects old animations and removed renderers', () => {
        const idle = vi.fn();
        const props = { entries: [entry], routes: { coast: { route, error: '', retry: vi.fn() } }, selectedId: 'coast', fitVersion: 0, panelOpen: true,
            onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn(), onCameraIdle: idle };
        const { rerender, unmount } = render(<TripAtlasMap {...props} />);
        const instance = fake.instances[0];
        act(() => { instance.events.get('styledata')?.forEach(listener => listener()); });
        act(() => { instance.events.get('move')?.forEach(listener => listener()); });
        expect(idle).not.toHaveBeenCalled();
        const moving = vi.spyOn(instance, 'isMoving').mockReturnValue(true);
        act(() => { instance.events.get('moveend')?.forEach(listener => listener()); });
        expect(idle).not.toHaveBeenCalled();
        moving.mockReturnValue(false);
        act(() => { instance.events.get('moveend')?.forEach(listener => listener()); });
        expect(idle).toHaveBeenCalledOnce();
        rerender(<TripAtlasMap {...props} selectedId="delayed" fitVersion={1} />);
        act(() => { instance.events.get('moveend')?.forEach(listener => listener()); });
        expect(idle).toHaveBeenCalledOnce();
        unmount();
        act(() => { instance.events.get('moveend')?.forEach(listener => listener()); });
        expect(idle).toHaveBeenCalledOnce();
    });

    it.each([true, false])('keeps fit padding stable while attribution loads (phone: %s)', phone => {
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: phone })));
        const props = { entries: [entry], routes: { coast: { route, error: '', retry: vi.fn() } }, selectedId: 'coast',
            fitVersion: 1, panelOpen: true, onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn() };
        const { rerender } = render(<TripAtlasMap {...props} />);
        const container = screen.getByTestId('trip-atlas-map');
        Object.defineProperty(container, 'clientHeight', { value: 600 });
        container.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
        const instance = fake.instances[0];
        act(() => { instance.events.get('styledata')?.forEach(listener => listener()); });
        const before = instance.fitBounds.mock.calls[0][1].padding;
        const attribution = document.createElement('div');
        attribution.className = 'maplibregl-ctrl-bottom-right';
        attribution.getBoundingClientRect = () => new DOMRect(0, 300, 800, 20);
        container.append(attribution);
        rerender(<TripAtlasMap {...props} fitVersion={2} />);
        expect(instance.fitBounds.mock.calls[1][1].padding).toEqual(before);
        expect(before.bottom).toBe(phone ? 100 : 52);
    });

    it('keeps logical selection separate from filtered geometry and an explicit results fit', () => {
        const props = {
            entries: [entry], routes: { coast: { route, error: '', retry: vi.fn() } },
            selectedId: 'excluded-trip', fitVersion: 0, fitRequest: {}, panelOpen: true,
            onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn(),
        };
        const { rerender } = render(<TripAtlasMap {...props} />);
        const instance = fake.instances[0];
        act(() => { instance.events.get('styledata')?.forEach(listener => listener()); });
        expect(instance.fitBounds).toHaveBeenCalledOnce();
        rerender(<TripAtlasMap {...props} fitRequest={{ cancelled: true }} panelOpen={false} />);
        act(() => { instance.events.get('resize')?.forEach(listener => listener()); });
        expect(instance.fitBounds).toHaveBeenCalledOnce();
        rerender(<TripAtlasMap {...props} fitVersion={1} />);
        expect(instance.fitBounds).toHaveBeenCalledTimes(2);
    });

    it('does not complete a cancelled fit when delayed geometry arrives, and accepts the next explicit request', () => {
        const props = {
            entries: [entry], routes: { coast: { route: null, error: '', retry: vi.fn() } },
            selectedId: 'coast', fitVersion: 1, fitRequest: { tripId: 'coast', cancelled: true }, panelOpen: true,
            onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn(),
        };
        const { rerender } = render(<TripAtlasMap {...props} />);
        const instance = fake.instances[0];
        act(() => { instance.events.get('styledata')?.forEach(listener => listener()); });
        rerender(<TripAtlasMap {...props} routes={{ coast: { ...props.routes.coast, route } }} />);
        expect(instance.fitBounds).not.toHaveBeenCalled();
        rerender(<TripAtlasMap {...props} routes={{ coast: { ...props.routes.coast, route } }} fitVersion={2} fitRequest={{ tripId: 'coast', cancelled: false }} />);
        expect(instance.fitBounds).toHaveBeenCalledOnce();
    });

    it('recovers from initialization failure and still fits the selected route', () => {
        fake.failInitialization = true;
        render(<TripAtlasMap entries={[entry]} routes={{ coast: { route, error: '', retry: vi.fn() } }}
            selectedId="coast" fitVersion={1} panelOpen onSelect={vi.fn()} onHover={vi.fn()} onCameraChange={vi.fn()} />);
        expect(screen.getByRole('status')).toHaveTextContent('The interactive map is unavailable.');
        expect(fake.instances).toHaveLength(0);
        fake.failInitialization = false;
        fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        const recovered = fake.instances[0];
        act(() => { recovered.events.get('styledata')?.forEach(listener => listener()); });
        expect(recovered.fitBounds).toHaveBeenCalledOnce();
        expect(screen.getByTestId('trip-atlas-map')).toHaveAttribute('data-selected-trip', 'coast');
    });

    it.each([
        { name: 'unchanged selection', selectedId: 'coast', fitVersion: 1, shouldFit: false },
        { name: 'new selection', selectedId: 'inland', fitVersion: 2, shouldFit: true },
        { name: 'overview request', selectedId: undefined, fitVersion: 2, shouldFit: true },
    ])('preserves saved-camera identity through constructor failure ($name)', ({ selectedId, fitVersion, shouldFit }) => {
        fake.failInitialization = true;
        const props = {
            entries: [entry, { ...entry, id: 'inland', title: 'Inland' }],
            routes: { coast: { route, error: '', retry: vi.fn() }, inland: { route, error: '', retry: vi.fn() } },
            selectedId: 'coast', fitVersion: 1, panelOpen: true,
            initialCamera: { center: [-100, 40] as [number, number], zoom: 6, bearing: 0, pitch: 0 },
            onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn(),
        };
        const { rerender } = render(<TripAtlasMap {...props} />);
        expect(fake.instances).toHaveLength(0);
        rerender(<TripAtlasMap {...props} selectedId={selectedId} fitVersion={fitVersion} />);
        fake.failInitialization = false;
        fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
        const recovered = fake.instances[0];
        expect(recovered.options.center).toEqual([-100, 40]);
        act(() => { recovered.events.get('styledata')?.forEach(listener => listener()); });
        expect(recovered.fitBounds).toHaveBeenCalledTimes(shouldFit ? 1 : 0);
    });

    it.each([
        ['background tiles', { error: new Error('Tile request failed'), sourceId: 'basemap' }, false],
        ['route source', { error: new Error('Invalid GeoJSON'), sourceId: 'atlas-routes' }, true],
        ['worker', { error: new Error('Worker initialization failed') }, true],
        ['WebGL context', { error: new Error('WebGL context lost') }, true],
    ] as const)('recovers from %s failure without changing the selected trip or saved camera', (_name, error, fatal) => {
        const remember = vi.fn();
        render(<TripAtlasMap entries={[entry]} routes={{ coast: { route, error: '', retry: vi.fn() } }}
            selectedId="coast" fitVersion={1} panelOpen onSelect={vi.fn()} onHover={vi.fn()} onCameraChange={remember} />);
        const original = fake.instances[0];
        act(() => {
            original.events.get('styledata')?.forEach(listener => listener());
            original.events.get('movestart')?.forEach(listener => listener({ originalEvent: new Event('mousedown') }));
            original.center = { lng: -123, lat: 46 };
            original.events.get('move')?.forEach(listener => listener());
            original.events.get('error')?.forEach(listener => listener(error));
        });
        expect(screen.getByRole('status')).toHaveTextContent(fatal ? 'The interactive map is unavailable.' : 'Some background tiles could not load.');
        fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        const recovered = fake.instances[1];
        expect(recovered.options).toMatchObject({ center: [-123, 46], zoom: 5.5 });
        act(() => { recovered.events.get('styledata')?.forEach(listener => listener()); });
        expect(recovered.fitBounds).not.toHaveBeenCalled();
        expect(screen.getByTestId('trip-atlas-map')).toHaveAttribute('data-selected-trip', 'coast');
        remember.mockClear();
        act(() => {
            original.events.get('error')?.forEach(listener => listener(error));
            original.events.get('webglcontextlost')?.forEach(listener => listener());
            original.events.get('move')?.forEach(listener => listener());
        });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(remember).not.toHaveBeenCalled();
    });

    it('includes the supplied atlas controls in the fullscreen target', () => {
        const fullscreenContainer = createRef<HTMLElement>();
        render(<main ref={fullscreenContainer}>
            <TripAtlasMap entries={[entry]} routes={{}} fitVersion={0} panelOpen fullscreenContainer={fullscreenContainer}
                onSelect={vi.fn()} onHover={vi.fn()} onCameraChange={vi.fn()} />
            <aside>Trip reports</aside>
        </main>);
        const target = fake.fullscreenOptions[0]?.container;
        expect(target).toBe(fullscreenContainer.current);
        expect(target).toContainElement(screen.getByRole('complementary'));
        expect(target).toContainElement(screen.getByTestId('trip-atlas-map'));
        target!.classList.add('maplibregl-pseudo-fullscreen');
        act(() => { fake.instances[0].events.get('webglcontextlost')?.forEach(listener => listener()); });
        fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
        expect(fake.instances).toHaveLength(2);
        expect(fake.fullscreenOptions).toHaveLength(1);
        expect(fake.fullscreenOptions[0]?.container).toBe(target);
    });

    it.each(['inland', undefined])('retains a pending fit through renderer recovery (destination: %s)', selectedId => {
        const inland = { ...entry, id: 'inland', title: 'Inland' };
        const entries = [entry, inland];
        const routes = {
            coast: { route, error: '', retry: vi.fn() },
            inland: { route: null as RouteGeoJson | null, error: '', retry: vi.fn() },
        };
        const props = {
            entries, routes, selectedId: 'coast', fitVersion: 1, panelOpen: true,
            onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn(),
        };
        const { rerender } = render(<TripAtlasMap {...props} />);
        const original = fake.instances[0];
        act(() => { original.events.get('styledata')?.forEach(listener => listener()); });
        act(() => { original.events.get('moveend')?.forEach(listener => listener()); });
        expect(original.fitBounds).toHaveBeenCalledOnce();
        expect(props.onCameraChange).toHaveBeenCalled();
        rerender(<TripAtlasMap {...props} selectedId={selectedId} fitVersion={2} />);
        expect(original.fitBounds).toHaveBeenCalledOnce();
        act(() => { original.events.get('webglcontextlost')?.forEach(listener => listener()); });
        fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
        const recovered = fake.instances[1];
        expect(recovered.options.center).toEqual([-121.5, 46.5]);
        act(() => { recovered.events.get('styledata')?.forEach(listener => listener()); });
        expect(recovered.fitBounds).not.toHaveBeenCalled();
        rerender(<TripAtlasMap {...props} selectedId={selectedId} fitVersion={2}
            routes={{ ...routes, inland: { ...routes.inland, route } }} />);
        expect(recovered.fitBounds).toHaveBeenCalledOnce();
        rerender(<TripAtlasMap {...props} selectedId={selectedId} fitVersion={2}
            routes={{ ...routes, inland: { ...routes.inland, route } }} />);
        expect(recovered.fitBounds).toHaveBeenCalledOnce();
    });

    it.each([undefined, 'coast'])('cancels a pending fit after manual movement (selected: %s) and permits a new fit request', selectedId => {
        const props = {
            entries: [entry], routes: { coast: { route: null, error: '', retry: vi.fn() } }, selectedId,
            fitVersion: selectedId ? 1 : 0, panelOpen: true,
            onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn(), onViewChange: vi.fn(),
        };
        const { rerender } = render(<TripAtlasMap {...props} />);
        const instance = fake.instances[0];
        act(() => { instance.events.get('styledata')?.forEach(listener => listener()); });
        act(() => {
            instance.events.get('movestart')?.forEach(listener => listener({ originalEvent: new Event('mousedown') }));
            instance.center = { lng: -100, lat: 40 };
            instance.events.get('moveend')?.forEach(listener => listener());
        });
        rerender(<TripAtlasMap {...props} routes={{ coast: { route, error: '', retry: vi.fn() } }} />);
        expect(instance.fitBounds).not.toHaveBeenCalled();
        expect(props.onCameraChange).toHaveBeenCalledWith({ center: [-100, 40], zoom: 5.5, bearing: 0, pitch: 0 });
        if (!selectedId) expect(props.onViewChange).toHaveBeenLastCalledWith(true);
        rerender(<TripAtlasMap {...props} fitVersion={props.fitVersion + 1} routes={{ coast: { route, error: '', retry: vi.fn() } }} />);
        expect(instance.fitBounds).toHaveBeenCalledOnce();
    });

    it('keeps a manually cancelled fit cancelled after renderer recovery', () => {
        const props = {
            entries: [entry], routes: { coast: { route: null, error: '', retry: vi.fn() } },
            selectedId: 'coast', fitVersion: 1, panelOpen: true,
            onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn(),
        };
        const { rerender } = render(<TripAtlasMap {...props} />);
        const original = fake.instances[0];
        act(() => {
            original.events.get('movestart')?.forEach(listener => listener({ originalEvent: new Event('mousedown') }));
            original.center = { lng: -100, lat: 40 };
            original.events.get('moveend')?.forEach(listener => listener());
            original.events.get('webglcontextlost')?.forEach(listener => listener());
        });
        fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
        const recovered = fake.instances[1];
        act(() => { recovered.events.get('styledata')?.forEach(listener => listener()); });
        rerender(<TripAtlasMap {...props} routes={{ coast: { ...props.routes.coast, route } }} />);
        expect(recovered.options.center).toEqual([-100, 40]);
        expect(recovered.fitBounds).not.toHaveBeenCalled();
        rerender(<TripAtlasMap {...props} fitVersion={2} routes={{ coast: { ...props.routes.coast, route } }} />);
        expect(recovered.fitBounds).toHaveBeenCalledOnce();
    });

    it('does not cancel a pending route fit for programmatic camera movement', () => {
        const props = {
            entries: [entry], routes: { coast: { route: null, error: '', retry: vi.fn() } }, selectedId: 'coast',
            fitVersion: 1, panelOpen: true, onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn(),
        };
        const { rerender } = render(<TripAtlasMap {...props} />);
        const instance = fake.instances[0];
        act(() => {
            instance.events.get('styledata')?.forEach(listener => listener());
            instance.events.get('movestart')?.forEach(listener => listener({}));
        });
        rerender(<TripAtlasMap {...props} routes={{ coast: { route, error: '', retry: vi.fn() } }} />);
        expect(instance.fitBounds).toHaveBeenCalledOnce();
    });

    it('reuses a safe colored tooltip for hover updates and removes it when feedback ends', async () => {
        const unsafeTitle = '<img src=x onerror=alert(1)>';
        const props = {
            entries: [{ ...entry, title: unsafeTitle }], routes: { coast: { route, error: '', retry: vi.fn() } },
            fitVersion: 0, panelOpen: true, onSelect: vi.fn(), onHover: vi.fn(), onCameraChange: vi.fn(),
        };
        const { rerender, unmount } = render(<TripAtlasMap {...props} highlightedId="coast" />);
        act(() => { fake.instances[0].events.get('styledata')?.forEach(listener => listener()); });
        const popup = await screen.findByRole('tooltip');
        expect(popup).toHaveTextContent(unsafeTitle);
        expect(popup.querySelector('.trip-map-tooltip-subtitle')).toHaveTextContent('January 2024');
        expect(popup.querySelector('img')).toBeNull();
        expect(popup.style.getPropertyValue('--trip-day-color')).toBe(tripAtlasColor('coast'));
        expect(fake.popupOptions[0]).toMatchObject({ closeButton: false, closeOnClick: false, focusAfterOpen: false, offset: 12 });
        rerender(<TripAtlasMap {...props} entries={[{ ...entry, title: 'Updated journey' }]} highlightedId="coast" />);
        expect(screen.getByRole('tooltip')).toBe(popup);
        expect(popup).toHaveTextContent('Updated journey');
        rerender(<TripAtlasMap {...props} entries={[{ ...entry, title: 'Updated journey', summary: { ...entry.summary, dates: { start: '2025-05-11', end: '2025-05-19' } } }]} highlightedId="coast" />);
        expect(screen.getByRole('tooltip')).toBe(popup);
        expect(popup.querySelector('.trip-map-tooltip-subtitle')).toHaveTextContent('May 2025');
        expect(fake.popupOptions).toHaveLength(1);
        rerender(<TripAtlasMap {...props} selectedId="coast" />);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        rerender(<TripAtlasMap {...props} highlightedId="coast" />);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        unmount();
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('updates directional card feedback after camera movement and ignores removed renderers', async () => {
        const east: RouteGeoJson = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-100, 47], [-99, 46]] } };
        const { unmount } = render(<TripAtlasMap entries={[entry]} routes={{ coast: { route: east, error: '', retry: vi.fn() } }}
            fitVersion={0} panelOpen highlightedId="coast" onSelect={vi.fn()} onHover={vi.fn()} onCameraChange={vi.fn()} />);
        const instance = fake.instances[0];
        act(() => { instance.events.get('styledata')?.forEach(listener => listener()); });
        expect(fake.popupOptions.at(-1)).toMatchObject({ anchor: 'right' });
        vi.spyOn(instance, 'project').mockImplementation(point => {
            const lng = Array.isArray(point) ? point[0] : point.lng;
            return { x: (lng + 125) * 100 - 4000, y: 300 };
        });
        act(() => { instance.events.get('move')?.forEach(listener => listener()); });
        await waitFor(() => expect(fake.popupOptions.at(-1)).toMatchObject({ anchor: 'left' }));
        unmount();
        const count = fake.popupOptions.length;
        act(() => { instance.events.get('move')?.forEach(listener => listener()); });
        expect(fake.popupOptions).toHaveLength(count);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('fits routes after Strict Mode replaces an uninitialized map instead of restoring its default camera', async () => {
        const remember = vi.fn();
        render(<StrictMode><TripAtlasMap entries={[entry]} routes={{ coast: { route, error: '', retry: vi.fn() } }}
            fitVersion={0} panelOpen onSelect={vi.fn()} onHover={vi.fn()} onCameraChange={remember} /></StrictMode>);
        expect(fake.instances).toHaveLength(2);
        expect(remember).not.toHaveBeenCalled();
        const current = fake.instances[1];
        act(() => { current.events.get('styledata')?.forEach(listener => listener()); });
        await waitFor(() => expect(current.fitBounds).toHaveBeenCalledOnce());
        expect(fake.instances[0].fitBounds).not.toHaveBeenCalled();
        act(() => { current.events.get('moveend')?.forEach(listener => listener()); });
        expect(remember).toHaveBeenCalledOnce();
    });
});

describe('review regressions: camera persistence during movement', () => {
    it('persists the moving camera before parent navigation cleanup takes its snapshot', () => {
        const key = 'navigation-during-gesture';
        function Owner() {
            const session = useRef<AtlasSession>({ panelOpen: true, scrollTop: 40 });
            useEffect(() => () => saveAtlasSession(key, '/atlas-regression', session.current), []);
            return <TripAtlasMap entries={[entry]} routes={{}} fitVersion={0} panelOpen
                onSelect={vi.fn()} onHover={vi.fn()} onCameraChange={camera => { session.current.camera = camera; }} />;
        }
        const { unmount } = render(<Owner />);
        const instance = fake.instances[0];
        act(() => {
            instance.events.get('movestart')?.forEach(listener => listener({ originalEvent: new Event('mousedown') }));
            instance.center = { lng: -100, lat: 40 };
            instance.events.get('move')?.forEach(listener => listener());
        });
        unmount();
        expect(readAtlasSession(key)?.camera?.center).toEqual([-100, 40]);
    });

    it('captures an in-progress gesture before moveend without comparing the overview each frame', () => {
        const remember = vi.fn();
        const compare = vi.fn();
        const { unmount } = render(<TripAtlasMap entries={[entry]} routes={{}}
            fitVersion={0} panelOpen onSelect={vi.fn()} onHover={vi.fn()} onCameraChange={remember} onViewChange={compare} />);
        const instance = fake.instances[0];
        act(() => {
            instance.events.get('movestart')?.forEach(listener => listener({ originalEvent: new Event('mousedown') }));
            instance.center = { lng: -100, lat: 40 };
            instance.events.get('move')?.forEach(listener => listener());
        });
        expect(remember).toHaveBeenLastCalledWith({ center: [-100, 40], zoom: 5.5, bearing: 0, pitch: 0 });
        expect(compare).not.toHaveBeenCalled();
        unmount();
        remember.mockClear();
        act(() => { instance.events.get('move')?.forEach(listener => listener()); });
        expect(remember).not.toHaveBeenCalled();
    });

    it('captures a fit in progress but ignores the uninitialized default camera', () => {
        const remember = vi.fn();
        render(<TripAtlasMap entries={[entry]} routes={{ coast: { route, error: '', retry: vi.fn() } }}
            fitVersion={0} panelOpen onSelect={vi.fn()} onHover={vi.fn()} onCameraChange={remember} />);
        const instance = fake.instances[0];
        act(() => { instance.events.get('move')?.forEach(listener => listener()); });
        expect(remember).not.toHaveBeenCalled();
        act(() => { instance.events.get('styledata')?.forEach(listener => listener()); });
        expect(instance.fitBounds).toHaveBeenCalledOnce();
        act(() => {
            instance.center = { lng: -123, lat: 46 };
            instance.events.get('move')?.forEach(listener => listener());
        });
        expect(remember).toHaveBeenLastCalledWith({ center: [-123, 46], zoom: 5.5, bearing: 0, pitch: 0 });
    });
});
