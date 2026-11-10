import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { z } from 'zod';
import { usStates } from '../shared/geography/usStates.ts';
import { climateTrendsSchema, countyRecordsSchema, recentRecordsSchema, stateRecordsSchema, temperatureSummarySchema } from '../shared/temperatureSchemas.ts';

const expectedStates = usStates.map(state => state.abbr).filter(state => state !== 'AK' && state !== 'HI').sort();
const allStates = usStates.map(state => state.abbr).sort();
const stateFips = new Map(usStates.map(state => [state.abbr, state.fips]));
const files = ['countyRecords.json', 'stateRecords.json', 'recentRecords.json', 'summary.json', 'climateTrends.json'];

function assertStates(states, label, expected = expectedStates) {
    if (!Array.isArray(states) || states.length !== expected.length
        || [...states].sort().some((state, index) => state !== expected[index])) {
        const description = expected === expectedStates ? '48 contiguous states' : '50 states';
        throw new Error(`${label}: expected all ${description} without duplicates.`);
    }
}

function validCoordinates(lon, lat) {
    return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
}

function assertRecordLocations(county, state, asOf) {
    const counties = new Set();
    for (const { properties: record, geometry } of county.features) {
        const key = `${record.countyFips}:${record.type}`;
        if (counties.has(key)) throw new Error(`County record is duplicated: ${key}.`);
        counties.add(key);
        if (!/^\d{5}$/.test(record.countyFips) || !record.countyFips.startsWith(stateFips.get(record.state) ?? '!')
            || !validCoordinates(record.lon, record.lat) || !validCoordinates(...geometry.coordinates)
            || record.date < '1890-01-01' || record.date > asOf) {
            throw new Error(`County record has an invalid location, state, or date: ${key}.`);
        }
    }
    for (const { properties: record, geometry } of state.features) {
        if (!validCoordinates(...geometry.coordinates) || record.date > asOf) {
            throw new Error(`State record has an invalid location or date: ${record.state}.`);
        }
    }
}

function assertStandingHistory(rawTrends, county, endYear) {
    const years = Array.from({ length: endYear - 1889 }, (_, index) => index + 1890);
    // Bound the year range before the frontend schema fills legacy gaps.
    if (!Array.isArray(rawTrends?.byYear) || rawTrends.byYear.length !== years.length
        || rawTrends.byYear.some((row, index) => row?.year !== years[index])) {
        throw new Error('Standing-record history must include every calendar year from 1890 through the as-of year.');
    }
    const normalized = climateTrendsSchema.parse(rawTrends);
    const counts = new Map(years.map(year => [year, { highs: 0, lows: 0 }]));
    for (const { properties: record } of county.features) {
        counts.get(Number(record.date.slice(0, 4)))[record.type === 'high' ? 'highs' : 'lows']++;
    }
    for (const row of rawTrends.byYear) {
        const expected = counts.get(row.year);
        if (row.highs !== expected.highs || row.lows !== expected.lows) {
            throw new Error(`Standing-record history for ${row.year} does not match county records.`);
        }
    }
    for (const field of ['totalHighs', 'totalLows', 'byDecade', 'rollingRatio']) {
        if (!isDeepStrictEqual(rawTrends[field], normalized[field])) {
            throw new Error(`Standing-record history ${field} does not match yearly counts.`);
        }
    }
}

function assertRecentRecords(recent, yesterday) {
    const keys = new Set();
    for (const record of recent.last7Days) {
        const key = `${record.uid}:${record.date}:${record.type}`;
        if (keys.has(key) || !Number.isSafeInteger(record.uid) || record.uid < 0
            || !expectedStates.includes(record.state) || !validCoordinates(record.lon, record.lat)) {
            throw new Error(`Recent record is duplicated or has an invalid station location: ${key}.`);
        }
        keys.add(key);
    }
    const sort = records => [...records].sort((a, b) => a.uid - b.uid || a.type.localeCompare(b.type));
    if (!isDeepStrictEqual(sort(recent.yesterday), sort(recent.last7Days.filter(record => record.date === yesterday)))) {
        throw new Error('Recent yesterday records do not match the seven-day snapshot.');
    }
}

function assertCoverage(coverage, label) {
    assertStates(coverage?.expectedStates, `${label} expected states`);
    assertStates(coverage?.completedStates, `${label} completed states`);
}

