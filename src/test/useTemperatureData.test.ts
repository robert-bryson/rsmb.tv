import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTemperatureData } from '../features/temperatures/hooks/useTemperatureData';
import { clearCache } from '../features/flights/utils/fetchCache';
import { jsonFetchResponse } from './helpers/fetch';

function deferredResponse() {
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>((res) => { resolve = res; });
    return { promise, resolve };
}

const recentRecords = { yesterday: [], last7Days: [] };
const summary = { generatedAt: '2026-05-28T00:00:00.000Z' };
const stateRecords = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-120, 35] },
            properties: { state: 'CA', type: 'high', tempF: 130, date: '1913-07-10' },
        },
    ],
};
const countyRecords = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-120, 35] },
            properties: { countyFips: '06027', state: 'CA', type: 'high', tempF: 130, date: '1913-07-10' },
        },
    ],
};

describe('useTemperatureData', () => {
    beforeEach(() => {
        clearCache();
        vi.restoreAllMocks();
    });

    it('loads recent records without fetching all-time data while disabled', async () => {
        globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/recentRecords.json')) return Promise.resolve(jsonFetchResponse(recentRecords));
            if (url.endsWith('/summary.json')) return Promise.resolve(jsonFetchResponse(summary));
            return Promise.reject(new Error(`Unexpected fetch: ${url}`));
        });

        const { result } = renderHook(() => useTemperatureData({ loadAllTimeRecords: false }));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.recentRecords).toEqual(recentRecords);
        expect(result.current.stateRecords).toBeNull();
        expect(result.current.countyRecords).toBeNull();
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('reports loading while deferred all-time records are fetched after enabling', async () => {
        const pendingStateRecords = deferredResponse();
        const pendingCountyRecords = deferredResponse();
        globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/recentRecords.json')) return Promise.resolve(jsonFetchResponse(recentRecords));
            if (url.endsWith('/summary.json')) return Promise.resolve(jsonFetchResponse(summary));
            if (url.endsWith('/stateRecords.json')) return pendingStateRecords.promise;
            if (url.endsWith('/countyRecords.json')) return pendingCountyRecords.promise;
            return Promise.reject(new Error(`Unexpected fetch: ${url}`));
        });

        const { result, rerender } = renderHook(
            ({ loadAllTimeRecords }) => useTemperatureData({ loadAllTimeRecords }),
            { initialProps: { loadAllTimeRecords: false } },
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        rerender({ loadAllTimeRecords: true });

        await waitFor(() => expect(result.current.loading).toBe(true));
        const fetchedUrls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
        expect(fetchedUrls).toContain('https://data.rsmb.tv/stateRecords.json');
        expect(fetchedUrls).toContain('https://data.rsmb.tv/countyRecords.json');

        pendingStateRecords.resolve(jsonFetchResponse(stateRecords));
        pendingCountyRecords.resolve(jsonFetchResponse(countyRecords));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.stateRecords).toEqual(stateRecords);
        expect(result.current.countyRecords).toEqual(countyRecords);
    });

    it('does not expose all-time errors when all-time records are disabled again', async () => {
        globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/recentRecords.json')) return Promise.resolve(jsonFetchResponse(recentRecords));
            if (url.endsWith('/summary.json')) return Promise.resolve(jsonFetchResponse(summary));
            if (url.endsWith('/stateRecords.json')) return Promise.reject(new Error('All-time records unavailable'));
            if (url.endsWith('/countyRecords.json')) return Promise.reject(new Error('County records unavailable'));
            return Promise.reject(new Error(`Unexpected fetch: ${url}`));
        });

        const { result, rerender } = renderHook(
            ({ loadAllTimeRecords }) => useTemperatureData({ loadAllTimeRecords }),
            { initialProps: { loadAllTimeRecords: false } },
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        rerender({ loadAllTimeRecords: true });
        await waitFor(() => expect(result.current.error).toBe('All-time records unavailable'));

        rerender({ loadAllTimeRecords: false });

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.recentRecords).toEqual(recentRecords);
    });
});