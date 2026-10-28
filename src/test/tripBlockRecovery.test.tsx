import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripGalleryBlock, TripMapBlock } from '../blog/TripMdxBlocks';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import type { TripManifest } from '../features/trips/types';
import type { TripMapFocus } from '../features/trips/tripMapView';
import { dayMapManifest } from './fixtures/tripDayMap';

const failures = vi.hoisted(() => ({ map: false, gallery: false }));

vi.mock('../features/trips/components/TripRouteMap', () => ({
    TripRouteMap: () => {
        if (failures.map) throw new Error('Map construction failed');
        return <output>Interactive map</output>;
    },
}));
vi.mock('../features/trips/components/TripGallery', () => ({
    TripGallery: ({ galleryId }: { galleryId: string }) => {
        if (failures.gallery) throw new Error('Gallery rendering failed');
        return <output>Gallery: {galleryId}</output>;
    },
}));

afterEach(() => {
    failures.map = false;
    failures.gallery = false;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function story(manifest: TripManifest = dayMapManifest, focus: TripMapFocus = {}) {
    return <TripStoryProvider manifest={manifest}><TripMapBlock {...focus} /></TripStoryProvider>;
}

function keepPreviewOffscreen() {
    vi.stubGlobal('IntersectionObserver', class {
        observe() {}
        disconnect() {}
    });
}

describe('trip block recovery', () => {
    it.each(['route', 'track', 'day', 'stops', 'days'] as const)(
        'recovers a failed map when its %s configuration changes', async replacement => {
            keepPreviewOffscreen();
            vi.spyOn(console, 'error').mockImplementation(() => {});
            failures.map = true;
            const { rerender } = render(story());
            fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
            await screen.findByText('Interactive map unavailable. The route and story are still available.');

            failures.map = false;
            const manifest = {
                ...dayMapManifest,
                ...(replacement === 'route' ? { route: { ...dayMapManifest.route, geoJson: '/replacement.geojson' } } : {}),
                ...(replacement === 'stops' ? { stops: [...dayMapManifest.stops] } : {}),
                ...(replacement === 'days' ? { days: [...dayMapManifest.days!] } : {}),
            };
            const focus = replacement === 'track' ? { trackId: 'return' }
                : replacement === 'day' ? { dayId: 'homebound' } : {};
            rerender(story(manifest, focus));
            expect(await screen.findByText('Interactive map')).toBeVisible();
            expect(screen.queryByText(/Interactive map unavailable/)).not.toBeInTheDocument();
        },
    );

    it('retries a failed map without a configuration change', async () => {
        keepPreviewOffscreen();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        failures.map = true;
        render(story());
        fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
        await screen.findByText(/Interactive map unavailable/);
        failures.map = false;
        fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
        expect(await screen.findByText('Interactive map')).toBeVisible();
    });

    it('keeps a healthy map mounted when only its requested stop changes', async () => {
        keepPreviewOffscreen();
        const { rerender } = render(story(dayMapManifest, { stopId: 'finish' }));
        fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
        const map = await screen.findByText('Interactive map');
        rerender(story(dayMapManifest, { stopId: 'camp' }));
        expect(screen.getByText('Interactive map')).toBe(map);
    });

    it('recovers a failed gallery when its gallery ID changes', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        failures.gallery = true;
        const { rerender } = render(<TripGalleryBlock galleryId="first" />);
        await screen.findByText('These photos could not load. Reload the page to try again.');
        failures.gallery = false;
        rerender(<TripGalleryBlock galleryId="second" />);
        expect(await screen.findByText('Gallery: second')).toBeVisible();
    });
});
