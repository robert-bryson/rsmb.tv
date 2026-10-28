import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tripManifestSchema } from '../../shared/tripManifestSchema';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { TripRoutePreview } from '../features/trips/components/TripRoutePreview';
import { dayColor, routeColor, routeLineColor, trackColor, tripMapCoordinates, tripMapView } from '../features/trips/tripMapView';
import { routeFeatures } from '../features/trips/routeGeometry';
import { clearTripRouteCache } from '../features/trips/useTripRoute';
import { dayMapManifest as manifest, dayMapRoute as route } from './fixtures/tripDayMap';

afterEach(() => { clearTripRouteCache(); vi.unstubAllGlobals(); });

describe('daily trip maps', () => {
    it('retains muted route context when an overview preview selects a day', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        const { container } = render(<TripStoryProvider manifest={manifest}>
            <TripRoutePreview dayId="coastbound" allowDaySelection onDaySelect={vi.fn()} />
        </TripStoryProvider>);
        await waitFor(() => expect(container.querySelectorAll('polyline')).toHaveLength(5));
        expect(container.querySelectorAll('polyline[stroke="#71717a"]')).toHaveLength(2);
        expect(container.querySelectorAll('polyline[stroke="#71717a"]')[0]).toHaveAttribute('opacity', '0.25');
        expect(container.querySelectorAll('circle')).toHaveLength(2);
    });

    it('highlights a selected track while retaining muted context in the preview', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        const { container } = render(<TripStoryProvider manifest={manifest}><TripRoutePreview trackId="return" /></TripStoryProvider>);
        await waitFor(() => expect(container.querySelectorAll('polyline')).toHaveLength(5));
        expect(container.querySelectorAll('polyline[stroke="#f59e0b"]')).toHaveLength(1);
        expect(container.querySelectorAll('polyline[stroke="#71717a"]')).toHaveLength(4);
        expect(screen.getByRole('img')).toHaveAccessibleName('Map focused on Return ride (reconstructed).');
    });

    it('loads the preview only when approached and keeps day links available', async () => {
        let notify: IntersectionObserverCallback;
        const disconnect = vi.fn();
        vi.stubGlobal('IntersectionObserver', class {
            constructor(callback: IntersectionObserverCallback) { notify = callback; }
            observe = vi.fn();
            disconnect = disconnect;
        });
        const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => route });
        vi.stubGlobal('fetch', fetch);
        const { unmount } = render(<TripStoryProvider manifest={manifest}><TripRoutePreview /></TripStoryProvider>);
        expect(fetch).not.toHaveBeenCalled();
        expect(screen.getByRole('link', { name: '1. Coastbound' })).toHaveAttribute('href', '#first-day');
        act(() => notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
        expect(fetch).not.toHaveBeenCalled();
        act(() => notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
        await screen.findByRole('img');
        expect(fetch).toHaveBeenCalledOnce();
        expect(disconnect).toHaveBeenCalledOnce();
        unmount();
        expect(disconnect).toHaveBeenCalledTimes(2);
    });

    it('retains the static fallback and permits retry when a preview request fails', async () => {
        const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 })
            .mockResolvedValueOnce({ ok: true, json: async () => route });
        vi.stubGlobal('fetch', fetch);
        render(<TripStoryProvider manifest={{ ...manifest, route: { ...manifest.route, staticImage: '/route.webp' } }}>
            <TripRoutePreview />
        </TripStoryProvider>);
        await screen.findByText('Route request failed with 503');
        expect(screen.getByRole('img')).toHaveAttribute('src', '/route.webp');
        fireEvent.click(screen.getByRole('button', { name: 'Retry route preview' }));
        await waitFor(() => expect(screen.getByRole('img').tagName.toLowerCase()).toBe('svg'));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('reports invalid day references without rendering partial geometry', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        const { container } = render(<TripStoryProvider manifest={manifest}><TripRoutePreview dayId="missing" /></TripStoryProvider>);
        expect(screen.getByRole('status')).toHaveTextContent('Unknown trip day: missing.');
        await act(async () => {});
        expect(container.querySelector('svg')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Download route (GeoJSON)' })).toBeVisible();
    });

    it('groups separate segments, shared POIs, and bounds from explicit day membership', () => {
        const view = tripMapView(manifest, route, { dayId: 'coastbound' });
        expect(routeFeatures(view.focusedRoute!)).toHaveLength(2);
        expect(view.stops.map(stop => stop.id)).toEqual(['start', 'camp']);
        expect(tripMapCoordinates(view)).toContainEqual([-124.5, 45]);
        expect(tripMapCoordinates(view, false)).not.toContainEqual([-124.5, 45]);
        expect(tripMapView(manifest, route, { dayId: 'homebound' }).stops.map(stop => stop.id)).toEqual(['camp', 'finish']);
        const reversedStops = { ...manifest, days: [{ ...manifest.days![0], stopIds: ['camp', 'start'] }] };
        expect(tripMapView(reversedStops, route, { dayId: 'coastbound' }).stops.map(stop => stop.id)).toEqual(['camp', 'start']);
    });

    it('retains unassigned tracks and gives previews and maps the same day colors', () => {
        expect(routeFeatures(tripMapView(manifest, route, {}).focusedRoute!)).toHaveLength(4);
        expect(trackColor(manifest, 'morning')).toBe(dayColor(manifest, 'coastbound'));
        expect(trackColor(manifest, 'afternoon')).toBe(trackColor(manifest, 'morning'));
        expect(trackColor(manifest, 'return')).not.toBe(trackColor(manifest, 'morning'));
        expect(trackColor(manifest, 'unassigned')).toBe(routeColor);
        expect(routeLineColor(manifest)).toEqual(['match', ['get', 'trackId'],
            ['morning', 'afternoon'], dayColor(manifest, 'coastbound'), ['return'], dayColor(manifest, 'homebound'), routeColor]);
        expect(routeLineColor({ ...manifest, days: undefined })).toBe(routeColor);
    });

    it('reports missing days, empty days, and missing segments without fitting partial data', () => {
        expect(tripMapView(manifest, route, { dayId: 'missing' }).error).toMatch(/Unknown trip day/);
        expect(tripMapView(manifest, route, { dayId: 'rest' }).error).toMatch(/no route tracks/);
        const partial = { type: 'FeatureCollection' as const, features: routeFeatures(route).slice(0, 1) };
        const view = tripMapView(manifest, partial, { dayId: 'coastbound' });
        expect(view.error).toContain('afternoon');
        expect(tripMapCoordinates(view)).toEqual([]);
        expect(tripMapView({ ...manifest, days: manifest.days!.map(day => ({ ...day, stopIds: [] })) }, route, { dayId: 'coastbound' }).stops).toEqual([]);
    });

    it('rejects ambiguous track assignments and duplicate POIs while allowing shared camps', () => {
        expect(() => tripManifestSchema.parse(manifest)).not.toThrow();
        expect(() => tripManifestSchema.parse({ ...manifest, days: [manifest.days![0], { ...manifest.days![1], trackIds: ['morning'] }] })).toThrow(/assigned to more than one day/);
        expect(() => tripManifestSchema.parse({ ...manifest, days: [{ ...manifest.days![0], stopIds: ['camp', 'camp'] }] })).toThrow(/duplicate stop IDs/);
    });

    it('renders the focused day and its POIs in the preview with matching colors', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        const { container, rerender } = render(<TripStoryProvider manifest={manifest}><TripRoutePreview dayId="homebound" /></TripStoryProvider>);
        await waitFor(() => expect(container.querySelectorAll('polyline')).toHaveLength(1));
        expect(screen.getByRole('img')).toHaveAccessibleName('Map of Homebound (reconstructed).');
        expect(container.querySelector('polyline')).toHaveAttribute('stroke', dayColor(manifest, 'homebound'));
        expect(container.querySelectorAll('circle')).toHaveLength(2);
        expect(screen.queryByText(/Harbor/)).not.toBeInTheDocument();
        rerender(<TripStoryProvider manifest={manifest}><TripRoutePreview dayId="homebound" showStops={false} /></TripStoryProvider>);
        expect(container.querySelectorAll('circle')).toHaveLength(0);
        expect(screen.queryByText(/Shared camp/)).not.toBeVisible();
    });
});
