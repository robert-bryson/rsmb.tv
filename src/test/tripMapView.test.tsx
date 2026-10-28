import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tripManifestSchema } from '../../shared/tripManifestSchema';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { TripRoutePreview } from '../features/trips/components/TripRoutePreview';
import { dayColor, routeColor, routeLineColor, trackColor, tripMapCoordinates, tripMapDayAnchor, tripMapDayForTrack, tripMapView } from '../features/trips/tripMapView';
import { routeFeatures } from '../features/trips/routeGeometry';
import { clearTripRouteCache } from '../features/trips/useTripRoute';
import { dayMapManifest as manifest, dayMapRoute as route } from './fixtures/tripDayMap';
import oceanShoresManifest from '../content/trips/ocean-shores-2024.json';

afterEach(() => { clearTripRouteCache(); vi.unstubAllGlobals(); });

describe('daily trip maps', () => {
    it('preserves a selected preview day when Escape is used outside its map', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        render(<TripStoryProvider manifest={manifest}><TripRoutePreview /></TripStoryProvider>);
        await screen.findByRole('img');
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        fireEvent.click(day);
        fireEvent.mouseEnter(day);
        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(day).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('retains focused preview feedback after pointer hover leaves the label and route', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        const { container } = render(<TripStoryProvider manifest={manifest}><TripRoutePreview /></TripStoryProvider>);
        await screen.findByRole('img');
        const line = container.querySelector(`polyline[stroke="${dayColor(manifest, 'homebound')}"]`)!;
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        fireEvent.focus(day);
        fireEvent.mouseEnter(day);
        fireEvent.mouseLeave(day);
        expect(day).toHaveAttribute('data-highlighted', 'true');
        expect(day).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
        fireEvent.mouseEnter(line);
        fireEvent.mouseLeave(line);
        expect(screen.getByRole('tooltip')).toHaveTextContent('Coastbound');
        fireEvent.blur(day);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it.each([false, true])('dismisses an unselected preview tooltip with Escape (parent-owned selection: %s)', async parentOwned => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        render(<TripStoryProvider manifest={manifest}><TripRoutePreview
            figureRef={parentOwned ? { current: null } : undefined} onDaySelect={parentOwned ? vi.fn() : undefined} />
        </TripStoryProvider>);
        await screen.findByRole('img');
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        fireEvent.focus(day);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        fireEvent.keyDown(day, { key: 'Escape' });
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(day).not.toHaveAttribute('aria-describedby');
        expect(day).toHaveAttribute('aria-pressed', 'false');
    });

    it('clears preview hover and focus when another route replaces the current one', async () => {
        const state = { route, error: '', retry: vi.fn() };
        const story = (geoJson: string) => <TripStoryProvider manifest={{ ...manifest, route: { ...manifest.route, geoJson } }}>
            <TripRoutePreview routeState={state} />
        </TripStoryProvider>;
        const { rerender } = render(story('/first.geojson'));
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        fireEvent.focus(day);
        fireEvent.mouseEnter(day);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        rerender(story('/second.geojson'));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(day).not.toHaveAttribute('data-highlighted');
        expect(day).not.toHaveAttribute('aria-describedby');
    });

    it('selects, switches, and resets preview days through track clicks', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        const { container } = render(<TripStoryProvider manifest={manifest}><TripRoutePreview /></TripStoryProvider>);
        await screen.findByRole('img');
        const line = container.querySelector(`polyline[stroke="${dayColor(manifest, 'homebound')}"]`)!;
        const originalPoints = line.getAttribute('points');
        const coastbound = screen.getByRole('button', { name: '1. Coastbound' });
        const homebound = screen.getByRole('button', { name: '2. Homebound' });
        fireEvent.click(homebound);
        const buttonPoints = line.getAttribute('points');
        fireEvent.click(homebound);
        fireEvent.click(line);
        expect(homebound).toHaveAttribute('aria-pressed', 'true');
        expect(line).toHaveAttribute('points', buttonPoints);
        expect(line).not.toHaveAttribute('points', originalPoints);
        fireEvent.click(line);
        expect(homebound).toHaveAttribute('aria-pressed', 'false');
        expect(line).toHaveAttribute('points', originalPoints);
        fireEvent.click(coastbound);
        fireEvent.click(line);
        expect(homebound).toHaveAttribute('aria-pressed', 'true');
        expect(coastbound).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(screen.getByRole('img'));
        expect(homebound).toHaveAttribute('aria-pressed', 'false');
        expect(line).toHaveAttribute('points', originalPoints);
    });

    it('shows separate outbound and return days for the published Ocean Shores tracks', async () => {
        const trip = tripManifestSchema.parse(oceanShoresManifest);
        const coastalRoute = {
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', properties: { trackId: 'paseo-de-rever-02-17-24' },
                    geometry: { type: 'LineString', coordinates: [[-122.32373, 47.59587], [-124.16739, 47.01277]] } },
                { type: 'Feature', properties: { trackId: 'paseo-de-rever-02-20-24' },
                    geometry: { type: 'LineString', coordinates: [[-124.16075, 47.00782], [-122.33947, 47.60292]] } },
            ],
        };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => coastalRoute }));
        const { container } = render(<TripStoryProvider manifest={trip}><TripRoutePreview /></TripStoryProvider>);
        await screen.findByRole('img');
        expect(screen.getByRole('group', { name: 'Map days' })).toBeVisible();
        expect(screen.getByRole('button', { name: '1. Seattle to Ocean Shores' })).toBeVisible();
        const returnDay = screen.getByRole('button', { name: '2. Ocean Shores to Seattle' });
        expect(returnDay).toBeVisible();
        expect(container.querySelectorAll('polyline[stroke="#fbbf24"]')).toHaveLength(1);
        expect(container.querySelectorAll('polyline[stroke="#38bdf8"]')).toHaveLength(1);
        fireEvent.click(returnDay);
        expect(returnDay).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('img')).toHaveAccessibleName('Map of Ocean Shores to Seattle.');
    });

    it('links SVG route hover, the bottom day label, and its tooltip without changing the extent', async () => {
        const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => route });
        vi.stubGlobal('fetch', fetch);
        const { container } = render(<TripStoryProvider manifest={manifest}><TripRoutePreview /></TripStoryProvider>);
        await screen.findByRole('img');
        const line = container.querySelector(`polyline[stroke="${dayColor(manifest, 'homebound')}"]`)!;
        const originalPoints = line.getAttribute('points');
        const day = screen.getByRole('button', { name: '2. Homebound' });
        fireEvent.mouseEnter(line);
        expect(day).toHaveAttribute('data-highlighted', 'true');
        expect(day).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('tooltip')).toHaveTextContent('Homebound');
        expect(line).toHaveAttribute('points', originalPoints);
        fireEvent.mouseLeave(line);
        expect(day).not.toHaveAttribute('data-highlighted');
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        fireEvent.focus(day);
        expect(day).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
        fireEvent.blur(day);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(fetch).toHaveBeenCalledOnce();
    });

    it('resolves hover membership and anchors only from complete assigned route geometry', () => {
        expect(tripMapDayForTrack(manifest, 'afternoon')?.id).toBe('coastbound');
        expect(tripMapDayForTrack(manifest, 'unassigned')).toBeUndefined();
        expect(tripMapDayForTrack(manifest, 42)).toBeUndefined();
        expect(tripMapDayAnchor(manifest, route, 'homebound')).toEqual([-122, 47]);
        expect(tripMapDayAnchor(manifest, route, 'missing')).toBeUndefined();
        const partial = { type: 'FeatureCollection' as const, features: routeFeatures(route).slice(0, 1) };
        expect(tripMapDayAnchor(manifest, partial, 'coastbound')).toBeUndefined();
    });

    it('emphasizes preview days on hover and restores its original extent after clicking away', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        const { container } = render(<TripStoryProvider manifest={manifest}><TripRoutePreview /></TripStoryProvider>);
        await screen.findByRole('img');
        const day = screen.getByRole('button', { name: '2. Homebound' });
        const points = () => Array.from(container.querySelectorAll('polyline'), line => line.getAttribute('points')).sort();
        const originalPoints = points();
        fireEvent.mouseEnter(day);
        expect(container.querySelectorAll('polyline[stroke="#09090b"][opacity="0.85"]')).toHaveLength(4);
        expect(points()).toEqual(originalPoints);
        fireEvent.click(day);
        expect(day).toHaveAttribute('aria-pressed', 'true');
        expect(points()).not.toEqual(originalPoints);
        fireEvent.click(document.body);
        expect(day).toHaveAttribute('aria-pressed', 'false');
        expect(points()).toEqual(originalPoints);
        expect(container.querySelectorAll('polyline[stroke="#09090b"][opacity="0.85"]')).toHaveLength(0);
    });

    it('uses black background tracks when an overview preview selects a day', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        const { container } = render(<TripStoryProvider manifest={manifest}>
            <TripRoutePreview dayId="coastbound" allowDaySelection onDaySelect={vi.fn()} />
        </TripStoryProvider>);
        await waitFor(() => expect(container.querySelectorAll('polyline')).toHaveLength(5));
        expect(container.querySelectorAll('polyline[stroke="#09090b"][opacity="0.85"][stroke-width="7"]')).toHaveLength(2);
        expect(container.querySelectorAll('circle')).toHaveLength(0);
    });

    it('highlights a selected track while retaining muted context in the preview', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        const { container } = render(<TripStoryProvider manifest={manifest}><TripRoutePreview trackId="return" /></TripStoryProvider>);
        await waitFor(() => expect(container.querySelectorAll('polyline')).toHaveLength(5));
        expect(container.querySelectorAll('polyline[stroke="#f59e0b"]')).toHaveLength(1);
        expect(container.querySelectorAll('polyline[stroke="#71717a"]')).toHaveLength(4);
        expect(screen.getByRole('img')).toHaveAccessibleName('Map focused on Return ride.');
    });

    it('loads the preview only when approached and places day controls below it', async () => {
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
        expect(screen.getByRole('button', { name: '1. Coastbound' }).closest('figcaption')).not.toBeNull();
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

    it('renders the focused day above black background tracks while retaining its scoped POIs and extent', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => route }));
        const { container, rerender } = render(<TripStoryProvider manifest={manifest}><TripRoutePreview dayId="homebound" /></TripStoryProvider>);
        await waitFor(() => expect(container.querySelectorAll('polyline')).toHaveLength(5));
        expect(screen.getByRole('img')).toHaveAccessibleName('Map of Homebound.');
        expect(container.querySelectorAll('polyline[stroke="#09090b"][opacity="0.85"][stroke-width="7"]')).toHaveLength(4);
        expect(screen.queryByText('Homebound', { exact: true })).not.toBeInTheDocument();
        const selected = container.querySelector(`polyline[stroke="${dayColor(manifest, 'homebound')}"]`)!;
        expect(container.querySelectorAll('polyline')[4]).toBe(selected);
        const originalPoints = selected.getAttribute('points');
        const expandedRoute = { type: 'FeatureCollection' as const, features: [...routeFeatures(route), {
            type: 'Feature' as const, properties: { trackId: 'distant' },
            geometry: { type: 'LineString' as const, coordinates: [[100, 0], [120, 1]] },
        }] };
        const expandedState = { route: expandedRoute, error: '', retry: vi.fn() };
        rerender(<TripStoryProvider manifest={manifest}><TripRoutePreview dayId="homebound"
            routeState={expandedState} /></TripStoryProvider>);
        expect(container.querySelectorAll('polyline')).toHaveLength(6);
        expect(container.querySelector(`polyline[stroke="${dayColor(manifest, 'homebound')}"]`)).toHaveAttribute('points', originalPoints);
        expect(container.querySelectorAll('circle')).toHaveLength(2);
        expect(screen.queryByText(/Harbor/)).not.toBeInTheDocument();
        rerender(<TripStoryProvider manifest={manifest}><TripRoutePreview dayId="homebound" showStops={false} routeState={expandedState} /></TripStoryProvider>);
        expect(container.querySelectorAll('circle')).toHaveLength(0);
        expect(screen.queryByText(/Shared camp/)).not.toBeVisible();
    });
});
