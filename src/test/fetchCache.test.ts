import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchWithCache, clearCache, invalidateCache } from '../features/flights/utils/fetchCache';
import { jsonFetchResponse } from './helpers/fetch';

function deferredResponse() {
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>((res) => { resolve = res; });
    return { promise, resolve };
}

describe('fetchCache', () => {
    beforeEach(() => {
        clearCache();
        vi.restoreAllMocks();
    });

    it('fetches and caches data', async () => {
        const mockData = { name: 'test' };
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse(mockData));

        const result = await fetchWithCache<typeof mockData>('/api/test');
        expect(result).toEqual(mockData);
        expect(fetch).toHaveBeenCalledTimes(1);

        // Second call should use cache
        const cached = await fetchWithCache<typeof mockData>('/api/test');
        expect(cached).toEqual(mockData);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('bypasses cache with forceRefresh', async () => {
        const data1 = { v: 1 };
        const data2 = { v: 2 };
        globalThis.fetch = vi
            .fn()
            .mockResolvedValueOnce(jsonFetchResponse(data1))
            .mockResolvedValueOnce(jsonFetchResponse(data2));

        await fetchWithCache('/api/x');
        const result = await fetchWithCache('/api/x', { forceRefresh: true });
        expect(result).toEqual(data2);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('deduplicates concurrent in-flight requests', async () => {
        const mockData = { dup: true };
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse(mockData));

        // Fire two concurrent requests for the same URL
        const [a, b] = await Promise.all([
            fetchWithCache('/api/dedup'),
            fetchWithCache('/api/dedup'),
        ]);

        expect(a).toEqual(mockData);
        expect(b).toEqual(mockData);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('clearCache drops in-flight requests and keeps stale responses out of the cache', async () => {
        const staleResponse = deferredResponse();
        const freshResponse = deferredResponse();
        globalThis.fetch = vi
            .fn()
            .mockReturnValueOnce(staleResponse.promise)
            .mockReturnValueOnce(freshResponse.promise);

        const staleRequest = fetchWithCache<{ value: string }>('/api/reset');

        clearCache();
        const freshRequest = fetchWithCache<{ value: string }>('/api/reset');

        await Promise.resolve();

        expect(fetch).toHaveBeenCalledTimes(2);

        freshResponse.resolve(jsonFetchResponse({ value: 'fresh' }));
        await expect(freshRequest).resolves.toEqual({ value: 'fresh' });

        staleResponse.resolve(jsonFetchResponse({ value: 'stale' }));
        await expect(staleRequest).resolves.toEqual({ value: 'stale' });

        await expect(fetchWithCache<{ value: string }>('/api/reset')).resolves.toEqual({ value: 'fresh' });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('does not let an older in-flight response overwrite a force-refreshed cache entry', async () => {
        const staleResponse = deferredResponse();
        const freshResponse = deferredResponse();
        globalThis.fetch = vi
            .fn()
            .mockReturnValueOnce(staleResponse.promise)
            .mockReturnValueOnce(freshResponse.promise);

        const staleRequest = fetchWithCache<{ value: string }>('/api/refresh-race');
        const freshRequest = fetchWithCache<{ value: string }>('/api/refresh-race', { forceRefresh: true });

        freshResponse.resolve(jsonFetchResponse({ value: 'fresh' }));
        await expect(freshRequest).resolves.toEqual({ value: 'fresh' });

        staleResponse.resolve(jsonFetchResponse({ value: 'stale' }));
        await expect(staleRequest).resolves.toEqual({ value: 'stale' });

        await expect(fetchWithCache<{ value: string }>('/api/refresh-race')).resolves.toEqual({ value: 'fresh' });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('throws on non-ok response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
        });

        await expect(fetchWithCache('/api/fail')).rejects.toThrow('HTTP 404');
    });

    it('invalidateCache removes a specific entry', async () => {
        const mockData = { id: 1 };
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse(mockData));

        await fetchWithCache('/api/inv');
        expect(fetch).toHaveBeenCalledTimes(1);

        invalidateCache('/api/inv');

        await fetchWithCache('/api/inv');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('respects TTL expiration', async () => {
        const mockData = { ttl: true };
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse(mockData));

        await fetchWithCache('/api/ttl', { ttl: 0 }); // Expire immediately
        await fetchWithCache('/api/ttl', { ttl: 0 });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('propagates JSON parse errors and cleans up pending state', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse({}, {
            json: () => Promise.reject(new SyntaxError('Unexpected token')),
        }));

        await expect(fetchWithCache('/api/bad-json')).rejects.toThrow('Unexpected token');

        // After failure, a fresh request should be made (not stuck on old pending promise)
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse({ recovered: true }));

        const result = await fetchWithCache('/api/bad-json');
        expect(result).toEqual({ recovered: true });
    });

    it('does not cache failed responses', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Server Error',
        });

        await expect(fetchWithCache('/api/server-error')).rejects.toThrow('HTTP 500');

        // Retry should make a new request
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse({ success: true }));

        const result = await fetchWithCache('/api/server-error');
        expect(result).toEqual({ success: true });
    });

    it('throws a clear error when the server returns HTML instead of JSON', async () => {
        const jsonSpy = vi.fn();
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse({}, {
            headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
            json: jsonSpy as Response['json'],
        }));

        await expect(fetchWithCache('/api/html-fallback')).rejects.toThrow(
            'Expected JSON but server returned HTML from /api/html-fallback',
        );
        expect(jsonSpy).not.toHaveBeenCalled();
    });
});
