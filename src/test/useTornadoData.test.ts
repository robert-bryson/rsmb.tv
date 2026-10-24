import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache } from '../features/flights/utils/fetchCache';
import { useTornadoData } from '../features/tornadoes/hooks/useTornadoData';
import { jsonFetchResponse } from './helpers/fetch';

const collection = { type: 'FeatureCollection', features: [] };

function deferredResponse() {
    let resolve!: (value: Response) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<Response>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

describe('useTornadoData', () => {
    beforeEach(() => clearCache());
    afterEach(() => { clearCache(); vi.unstubAllGlobals(); });

    it.each(['tracks', 'track-points'])('preserves %s errors when the other data request succeeds', async failedType => {
        const successful = deferredResponse();
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes(`/${failedType}/`)) return Promise.reject(new Error(`${failedType} unavailable`));
            if (/\/(tracks|track-points)\//.test(url)) return successful.promise;
            return Promise.resolve(jsonFetchResponse([]));
        }));
        const { result } = renderHook(() => useTornadoData({ startYear: 2020, endYear: 2020, loadPoints: true }));
        await waitFor(() => expect(result.current.error).toBe(`${failedType} unavailable`));
        await act(async () => successful.resolve(jsonFetchResponse(collection)));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe(`${failedType} unavailable`);
    });

    it('hides density errors when density mode is disabled', async () => {
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/track-points/')) return Promise.reject(new Error('Density unavailable'));
            return Promise.resolve(jsonFetchResponse(url.includes('/tracks/') ? collection : []));
        }));
        const { result, rerender } = renderHook(({ loadPoints }) => useTornadoData({ startYear: 2020, endYear: 2020, loadPoints }), {
            initialProps: { loadPoints: true },
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe('Density unavailable');
        rerender({ loadPoints: false });
        expect(result.current.error).toBeNull();
    });

    it('does not retain errors from a previous year range', async () => {
        const next = deferredResponse();
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/tracks/2020')) return Promise.reject(new Error('Old year unavailable'));
            if (url.includes('/tracks/2021')) return next.promise;
            return Promise.resolve(jsonFetchResponse([]));
        }));
        const { result, rerender } = renderHook(({ year }) => useTornadoData({ startYear: year, endYear: year }), {
            initialProps: { year: 2020 },
        });
        await waitFor(() => expect(result.current.error).toBe('Old year unavailable'));
        rerender({ year: 2021 });
        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBeNull();
        await act(async () => next.resolve(jsonFetchResponse(collection)));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBeNull();
    });
});
