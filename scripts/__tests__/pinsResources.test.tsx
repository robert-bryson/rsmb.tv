import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, getCacheStats } from '../../src/data/fetchCache';
import { usePinsData } from '../../src/features/pins/data';
import { publishedPins, readPinsArtifact } from './pinsFixtures';

const states = readPinsArtifact('states.geojson');
const counties = readPinsArtifact('counties.geojson');
const artifacts: Record<string, unknown> = { 'pins.json': publishedPins, 'states.geojson': states, 'counties.geojson': counties };
const response = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

describe('pin resource loading', () => {
    beforeEach(() => clearCache());
    afterEach(() => { cleanup(); clearCache(); vi.unstubAllGlobals(); });

    it('deduplicates readers and loads counties only when enabled, then reuses them', async () => {
        const fetch = vi.fn(async (url: string) => response(artifacts[url.split('/').at(-1)!]));
        vi.stubGlobal('fetch', fetch);
        const first = renderHook(({ enabled }) => usePinsData(enabled), { initialProps: { enabled: false } });
        const second = renderHook(() => usePinsData(false));
        await waitFor(() => expect(first.result.current.states.data?.features).toHaveLength(56), { timeout: 10_000 });
        await waitFor(() => expect(second.result.current.pins.data?.pins).toHaveLength(3292), { timeout: 10_000 });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(first.result.current.counties.loading).toBe(false);
        first.rerender({ enabled: true });
        await waitFor(() => expect(first.result.current.counties.data?.features).toHaveLength(3235), { timeout: 10_000 });
        first.rerender({ enabled: false });
        first.rerender({ enabled: true });
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(first.result.current.counties.error).toBeNull();
    }, 20_000);

    it('evicts malformed data and retries only the failed resource', async () => {
        let invalid = true;
        const fetch = vi.fn(async (url: string) => response(url.endsWith('pins.json') && invalid ? {} : artifacts[url.split('/').at(-1)!]));
        vi.stubGlobal('fetch', fetch);
        const { result } = renderHook(() => usePinsData(false));
        await waitFor(() => expect(result.current.pins.error).toBe('Could not load pins.json.'), { timeout: 10_000 });
        expect(result.current.pins.loading).toBe(false);
        expect(getCacheStats().entries).toBe(1);
        invalid = false;
        act(() => result.current.pins.retry());
        expect(result.current.pins.error).toBeNull();
        await waitFor(() => expect(result.current.pins.data?.metadata.countyCount).toBe(3235), { timeout: 10_000 });
        expect(fetch).toHaveBeenCalledTimes(3);
    }, 20_000);

    it('rejects a county file served as state boundaries and recovers a network failure', async () => {
        let broken = true;
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (broken && url.endsWith('counties.geojson')) throw new TypeError('offline');
            return response(broken && url.endsWith('states.geojson') ? counties : artifacts[url.split('/').at(-1)!]);
        }));
        const { result } = renderHook(() => usePinsData(true));
        await waitFor(() => expect(result.current.states.error).not.toBeNull(), { timeout: 10_000 });
        await waitFor(() => expect(result.current.counties.error).not.toBeNull(), { timeout: 10_000 });
        broken = false;
        act(() => { result.current.states.retry(); result.current.counties.retry(); });
        await waitFor(() => expect(result.current.states.data?.features).toHaveLength(56), { timeout: 10_000 });
        await waitFor(() => expect(result.current.counties.data?.features).toHaveLength(3235), { timeout: 10_000 });
    }, 20_000);

    it('ignores a disabled county request until it is enabled again', async () => {
        let resolveCounty!: (response: Response) => void;
        vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('counties.geojson')
            ? new Promise<Response>(resolve => { resolveCounty = resolve; }) : Promise.resolve(response(artifacts[url.split('/').at(-1)!]))));
        const { result, rerender, unmount } = renderHook(({ enabled }) => usePinsData(enabled), { initialProps: { enabled: true } });
        await waitFor(() => expect(resolveCounty).toBeTypeOf('function'), { timeout: 10_000 });
        rerender({ enabled: false });
        await act(async () => resolveCounty(response(counties)));
        expect(result.current.counties.data).toBeNull();
        expect(result.current.counties.error).toBeNull();
        rerender({ enabled: true });
        await waitFor(() => expect(result.current.counties.data?.features).toHaveLength(3235), { timeout: 10_000 });
        unmount();
    }, 20_000);
});
