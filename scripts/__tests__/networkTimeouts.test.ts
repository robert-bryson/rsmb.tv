// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGoogleDocHtml, fetchSheetAsCsv } from '../sync-blogs.js';
import { fetchJson, postJson } from '../sync-temperatures.js';

function stalledBody(method: 'json' | 'text') {
    const signals: Array<AbortSignal | null | undefined> = [];
    const fetchImpl = vi.fn((_input: RequestInfo | URL, options?: RequestInit) => {
        const signal = options?.signal;
        signals.push(signal);
        return Promise.resolve({
            ok: true,
            [method]: () => new Promise((_resolve, reject) => {
                signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
            }),
        } as unknown as Response);
    });
    return { fetchImpl, signals };
}

describe('data import request deadlines', () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it.each(['sheet', 'document'])('aborts a stalled Google %s response body', async source => {
        const { fetchImpl, signals } = stalledBody('text');
        const options = { fetchImpl, timeoutMs: 5 };
        const outcome = (source === 'sheet'
            ? fetchSheetAsCsv('test-sheet', 'Posts', options)
            : fetchGoogleDocHtml('test-document', options))
            .catch((error: unknown) => error);

        expect(signals[0]).toBeDefined();
        await expect(outcome).resolves.toMatchObject({ name: 'TimeoutError' });
        expect(signals[0]?.aborted).toBe(true);
    });

    it.each(['GET', 'POST'])('bounds every temperature %s retry, including the response body', async method => {
        const { fetchImpl, signals } = stalledBody('json');
        vi.stubGlobal('fetch', fetchImpl);
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const options = { retries: 2, delay: 0, timeoutMs: 5 };
        const outcome = (method === 'GET'
            ? fetchJson('https://example.test/records', options)
            : postJson('https://example.test/records', { state: 'WA' }, options))
            .catch((error: unknown) => error);

        expect(signals[0]).toBeDefined();
        await expect(outcome).resolves.toMatchObject({ name: 'TimeoutError' });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(signals[0]).not.toBe(signals[1]);
        expect(signals.every(signal => signal?.aborted)).toBe(true);
        if (method === 'POST') {
            expect(fetchImpl).toHaveBeenCalledWith('https://example.test/records', expect.objectContaining({
                method: 'POST', body: JSON.stringify({ state: 'WA' }),
            }));
        }
    });
});
