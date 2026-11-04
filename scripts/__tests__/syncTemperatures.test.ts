import { afterAll, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';

const temporaryCache = await vi.hoisted(async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const directory = mkdtempSync(join(tmpdir(), 'temperature-state-requests-'));
    vi.stubEnv('TEMP_DATA_DIR', directory);
    vi.stubEnv('TEMPERATURE_DATA_BUCKET', '');
    return directory;
});
import {
    buildBrokenRecordsFromDailyArchive,
    buildRecentRecords,
    coveredRecentRecordDates,
    filterBrokenRecordsForDates,
    generateClimateTrends,
    mergeStationIndexes,
    parseBackfillDays,
    validateRecentRecords,
    assertStateCoverage,
    fetchStateForDate,
} from '../sync-temperatures.js';

afterAll(() => { rmSync(temporaryCache, { recursive: true, force: true }); vi.unstubAllEnvs(); });

function mockStateResponses(high: unknown, low: unknown) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
        const params = JSON.parse(String(options?.body));
        const station = params.date ? { data: [high, low] }
            : params.elems[0].interval === 'mly' ? { smry: ['100', '0'] }
                : { smry: [['100', '2000-07-01'], ['0', '2000-01-01'], '70', '40'] };
        return new Response(JSON.stringify({ data: [{ meta: { uid: 1 }, ...station }] }));
    });
}