/** Check actual records as well as completion metadata after a full sync. */
export async function verifyTemperaturePublication({
    baseUrl = 'https://data.rsmb.tv', asOf = new Date().toISOString().slice(0, 10),
    updatedSince, fetchImpl = fetch, timeoutMs = 30_000,
} = {}) {
    const base = new URL(baseUrl.replace(/\/+$/, '') + '/');
    if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
        throw new Error('Use an HTTP(S) temperature data URL without credentials, query parameters, or a fragment.');
    }
    const asOfTime = Date.parse(`${asOf}T00:00:00Z`);
    if (!Number.isFinite(asOfTime) || new Date(asOfTime).toISOString().slice(0, 10) !== asOf
        || asOf < '1890-01-01' || asOf > new Date().toISOString().slice(0, 10)) throw new Error('Invalid as-of date.');
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) throw new Error('Invalid request timeout.');
    const since = updatedSince === undefined ? undefined : Date.parse(updatedSince);
    if (since !== undefined && !Number.isFinite(since)) throw new Error('Invalid updated-since timestamp.');

    const payloads = await Promise.all(files.map(async filename => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(new Error('Request timed out.')), timeoutMs);
        try {
            const response = await fetchImpl(new URL(filename, base), { cache: 'no-store', signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (!/^application\/(?:[\w.+-]+\+)?json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) throw new Error('Expected JSON content type.');
            return await response.json();
        } catch (cause) {
            throw new Error(`${filename}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
        } finally {
            clearTimeout(timer);
        }
    }));
    const [rawCounty, rawState, rawRecent, rawSummary, rawTrends] = payloads;
    const county = countyRecordsSchema.parse(rawCounty);
    const state = stateRecordsSchema.parse(rawState);
    const recent = recentRecordsSchema.parse(rawRecent);
    const summary = temperatureSummarySchema.parse(rawSummary);
    if (rawRecent.monthlyThresholdVersion !== 2) throw new Error('Monthly thresholds must use version 2.');
    if (recent.asOf !== asOf) throw new Error(`Recent snapshot is for ${recent.asOf}; expected ${asOf}.`);
    if (summary.countyRecordCount !== county.features.length || summary.stateRecordCount !== state.features.length) {
        throw new Error('Summary counts do not match the published records.');
    }
    if (summary.statesProcessed !== expectedStates.length) throw new Error('Summary must report 48 processed states.');
    assertCoverage(summary.countyCoverage, 'County coverage');
    for (const type of ['high', 'low']) {
        assertStates([...new Set(county.features.filter(feature => feature.properties.type === type).map(feature => feature.properties.state))], `County ${type} records`);
        assertStates([...new Set(state.features.filter(feature => feature.properties.type === type).map(feature => feature.properties.state))], `State ${type} records`, allStates);
    }
    assertRecordLocations(county, state, asOf);
    const endYear = new Date(asOfTime).getUTCFullYear();
    assertStandingHistory(rawTrends, county, endYear);
    if (!recent.dates?.length || new Set(recent.dates).size !== recent.dates.length) throw new Error('Recent dates must be present and unique.');
    const requiredDates = Array.from({ length: 7 }, (_, index) => new Date(asOfTime - (index + 1) * 86_400_000).toISOString().slice(0, 10));
    if (requiredDates.some(date => !recent.dates.includes(date))) throw new Error('Recent snapshot does not cover all seven preceding dates.');
    for (const date of recent.dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= asOf) throw new Error('Recent dates must precede the as-of date.');
        assertCoverage(recent.coverageByDate?.[date], `Recent coverage on ${date}`);
    }
    if (recent.last7Days.some(record => !recent.dates.includes(record.date)) || recent.yesterday.some(record => record.date !== requiredDates[0])) {
        throw new Error('Recent records contain dates outside their declared window.');
    }
    assertRecentRecords(recent, requiredDates[0]);
    for (const [label, timestamp] of [['Summary', summary.lastUpdated], ['Recent snapshot', recent.generatedAt]]) {
        if (!z.iso.datetime().safeParse(timestamp).success || (since !== undefined && Date.parse(timestamp) < since)) {
            throw new Error(`${label} timestamp is missing, invalid, or older than the requested sync.`);
        }
    }
    return {
        baseUrl: base.href, checkedAt: new Date().toISOString(), asOf,
        lastUpdated: summary.lastUpdated, recentGeneratedAt: recent.generatedAt,
        monthlyThresholdVersion: rawRecent.monthlyThresholdVersion,
        countyRecords: county.features.length, stateRecords: state.features.length,
        standingHistoryYears: rawTrends.byYear.length,
        californiaCountyRecords: county.features.filter(feature => feature.properties.state === 'CA').length,
        countyStates: expectedStates,
        recentCoverage: Object.fromEntries(recent.dates.map(date => [date, {
            states: recent.coverageByDate[date].completedStates.length,
            records: recent.last7Days.filter(record => record.date === date).length,
        }])),
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const { values } = parseArgs({ options: {
            'base-url': { type: 'string' }, 'as-of': { type: 'string' },
            'updated-since': { type: 'string' }, output: { type: 'string' },
        } });
        const result = await verifyTemperaturePublication({ baseUrl: values['base-url'], asOf: values['as-of'], updatedSince: values['updated-since'] });
        if (values.output) await fs.writeFile(values.output, JSON.stringify(result, null, 2) + '\n');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
