import { afterEach, expect, it, vi } from 'vitest';
import type { PrefetchTarget } from '../navigation/prefetchTargets';
import { prepareDestination } from '../navigation/prefetchDestination';

const mocks = vi.hoisted(() => ({
    page: vi.fn(), post: vi.fn(), body: vi.fn(), manifest: vi.fn(),
    flights: vi.fn(), flightData: vi.fn(), temperature: vi.fn(), temperatureData: vi.fn(),
    tornado: vi.fn(), tornadoData: vi.fn(), atlas: vi.fn(),
}));
vi.mock('../navigation/pageLoaders', () => ({ pageLoaders: { article: mocks.page, '/about': mocks.page,
    '/projects/flights/map': mocks.page, '/projects/temperature-records/map': mocks.page,
    '/projects/tornado-tracks/map': mocks.page, '/projects/adv-atlas/map': mocks.page } }));
vi.mock('../content/posts', () => ({ getPostBySlug: mocks.post }));
vi.mock('../features/trips/tripManifests', () => ({ loadTripManifest: mocks.manifest }));
vi.mock('../features/flights/loadFlightsMap', () => ({ loadFlightsMap: mocks.flights, warmFlightData: mocks.flightData }));
vi.mock('../features/temperatures/loadTemperatureMap', () => ({ loadTemperatureMap: mocks.temperature, warmTemperatureData: mocks.temperatureData }));
vi.mock('../features/tornadoes/loadTornadoMap', () => ({ loadTornadoMap: mocks.tornado, warmTornadoData: mocks.tornadoData }));
vi.mock('../features/trips/atlas/loadTripAtlasMap', () => ({ loadTripAtlasMap: mocks.atlas }));

afterEach(() => vi.resetAllMocks());

const target = (page: PrefetchTarget['page'], map?: PrefetchTarget['map']): PrefetchTarget => ({ key: page, page, map, search: '?view=county' });

it('prepares only the selected article and its manifest, without maps or unrelated bodies', async () => {
    mocks.post.mockReturnValue({ format: 'trip', tripId: 'coast', loadComponent: mocks.body });
    await prepareDestination({ ...target('article'), slug: 'coast-report' }, true, false);
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith('coast-report');
    expect(mocks.body).toHaveBeenCalledTimes(1);
    expect(mocks.manifest).toHaveBeenCalledExactlyOnceWith('coast');
    expect(mocks.atlas).not.toHaveBeenCalled(); expect(mocks.flights).not.toHaveBeenCalled();
});

it('keeps article bodies and nested renderers out of page-only preparation', async () => {
    await prepareDestination(target('/projects/flights/map', 'flights'), true, false);
    await prepareDestination({ ...target('article'), slug: 'coast-report' }, false, false);
    expect(mocks.page).toHaveBeenCalledTimes(2);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.flights).not.toHaveBeenCalled(); expect(mocks.flightData).not.toHaveBeenCalled();
});

it.each([
    ['/projects/flights/map', 'flights', 'flights', 'flightData'],
    ['/projects/temperature-records/map', 'temperatures', 'temperature', 'temperatureData'],
    ['/projects/tornado-tracks/map', 'tornadoes', 'tornado', 'tornadoData'],
    ['/projects/adv-atlas/map', 'atlas', 'atlas', undefined],
] as const)('prepares the allowlisted renderer and data for %s', async (page, map, renderer, data) => {
    await prepareDestination(target(page, map), true, true);
    expect(mocks[renderer]).toHaveBeenCalledTimes(1);
    if (data) expect(mocks[data]).toHaveBeenCalledTimes(1);
    if (data === 'temperatureData') expect(mocks.temperatureData).toHaveBeenCalledWith('?view=county');
});

it('awaits pending data even when its renderer fails early', async () => {
    let release!: () => void;
    mocks.flightData.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
    mocks.flights.mockRejectedValue(new Error('Module unavailable'));
    const settled = vi.fn();
    const request = prepareDestination(target('/projects/flights/map', 'flights'), true, true);
    void request.catch(settled);
    await vi.waitFor(() => expect(mocks.flightData).toHaveBeenCalled());
    expect(settled).not.toHaveBeenCalled();
    release(); await expect(request).rejects.toThrow('Module unavailable');
});

it('tolerates a missing article and keeps non-trip bodies independent of manifests', async () => {
    await prepareDestination({ ...target('article'), slug: 'missing' }, true, false);
    mocks.post.mockReturnValue({ format: 'blog', loadComponent: mocks.body });
    await prepareDestination({ ...target('article'), slug: 'ordinary' }, true, false);
    expect(mocks.body).toHaveBeenCalledTimes(1); expect(mocks.manifest).not.toHaveBeenCalled();
});