describe('temperature publication coverage', () => {
    it.each([
        ['daily', { data: [] }],
        ['daily', { error: 'Temporarily unavailable' }],
        ['daily', { data: [{ meta: { uid: 7 }, data: ['M', 'M'] }] }],
        ['daily', null],
        ['daily', { data: [null, { meta: { uid: 7 }, data: ['90', '10'] }] }],
        ['historical', { data: [] }],
        ['historical', { error: 'Temporarily unavailable' }],
        ['historical', { data: [{ meta: { uid: 7 }, smry: [null, ['0', '2000-01-01']] }] }],
        ['historical', { data: [{ meta: { uid: 7 }, smry: [[], []] }] }],
        ['monthly', { data: [] }],
        ['monthly', { error: 'Temporarily unavailable' }],
        ['monthly', { data: [{ meta: { uid: 7 } }] }],
        ['monthly', { data: [{ meta: { uid: 7 }, smry: [null, null] }] }],
        ['monthly', { data: [{ meta: { uid: 7 }, smry: [[], []] }] }],
    ])('retries an invalid %s response (%j) before rejecting the state', async (phase, failedResponse) => {
        let requests = 0;
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
            const params = JSON.parse(String(options?.body));
            const requestPhase = params.date ? 'daily' : params.elems[0].interval === 'mly' ? 'monthly' : 'historical';
            if (requestPhase === phase && ++requests === 1) return new Response(JSON.stringify(failedResponse));
            const station = params.date ? { data: ['90', '10'] }
                : params.elems[0].interval === 'mly' ? { smry: ['100', '0'] }
                    : { smry: [['100', '2000-07-01'], ['0', '2000-01-01'], '70', '40'] };
            return new Response(JSON.stringify({ data: [{ meta: { uid: 7 }, ...station }] }));
        });
        try {
            await expect(fetchStateForDate('DE', '2026-11-03', '11-03', 2026)).resolves.toMatchObject({
                broken: [], observations: [{ uid: 7, maxt: 90, mint: 10 }],
            });
            expect(requests).toBe(2);
        } finally { fetchMock.mockRestore(); }
    });

    it('bounds retries when a daily response stays empty', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [] })));
        try {
            const outcome = expect(fetchStateForDate('DE', '2026-11-03', '11-03', 2026))
                .rejects.toThrow('Recent records for DE on 2026-11-03: No station observations returned');
            await vi.runAllTimersAsync();
            await outcome;
            expect(fetchMock).toHaveBeenCalledTimes(3);
        } finally { vi.useRealTimers(); fetchMock.mockRestore(); }
    });

    it.each([['M', 'M'], ['invalid', 'Infinity'], ['90junk', ''], [' ', false]])('rejects a state with no usable observations (%s, %s)', async (high, low) => {
        const fetchMock = mockStateResponses(high, low);
        try {
            await expect(fetchStateForDate('CA', '2026-11-02', '11-02', 2026)).rejects.toThrow(/CA.*No usable station observations/);
        } finally { fetchMock.mockRestore(); }
    });

    it('accepts usable observations when no station breaks a record', async () => {
        const fetchMock = mockStateResponses('90', '10');
        try {
            const result = await fetchStateForDate('CA', '2026-11-02', '11-02', 2026);
            expect(result.broken).toEqual([]);
            expect(result.observations).toEqual([expect.objectContaining({ uid: 1, maxt: 90, mint: 10 })]);
        } finally { fetchMock.mockRestore(); }
    });

    it('retains zero temperatures and a missing companion observation', async () => {
        const fetchMock = mockStateResponses('M', 0);
        try {
            const result = await fetchStateForDate('CA', '2026-11-02', '11-02', 2026);
            expect(result.broken).toEqual([]);
            expect(result.observations).toEqual([expect.objectContaining({ uid: 1, maxt: null, mint: 0 })]);
        } finally { fetchMock.mockRestore(); }
    });

    it('accepts missing historical and monthly values alongside usable daily observations', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
            const params = JSON.parse(String(options?.body));
            const station = params.date ? { data: ['90', '10'] }
                : params.elems[0].interval === 'mly' ? { smry: ['M', 'M'] }
                    : { smry: [['M', 'M'], ['M', 'M'], 'M', 'M'] };
            return new Response(JSON.stringify({ data: [{ meta: { uid: 1 }, ...station }] }));
        });
        try {
            const result = await fetchStateForDate('DE', '2026-11-03', '11-03', 2026);
            expect(result.broken).toEqual([]);
            expect(result.observations).toEqual([{ uid: 1, maxt: 90, mint: 10 }]);
        } finally { fetchMock.mockRestore(); }
    });

    it.each([
        [2024, '2023-02-28'],
        [2025, '2024-02-29'],
    ])('uses the historical year to end the February monthly request for %i', async (year, expectedEnd) => {
        const requests: Array<{ edate?: string }> = [];
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
            const params = JSON.parse(String(options?.body));
            requests.push(params);
            const smry = !params.date && params.elems[0].interval === 'mly' ? ['M', 'M'] : [['M', 'M'], ['M', 'M'], 'M', 'M'];
            return new Response(JSON.stringify({ data: [{ meta: { uid: 1 }, data: ['90', '10'], smry }] }));
        });
        try {
            await fetchStateForDate('CA', `${year}-02-15`, '02-15', year);
            expect(requests.at(-1)?.edate).toBe(expectedEnd);
        } finally { fetchMock.mockRestore(); }
    });

    it('rejects a county snapshot that omits California', () => {
        expect(() => assertStateCoverage([
            { properties: { state: 'OR' } },
            { properties: { state: 'WA' } },
        ], ['CA', 'OR', 'WA'], 'county records')).toThrow(/county records.*CA/);
    });

    it('reports completed states from the actual records, including duplicate station rows', () => {
        expect(assertStateCoverage([
            { properties: { state: 'CA' } }, { properties: { state: 'CA' } },
            { properties: { state: 'OR' } },
        ], ['CA', 'OR'], 'county records')).toEqual({ expectedStates: ['CA', 'OR'], completedStates: ['CA', 'OR'] });
    });

    it('rejects an ACIS error instead of treating the state as a day with no records', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => new Response(JSON.stringify({ error: 'State request failed' }), { status: 200 });
        try {
            await expect(fetchStateForDate('CA', '2026-11-02', '11-02', 2026)).rejects.toThrow(/CA.*2026-11-02.*State request failed/);
        } finally { globalThis.fetch = originalFetch; }
    });
});

function record(date: string, type: 'high' | 'low', tempF: number) {
    return { date, type, tempF };
}

