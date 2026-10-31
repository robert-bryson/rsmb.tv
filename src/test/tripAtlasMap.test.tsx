import { createRef, StrictMode, useEffect, useRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TripAtlasEntry } from '../features/trips/atlas/tripAtlasEntries';
import type { RouteGeoJson } from '../features/trips/routeGeometry';
import TripAtlasMap from '../features/trips/atlas/TripAtlasMap';
import { tripAtlasColor } from '../features/trips/atlas/tripAtlasView';
import { readAtlasSession, saveAtlasSession, type AtlasSession } from '../features/trips/atlas/tripAtlasSession';

type RendererListener = (event?: { originalEvent?: Event; error?: Error; sourceId?: string }) => void;
type InitialCamera = { center: [number, number]; zoom: number };

const fake = vi.hoisted(() => ({
    failInitialization: false,
    instances: [] as Array<{
        events: Map<string, RendererListener[]>;
        fitBounds: ReturnType<typeof vi.fn>;
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
        setText(text: string) { this.element.textContent = text; return this; }
        setDOMContent(content: Node) { this.element.replaceChildren(content); return this; }
        addTo() { document.body.append(this.element); return this; }
        getElement() { return this.element; }
        remove() { this.element.remove(); return this; }
    },
    LngLatBounds: class { extend() { return this; } },
    Map: class {
        events = new Map<string, RendererListener[]>();
        fitBounds = vi.fn();
        center = { lng: -121.5, lat: 46.5 };
        canvas = document.createElement('canvas');
        options: InitialCamera;
        constructor(options: InitialCamera) {
            if (fake.failInitialization) throw new Error('WebGL initialization failed');
            this.options = options;
            this.center = { lng: options.center[0], lat: options.center[1] };
            fake.instances.push(this);
        }
        on(event: string, listener: RendererListener) {
            const listeners = this.events.get(event) ?? [];
            listeners.push(listener);
            this.events.set(event, listeners);
        }
        once() {}
        off() {}
        addControl() {}
        getCanvas() { return this.canvas; }
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
            return Array.isArray(point) ? { x: point[0], y: point[1] } : { x: point.lng, y: point.lat };
        }
        setFilter() {}
        setPaintProperty() {}
        remove() {}
    },
}));
vi.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

afterEach(() => { fake.failInitialization = false; fake.instances.length = 0; fake.popupOptions.length = 0; fake.fullscreenOptions.length = 0; });

const entry = {
    id: 'coast', title: 'Coast', description: 'A coastal journey.', reports: [],
    summary: {
        id: 'coast', dates: { start: '2024-01-01', end: '2024-01-02' },
        hero: { id: 'hero', src: '/hero.webp', alt: 'Coast', width: 800, height: 600 },
        route: { geoJson: '/route.geojson' },
    },
} satisfies TripAtlasEntry;
const route: RouteGeoJson = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-122, 47], [-124, 45]] } };

describe('atlas renderer lifecycle', () => {
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
