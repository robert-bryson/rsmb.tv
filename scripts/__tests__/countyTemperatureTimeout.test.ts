// @vitest-environment node
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, expect, it, vi } from 'vitest';

const cache = await vi.hoisted(async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const directory = mkdtempSync(join(tmpdir(), 'county-temperature-timeout-'));
    vi.stubEnv('TEMP_DATA_DIR', directory);
    vi.stubEnv('TEMPERATURE_DATA_BUCKET', '');
    return directory;
});
import { fetchCountyRecordsForState } from '../sync-temperatures.js';

afterAll(() => { rmSync(cache, { recursive: true, force: true }); vi.unstubAllEnvs(); });

it('accepts a slow California response and reuses it after an interrupted full sync', async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(new Error('Request timed out')), milliseconds);
        return controller.signal;
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(Response.json({ data: [{
            meta: { name: 'California station', ll: [-120, 37], county: '06001', state: 'CA' },
            smry: [['100', '2000-07-01'], ['0', '2000-01-01']],
        }] })), 70_000);
        options!.signal!.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(options!.signal!.reason);
        }, { once: true });
    }));
    let records: unknown;
    let error: unknown;
    const pending = fetchCountyRecordsForState('CA').then(result => { records = result; }, failure => { error = failure; });
    try {
        await vi.advanceTimersByTimeAsync(70_001);
        expect(error).toBeUndefined();
        expect(records).toEqual([
            expect.objectContaining({ state: 'CA', type: 'high', tempF: 100 }),
            expect.objectContaining({ state: 'CA', type: 'low', tempF: 0 }),
        ]);
        expect(await fetchCountyRecordsForState('CA')).toEqual(records);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const directory = join(cache, 'cache/county-alltime/CA');
        const filename = readdirSync(directory)[0];
        writeFileSync(join(directory, filename), JSON.stringify({ data: [{
            meta: { name: 'California station', ll: [-120, 37], county: '06001', state: 'CA' }, smry: [['M', 'M'], ['M', 'M']],
        }] }));
        fetchMock.mockResolvedValueOnce(Response.json({ data: [{
            meta: { name: 'California station', ll: [-120, 37], county: '06001', state: 'CA' }, smry: [['100', '2000-07-01'], ['0', '2000-01-01']],
        }] }));
        expect(await fetchCountyRecordsForState('CA')).toEqual(records);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
        await vi.runAllTimersAsync();
        await pending;
        vi.restoreAllMocks();
        vi.useRealTimers();
    }
});