describe('temperature sync recent-record helpers', () => {
    it('filters stale summaries to the requested dates only', () => {
        const recentRecords = {
            last7Days: [
                record('2026-04-27', 'high', 91),
                record('2026-04-26', 'low', 22),
                record('2026-03-01', 'high', 87),
            ],
        };

        expect(filterBrokenRecordsForDates(recentRecords, ['2026-04-27', '2026-04-26']))
            .toEqual([
                record('2026-04-27', 'high', 91),
                record('2026-04-26', 'low', 22),
            ]);
    });

    it('ignores malformed cached records while filtering previous summaries', () => {
        const expected = record('2026-04-27', 'high', 93);
        const recentRecords = {
            last7Days: [
                expected,
                null,
                { type: 'low', tempF: 25 },
                record('2026-04-20', 'low', 19),
            ],
        };

        expect(filterBrokenRecordsForDates(recentRecords, ['2026-04-27'])).toEqual([expected]);
        expect(filterBrokenRecordsForDates({}, ['2026-04-27'])).toEqual([]);
    });

    it('builds a bounded rolling recent-record window', () => {
        const recentRecords = buildRecentRecords(
            '2026-04-28',
            '2026-04-27',
            [
                record('2026-04-27', 'low', 25),
                record('2026-04-27', 'high', 93),
                record('2026-04-26', 'high', 88),
                record('2026-04-20', 'high', 99),
            ],
            ['2026-04-27', '2026-04-26'],
        );

        expect(recentRecords.asOf).toBe('2026-04-28');
        expect(recentRecords.dates).toEqual(['2026-04-27', '2026-04-26']);
        expect(recentRecords.yesterday.map(item => item.date)).toEqual(['2026-04-27', '2026-04-27']);
        expect(recentRecords.last7Days.map(item => item.date)).toEqual(['2026-04-27', '2026-04-26', '2026-04-27']);
    });

    it('tracks covered dates even when a day has no broken records', () => {
        const covered = coveredRecentRecordDates({
            dates: ['2026-04-27', '2026-04-26'],
            last7Days: [record('2026-04-27', 'high', 91)],
        }, ['2026-04-27', '2026-04-26', '2026-04-25']);

        expect([...covered]).toEqual(['2026-04-27', '2026-04-26']);
    });

    it('falls back to last7Days dates on legacy summaries without a dates array', () => {
        // Old recentRecords.json has no `dates` field — must still detect covered dates
        // from the broken-record rows themselves. Zero-record days are treated as uncovered.
        const covered = coveredRecentRecordDates({
            last7Days: [
                record('2026-04-27', 'high', 91),
                record('2026-04-26', 'low', 22),
            ],
        }, ['2026-04-27', '2026-04-26', '2026-04-25']);

        expect(covered.has('2026-04-27')).toBe(true);
        expect(covered.has('2026-04-26')).toBe(true);
        // 2026-04-25 had no records so it is NOT detected as covered via last7Days alone
        expect(covered.has('2026-04-25')).toBe(false);
    });

    it('returns an empty set for null, non-object, or missing recentRecords', () => {
        expect(coveredRecentRecordDates(null, ['2026-04-27'])).toEqual(new Set());
        expect(coveredRecentRecordDates(undefined, ['2026-04-27'])).toEqual(new Set());
        expect(coveredRecentRecordDates(42 as unknown as object, ['2026-04-27'])).toEqual(new Set());
        expect(coveredRecentRecordDates({ dates: [], last7Days: [] }, [])).toEqual(new Set());
    });
});

