import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchWithCache, clearCache } from '../features/flights/utils/fetchCache';

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
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockData),
        });

        const result = await fetchWithCache('/api/fast', { timeout: 5000 });
        expect(result).toEqual(mockData);
    });

    it('passes AbortSignal to fetch', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });

        await fetchWithCache('/api/signal', { timeout: 5000 });

        expect(fetch).toHaveBeenCalledWith('/api/signal', expect.objectContaining({
            signal: expect.any(AbortSignal),
        }));
    });
});
