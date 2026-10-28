import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripMapBlock } from '../blog/TripMdxBlocks';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { clearTripRouteCache } from '../features/trips/useTripRoute';
import { dayMapManifest as manifest } from './fixtures/tripDayMap';

vi.mock('../features/trips/components/TripRouteMap', () => ({
    TripRouteMap: ({ initialDayId }: { initialDayId?: string }) => <output data-testid="interactive-day">
        {initialDayId ?? 'none'}
    </output>,
}));

afterEach(() => { clearTripRouteCache(); vi.unstubAllGlobals(); });

function story(url: string, days = manifest.days, focus: { trackId?: string; stopId?: string } = {}) {
    return <TripStoryProvider manifest={{ ...manifest, days, route: { ...manifest.route, geoJson: url } }}>
        <TripMapBlock {...focus} />
    </TripStoryProvider>;
}

function keepPreview() {
    vi.stubGlobal('IntersectionObserver', class {
        observe = vi.fn();
        disconnect = vi.fn();
    });
}

describe('preview selection ownership', () => {
    it.each([{ trackId: 'return' }, { stopId: 'finish' }])(
        'clears the overview day when the block changes focus to %j', async focus => {
            keepPreview();
            const { rerender } = render(story('/first.geojson'));
            fireEvent.click(screen.getByRole('button', { name: '1. Coastbound' }));
            rerender(story('/first.geojson', manifest.days, focus));
            expect(screen.queryByRole('group', { name: 'Map days' })).not.toBeInTheDocument();
            if (focus.trackId) expect(screen.getByText('Return ride')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
            expect(await screen.findByTestId('interactive-day')).toHaveTextContent('none');
            rerender(story('/first.geojson'));
            expect(screen.getByTestId('interactive-day')).toHaveTextContent('none');
        },
    );

    it('clears selection when a route changes and does not restore it on a return to the first route', () => {
        keepPreview();
        const { rerender } = render(story('/first.geojson'));
        const day = screen.getByRole('button', { name: '1. Coastbound' });
        fireEvent.click(day);
        expect(day).toHaveAttribute('aria-pressed', 'true');

        rerender(story('/second.geojson'));
        expect(day).toHaveAttribute('aria-pressed', 'false');
        rerender(story('/first.geojson'));
        expect(day).toHaveAttribute('aria-pressed', 'false');
    });

    it('does not pass an old day ID into a replacement route with different days', () => {
        keepPreview();
        const { rerender } = render(story('/first.geojson'));
        fireEvent.click(screen.getByRole('button', { name: '1. Coastbound' }));

        rerender(story('/second.geojson', manifest.days?.filter(day => day.id === 'homebound')));
        expect(screen.queryByText('Unknown trip day: coastbound.')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '1. Homebound' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('hands the selected day to the interactive map and clears it when the route is replaced', async () => {
        keepPreview();
        const { rerender } = render(story('/first.geojson'));
        fireEvent.click(screen.getByRole('button', { name: '1. Coastbound' }));
        fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
        expect(await screen.findByTestId('interactive-day')).toHaveTextContent('coastbound');

        rerender(story('/second.geojson'));
        expect(screen.getByTestId('interactive-day')).toHaveTextContent('none');
    });
});