describe('temperature sync archive rebuild helpers', () => {
    const baseStation = (uid: number) => ({ uid, name: 'TEST', ll: [-90.0, 35.0] as [number, number], state: 'TN', county: '47000', elev: 500 });
    const indexOf = (...stations: ReturnType<typeof baseStation>[]) =>
        new Map(stations.map(s => [s.uid, s]));

    it('rebuilds broken records from archived daily observations', () => {
        const archive = {
            date: '2026-04-27',
            count: 4,
            observations: [
                // uid 1: breaks a monthly high record (mh=94, maxt=95)
                { uid: 1, maxt: 95, mint: 40, rh: 90, rhd: '2012-04-27', rl: 35, rld: '2011-04-27', nh: 76, nl: 52, mh: 94, ml: 20 },
                // uid 2: breaks a daily low record (ml=18, mint=19 > ml, so scope stays 'daily')
                { uid: 2, maxt: 75, mint: 19, rh: 88, rhd: '2010-04-27', rl: 25, rld: '1999-04-27', nh: 70, nl: 44, mh: 100, ml: 18 },
                // uid 3: null maxt/mint — must not produce any broken-record rows
                { uid: 3, maxt: null, mint: null, rh: -5, rl: 10 },
                // uid 999: not in stationIndex — must be silently skipped
                { uid: 999, maxt: 100, rh: 80 },
            ],
        };
        const stationIndex = new Map([
            [1, { uid: 1, name: 'CONWAY', ll: [-92.4903, 35.1034], state: 'AR', county: '05045', elev: 312 }],
            [2, { uid: 2, name: 'AMES', ll: [-93.62, 42.03], state: 'IA', county: '19169', elev: 955 }],
            [3, { uid: 3, name: 'NULL STATION', ll: [-100.0, 40.0], state: 'NE', county: '31000', elev: 1800 }],
        ]);

        const rebuilt = buildBrokenRecordsFromDailyArchive('2026-04-27', archive, stationIndex);

        // uid 999 (not in index) and uid 3 (null temps) must both be excluded
        expect(rebuilt).toHaveLength(2);
        expect(rebuilt.every(r => r.uid !== 999)).toBe(true);
        expect(rebuilt.every(r => r.uid !== 3)).toBe(true);

        expect(rebuilt).toEqual([
            expect.objectContaining({
                stationName: 'CONWAY',
                uid: 1,
                state: 'AR',
                stateName: 'Arkansas',
                county: '05045',
                lat: 35.1034,
                lon: -92.4903,
                type: 'high',
                tempF: 95,
                prevRecordF: 90,
                prevRecordDate: '2012-04-27',
                normalF: 76,
                date: '2026-04-27',
                recordScope: 'monthly',
            }),
            expect.objectContaining({
                stationName: 'AMES',
                uid: 2,
                type: 'low',
                tempF: 19,
                prevRecordF: 25,
                prevRecordDate: '1999-04-27',
                normalF: 44,
                recordScope: 'daily',
            }),
        ]);
    });

    it('returns empty array for null/missing archive or non-Map index', () => {
        const idx = indexOf(baseStation(1));
        const archive = { date: '2026-04-27', observations: [{ uid: 1, maxt: 100, rh: 80 }] };

        expect(buildBrokenRecordsFromDailyArchive('2026-04-27', null as never, idx)).toEqual([]);
        expect(buildBrokenRecordsFromDailyArchive('2026-04-27', archive, [] as never)).toEqual([]);
        expect(buildBrokenRecordsFromDailyArchive('2026-04-27', archive, undefined as never)).toEqual([]);
    });

    it('returns empty array when observations list is empty', () => {
        const archive = { date: '2026-04-27', observations: [] };
        expect(buildBrokenRecordsFromDailyArchive('2026-04-27', archive, indexOf(baseStation(1)))).toEqual([]);
    });

    it('treats ACIS sentinel strings "M" and "T" as missing values', () => {
        const archive = {
            date: '2026-04-27',
            observations: [{ uid: 1, maxt: 'M', mint: 'T', rh: 80, rl: 30 }],
        };
        // 'M'/'T' coerce to null via numberOrNull — nothing to compare against records
        expect(buildBrokenRecordsFromDailyArchive('2026-04-27', archive, indexOf(baseStation(1)))).toEqual([]);
    });

    it('detects cold broken records with negative prevRecordF', () => {
        // A genuine record-low scenario: station broke a sub-zero record
        const archive = {
            date: '2026-01-15',
            observations: [{ uid: 1, mint: -35, rl: -28, rld: '1985-01-15', nl: 12 }],
        };
        const [result] = buildBrokenRecordsFromDailyArchive('2026-01-15', archive, indexOf(baseStation(1)));

        expect(result).toMatchObject({ type: 'low', tempF: -35, prevRecordF: -28, prevRecordDate: '1985-01-15', normalF: 12 });
    });

    it('produces both high and low broken records from the same observation', () => {
        // A single station breaking both its high and low record on the same day
        // is unusual but valid in the archive format (separate high/low obs entries
        // can coexist; here both are in one compact obs)
        const archive = {
            date: '2026-04-27',
            observations: [
                { uid: 1, maxt: 95, mint: 22, rh: 90, rl: 28, nh: 74, nl: 48 },
            ],
        };
        const results = buildBrokenRecordsFromDailyArchive('2026-04-27', archive, indexOf(baseStation(1)));

        expect(results).toHaveLength(2);
        expect(results.find(r => r.type === 'high')).toMatchObject({ tempF: 95, prevRecordF: 90 });
        expect(results.find(r => r.type === 'low')).toMatchObject({ tempF: 22, prevRecordF: 28 });
    });

    it('falls back to zero coords when station ll is absent', () => {
        const stationNoCoords = { uid: 1, name: 'UNKNOWN', ll: null as never, state: 'TX', county: '48000', elev: null };
        const archive = { date: '2026-04-27', observations: [{ uid: 1, maxt: 105, rh: 100 }] };
        const [result] = buildBrokenRecordsFromDailyArchive('2026-04-27', archive, new Map([[1, stationNoCoords]]));

        expect(result.lat).toBe(0);
        expect(result.lon).toBe(0);
    });

    it('uses the raw state abbreviation as stateName when state is not in US_STATES', () => {
        const unknownState = { uid: 1, name: 'X STATION', ll: [-80.0, 18.0] as [number, number], state: 'PR', county: '72000', elev: 10 };
        const archive = { date: '2026-04-27', observations: [{ uid: 1, maxt: 92, rh: 88 }] };
        const [result] = buildBrokenRecordsFromDailyArchive('2026-04-27', archive, new Map([[1, unknownState]]));

        expect(result.stateName).toBe('PR');
    });

    it('prefers compact rhd/rld fields over verbose recordHighDate/recordLowDate', () => {
        // rhd takes priority if both forms present (shouldn't happen in practice but
        // exercises the fallback chain in previousRecordDate)
        const archive = {
            date: '2026-04-27',
            observations: [{ uid: 1, maxt: 95, rh: 90, rhd: '2012-04-27', recordHighDate: '1999-01-01' }],
        };
        const [result] = buildBrokenRecordsFromDailyArchive('2026-04-27', archive, indexOf(baseStation(1)));

        expect(result.prevRecordDate).toBe('2012-04-27');
    });

    it('returns empty prevRecordDate when no date field is present', () => {
        const archive = { date: '2026-04-27', observations: [{ uid: 1, maxt: 95, rh: 90 }] };
        const [result] = buildBrokenRecordsFromDailyArchive('2026-04-27', archive, indexOf(baseStation(1)));

        expect(result.prevRecordDate).toBe('');
    });

    it('classifies recordScope as monthly when maxt exceeds monthly high', () => {
        const archive = { date: '2026-04-27', observations: [{ uid: 1, maxt: 101, rh: 98, mh: 100 }] };
        const [result] = buildBrokenRecordsFromDailyArchive('2026-04-27', archive, indexOf(baseStation(1)));

        expect(result.recordScope).toBe('monthly');
    });

    it('classifies recordScope as daily when maxt does not exceed monthly high', () => {
        const archive = { date: '2026-04-27', observations: [{ uid: 1, maxt: 99, rh: 97, mh: 100 }] };
        const [result] = buildBrokenRecordsFromDailyArchive('2026-04-27', archive, indexOf(baseStation(1)));

        expect(result.recordScope).toBe('daily');
    });

    it('classifies recordScope as daily when no monthly extreme is present', () => {
        const archive = { date: '2026-04-27', observations: [{ uid: 1, maxt: 99, rh: 97 }] };
        const [result] = buildBrokenRecordsFromDailyArchive('2026-04-27', archive, indexOf(baseStation(1)));

        expect(result.recordScope).toBe('daily');
    });
});

