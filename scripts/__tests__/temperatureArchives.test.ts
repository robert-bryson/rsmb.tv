// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { usStates } from '../../shared/geography/usStates';

const temporaryCache = await vi.hoisted(async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const directory = mkdtempSync(join(tmpdir(), 'temperature-archives-'));
    vi.stubEnv('TEMP_DATA_DIR', directory);
    vi.stubEnv('TEMPERATURE_DATA_BUCKET', 'test-temperature-data');
    return directory;
});
vi.mock('child_process', () => ({ execFileSync: vi.fn() }));
import { fetchRecentRecords, fetchStateForDate, MONTHLY_THRESHOLD_VERSION } from '../sync-temperatures.js';

const states = usStates.filter(state => state.abbr !== 'AK' && state.abbr !== 'HI');
const coverage = { expectedStates: states.map(state => state.abbr), completedStates: states.map(state => state.abbr) };
const stations = states.map((state, index) => ({ uid: index + 1, name: state.name, state: state.abbr, ll: [-100, 39], elev: 100, county: state.fips + '001' }));
const bucket = new Map<string, unknown>();
const date = '2026-11-03';
const previousRecord = {
    stationName: 'Old station name', uid: 1, state: 'AL', stateName: 'Alabama', county: '01001',
    lat: 39, lon: -100, elev: 100, type: 'high', tempF: 108, prevRecordF: 100,
    prevRecordDate: '2000-11-03', normalF: 70, date, recordScope: 'daily',
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    bucket.clear();
    vi.mocked(execFileSync).mockImplementation((_command, args) => {
        const argv = args as string[];
        const key = argv[argv.indexOf('--key') + 1];
        if (!bucket.has(key)) throw new Error('NoSuchKey');
        if (argv[1] === 'get-object') writeFileSync(argv.at(-1)!, JSON.stringify(bucket.get(key)));
        return Buffer.from('');
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    bucket.set('recentRecords.json', { dates: [date], yesterday: [previousRecord], last7Days: [previousRecord] });
    bucket.set('stations.json', { stations });
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
afterAll(() => { rmSync(temporaryCache, { recursive: true, force: true }); vi.unstubAllEnvs(); });

function archive(date: string, breaksRecords: boolean, verified = true) {
    return {
        date,
        monthlyThresholdVersion: MONTHLY_THRESHOLD_VERSION,
        observations: stations.map(station => ({ uid: station.uid, maxt: breaksRecords ? 110 : 90, mint: 10, rh: 100, rl: 0 })),
        ...(verified ? { coverage } : {}),
    };
}

describe('recent temperature archive reuse', () => {
    it('rebuilds the rolling summary from a staged repair before its S3 upload', async () => {
        const stale = { ...archive(date, true), monthlyThresholdVersion: 1 };
        bucket.set('daily/2026/11/' + date + '.json', stale);
        const repaired = { ...stale, monthlyThresholdVersion: MONTHLY_THRESHOLD_VERSION,
            observations: stale.observations.map(observation => ({ ...observation, mh: 105, mhd: '2020-11-01' })) };
        const directory = temporaryCache + '/daily/2026/11';
        const filename = directory + '/' + date + '.json';
        mkdirSync(directory, { recursive: true });
        writeFileSync(filename, JSON.stringify(repaired));
        try {
            const result = await fetchRecentRecords(1);
            expect(fetch).not.toHaveBeenCalled();
            expect(result.recentRecords.last7Days).toHaveLength(48);
            expect(result.recentRecords.last7Days.every(record => record.recordScope === 'monthly' && record.prevRecordF === 105)).toBe(true);
        } finally { rmSync(filename, { force: true }); }
    });

    it('repairs stale thresholds even when the old summary claims complete coverage', async () => {
        bucket.set('recentRecords.json', { monthlyThresholdVersion: 1, dates: [date], yesterday: [previousRecord], last7Days: [previousRecord], coverageByDate: { [date]: coverage } });
        const staleArchive = { ...archive(date, true), monthlyThresholdVersion: 1 };
        const key = 'daily/2026/11/' + date + '.json';
        bucket.set(key, staleArchive);
        const requests: Array<{ date?: string; elems: Array<{ duration: string }> }> = [];
        vi.mocked(globalThis.fetch).mockImplementation(async (_url, options) => {
            const params = JSON.parse(String(options?.body));
            requests.push(params);
            const station = stations.find(station => station.state === params.state)!;
            return new Response(JSON.stringify({ data: [{ meta: station, smry: [['105', '2020-11-01'], ['0', '2010-11-02']] }] }));
        });
        const result = await fetchRecentRecords(1);
        expect(requests).toHaveLength(96);
        expect(requests.every(request => !request.date && request.elems[0].duration === 'mtd')).toBe(true);
        expect(result.recentRecords.monthlyThresholdVersion).toBe(MONTHLY_THRESHOLD_VERSION);
        expect(result.recentRecords.last7Days).toHaveLength(48);
        expect(result.recentRecords.last7Days.every(record => record.recordScope === 'monthly' && record.prevRecordF === 105)).toBe(true);
        expect(result.dailyObservations.get(date)?.[0]).toMatchObject({ maxt: 110, mh: 105, mhd: '2020-11-01' });
        expect(staleArchive.observations[0]).not.toHaveProperty('mh');
    });

    it('reuses a verified summary without fetching observations or rebuilding records', async () => {
        bucket.set('recentRecords.json', { monthlyThresholdVersion: MONTHLY_THRESHOLD_VERSION, dates: [date], yesterday: [previousRecord], last7Days: [previousRecord], coverageByDate: { [date]: coverage } });
        bucket.set('daily/2026/11/' + date + '.json', archive(date, true));
        const result = await fetchRecentRecords(1);
        expect(result.recentRecords.last7Days).toEqual([previousRecord]);
        expect(result.recentRecords.coverageByDate).toEqual({ [date]: coverage });
        expect(result.dailyObservations.size).toBe(0);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it.each([true, false])('replaces old summary rows with rebuilt archive records (broken records: %s)', async breaksRecords => {
        bucket.set('daily/2026/11/' + date + '.json', archive(date, breaksRecords));
        const result = await fetchRecentRecords(1);
        expect(result.recentRecords.last7Days).toHaveLength(breaksRecords ? 48 : 0);
        expect(result.recentRecords.last7Days.every(record => record.tempF === 110)).toBe(true);
        expect(result.recentRecords.yesterday).toEqual(result.recentRecords.last7Days);
        expect(result.dailyObservations.size).toBe(0);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('regenerates all seven legacy archives before claiming complete coverage', async () => {
        const dates = ['2026-11-03', '2026-11-02', '2026-11-01', '2026-10-31', '2026-10-30', '2026-10-29', '2026-10-28'];
        for (const day of dates) bucket.set(`daily/${day.slice(0, 4)}/${day.slice(5, 7)}/${day}.json`, archive(day, true, false));
        const requests: Array<{ state: string; date?: string }> = [];
        vi.mocked(globalThis.fetch).mockImplementation(async (_url, options) => {
            const params = JSON.parse(String(options?.body));
            requests.push(params);
            const station = stations.find(station => station.state === params.state)!;
            const fields = params.date ? { data: ['110', '10'] }
                : params.elems[0].duration === 'mtd' ? { smry: [['120', '2000-11-01'], ['-20', '2000-11-01']] }
                    : { smry: [['100', '2000-07-01'], ['0', '2000-01-01'], '70', '40'] };
            return new Response(JSON.stringify({ data: [{ meta: station, ...fields }] }));
        });
        const pending = fetchRecentRecords(7);
        await vi.runAllTimersAsync();
        const result = await pending;
        expect(result.recentRecords.dates).toEqual(dates);
        expect(result.recentRecords.last7Days).toHaveLength(48 * 7);
        expect(result.recentRecords.yesterday).toHaveLength(48);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('state coverage is unverified; recomputing'));
        for (const day of dates) {
            expect(result.recentRecords.coverageByDate[day]).toEqual(coverage);
            expect(result.dailyObservations.get(day)).toHaveLength(48);
            expect(requests.filter(request => request.date === day).map(request => request.state).sort()).toEqual([...coverage.expectedStates].sort());
        }
    });

    it.each([
        { name: 'valid extremes', smry: [['100', '2000-07-01'], ['0', '2000-01-01']], valid: true },
        { name: 'missing summaries', smry: [null, null], valid: false },
        { name: 'empty summaries', smry: [[], []], valid: false },
    ])('validates historical S3 cache entries before reuse ($name)', async ({ smry, valid }) => {
        vi.mocked(execFileSync).mockImplementationOnce((_command, args) => {
            writeFileSync((args as string[]).at(-1)!, JSON.stringify({ data: [{
                meta: { uid: 1 }, smry,
            }] }));
            return Buffer.from('');
        });
        const phases: string[] = [];
        vi.mocked(globalThis.fetch).mockImplementation(async (_url, options) => {
            const params = JSON.parse(String(options?.body));
            const phase = params.date ? 'daily' : params.elems[0].duration === 'mtd' ? 'monthly' : 'historical';
            phases.push(phase);
            const fields = phase === 'daily' ? { data: ['110', '10'] }
                : phase === 'monthly' ? { smry: [['120', '2000-11-01'], ['-20', '2000-11-01']] }
                    : { smry: [['100', '2000-07-01'], ['0', '2000-01-01'], '70', '40'] };
            return new Response(JSON.stringify({ data: [{ meta: stations[0], ...fields }] }));
        });
        const pending = fetchStateForDate('DE', date, '11-03', 2026);
        await vi.runAllTimersAsync();
        const result = await pending;
        expect(phases).toEqual(valid ? ['daily', 'monthly', 'monthly'] : ['daily', 'historical', 'monthly', 'monthly']);
        expect(result.broken).toEqual([expect.objectContaining({ type: 'high', tempF: 110, prevRecordF: 100 })]);
    });
});
