import { createRef, StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TripAtlasEntry } from '../features/trips/atlas/tripAtlasEntries';
import type { RouteGeoJson } from '../features/trips/routeGeometry';
import TripAtlasMap from '../features/trips/atlas/TripAtlasMap';
import { tripAtlasColor } from '../features/trips/atlas/tripAtlasView';

const fake = vi.hoisted(() => ({
    instances: [] as Array<{
        events: Map<string, Array<(event?: { originalEvent?: Event }) => void>>;
        fitBounds: ReturnType<typeof vi.fn>;
        center: { lng: number; lat: number };
    }>,
    popupOptions: [] as unknown[],
    fullscreenOptions: [] as Array<{ container?: HTMLElement } | undefined>,
}));

vi.mock('maplibre-gl', () => ({
    setWorkerUrl: vi.fn(),
    NavigationControl: class {},
    FullscreenControl: class {
        constructor(options?: { container?: HTMLElement }) { fake.fullscreenOptions.push(options); }
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
        events = new Map<string, Array<(event?: { originalEvent?: Event }) => void>>();
        fitBounds = vi.fn();
        center = { lng: -121.5, lat: 46.5 };
        canvas = document.createElement('canvas');
        constructor() { fake.instances.push(this); }
        on(event: string, listener: (event?: { originalEvent?: Event }) => void) {
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

afterEach(() => { fake.instances.length = 0; fake.popupOptions.length = 0; fake.fullscreenOptions.length = 0; });

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
        act(() => { fake.instances[0].events.get('webglcontextlost')?.forEach(listener => listener()); });
        fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
        expect(fake.instances).toHaveLength(2);
        expect(fake.fullscreenOptions).toHaveLength(1);
        expect(fake.fullscreenOptions[0]?.container).toBe(target);
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