describe('temperature sync validation helpers', () => {
    it('rejects recent-record output outside the requested window', () => {
        expect(() => validateRecentRecords({
            asOf: '2026-04-28',
            yesterday: [],
            last7Days: [record('2026-04-20', 'high', 99)],
        }, ['2026-04-27'])).toThrow(/outside the requested window/);
    });

    it('rejects malformed or stale yesterday sections', () => {
        expect(() => validateRecentRecords({
            asOf: '2026-04-28',
            yesterday: [record('2026-04-26', 'high', 88)],
            last7Days: [],
        }, ['2026-04-27', '2026-04-26'])).toThrow(/yesterday includes dates other than 2026-04-27/);

        expect(() => validateRecentRecords({
            asOf: '2026-04-28',
            yesterday: [],
            last7Days: [null],
        }, ['2026-04-27'])).toThrow(/last7Days includes records without valid dates/);
    });
});

describe('temperature sync station index helpers', () => {
    it('merges valid stations into the previous catalog by uid', () => {
        const previous = new Map<string | number, { uid: number | string; name: string }>([
            [1, { uid: 1, name: 'Old One' }],
            [2, { uid: 2, name: 'Old Two' }],
            ['bad', { uid: 'bad', name: 'Corrupt Station' }],
        ]);
        const current = new Map<string | number, { uid: number | string; name: string } | null>([
            [2, { uid: 2, name: 'New Two' }],
            ['3', { uid: '3', name: 'New Three' }],
            [4, null],
        ]);

        const merged = mergeStationIndexes(previous, current);

        expect(merged.size).toBe(3);
        expect(merged.get(1)?.name).toBe('Old One');
        expect(merged.get(2)?.name).toBe('New Two');
        expect(merged.get(3)?.name).toBe('New Three');
        expect(merged.get(3)?.uid).toBe(3);
    });
});

