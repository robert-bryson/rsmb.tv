import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorldPinsData } from '../../src/features/pins/data';
import { clearCache } from '../../src/data/fetchCache';
import { readPinsArtifact } from './pinsFixtures';

const artifacts = new Map(['world/pins.json', 'world/countries.geojson', 'world/regions/CAN.json', 'world/regions/CAN.geojson',
    'world/regions/AUS.json', 'world/regions/AUS.geojson'].map(filename => [filename, readPinsArtifact(filename)]));
const filename = (url: string) => url.split('/pins-of-inaccessibility/')[1];
const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

beforeEach(() => clearCache());
afterEach(() => { cleanup(); clearCache(); vi.unstubAllGlobals(); });

describe('country-specific lazy resources', () => {
    it('does not load global files for the U.S. or province files for the world overview', async () => {
        const fetch = vi.fn(async (url: string) => response(artifacts.get(filename(url))));
        vi.stubGlobal('fetch', fetch);
        const hook = renderHook(({ country }) => useWorldPinsData(country), { initialProps: { country: 'USA' } });
        expect(fetch).not.toHaveBeenCalled();
        hook.rerender({ country: 'ALL' });
        await waitFor(() => expect(hook.result.current.pins.data?.pins).toHaveLength(257), { timeout: 10_000 });
        await waitFor(() => expect(hook.result.current.countries.data?.features).toHaveLength(257), { timeout: 10_000 });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(hook.result.current.regions.loading).toBe(false);
    }, 20_000);

    it('reuses the country index and isolates province data during rapid country changes', async () => {
        let releaseCanada!: () => void;
        const gate = new Promise<void>(resolve => { releaseCanada = resolve; });
        const fetch = vi.fn(async (url: string) => {
            if (filename(url).includes('/CAN.')) await gate;
            return response(artifacts.get(filename(url)));
        });
        vi.stubGlobal('fetch', fetch);
        const hook = renderHook(({ country }) => useWorldPinsData(country), { initialProps: { country: 'CAN' } });
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4), { timeout: 10_000 });
        hook.rerender({ country: 'AUS' });
        expect(hook.result.current.regions.data).toBeNull();
        await waitFor(() => expect(hook.result.current.regions.data?.pins).toHaveLength(11), { timeout: 10_000 });
        await act(async () => releaseCanada());
        expect(hook.result.current.regions.data?.metadata.countryCode).toBe('AUS');
        expect(hook.result.current.outlines.data?.features.every(feature => feature.properties.countryCode === 'AUS')).toBe(true);
        hook.rerender({ country: 'CAN' });
        expect(hook.result.current.regions.data).toBeNull();
        await waitFor(() => expect(hook.result.current.regions.data?.pins).toHaveLength(13), { timeout: 10_000 });
        expect(fetch).toHaveBeenCalledTimes(6);
    }, 20_000);

    it('rejects a swapped province file and retries only the failed resource', async () => {
        let wrong = true;
        const fetch = vi.fn(async (url: string) => response(artifacts.get(wrong && filename(url) === 'world/regions/CAN.json' ? 'world/regions/AUS.json' : filename(url))));
        vi.stubGlobal('fetch', fetch);
        const { result } = renderHook(() => useWorldPinsData('CAN'));
        await waitFor(() => expect(result.current.regions.error).toBe('Could not load world/regions/CAN.json.'), { timeout: 10_000 });
        wrong = false;
        act(() => result.current.regions.retry());
        await waitFor(() => expect(result.current.regions.data?.pins).toHaveLength(13), { timeout: 10_000 });
        expect(fetch).toHaveBeenCalledTimes(5);
    }, 20_000);

    it('loads outlines only while the province layer is enabled and suppresses a hidden outline error', async () => {
        let invalid = true;
        const fetch = vi.fn(async (url: string) => response(invalid && filename(url) === 'world/regions/CAN.geojson' ? {} : artifacts.get(filename(url))));
        vi.stubGlobal('fetch', fetch);
        const hook = renderHook(({ visible }) => useWorldPinsData('CAN', visible), { initialProps: { visible: false } });
        await waitFor(() => expect(hook.result.current.regions.data?.pins).toHaveLength(13), { timeout: 10_000 });
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(hook.result.current.outlines.loading).toBe(false);
        hook.rerender({ visible: true });
        await waitFor(() => expect(hook.result.current.outlines.error).not.toBeNull(), { timeout: 10_000 });
        hook.rerender({ visible: false });
        expect(hook.result.current.outlines.error).toBeNull();
        expect(hook.result.current.outlines.loading).toBe(false);
        invalid = false;
        hook.rerender({ visible: true });
        await waitFor(() => expect(hook.result.current.outlines.data?.features).toHaveLength(13), { timeout: 10_000 });
        expect(fetch).toHaveBeenCalledTimes(5);
    }, 20_000);
});
