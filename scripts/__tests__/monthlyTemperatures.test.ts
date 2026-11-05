// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
const cacheDirectory = await vi.hoisted(async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const directory = mkdtempSync(`${tmpdir()}/monthly-temperature-`);
    vi.stubEnv('TEMP_DATA_DIR', directory);
    vi.stubEnv('TEMPERATURE_DATA_BUCKET', '');
    return directory;
});
import { fetchStateForDate, repairMonthlyArchive, buildBrokenRecordsFromDailyArchive } from '../sync-temperatures.js';

const station = { uid: 18747, name: 'Albany', state: 'NY', ll: [-73.8, 42.7] };
const history = [
    ['1950-11-02', 82, 10], ['1953-09-03', 100, 0], ['1971-01-19', 30, -28],
    ['2018-11-23', 70, 4], ['2024-02-29', 80, -10], ['2023-02-28', 70, 0],
    ['2026-11-02', 85, 2],
    ['2026-11-05', 110, -10],
] as const;

beforeEach(() => { rmSync(cacheDirectory, { recursive: true, force: true }); mkdirSync(cacheDirectory); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
afterAll(() => { rmSync(cacheDirectory, { recursive: true, force: true }); vi.unstubAllEnvs(); });

// Evaluate the ACIS interval/duration contract against dated observations,
// rather than returning a preselected monthly scalar regardless of the query.
function installAcis(date: string, high: number, low: number) {
    const requests: Record<string, unknown>[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
        const p = JSON.parse(String(options?.body));
        requests.push(p);
        let fields;
        if (p.date) fields = { data: [String(high), String(low)] };
        else if (p.elems.length === 4) fields = { smry: [['75', '2000-11-05'], ['8', '2001-11-05'], '60', '30'] };
        else {
            const selected = history.filter(([d]) => {
                if (d.slice(0, 4) < p.sdate.slice(0, 4) || d > p.edate) return false;
                if (p.elems[0].interval === 'mly') return d >= p.sdate;
                if (d.slice(5, 7) !== p.sdate.slice(5, 7)) return false;
                const y = Number(d.slice(0, 4));
                const lastDay = new Date(Date.UTC(y, Number(d.slice(5, 7)), 0)).getUTCDate();
                return Number(d.slice(8)) <= Math.min(Number(p.sdate.slice(8)), lastDay);
            });
            fields = { smry: [1, 2].map((column) => {
                const sorted = [...selected].sort((a, b) => column === 1 ? b[1] - a[1] : a[2] - b[2]);
                const row = sorted[0];
                const value = row ? [String(row[column]), row[0]] : ['M', 'M'];
                return p.elems[0].smry?.add === 'date' ? value : value[0];
            }) };
        }
        return new Response(JSON.stringify({ data: [{ meta: station, ...fields }] }));
    });
    return { requests, pending: fetchStateForDate('NY', date, date.slice(5), Number(date.slice(0, 4))) };
}

describe('calendar-month temperature thresholds', () => {
    function archivedObservation(uid = station.uid) {
        return { uid, maxt: 83, mint: 3, rh: 80, rl: 5, mh: 100, ml: -28 };
    }

    function historicalSeries(uid = station.uid, missingColumn?: number) {
        const rows = Array.from({ length: 912 }, () => [['M', 'M'], ['M', 'M']]);
        rows[10] = [['82', '1950-11-02'], ['4', '2018-11-23']];
        if (missingColumn !== undefined) rows[10][missingColumn] = ['M', 'M'];
        return { meta: { uid }, data: rows };
    }

    function monthSeries(uid = station.uid) {
        const rows = Array.from({ length: 30 }, () => ['M', 'M']);
        rows[1] = ['85', '2'];
        rows[2] = ['99', '-10']; // Target day: never part of its predecessor.
        rows[29] = ['150', '-30'];
        return { meta: { uid }, data: rows };
    }

    it('rejects a nonempty response that omits a station with proven historical records', async () => {
        vi.useFakeTimers();
        const archive = { observations: [archivedObservation()] };
        const original = structuredClone(archive);
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [{
            meta: { uid: 2 }, smry: [['82', '1950-11-02'], ['4', '2018-11-23']],
        }] })));
        const assertion = expect(repairMonthlyArchive('2026-11-03', archive, new Map([[station.uid, station]])))
            .rejects.toThrow(`Missing historical monthlyHigh for station ${station.uid}`);
        await vi.runAllTimersAsync();
        await assertion;
        expect(archive).toEqual(original);
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it.each([
        ['omitted station', 2, [['82', '1950-11-02'], ['4', '2018-11-23']], 'monthlyHigh'],
        ['all missing history', station.uid, [['M', 'M'], ['M', 'M']], 'monthlyHigh'],
        ['missing high history', station.uid, [['M', 'M'], ['4', '2018-11-23']], 'monthlyHigh'],
        ['missing low history', station.uid, [['82', '1950-11-02'], ['M', 'M']], 'monthlyLow'],
    ] as const)('rejects fresh generation with %s when calendar-date records prove history', async (_label, uid, monthlySummary, field) => {
        vi.useFakeTimers();
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, request) => {
            const params = JSON.parse(String(request?.body));
            if (params.date) return new Response(JSON.stringify({ data: [{ meta: station, data: ['83', '3'] }] }));
            if (params.elems.length === 4) return new Response(JSON.stringify({ data: [{
                meta: station, smry: [['80', '2000-11-03'], ['5', '2001-11-03'], '60', '30'],
            }] }));
            return new Response(JSON.stringify({ data: [{ meta: { uid }, smry: monthlySummary }] }));
        });
        const pending = fetchStateForDate('NY', '2026-11-03', '11-03', 2026);
        const assertion = expect(pending).rejects.toThrow(`Recent records for NY on 2026-11-03: Missing historical ${field} for station ${station.uid}`);
        await vi.runAllTimersAsync();
        await assertion;
        // A structurally valid but incomplete historical result cannot reach
        // current-year aggregation or return an archive for publication.
        expect(fetch).toHaveBeenCalledTimes(5);
    });

    it.each([[0, 'monthlyHigh'], [1, 'monthlyLow']] as const)('rejects missing historical %s before current-year data can conceal it', async (column, field) => {
        vi.useFakeTimers();
        const archive = { observations: [archivedObservation()] };
        const original = structuredClone(archive);
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [historicalSeries(station.uid, column)] })));
        const assertion = expect(repairMonthlyArchive('2026-11-03', archive, new Map([[station.uid, station]]), new Map(), '2026-11-30'))
            .rejects.toThrow(`Missing historical ${field} for station ${station.uid}`);
        await vi.runAllTimersAsync();
        await assertion;
        expect(archive).toEqual(original);
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('revalidates historical tables for a new month and can replace invalid cached evidence on retry', async () => {
        let corrected = false;
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
            const historical = historicalSeries();
            if (corrected) historical.data[3] = [['82', '1950-04-02'], ['4', '1950-04-23']];
            return new Response(JSON.stringify({ data: [historical] }));
        });
        const cache = new Map();
        const archive = { observations: [archivedObservation()] };
        const index = new Map([[station.uid, station]]);
        await repairMonthlyArchive('2026-11-01', archive, index, cache, '2026-11-30');
        await expect(repairMonthlyArchive('2026-04-01', archive, index, cache, '2026-04-30'))
            .rejects.toThrow(`Missing historical monthlyHigh for station ${station.uid} on 2026-04-01`);
        expect(fetch).toHaveBeenCalledTimes(1);
        corrected = true;
        const result = await repairMonthlyArchive('2026-04-01', archive, index, cache, '2026-04-30');
        expect(result.observations[0]).toMatchObject({ mh: 82, ml: 4, mhd: '1950-04-02' });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(archive.observations[0]).toMatchObject({ mh: 100, ml: -28 });
    });

    it('retries incomplete historical coverage and caches only the verified replacement', async () => {
        vi.useFakeTimers();
        let historicalRequests = 0;
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
            historicalRequests++;
            return new Response(JSON.stringify({ data: [historicalSeries(historicalRequests === 1 ? 2 : station.uid)] }));
        });
        const archive = { observations: [archivedObservation()] };
        const cache = new Map();
        const index = new Map([[station.uid, station]]);
        const pending = repairMonthlyArchive('2026-11-01', archive, index, cache, '2026-11-30');
        await vi.runAllTimersAsync();
        expect((await pending).observations[0]).toMatchObject({ mh: 82, ml: 4 });
        await repairMonthlyArchive('2026-11-01', archive, index, cache, '2026-11-30');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('permits a new station absent from prior-year history and uses its earlier current-month observations', async () => {
        const archive = { observations: [{ uid: station.uid, maxt: 83, mint: 3 }] };
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, request) => {
            const params = JSON.parse(String(request?.body));
            return new Response(JSON.stringify({ data: params.elems[0] === 'maxt' ? [monthSeries()] : [historicalSeries(2)] }));
        });
        const result = await repairMonthlyArchive('2026-11-03', archive, new Map([[station.uid, station]]), new Map(), '2026-11-30');
        expect(result).toMatchObject({ monthlyThresholdVersion: 2, observations: [{ mh: 85, ml: 2, mhd: '2026-11-02', mld: '2026-11-02' }] });
        expect(archive.observations[0]).not.toHaveProperty('mh');
    });

    it('permits a new station with no preceding history on the first day of a month', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [historicalSeries(2)] })));
        const archive = { observations: [{ uid: station.uid, maxt: 83, mint: 3 }] };
        const result = await repairMonthlyArchive('2026-11-01', archive, new Map([[station.uid, station]]), new Map(), '2026-11-30');
        expect(result).toMatchObject({ monthlyThresholdVersion: 2, observations: archive.observations });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('recovers an omitted monthly station from a verified dated series and reuses that proof across dates', async () => {
        const requests: string[] = [];
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, request) => {
            const params = JSON.parse(String(request?.body));
            requests.push(String(url));
            const data = monthSeries();
            const response = String(url).endsWith('/StnData')
                ? { meta: data.meta, data: data.data.map((row, index) => [`2026-11-${String(index + 1).padStart(2, '0')}`, ...row]) }
                : { data: params.elems[0] === 'maxt' ? [monthSeries(2)] : [historicalSeries()] };
            return new Response(JSON.stringify(response));
        });
        const cache = new Map();
        const archive = { observations: [archivedObservation()] };
        const first = await repairMonthlyArchive('2026-11-03', archive, new Map([[station.uid, station]]), cache, '2026-11-30');
        const later = await repairMonthlyArchive('2026-11-04', archive, new Map([[station.uid, station]]), cache, '2026-11-30');
        expect(first.observations[0]).toMatchObject({ mh: 85, ml: 2, mhd: '2026-11-02' });
        expect(later.observations[0]).toMatchObject({ mh: 99, ml: -10, mhd: '2026-11-03' });
        expect(requests.filter(url => url.endsWith('/StnData'))).toHaveLength(1);
    });

    it('accepts explicit missing readings as verified coverage without inventing current-month values', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, request) => {
            const params = JSON.parse(String(request?.body));
            const response = String(url).endsWith('/StnData')
                ? { meta: { uid: station.uid }, data: Array.from({ length: 30 }, (_, index) => [`2026-11-${String(index + 1).padStart(2, '0')}`, 'M', 'M']) }
                : { data: params.elems[0] === 'maxt' ? [monthSeries(2)] : [historicalSeries()] };
            return new Response(JSON.stringify(response));
        });
        const result = await repairMonthlyArchive('2026-11-03', { observations: [archivedObservation()] }, new Map([[station.uid, station]]), new Map(), '2026-11-30');
        expect(result.observations[0]).toMatchObject({ mh: 82, ml: 4 });
    });

    it('rechecks cached full-month coverage when a later archive introduces another station', async () => {
        vi.useFakeTimers();
        const other = { ...station, uid: 2 };
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, request) => {
            const params = JSON.parse(String(request?.body));
            if (String(url).endsWith('/StnData')) return new Response(JSON.stringify({ error: 'No verified station series' }));
            return new Response(JSON.stringify({ data: params.elems[0] === 'maxt' ? [monthSeries()] : [historicalSeries(), historicalSeries(2)] }));
        });
        const cache = new Map();
        const index = new Map([[station.uid, station], [2, other]]);
        await repairMonthlyArchive('2026-11-03', { observations: [archivedObservation()] }, index, cache, '2026-11-30');
        const archive = { observations: [archivedObservation(), archivedObservation(2)] };
        const original = structuredClone(archive);
        const pending = repairMonthlyArchive('2026-11-04', archive, index, cache, '2026-11-30');
        const assertion = expect(pending).rejects.toThrow('Invalid monthly observation series for station 2');
        await vi.runAllTimersAsync();
        await assertion;
        expect(archive).toEqual(original);
        expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/MultiStnData'))).toHaveLength(2);
    });

    it('bounds omitted-station verification instead of expanding a truncated state response into unbounded work', async () => {
        const uids = Array.from({ length: 9 }, (_, index) => index + 1);
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, request) => {
            const params = JSON.parse(String(request?.body));
            return new Response(JSON.stringify({ data: params.elems[0] === 'maxt' ? [monthSeries(999)] : uids.map(uid => historicalSeries(uid)) }));
        });
        await expect(repairMonthlyArchive('2026-11-03', { observations: uids.map(uid => archivedObservation(uid)) },
            new Map(uids.map(uid => [uid, { ...station, uid }])), new Map(), '2026-11-30'))
            .rejects.toThrow('9 stations missing');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it.each(['duplicate uid', 'invalid uid', 'malformed value', 'missing date'] as const)('rejects malformed historical station data with %s', async failure => {
        vi.useFakeTimers();
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
            const series = historicalSeries();
            if (failure === 'invalid uid') series.meta.uid = -1;
            if (failure === 'malformed value') series.data[10][0][0] = 'invalid';
            if (failure === 'missing date') series.data[10][0][1] = '';
            return new Response(JSON.stringify({ data: failure === 'duplicate uid' ? [series, series] : [series] }));
        });
        const archive = { observations: [archivedObservation()] };
        const original = structuredClone(archive);
        const pending = repairMonthlyArchive('2026-11-03', archive, new Map([[station.uid, station]]), new Map(), '2026-11-30');
        const assertion = expect(pending).rejects.toThrow(/Invalid.*(?:monthly station UID|historical monthly series)/);
        await vi.runAllTimersAsync();
        await assertion;
        expect(archive).toEqual(original);
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it.each(['wrong uid', 'missing date', 'invalid value', 'error'] as const)('rejects an omitted target station when its verification has %s', async failure => {
        vi.useFakeTimers();
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, request) => {
            const params = JSON.parse(String(request?.body));
            if (!String(url).endsWith('/StnData')) {
                return new Response(JSON.stringify({ data: params.elems[0] === 'maxt' ? [monthSeries(2)] : [historicalSeries()] }));
            }
            const data = Array.from({ length: 30 }, (_, index) => [`2026-11-${String(index + 1).padStart(2, '0')}`, 'M', 'M']);
            if (failure === 'missing date') data[1][0] = '2026-11-03';
            if (failure === 'invalid value') data[1][1] = 'not a temperature';
            return new Response(JSON.stringify({ meta: { uid: failure === 'wrong uid' ? 2 : station.uid }, data,
                ...(failure === 'error' ? { error: 'Station unavailable' } : {}) }));
        });
        const archive = { observations: [archivedObservation()] };
        const original = structuredClone(archive);
        const pending = repairMonthlyArchive('2026-11-03', archive, new Map([[station.uid, station]]), new Map(), '2026-11-30');
        const assertion = expect(pending).rejects.toThrow(`Invalid monthly observation series for station ${station.uid}`);
        await vi.runAllTimersAsync();
        await assertion;
        expect(archive).toEqual(original);
        expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/StnData'))).toHaveLength(3);
    });

    it('retains leap-day extremes in the month-batched historical table', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
            const params = JSON.parse(String(options?.body));
            const rows = params.elems[0] === 'maxt' ? Array.from({ length: 28 }, () => ['M', 'M'])
                : Array.from({ length: 912 }, () => [['M', 'M'], ['M', 'M']]);
            if (params.elems[0] !== 'maxt') {
                rows[888] = [['100', '2024-01-01'], ['-28', '2024-01-01']];
                rows[889] = [['80', '2024-02-29'], ['-10', '2024-02-29']];
            }
            return new Response(JSON.stringify({ data: [{ meta: station, data: rows }] }));
        });
        const archive = { observations: [{ uid: station.uid, maxt: 79, mint: -9, rh: 75, rl: 0 }] };
        const result = await repairMonthlyArchive('2026-02-15', archive, new Map([[station.uid, { ...station, state: 'VT' }]]), new Map(), '2026-02-28');
        expect(result.observations[0]).toMatchObject({ mh: 80, ml: -10, mhd: '2024-02-29' });
    });

    it('shares month-batched backfill data while excluding each target day and later days', async () => {
        const requests: unknown[] = [];
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
            const params = JSON.parse(String(options?.body));
            requests.push(params);
            const rows = Array.from({ length: 30 }, () => ['M', 'M']);
            rows[1] = ['81', '5']; rows[2] = ['85', '2'];
            rows[4] = ['120', '-10']; rows[29] = ['150', '-20'];
            const history = Array.from({ length: 912 }, () => [['M', 'M'], ['M', 'M']]);
            history[10] = [['82', '1950-11-02'], ['4', '2018-11-23']];
            history[44] = [['100', '1953-09-03'], ['M', 'M']];
            history[252] = [['M', 'M'], ['-28', '1971-01-19']];
            const values = params.elems[0] === 'maxt' ? { data: rows } : { data: history };
            return new Response(JSON.stringify({ data: [{ meta: station, ...values }] }));
        });
        const cache = new Map();
        const index = new Map([[station.uid, station]]);
        const archive = { observations: [{ uid: station.uid, maxt: 83, mint: 3, rh: 80, rl: 5 }] };
        const first = await repairMonthlyArchive('2026-11-03', archive, index, cache, '2026-11-30');
        const later = await repairMonthlyArchive('2026-11-05', archive, index, cache, '2026-11-30');
        const earlierAgain = await repairMonthlyArchive('2026-11-03', archive, index, cache, '2026-11-30');
        expect(first.observations[0]).toMatchObject({ mh: 82, ml: 4 });
        expect(later.observations[0]).toMatchObject({ mh: 85, ml: 2, mhd: '2026-11-03' });
        expect(earlierAgain.observations[0]).toMatchObject({ mh: 82, ml: 4 });
        expect(requests).toHaveLength(2);
    });

    it('excludes hotter summer and colder winter observations and reconstructs the same monthly records', async () => {
        vi.useFakeTimers();
        const { pending } = installAcis('2025-11-05', 83, 3);
        await vi.runAllTimersAsync();
        const result = await pending;
        expect(result.observations[0]).toMatchObject({ mh: 82, ml: 4, mhd: '1950-11-02', mld: '2018-11-23' });
        expect(result.broken.map(r => r.recordScope)).toEqual(['monthly', 'monthly']);
        expect(result.broken[0]).toMatchObject({ prevRecordF: 82, prevRecordDate: '1950-11-02' });
        const rebuilt = buildBrokenRecordsFromDailyArchive('2025-11-05', { observations: result.observations }, result.stations);
        expect(rebuilt).toEqual(result.broken);
    });

    it('includes earlier observations in the current month but excludes the target day', async () => {
        vi.useFakeTimers();
        const { pending, requests } = installAcis('2026-11-05', 83, 3);
        await vi.runAllTimersAsync();
        const result = await pending;
        expect(result.observations[0]).toMatchObject({ mh: 85, ml: 2 });
        expect(result.broken.map(r => r.recordScope)).toEqual(['daily', 'daily']);
        expect(requests.some(p => p.sdate === '2026-11-04' && p.edate === '2026-11-04')).toBe(true);
    });

    it('does not include the previous month or future observations on the first of a month', async () => {
        vi.useFakeTimers();
        const { pending, requests } = installAcis('2026-11-01', 83, 3);
        await vi.runAllTimersAsync();
        expect((await pending).observations[0]).toMatchObject({ mh: 82, ml: 4 });
        expect(requests).toHaveLength(3);
    });

    it.each(['2025-02-15', '2024-02-29'])('covers leap and ordinary February when classifying %s', async date => {
        vi.useFakeTimers();
        const { pending, requests } = installAcis(date, 79, -9);
        await vi.runAllTimersAsync();
        const result = await pending;
        expect(result.observations[0]).toMatchObject(date.startsWith('2025') ? { mh: 80, ml: -10 } : { mh: 70, ml: 0 });
        expect(result.broken[0].recordScope).toBe(date.startsWith('2025') ? 'daily' : 'monthly');
        if (date.endsWith('02-29')) expect(requests[1]).toMatchObject({ sdate: '1952-02-29', edate: '2020-02-29', elems: [
            expect.objectContaining({ interval: [4, 0, 0] }), expect.anything(), expect.anything(), expect.anything(),
        ] });
    });
});
