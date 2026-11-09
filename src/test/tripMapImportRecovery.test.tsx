import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TripMapBlock } from '../blog/TripMdxBlocks';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { dayMapManifest } from './fixtures/tripDayMap';

const state = vi.hoisted(() => ({ fail: true, attempts: 0 }));
vi.mock('../navigation/moduleLoader', () => ({
    MAPLIBRE_STYLESHEET: /maplibre/,
    moduleLoader: (load: () => Promise<unknown>) => () => {
        state.attempts++;
        return state.fail ? Promise.reject(new Error('Map module download failed')) : load();
    },
}));
vi.mock('../features/trips/components/TripRouteMap', () => ({
    TripRouteMap: () => <output>Recovered map renderer</output>,
}));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('retries a rejected lazy import rather than reusing its rejected React component type', async () => {
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<TripStoryProvider manifest={dayMapManifest}><TripMapBlock /></TripStoryProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
    expect(await screen.findByText(/Interactive map unavailable/)).toBeVisible();
    expect(state.attempts).toBe(1);
    state.fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
    expect(await screen.findByText('Recovered map renderer')).toBeVisible();
    expect(screen.queryByText(/Interactive map unavailable/)).not.toBeInTheDocument();
    expect(state.attempts).toBe(2);
    unmount();
    render(<TripStoryProvider manifest={dayMapManifest}><TripMapBlock /></TripStoryProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Explore interactive map' }));
    expect(await screen.findByText('Recovered map renderer')).toBeVisible();
    expect(screen.queryByText(/Interactive map unavailable/)).not.toBeInTheDocument();
});
