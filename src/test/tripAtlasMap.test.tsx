import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TripAtlasEntry } from '../features/trips/atlas/tripAtlasEntries';
import type { RouteGeoJson } from '../features/trips/routeGeometry';
import TripAtlasMap from '../features/trips/atlas/TripAtlasMap';
import { tripAtlasColor } from '../features/trips/atlas/tripAtlasView';

const fake = vi.hoisted(() => ({
    instances: [] as Array<{ events: Map<string, Array<() => void>>; fitBounds: ReturnType<typeof vi.fn> }>,
    popupOptions: [] as unknown[],
}));

vi.mock('maplibre-gl', () => ({
    setWorkerUrl: vi.fn(),
    NavigationControl: class {},
    FullscreenControl: class {},
    AttributionControl: class {},
    Popup: class {
        element = document.createElement('div');
        constructor(options: unknown) { fake.popupOptions.push(options); }
        setLngLat() { return this; }
        setText(text: string) { this.element.textContent = text; return this; }
        addTo() { document.body.append(this.element); return this; }
        getElement() { return this.element; }
        remove() { this.element.remove(); return this; }
    },
    LngLatBounds: class { extend() { return this; } },
    Map: class {
        events = new Map<string, Array<() => void>>();
        fitBounds = vi.fn();
        canvas = document.createElement('canvas');
        constructor() { fake.instances.push(this); }
        on(event: string, listener: () => void) {
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
        getCenter() { return { lng: -121.5, lat: 46.5 }; }
        getBounds() { return { contains: () => true }; }
        getZoom() { return 5.5; }
        getBearing() { return 0; }
        getPitch() { return 0; }
        setFilter() {}
        setPaintProperty() {}
        remove() {}
    },
}));
vi.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

afterEach(() => { fake.instances.length = 0; fake.popupOptions.length = 0; });

const entry: TripAtlasEntry = {
    id: 'coast', title: 'Coast', description: 'A coastal journey.', reports: [],
    summary: {
        id: 'coast', dates: { start: '2024-01-01', end: '2024-01-02' },
        hero: { id: 'hero', src: '/hero.webp', alt: 'Coast', width: 800, height: 600 },
        route: { geoJson: '/route.geojson' },
    },
};
const route: RouteGeoJson = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-122, 47], [-124, 45]] } };

describe('atlas renderer lifecycle', () => {
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
        expect(popup.querySelector('img')).toBeNull();
        expect(popup.style.getPropertyValue('--trip-day-color')).toBe(tripAtlasColor('coast'));
        expect(fake.popupOptions[0]).toMatchObject({ closeButton: false, closeOnClick: false, focusAfterOpen: false, offset: 12 });
        rerender(<TripAtlasMap {...props} entries={[{ ...entry, title: 'Updated journey' }]} highlightedId="coast" />);
        expect(screen.getByRole('tooltip')).toBe(popup);
        expect(popup).toHaveTextContent('Updated journey');
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
