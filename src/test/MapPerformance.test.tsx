import { StrictMode, useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapPerformance } from '../components/MapPerformance';
import { trackAnalyticsEvent } from '../utils/analytics';

vi.mock('../utils/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));
beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: false })));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

function Scene() {
    const location = useLocation();
    const navigate = useNavigate();
    const [failed, setFailed] = useState(false);
    return <>
        <MapPerformance />
        <span data-route-path={location.pathname} />
        <button onClick={() => navigate('?state=KS')}>Filter</button>
        <button onClick={() => navigate('/about')}>About</button>
        <button onClick={() => navigate('/projects/flights/map')}>Flights</button>
        <button onClick={() => setFailed(true)}>Fail page</button>
        {failed && <section data-testid="page-error" />}
        <div data-testid="temperature-map" data-map-state="loading" />
        <div data-testid="flights-map" data-map-state="loading" />
        <div data-testid="pins-map" data-map-state="loading" />
    </>;
}

describe('map performance', () => {
    it('measures a client visit from its route commit and ignores the previous map', async () => {
        vi.stubGlobal('matchMedia', () => ({ matches: false }));
        render(<MemoryRouter initialEntries={['/about']}><Scene /></MemoryRouter>);
        const start = performance.now();
        fireEvent.click(screen.getByRole('button', { name: 'Flights' }));
        screen.getByTestId('temperature-map').dataset.mapState = 'ready';
        await new Promise<void>(resolve => queueMicrotask(resolve));
        expect(trackAnalyticsEvent).not.toHaveBeenCalled();
        screen.getByTestId('flights-map').dataset.mapState = 'ready';
        await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledOnce());
        expect(trackAnalyticsEvent).toHaveBeenLastCalledWith('map-ready', expect.objectContaining({
            feature: 'flights', state: 'ready', navigation: 'client', device: 'desktop',
        }), '/projects/flights/map');
        const duration = vi.mocked(trackAnalyticsEvent).mock.calls[0][1]!.durationMs;
        expect(duration).toBeGreaterThanOrEqual(0);
        expect(duration).toBeLessThanOrEqual(Math.ceil(performance.now() - start));
        fireEvent.click(screen.getByRole('button', { name: 'About' }));
        screen.getByTestId('flights-map').dataset.mapState = 'error';
        await new Promise<void>(resolve => queueMicrotask(resolve));
        expect(trackAnalyticsEvent).toHaveBeenCalledOnce();
    });

    it('waits for the route marker and reports a page-download failure once', async () => {
        render(<MemoryRouter initialEntries={['/projects/temperature-records/map']}><Scene /></MemoryRouter>);
        const marker = document.querySelector<HTMLElement>('[data-route-path]')!;
        marker.dataset.routePath = '/about';
        screen.getByTestId('temperature-map').dataset.mapState = 'ready';
        await new Promise<void>(resolve => queueMicrotask(resolve));
        expect(trackAnalyticsEvent).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Fail page' }));
        await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledOnce());
        expect(trackAnalyticsEvent).toHaveBeenLastCalledWith('map-startup-error', expect.objectContaining({ state: 'error' }), '/projects/temperature-records/map');
        marker.dataset.routePath = '/still-loading';
        await new Promise<void>(resolve => queueMicrotask(resolve));
        expect(trackAnalyticsEvent).toHaveBeenCalledOnce();
    });

    it('reports a startup failure and later recovery once, including Strict Mode and filter changes', async () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        render(<StrictMode><MemoryRouter initialEntries={['/projects/temperature-records/map']}><Scene /></MemoryRouter></StrictMode>);
        const map = screen.getByTestId('temperature-map');
        map.dataset.mapState = 'error';
        await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledWith('map-startup-error', expect.objectContaining({ feature: 'temperature-records', state: 'error', navigation: 'document' }), '/projects/temperature-records/map'));
        map.dataset.mapState = 'degraded';
        await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledTimes(3));
        expect(trackAnalyticsEvent).toHaveBeenCalledWith('map-ready', expect.objectContaining({ state: 'degraded', device: 'mobile', revision: expect.any(String) }), '/projects/temperature-records/map');
        expect(trackAnalyticsEvent).toHaveBeenLastCalledWith('map-recovered', { feature: 'temperature-records', state: 'degraded', phase: 'startup' }, '/projects/temperature-records/map');
        fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
        map.dataset.mapState = 'ready';
        await new Promise<void>(resolve => queueMicrotask(resolve));
        expect(trackAnalyticsEvent).toHaveBeenCalledTimes(3);
        map.dataset.mapState = 'error';
        await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledTimes(4));
        map.dataset.mapState = 'fallback';
        await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledTimes(5));
        expect(trackAnalyticsEvent).toHaveBeenLastCalledWith('map-recovered', { feature: 'temperature-records', state: 'fallback', phase: 'runtime' }, '/projects/temperature-records/map');
    });

    it.each(['flights', 'pins-of-inaccessibility'] as const)('reports %s runtime failure and recovery without duplicating readiness', async feature => {
        render(<MemoryRouter initialEntries={[`/projects/${feature}/map`]}><Scene /></MemoryRouter>);
        const map = screen.getByTestId(feature === 'flights' ? 'flights-map' : 'pins-map');
        map.dataset.mapState = 'ready';
        await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledOnce());
        map.dataset.mapState = 'error';
        await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledWith('map-runtime-error', expect.objectContaining({ feature }), `/projects/${feature}/map`));
        map.dataset.mapState = 'loading';
        await new Promise<void>(resolve => queueMicrotask(resolve));
        map.dataset.mapState = 'fallback';
        await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledTimes(3));
        expect(trackAnalyticsEvent).toHaveBeenLastCalledWith('map-recovered', { feature, state: 'fallback', phase: 'runtime' }, `/projects/${feature}/map`);
        map.dataset.mapState = 'ready';
        await new Promise<void>(resolve => queueMicrotask(resolve));
        expect(trackAnalyticsEvent).toHaveBeenCalledTimes(3);
    });
});
