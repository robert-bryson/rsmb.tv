import { afterEach, expect, it, vi } from 'vitest';
import { clearCache, discardCachedValue, fetchWithCache } from '../data/fetchCache';
import { warmJson } from '../data/warmJson';

afterEach(() => { clearCache(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('shares a low-priority speculative response with demand and refetches after TTL expiry', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(Response.json({ valid: true })); vi.stubGlobal('fetch', fetch);
    await warmJson('/data', value => value, { ttl: 1 });
    expect(await fetchWithCache('/data')).toEqual({ valid: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]).toMatchObject({ priority: 'low' });
    await vi.advanceTimersByTimeAsync(10);
    fetch.mockResolvedValue(Response.json({ valid: true }));
    await fetchWithCache('/data'); expect(fetch).toHaveBeenCalledTimes(2);
});

it('discards a malformed prefetched response so navigation can recover with corrected data', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ bad: true })).mockResolvedValueOnce(Response.json({ valid: true }));
    vi.stubGlobal('fetch', fetch);
    await expect(warmJson('/data', () => { throw new Error('Invalid payload'); })).rejects.toThrow('Invalid payload');
    expect(await fetchWithCache('/data')).toEqual({ valid: true });
    expect(fetch).toHaveBeenCalledTimes(2);
});

it('a rejected older value cannot discard a newer forced refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ version: 1 })).mockResolvedValueOnce(Response.json({ version: 2 })));
    const older = await fetchWithCache('/data');
    const newer = await fetchWithCache('/data', { forceRefresh: true });
    discardCachedValue('/data', older);
    expect(await fetchWithCache('/data')).toBe(newer);
});

it('also discards a response rejected by asynchronous validation', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ bad: true })).mockResolvedValueOnce(Response.json({ repaired: true }));
    vi.stubGlobal('fetch', fetch);
    await expect(warmJson('/data', async () => { throw new Error('Async validation failed'); })).rejects.toThrow('Async validation failed');
    expect(await fetchWithCache('/data')).toEqual({ repaired: true });
    expect(fetch).toHaveBeenCalledTimes(2);
});