describe('temperature sync CLI parsing', () => {
    it('uses the default backfill window unless explicitly overridden', () => {
        expect(parseBackfillDays(['node', 'scripts/sync-temperatures.js'])).toBe(7);
        expect(parseBackfillDays(['node', 'scripts/sync-temperatures.js', '--backfill-days', '30'])).toBe(30);
        expect(parseBackfillDays(['node', 'scripts/sync-temperatures.js', '--backfill-days=14', '--recent-only'])).toBe(14);
    });

    it('rejects missing, malformed, or excessive backfill windows', () => {
        expect(() => parseBackfillDays(['node', 'script', '--backfill-days', '--recent-only'])).toThrow(/Invalid --backfill-days/);
        expect(() => parseBackfillDays(['node', 'script', '--backfill-days=0'])).toThrow(/Invalid --backfill-days/);
        expect(() => parseBackfillDays(['node', 'script', '--backfill-days=367'])).toThrow(/Invalid --backfill-days/);
    });
});

describe('temperature standing-record trend helpers', () => {
    it('fills internal and trailing calendar years before calculating ten-year windows', () => {
        const features = [
            { properties: { type: 'high', date: '2000-07-01' } },
            { properties: { type: 'low', date: '2002-01-15' } },
            { properties: { type: 'high', date: '2010-08-02' } },
        ];

        const trends = generateClimateTrends({ features }, 2012);

        expect(trends.byYear).toHaveLength(123);
        expect(trends.byYear.find(({ year }) => year === 2001)).toEqual({ year: 2001, highs: 0, lows: 0 });
        expect(trends.byYear.at(-1)).toEqual({ year: 2012, highs: 0, lows: 0 });
        expect(trends.rollingRatio.find(({ year }) => year === 2010)).toEqual({
            year: 2010,
            ratio: 1,
            highs10yr: 1,
            lows10yr: 1,
        });
        expect(trends.rollingRatio.at(-1)).toEqual({
            year: 2012,
            ratio: null,
            highs10yr: 1,
            lows10yr: 0,
        });
    });

    it('rejects an invalid trend end year', () => {
        expect(() => generateClimateTrends({ features: [] }, 1889)).toThrow(/on or after 1890/);
    });
});
