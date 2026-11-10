// @vitest-environment node
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';

const cache = await vi.hoisted(async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const directory = mkdtempSync(join(tmpdir(), 'county-temperature-review-'));
    vi.stubEnv('TEMP_DATA_DIR', directory);
    vi.stubEnv('TEMPERATURE_DATA_BUCKET', '');
    return directory;
});
import { fetchCountyRecordsForState } from '../sync-temperatures.js';

function station() {
    return {
        meta: { name: 'Test', ll: [-120, 37], county: '06001', state: 'CA' },
        smry: [[100 as string | number, '2000-07-01'], [0 as string | number, '2000-01-01']],
    };
}

beforeEach(() => rmSync(join(cache, 'cache'), { recursive: true, force: true }));
afterEach(() => vi.restoreAllMocks());
afterAll(() => { rmSync(cache, { recursive: true, force: true }); vi.unstubAllEnvs(); });

it('keeps numeric zero instead of treating it as missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: [station()] }));
    expect(await fetchCountyRecordsForState('CA')).toEqual([
        expect.objectContaining({ type: 'high', tempF: 100 }),
        expect.objectContaining({ type: 'low', tempF: 0 }),
    ]);
});

it.each(['numeric suffix', 'invalid date', 'future date', 'coordinates', 'county', 'state', 'station name'])('replaces a cached response with invalid %s', async kind => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ data: [station()] }));
    const expected = await fetchCountyRecordsForState('CA');
    const bad = station();
    if (kind === 'numeric suffix') bad.smry[1][0] = '-5 degrees';
    if (kind === 'invalid date') bad.smry[1][1] = '2000-02-30';
    if (kind === 'future date') bad.smry[1][1] = '2999-01-01';
    if (kind === 'coordinates') bad.meta.ll = [200, 37];
    if (kind === 'county') bad.meta.county = '20001';
    if (kind === 'state') bad.meta.state = 'KS';
    if (kind === 'station name') Object.assign(bad.meta, { name: { invalid: true } });
    const directory = join(cache, 'cache/county-alltime/CA');
    writeFileSync(join(directory, readdirSync(directory)[0]), JSON.stringify({ data: [bad] }));
    expect(await fetchCountyRecordsForState('CA')).toEqual(expected);
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('allows missing observations and unlocated stations alongside usable records', async () => {
    const missing = station();
    missing.smry[1] = ['M', 'M'];
    const unlocated = { ...station(), meta: { name: 'Unlocated' } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: [unlocated, missing] }));
    expect(await fetchCountyRecordsForState('CA')).toEqual([expect.objectContaining({ type: 'high', tempF: 100 })]);
});

it('retries an unusable fresh response before it can enter the cache', async () => {
    vi.useFakeTimers();
    const missing = station();
    missing.smry = [['M', 'M'], ['M', 'M']];
    const fetchMock = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(Response.json({ data: [missing] }))
        .mockResolvedValueOnce(Response.json({ data: [station()] }));
    try {
        const pending = fetchCountyRecordsForState('CA');
        await vi.advanceTimersByTimeAsync(1_001);
        expect(await pending).toHaveLength(2);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(await fetchCountyRecordsForState('CA')).toHaveLength(2);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
        vi.useRealTimers();
    }
});
