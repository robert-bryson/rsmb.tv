import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchWithCache, clearCache } from '../data/fetchCache';
import { jsonFetchResponse } from './helpers/fetch';

describe('fetchCache timeout', () => {
    beforeEach(() => {
        clearCache();
        vi.restoreAllMocks();
    });

    it('aborts request after timeout', async () => {
        globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
            return new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new DOMException('The operation was aborted.', 'AbortError'));
                });
            });
        });

        await expect(
            fetchWithCache('/api/slow', { timeout: 50 })
        ).rejects.toThrow('aborted');
    });

    it('succeeds when response arrives before timeout', async () => {
        const mockData = { fast: true };
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse(mockData));

        const result = await fetchWithCache('/api/fast', { timeout: 5000 });
        expect(result).toEqual(mockData);
    });

    it('bounds response-body reading and allows a retry after the deadline', async () => {
        globalThis.fetch = vi.fn().mockImplementationOnce((_url: string, init?: RequestInit) =>
            Promise.resolve(jsonFetchResponse({}, {
                json: () => new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
                }),
            })),
        ).mockResolvedValueOnce(jsonFetchResponse({ recovered: true }));

        await expect(fetchWithCache('/api/slow-body', { timeout: 10 })).rejects.toMatchObject({ name: 'AbortError' });
        await expect(fetchWithCache('/api/slow-body')).resolves.toEqual({ recovered: true });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('passes AbortSignal to fetch', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(jsonFetchResponse({}));

        await fetchWithCache('/api/signal', { timeout: 5000 });

        expect(fetch).toHaveBeenCalledWith('/api/signal', expect.objectContaining({
            signal: expect.any(AbortSignal),
        }));
    });
});
