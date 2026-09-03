#!/usr/bin/env node

/**
 * sync-temperatures.js
 * ====================
 * Fetches US temperature record data from NOAA/ACIS sources and writes
 * static GeoJSON files for the temperature records webmap.
 *
 * DATA SOURCES
 * ------------
 *   1. NOAA SCEC (State Climate Extremes Committee) — all-time state records
 *      https://www.ncei.noaa.gov/access/monitoring/scec/records.json
 *
 *   2. ACIS (Applied Climate Information System) — county-level station records
 *      https://data.rcc-acis.org/ (no API key required)
 *
 *   3. ACIS General — county boundaries and metadata
 *      https://data.rcc-acis.org/General/county
 *
 * OUTPUTS
 * -------
 *   public/data/temperatures/stateRecords.json   — all-time state records (GeoJSON)
 *   public/data/temperatures/countyRecords.json  — all-time county records (GeoJSON)
 *   public/data/temperatures/recentRecords.json  — broken records for the last N days
 *     Shape: { asOf, dates: string[], yesterday: BrokenRecord[], last7Days: BrokenRecord[] }
 *     `dates` lists every date in the requested window so zero-record days are
 *     distinguishable from days that were never fetched (used by --recent-only cache logic).
 *   public/data/temperatures/climateTrends.json  — derived decade/year/rolling-ratio data
 *   public/data/temperatures/summary.json        — metadata: counts, last-updated
 *
 *   $TEMP_DATA_DIR/daily/YYYY/MM/YYYY-MM-DD.json — per-day observation archive
 *     Shape: { date, count, observations: ObsEntry[] }
 *     ObsEntry compact fields written alongside maxt/mint:
 *       rh / rl   — previous calendar-date record high / low (°F)
 *       rhd / rld — date of that previous record (YYYY-MM-DD, empty on very old stations)
 *       nh / nl   — 1950-baseline climatological normal high / low (°F)
 *       mh / ml   — all-time monthly high / low (°F)
 *   $TEMP_DATA_DIR/stations.json — cumulative station metadata index
 *
 * USAGE
 * -----
 *   node scripts/sync-temperatures.js
 *   node scripts/sync-temperatures.js --recent-only
 *   node scripts/sync-temperatures.js --recent-only --backfill-days=14
 */

import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../public/data/temperatures');
const TEMP_DATA_DIR = process.env.TEMP_DATA_DIR || '/mnt/nas/record-highs';
const DAILY_DIR = resolve(TEMP_DATA_DIR, 'daily');

// US state codes and approximate centroids for mapping
const US_STATES = {
    AL: { name: 'Alabama', lat: 32.806671, lon: -86.79113 },
    AK: { name: 'Alaska', lat: 63.588753, lon: -154.493062 },
    AZ: { name: 'Arizona', lat: 34.048928, lon: -111.093731 },
    AR: { name: 'Arkansas', lat: 35.20105, lon: -91.831833 },
    CA: { name: 'California', lat: 36.778261, lon: -119.417932 },
    CO: { name: 'Colorado', lat: 39.550051, lon: -105.782067 },
    CT: { name: 'Connecticut', lat: 41.603221, lon: -73.087749 },
    DE: { name: 'Delaware', lat: 38.910832, lon: -75.52767 },
    FL: { name: 'Florida', lat: 27.664827, lon: -81.515754 },
    GA: { name: 'Georgia', lat: 32.157435, lon: -82.907123 },
    HI: { name: 'Hawaii', lat: 19.898682, lon: -155.665857 },
    ID: { name: 'Idaho', lat: 44.068202, lon: -114.742041 },
    IL: { name: 'Illinois', lat: 40.633125, lon: -89.398528 },
    IN: { name: 'Indiana', lat: 40.551217, lon: -85.602364 },
    IA: { name: 'Iowa', lat: 41.878003, lon: -93.097702 },
    KS: { name: 'Kansas', lat: 39.011902, lon: -98.484246 },
    KY: { name: 'Kentucky', lat: 37.839333, lon: -84.270018 },
    LA: { name: 'Louisiana', lat: 31.244823, lon: -92.145024 },
    ME: { name: 'Maine', lat: 45.253783, lon: -69.445469 },
    MD: { name: 'Maryland', lat: 39.045755, lon: -76.641271 },
    MA: { name: 'Massachusetts', lat: 42.407211, lon: -71.382437 },
    MI: { name: 'Michigan', lat: 44.314844, lon: -85.602364 },
    MN: { name: 'Minnesota', lat: 46.729553, lon: -94.6859 },
    MS: { name: 'Mississippi', lat: 32.354668, lon: -89.398528 },
    MO: { name: 'Missouri', lat: 37.964253, lon: -91.831833 },
    MT: { name: 'Montana', lat: 46.879682, lon: -110.362566 },
    NE: { name: 'Nebraska', lat: 41.492537, lon: -99.901813 },
    NV: { name: 'Nevada', lat: 38.80261, lon: -116.419389 },
    NH: { name: 'New Hampshire', lat: 43.193852, lon: -71.572395 },
    NJ: { name: 'New Jersey', lat: 40.058324, lon: -74.405661 },
    NM: { name: 'New Mexico', lat: 34.51994, lon: -105.87009 },
    NY: { name: 'New York', lat: 43.299428, lon: -74.217933 },
    NC: { name: 'North Carolina', lat: 35.759573, lon: -79.0193 },
    ND: { name: 'North Dakota', lat: 47.551493, lon: -101.002012 },
    OH: { name: 'Ohio', lat: 40.417287, lon: -82.907123 },
    OK: { name: 'Oklahoma', lat: 35.007752, lon: -97.092877 },
    OR: { name: 'Oregon', lat: 43.804133, lon: -120.554201 },
    PA: { name: 'Pennsylvania', lat: 41.203322, lon: -77.194525 },
    RI: { name: 'Rhode Island', lat: 41.580095, lon: -71.477429 },
    SC: { name: 'South Carolina', lat: 33.836081, lon: -81.163725 },
    SD: { name: 'South Dakota', lat: 43.969515, lon: -99.901813 },
    TN: { name: 'Tennessee', lat: 35.517491, lon: -86.580447 },
    TX: { name: 'Texas', lat: 31.968599, lon: -99.901813 },
    UT: { name: 'Utah', lat: 39.32098, lon: -111.093731 },
    VT: { name: 'Vermont', lat: 44.558803, lon: -72.577841 },
    VA: { name: 'Virginia', lat: 37.431573, lon: -78.656894 },
    WA: { name: 'Washington', lat: 47.751074, lon: -120.740139 },
    WV: { name: 'West Virginia', lat: 38.597626, lon: -80.454903 },
    WI: { name: 'Wisconsin', lat: 43.78444, lon: -88.787868 },
    WY: { name: 'Wyoming', lat: 43.075968, lon: -107.290284 },
};

// Map full state names to abbreviations
const STATE_NAME_TO_ABBR = Object.fromEntries(
    Object.entries(US_STATES).map(([abbr, { name }]) => [name, abbr])
);

// FIPS state codes to abbreviations
const FIPS_TO_ABBR = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
    '08': 'CO', '09': 'CT', '10': 'DE', '12': 'FL', '13': 'GA',
    '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
    '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
    '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO',
    '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ',
    '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
    '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC',
    '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT',
    '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
};

const ABBR_TO_FIPS = Object.fromEntries(
    Object.entries(FIPS_TO_ABBR).map(([fips, abbr]) => [abbr, fips])
);

// ─── Helpers ─────────────────────────────────────────────────────────

const S3_BUCKET = process.env.TEMPERATURE_DATA_BUCKET || '';
const TEMPERATURE_DATA_BASE_URL = (
    process.env.TEMPERATURE_DATA_BASE_URL
    || process.env.VITE_TEMPERATURE_DATA_BASE_URL
    || 'https://data.rsmb.tv'
).replace(/\/+$/, '');

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/** Build the S3 key / local subpath for a daily observation file: YYYY/MM/YYYY-MM-DD.json */
function dailySubpath(dateStr) {
    const [yyyy, mm] = dateStr.split('-');
    return `${yyyy}/${mm}/${dateStr}.json`;
}

/**
 * Check if a daily observation file already exists on S3.
 * Returns true if the file exists, false otherwise.
 */
async function dailyExistsOnS3(dateStr) {
    if (!S3_BUCKET) return false;
    try {
        execFileSync('aws', [
            's3api',
            'head-object',
            '--bucket', S3_BUCKET,
            '--key', `daily/${dailySubpath(dateStr)}`,
        ], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Read a JSON object from the S3 data bucket. Returns null when S3 is not
 * configured or the object is unavailable.
 */
async function readJsonFromS3(key, options = {}) {
    if (!S3_BUCKET) return null;
    const tmpFile = resolve(tmpdir(), `rsmbtv-s3-${process.pid}-${Date.now()}.json`);
    try {
        execFileSync('aws', [
            's3api',
            'get-object',
            '--bucket', S3_BUCKET,
            '--key', key,
            tmpFile,
        ], { stdio: 'ignore' });
        return JSON.parse(readFileSync(tmpFile, 'utf-8'));
    } catch {
        return null;
    } finally {
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
    }
}

async function loadJsonFromDataStore(key, localPath, label) {
    const fromS3 = await readJsonFromS3(key);
    if (fromS3) {
        console.log(`  📦 Loaded ${label} from S3`);
        return fromS3;
    }

    try {
        const fromCdn = await fetchJson(`${TEMPERATURE_DATA_BASE_URL}/${key}`, { retries: 2, delay: 500 });
        console.log(`  🌐 Loaded ${label} from ${TEMPERATURE_DATA_BASE_URL}`);
        return fromCdn;
    } catch {
        // Fall through to local snapshot for fully offline development.
    }

    if (!existsSync(localPath)) return null;
    try {
        console.log(`  📁 Loaded ${label} from local snapshot`);
        return JSON.parse(readFileSync(localPath, 'utf-8'));
    } catch {
        return null;
    }
}

export function filterBrokenRecordsForDates(recentRecords, dates) {
    if (!recentRecords || !Array.isArray(recentRecords.last7Days)) return [];
    const dateSet = new Set(dates);
    return recentRecords.last7Days.filter(record => record && typeof record === 'object' && dateSet.has(record.date));
}

/**
 * Returns the set of requested dates that are already accounted for in a
 * previously-generated recentRecords summary.
 *
 * A date is considered covered when:
 *   - It appears in `recentRecords.dates` (explicit coverage list written by this
 *     script starting with the fix for the 2026-04 timeout), OR
 *   - At least one broken-record row exists for that date in `last7Days` (legacy
 *     summaries generated before the `dates` field was added).
 *
 * Zero-record days (no station broke a record that day) are only detectable via
 * `recentRecords.dates`; legacy summaries will silently treat them as uncovered
 * and trigger an archive-rebuild attempt.
 *
 * @param {object|null} recentRecords  Previously-fetched recentRecords.json content.
 * @param {string[]} dates             YYYY-MM-DD dates to check (most recent first).
 * @returns {Set<string>} Dates that are provably covered.
 */
export function coveredRecentRecordDates(recentRecords, dates) {
    if (!recentRecords || typeof recentRecords !== 'object') return new Set();
    const dateSet = new Set(dates);
    const coveredDates = new Set();

    if (Array.isArray(recentRecords.dates)) {
        for (const date of recentRecords.dates) {
            if (dateSet.has(date)) coveredDates.add(date);
        }
    }

    for (const record of filterBrokenRecordsForDates(recentRecords, dates)) {
        coveredDates.add(record.date);
    }

    return coveredDates;
}

async function loadPreviousRecentRecords() {
    const recentPath = resolve(OUTPUT_DIR, 'recentRecords.json');
    return loadJsonFromDataStore('recentRecords.json', recentPath, 'previous recentRecords.json');
}

async function loadPreviousStationIndex() {
    const localPath = resolve(TEMP_DATA_DIR, 'stations.json');
    const previous = await loadJsonFromDataStore('stations.json', localPath, 'previous stations.json');
    if (!previous || !Array.isArray(previous.stations)) return new Map();

    const stations = previous.stations
        .filter(station => station && typeof station === 'object' && Number.isFinite(Number(station.uid)))
        .map(station => [Number(station.uid), { ...station, uid: Number(station.uid) }]);
    return new Map(stations);
}

async function loadDailyObservationArchive(dateStr) {
    const archivePath = dailySubpath(dateStr);
    const archive = await loadJsonFromDataStore(
        `daily/${archivePath}`,
        resolve(DAILY_DIR, archivePath),
        `daily archive for ${dateStr}`
    );

    if (!archive || archive.date !== dateStr || !Array.isArray(archive.observations)) return null;
    return archive;
}

async function fetchJson(url, options = {}) {
    const { retries = 3, delay = 1000 } = options;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return await res.json();
        } catch (err) {
            if (attempt === retries) throw err;
            console.warn(`  Attempt ${attempt} failed for ${url}, retrying in ${delay}ms...`);
            await sleep(delay * attempt);
        }
    }
}

async function postJson(url, params, options = {}) {
    const { retries = 3, delay = 1000 } = options;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return await res.json();
        } catch (err) {
            if (attempt === retries) throw err;
            console.warn(`  Attempt ${attempt} failed, retrying in ${delay}ms...`);
            await sleep(delay * attempt);
        }
    }
}

// ─── S3-backed ACIS Response Cache ───────────────────────────────────

/**
 * Cache ACIS API responses on S3 under `cache/{category}/{hash}.json`.
 * On subsequent runs the cached response is returned without hitting ACIS.
 *
 * Categories (S3 prefix):
 *   - `hist-daily/{state}/{MMDD}`  — historical records for a calendar date
 *   - `county-alltime/{state}`     — county all-time records for a state
 *   - `monthly-extremes/{state}/{MM}` — monthly extreme records
 *
 * The cache is keyed by a SHA-256 hash of the full POST body so any
 * parameter change automatically busts the entry.
 *
 * The local disk directory TEMP_DATA_DIR is used as a write-through cache.
 */
const CACHE_DIR = resolve(TEMP_DATA_DIR, 'cache');
const ACIS_CACHE_STATS = { hits: 0, misses: 0 };

function cacheKey(category, params) {
    const hash = createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 16);
    return `cache/${category}/${hash}.json`;
}

/** Check S3 for a cached ACIS response; returns parsed JSON or null. */
async function readCacheFromS3(key) {
    return readJsonFromS3(key);
}

/** Write a cached ACIS response to local disk (uploaded to S3 in CI sync step). */
function writeCacheLocal(key, data) {
    const filePath = resolve(TEMP_DATA_DIR, key);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data));
}

/**
 * Cached wrapper around postJson for ACIS endpoints.
 * @param {string} url       ACIS endpoint
 * @param {object} params    POST body
 * @param {string} category  Cache prefix category (e.g. 'hist-daily/WY/03-25')
 * @param {object} [options] { maxAgeDays } — if set, skip cache entries older than N days.
 *                           The S3 object's LastModified is checked.
 */
async function cachedPostJson(url, params, category, options = {}) {
    const key = cacheKey(category, params);

    // Try S3 cache first
    const cached = await readCacheFromS3(key);
    if (cached) {
        ACIS_CACHE_STATS.hits++;
        return cached;
    }

    // Cache miss — fetch from ACIS
    ACIS_CACHE_STATS.misses++;
    const data = await postJson(url, params);

    // Write through to local disk for later S3 upload
    writeCacheLocal(key, data);
    return data;
}

// ─── 1. Fetch SCEC State Records ────────────────────────────────────

async function fetchStateRecords() {
    console.log('\n📊 Fetching SCEC state records...');
    const url = 'https://www.ncei.noaa.gov/access/monitoring/scec/records.json';
    const data = await fetchJson(url);

    // SCEC JSON has { description: {...}, records: [...] }
    const rawRecords = data.records || data;
    const records = [];

    for (const record of rawRecords) {
        const stateName = record.state;
        const abbr = STATE_NAME_TO_ABBR[stateName];
        if (!abbr) continue;

        const element = record.element;
        if (element !== 'All-Time Maximum Temperature' && element !== 'All-Time Minimum Temperature') continue;

        const coords = US_STATES[abbr];
        if (!coords) continue;

        // Value is already a number in the JSON
        const tempF = typeof record.value === 'number' ? record.value : parseInt(record.value, 10);
        if (isNaN(tempF)) continue;

        // Parse date from YYYYMMDD format
        const rawDate = record.begdate || '';
        const dateStr = rawDate.length === 8
            ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
            : rawDate;

        records.push({
            state: abbr,
            stateName,
            type: element === 'All-Time Maximum Temperature' ? 'high' : 'low',
            tempF,
            date: dateStr,
            location: record.location || '',
            station: record.station || '',
            lat: coords.lat,
            lon: coords.lon,
        });
    }

    console.log(`  Found ${records.length} state temperature records`);
    return records;
}

// ─── 2. Fetch County Records via ACIS ────────────────────────────────

// State all-time records used as quality bounds (reject county values > state + 10°F)
const STATE_RECORD_HIGHS = {
    AL: 112, AZ: 128, AR: 120, CA: 134, CO: 118, CT: 106, DE: 110, FL: 109,
    GA: 112, ID: 118, IL: 117, IN: 116, IA: 118, KS: 121, KY: 114, LA: 114,
    ME: 105, MD: 109, MA: 107, MI: 112, MN: 115, MS: 115, MO: 118, MT: 117,
    NE: 118, NV: 125, NH: 106, NJ: 110, NM: 122, NY: 108, NC: 110, ND: 121,
    OH: 113, OK: 120, OR: 119, PA: 111, RI: 104, SC: 113, SD: 120, TN: 113,
    TX: 120, UT: 118, VT: 107, VA: 110, WA: 118, WV: 112, WI: 114, WY: 115,
};
const STATE_RECORD_LOWS = {
    AL: -27, AZ: -40, AR: -29, CA: -45, CO: -61, CT: -32, DE: -17, FL: -2,
    GA: -17, ID: -60, IL: -36, IN: -36, IA: -47, KS: -40, KY: -37, LA: -16,
    ME: -50, MD: -40, MA: -35, MI: -51, MN: -60, MS: -19, MO: -40, MT: -70,
    NE: -47, NV: -50, NH: -47, NJ: -34, NM: -50, NY: -52, NC: -34, ND: -60,
    OH: -39, OK: -31, OR: -54, PA: -42, RI: -28, SC: -19, SD: -58, TN: -32,
    TX: -23, UT: -56, VT: -50, VA: -30, WA: -48, WV: -37, WI: -55, WY: -66,
};
const QC_MARGIN = 15; // allow 15°F beyond state record before rejecting

/** Check if a temperature reading is plausible given type, state, value, and date */
function isPlausible(type, tempF, state, date) {
    const month = date.length >= 7 ? parseInt(date.slice(5, 7), 10) : 0;
    if (type === 'high') {
        if (tempF > 135 || tempF < -50) return false;
        if (tempF > 115 && ![5, 6, 7, 8, 9].includes(month)) return false;
        if (STATE_RECORD_HIGHS[state] != null && tempF > STATE_RECORD_HIGHS[state] + QC_MARGIN) return false;
    } else {
        if (tempF < -70 || tempF > 60) return false;
        if (tempF < -40 && ![11, 12, 1, 2, 3].includes(month)) return false;
        if (STATE_RECORD_LOWS[state] != null && tempF < STATE_RECORD_LOWS[state] - QC_MARGIN) return false;
    }
    return true;
}

async function fetchCountyRecordsForState(stateAbbr) {
    const fips = ABBR_TO_FIPS[stateAbbr];
    if (!fips) return [];

    // Use ACIS MultiStnData with yearly interval to get all-time max/min temps
    // smry_only returns just the period-of-record extreme and date
    const params = {
        state: stateAbbr,
        sdate: '1890-01-01',
        edate: formatDate(new Date()),
        meta: ['name', 'll', 'county', 'state'],
        elems: [
            {
                name: 'maxt',
                interval: 'yly',
                duration: 'yly',
                reduce: 'max',
                smry: { reduce: 'max', add: 'date' },
                smry_only: 1,
            },
            {
                name: 'mint',
                interval: 'yly',
                duration: 'yly',
                reduce: 'min',
                smry: { reduce: 'min', add: 'date' },
                smry_only: 1,
            },
        ],
    };

    try {
        const data = await cachedPostJson(
            'https://data.rcc-acis.org/MultiStnData', params,
            `county-alltime/${stateAbbr}`
        );
        if (data.error) {
            console.warn(`  ACIS error for ${stateAbbr}: ${data.error}`);
            return [];
        }

        const stationRecords = [];

        for (const station of data.data || []) {
            const meta = station.meta;
            if (!meta?.ll || !meta.county) continue;

            const [lon, lat] = meta.ll;
            const countyFips = meta.county;

            // smry format: [[maxTemp, maxDate], [minTemp, minDate]]
            const smry = station.smry;
            if (!smry || smry.length < 2) continue;

            const [maxTemp, maxDate] = smry[0] || [];
            const [minTemp, minDate] = smry[1] || [];

            if (maxTemp && maxTemp !== 'M' && maxTemp !== null) {
                const t = parseFloat(maxTemp);
                if (!isNaN(t) && isPlausible('high', t, stateAbbr, maxDate || '')) {
                    stationRecords.push({
                        countyFips,
                        stationName: meta.name || 'Unknown',
                        state: stateAbbr,
                        type: 'high',
                        tempF: t,
                        date: maxDate || '',
                        lat,
                        lon,
                    });
                }
            }

            if (minTemp && minTemp !== 'M' && minTemp !== null) {
                const t = parseFloat(minTemp);
                if (!isNaN(t) && isPlausible('low', t, stateAbbr, minDate || '')) {
                    stationRecords.push({
                        countyFips,
                        stationName: meta.name || 'Unknown',
                        state: stateAbbr,
                        type: 'low',
                        tempF: t,
                        date: minDate || '',
                        lat,
                        lon,
                    });
                }
            }
        }

        return stationRecords;
    } catch (err) {
        console.warn(`  Failed to fetch station data for ${stateAbbr}: ${err.message}`);
        return [];
    }
}

/**
 * Aggregate station-level records to county-level (highest high / lowest low per county)
 */
function aggregateToCounty(stationRecords) {
    const countyMap = new Map();

    for (const rec of stationRecords) {
        const key = `${rec.countyFips}-${rec.type}`;
        const existing = countyMap.get(key);

        if (!existing) {
            countyMap.set(key, { ...rec });
            continue;
        }

        if (rec.type === 'high' && rec.tempF > existing.tempF) {
            countyMap.set(key, { ...rec });
        } else if (rec.type === 'low' && rec.tempF < existing.tempF) {
            countyMap.set(key, { ...rec });
        }
    }

    return Array.from(countyMap.values());
}

// ─── 3. Fetch County Boundaries ──────────────────────────────────────

async function fetchCountyMeta() {
    console.log('\n🗺️  Fetching county centroids from ACIS...');

    // Get all US counties with their bounding boxes
    const allCounties = new Map();

    for (const stateAbbr of Object.keys(US_STATES)) {
        if (stateAbbr === 'AK' || stateAbbr === 'HI') continue; // Skip for mainland focus

        try {
            const data = await fetchJson(
                `https://data.rcc-acis.org/General/county?state=${stateAbbr}&meta=id,name,bbox,state`
            );
            for (const county of data.meta || []) {
                if (county.bbox) {
                    const [west, south, east, north] = county.bbox;
                    allCounties.set(county.id, {
                        id: county.id,
                        name: county.name,
                        state: county.state,
                        lat: (south + north) / 2,
                        lon: (west + east) / 2,
                    });
                }
            }
        } catch {
            // continue on failure
        }
        await sleep(100);
    }

    console.log(`  Found ${allCounties.size} counties`);
    return allCounties;
}

// ─── 4. Fetch Daily Record-Breaking Temperatures from ACIS ───────────

const STATE_CONCURRENCY = 8; // Number of states to fetch in parallel

/**
 * Fetch observations and historical records for a single state on a single date.
 * Returns { broken, observations, stations } for merging into the main result.
 */
async function fetchStateForDate(abbr, dateStr, mmdd, year) {
    const broken = [];
    const observations = [];
    const stations = new Map();

    try {
        // Query 1: observations for this date
        const obs = await postJson('https://data.rcc-acis.org/MultiStnData', {
            state: abbr,
            date: dateStr,
            meta: ['name', 'll', 'state', 'county', 'elev', 'uid'],
            elems: ['maxt', 'mint'],
        });

        if (obs.error) return { broken, observations, stations };
        await sleep(200);

        // Query 2: historical records + normals for this calendar date (all prior years)
        const histParams = {
            state: abbr,
            sdate: `1950-${mmdd}`,
            edate: `${year - 1}-${mmdd}`,
            meta: ['uid'],
            elems: [
                { name: 'maxt', interval: [1, 0, 0], duration: 1, smry: { reduce: 'max', add: 'date' }, smry_only: 1 },
                { name: 'mint', interval: [1, 0, 0], duration: 1, smry: { reduce: 'min', add: 'date' }, smry_only: 1 },
                { name: 'maxt', interval: [1, 0, 0], duration: 1, smry: { reduce: 'mean' }, smry_only: 1 },
                { name: 'mint', interval: [1, 0, 0], duration: 1, smry: { reduce: 'mean' }, smry_only: 1 },
            ],
        };
        const hist = await cachedPostJson(
            'https://data.rcc-acis.org/MultiStnData', histParams,
            `hist-daily/${abbr}/${mmdd}`
        );

        if (hist.error) return { broken, observations, stations };

        // Build uid → historical record map
        const histMap = {};
        for (const stn of hist.data || []) {
            const uid = stn.meta?.uid;
            const smry = stn.smry;
            if (!uid || !smry || smry.length < 2) continue;
            if (smry[0][0] === 'M' && smry[1][0] === 'M') continue;
            histMap[uid] = {
                recordHigh: smry[0][0] !== 'M' ? parseFloat(smry[0][0]) : null,
                recordHighDate: smry[0][1] || '',
                recordLow: smry[1][0] !== 'M' ? parseFloat(smry[1][0]) : null,
                recordLowDate: smry[1][1] || '',
                normalHigh: smry.length > 2 && smry[2] !== 'M' ? Math.round(parseFloat(smry[2])) : null,
                normalLow: smry.length > 3 && smry[3] !== 'M' ? Math.round(parseFloat(smry[3])) : null,
            };
        }

        // Query 3: monthly extremes — all-time high/low for this calendar month
        const mm = mmdd.slice(0, 2); // "03"
        const lastDayOfMonth = new Date(year, parseInt(mm, 10), 0).getDate();
        const monthlyParams = {
            state: abbr,
            sdate: `1950-${mm}-01`,
            edate: `${year - 1}-${mm}-${String(lastDayOfMonth).padStart(2, '0')}`,
            meta: ['uid'],
            elems: [
                { name: 'maxt', interval: 'mly', duration: 'mly', reduce: 'max', smry: { reduce: 'max' }, smry_only: 1 },
                { name: 'mint', interval: 'mly', duration: 'mly', reduce: 'min', smry: { reduce: 'min' }, smry_only: 1 },
            ],
        };
        const monthly = await cachedPostJson(
            'https://data.rcc-acis.org/MultiStnData', monthlyParams,
            `monthly-extremes/${abbr}/${mm}`
        );
        const monthlyMap = {};
        if (!monthly.error) {
            for (const stn of monthly.data || []) {
                const uid = stn.meta?.uid;
                const smry = stn.smry;
                if (!uid || !smry || smry.length < 2) continue;
                monthlyMap[uid] = {
                    monthlyHigh: smry[0] !== 'M' ? parseFloat(smry[0]) : null,
                    monthlyLow: smry[1] !== 'M' ? parseFloat(smry[1]) : null,
                };
            }
        }

        // Compare observations against historical records
        for (const stn of obs.data || []) {
            const uid = stn.meta?.uid;
            if (!uid) continue;
            const meta = stn.meta;
            const row = stn.data;
            if (!Array.isArray(row) || row.length < 2) continue;

            const [maxtStr, mintStr] = row;
            const rec = histMap[uid];
            const monthlyExtremes = monthlyMap[uid];

            // Collect station metadata for index
            if (!stations.has(uid) && meta.ll) {
                stations.set(uid, {
                    uid,
                    name: meta.name || 'Unknown',
                    ll: meta.ll,
                    state: abbr,
                    county: meta.county || '',
                    elev: meta.elev ?? null,
                });
            }

            // Archive ALL valid observations
            const maxt = maxtStr !== 'M' && maxtStr !== 'T' ? parseFloat(maxtStr) : null;
            const mint = mintStr !== 'M' && mintStr !== 'T' ? parseFloat(mintStr) : null;
            if (maxt != null || mint != null) {
                const obsEntry = { uid, maxt, mint };
                if (rec) {
                    if (rec.recordHigh != null) obsEntry.rh = rec.recordHigh;
                    if (rec.recordHighDate) obsEntry.rhd = rec.recordHighDate;
                    if (rec.recordLow != null) obsEntry.rl = rec.recordLow;
                    if (rec.recordLowDate) obsEntry.rld = rec.recordLowDate;
                    if (rec.normalHigh != null) obsEntry.nh = rec.normalHigh;
                    if (rec.normalLow != null) obsEntry.nl = rec.normalLow;
                }
                if (monthlyExtremes) {
                    if (monthlyExtremes.monthlyHigh != null) obsEntry.mh = monthlyExtremes.monthlyHigh;
                    if (monthlyExtremes.monthlyLow != null) obsEntry.ml = monthlyExtremes.monthlyLow;
                }
                observations.push(obsEntry);
            }

            // Detect broken records
            if (!rec) continue;

            if (maxt != null && rec.recordHigh != null) {
                if (!isNaN(maxt) && maxt > rec.recordHigh) {
                    // Classify scope: daily → monthly → (county/state determined client-side)
                    const monthlyBeat = monthlyExtremes?.monthlyHigh != null && maxt > monthlyExtremes.monthlyHigh;
                    broken.push({
                        stationName: meta.name || 'Unknown',
                        uid,
                        state: abbr,
                        stateName: US_STATES[abbr]?.name || abbr,
                        county: meta.county || '',
                        lat: meta.ll?.[1] ?? 0,
                        lon: meta.ll?.[0] ?? 0,
                        elev: meta.elev ?? null,
                        type: 'high',
                        tempF: maxt,
                        prevRecordF: rec.recordHigh,
                        prevRecordDate: rec.recordHighDate,
                        normalF: rec.normalHigh,
                        date: dateStr,
                        recordScope: monthlyBeat ? 'monthly' : 'daily',
                    });
                }
            }

            if (mintStr !== 'M' && mintStr !== 'T' && rec.recordLow != null) {
                if (mint != null && mint < rec.recordLow) {
                    const monthlyBeat = monthlyExtremes?.monthlyLow != null && mint < monthlyExtremes.monthlyLow;
                    broken.push({
                        stationName: meta.name || 'Unknown',
                        uid,
                        state: abbr,
                        stateName: US_STATES[abbr]?.name || abbr,
                        county: meta.county || '',
                        lat: meta.ll?.[1] ?? 0,
                        lon: meta.ll?.[0] ?? 0,
                        elev: meta.elev ?? null,
                        type: 'low',
                        tempF: mint,
                        prevRecordF: rec.recordLow,
                        prevRecordDate: rec.recordLowDate,
                        normalF: rec.normalLow,
                        date: dateStr,
                        recordScope: monthlyBeat ? 'monthly' : 'daily',
                    });
                }
            }
        }
    } catch {
        // continue on failure
    }

    return { broken, observations, stations };
}

function numberOrNull(value) {
    if (value == null || value === '' || value === 'M' || value === 'T') return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function previousRecordDate(obs, type) {
    const compactKey = type === 'high' ? 'rhd' : 'rld';
    const verboseKey = type === 'high' ? 'recordHighDate' : 'recordLowDate';
    if (typeof obs[compactKey] === 'string') return obs[compactKey];
    if (typeof obs[verboseKey] === 'string') return obs[verboseKey];
    return '';
}

function archiveRecordScope(obs, type, tempF) {
    const monthlyRecord = numberOrNull(type === 'high' ? obs.mh : obs.ml);
    if (monthlyRecord == null) return 'daily';
    if (type === 'high') return tempF > monthlyRecord ? 'monthly' : 'daily';
    return tempF < monthlyRecord ? 'monthly' : 'daily';
}

function buildArchivedBrokenRecord(dateStr, obs, station, type, tempF, prevRecordF, normalF) {
    const [lon = 0, lat = 0] = Array.isArray(station.ll) ? station.ll : [];
    return {
        stationName: station.name || 'Unknown',
        uid: station.uid,
        state: station.state || '',
        stateName: US_STATES[station.state]?.name || station.state || '',
        county: station.county || '',
        lat,
        lon,
        elev: station.elev ?? null,
        type,
        tempF,
        prevRecordF,
        prevRecordDate: previousRecordDate(obs, type),
        normalF,
        date: dateStr,
        recordScope: archiveRecordScope(obs, type, tempF),
    };
}

/**
 * Reconstructs broken-record rows from a daily observation archive without
 * making any ACIS network requests.
 *
 * Each observation entry carries the raw observed temperature plus compact
 * fields written by `fetchStateForDate`:
 *   rh / rl   — previous calendar-date record high / low (°F)
 *   rhd / rld — date of that previous record (YYYY-MM-DD, may be empty on old archives)
 *   nh / nl   — 1950-baseline climatological normal high / low (°F)
 *   mh / ml   — all-time monthly high / low (°F)
 *
 * Any observation whose uid is absent from `stationIndex` is silently skipped
 * (station metadata is in a separate file and may lag archives for very new stations).
 *
 * @param {string} dateStr      YYYY-MM-DD date the archive covers.
 * @param {object} archive      Parsed daily observation archive ({ date, observations }).
 * @param {Map<number, object>} stationIndex  uid → station metadata map.
 * @returns {import('../src/features/temperatures/types/index.ts').BrokenRecord[]}
 */
export function buildBrokenRecordsFromDailyArchive(dateStr, archive, stationIndex) {
    if (!archive || !Array.isArray(archive.observations) || !(stationIndex instanceof Map)) return [];

    const broken = [];
    for (const obs of archive.observations) {
        if (!obs || typeof obs !== 'object') continue;
        const uid = Number(obs.uid);
        if (!Number.isFinite(uid)) continue;

        const station = stationIndex.get(uid);
        if (!station) continue;

        const maxt = numberOrNull(obs.maxt);
        const recordHigh = numberOrNull(obs.rh);
        if (maxt != null && recordHigh != null && maxt > recordHigh) {
            broken.push(buildArchivedBrokenRecord(
                dateStr,
                obs,
                station,
                'high',
                maxt,
                recordHigh,
                numberOrNull(obs.nh)
            ));
        }

        const mint = numberOrNull(obs.mint);
        const recordLow = numberOrNull(obs.rl);
        if (mint != null && recordLow != null && mint < recordLow) {
            broken.push(buildArchivedBrokenRecord(
                dateStr,
                obs,
                station,
                'low',
                mint,
                recordLow,
                numberOrNull(obs.nl)
            ));
        }
    }

    return broken;
}

/**
 * For each of the last 7 days, compare station observations against the
 * all-time record for that calendar date across all CONUS states.
 * A "broken record" is when a station's observed max exceeds the previous
 * all-time max for that day of year, or its observed min is below the
 * previous all-time min.
 *
 * Also collects ALL daily observations (not just broken) for archival to S3.
 * Returns { recentRecords, dailyObservations, stationIndex }.
 */
async function fetchRecentRecords(numDays = 7) {
    console.log(`\n📅 Detecting daily record-breaking temperatures (last ${numDays} days)...`);

    const now = new Date();
    const todayStr = formatDate(now);
    const stateAbbrs = Object.keys(US_STATES).filter(s => s !== 'AK' && s !== 'HI');

    // Build array of the last N dates (most recent first)
    const allDates = [];
    for (let daysBack = 1; daysBack <= numDays; daysBack++) {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - daysBack);
        allDates.push(formatDate(dt));
    }
    const yesterdayStr = allDates[0];

    console.log(`  Checking dates: ${allDates.join(', ')}`);

    const previousRecentRecords = await loadPreviousRecentRecords();
    const previousBroken = filterBrokenRecordsForDates(previousRecentRecords, allDates);
    const previousDateSet = coveredRecentRecordDates(previousRecentRecords, allDates);
    if (previousBroken.length > 0) {
        console.log(`  📋 Loaded ${previousBroken.length} broken records from previous summary`);
    }

    // Check S3 for already-archived dates. If the previous summary does not
    // cover that date, rebuild its rows from the daily archive before falling
    // back to slow ACIS fetches.
    const skippedDates = [];
    const datesToFetch = [];
    const rebuiltBroken = [];
    let previousStationIndex = null;

    async function getPreviousStationIndex() {
        if (!previousStationIndex) previousStationIndex = await loadPreviousStationIndex();
        return previousStationIndex;
    }

    for (const dateStr of allDates) {
        if (await dailyExistsOnS3(dateStr)) {
            if (previousDateSet.has(dateStr)) {
                console.log(`  ✅ ${dateStr} — already on S3 and present in summary, skipping ACIS fetch`);
                skippedDates.push(dateStr);
            } else {
                const archive = await loadDailyObservationArchive(dateStr);
                const archivedStationIndex = await getPreviousStationIndex();
                if (archive && archivedStationIndex.size > 0) {
                    const restoredBroken = buildBrokenRecordsFromDailyArchive(dateStr, archive, archivedStationIndex);
                    console.log(`  ♻️ ${dateStr} — rebuilt ${restoredBroken.length} broken records from daily archive`);
                    rebuiltBroken.push(...restoredBroken);
                    skippedDates.push(dateStr);
                } else {
                    console.warn(`  ⚠️ ${dateStr} — daily archive exists but could not be rebuilt; recomputing`);
                    datesToFetch.push(dateStr);
                }
            }
        } else {
            datesToFetch.push(dateStr);
        }
    }

    const skippedDateSet = new Set(skippedDates);
    const allBroken = [
        ...previousBroken.filter(record => skippedDateSet.has(record.date)),
        ...rebuiltBroken,
    ];

    if (datesToFetch.length === 0) {
        console.log('\n  All dates already archived on S3, nothing to fetch.');
        const recentRecords = buildRecentRecords(todayStr, yesterdayStr, allBroken, allDates);
        validateRecentRecords(recentRecords, allDates);
        return {
            recentRecords,
            dailyObservations: new Map(),
            stationIndex: new Map(),
        };
    }

    console.log(`  📡 Fetching ${datesToFetch.length} missing date(s): ${datesToFetch.join(', ')}`);

    // Collect ALL observations per date for S3 archival (only for fetched dates)
    const dailyObservations = new Map(); // dateStr → observation[]
    for (const d of datesToFetch) dailyObservations.set(d, []);

    // Collect unique station metadata for station index
    const stationIndex = new Map(); // uid → { uid, name, ll, state, county, elev }

    for (const dateStr of datesToFetch) {
        const mmdd = dateStr.slice(5); // "MM-DD"
        const year = parseInt(dateStr.slice(0, 4), 10);
        console.log(`\n  ── ${dateStr} ──`);

        const dayObs = dailyObservations.get(dateStr);

        // Process states in parallel batches
        for (let i = 0; i < stateAbbrs.length; i += STATE_CONCURRENCY) {
            const batch = stateAbbrs.slice(i, i + STATE_CONCURRENCY);
            process.stdout.write(`\r    [${Math.min(i + STATE_CONCURRENCY, stateAbbrs.length)}/${stateAbbrs.length}] ${batch.join(', ')}...  `);

            const results = await Promise.all(
                batch.map(abbr => fetchStateForDate(abbr, dateStr, mmdd, year))
            );

            // Merge batch results
            for (const { broken, observations, stations } of results) {
                allBroken.push(...broken);
                dayObs.push(...observations);
                for (const [uid, meta] of stations) {
                    if (!stationIndex.has(uid)) stationIndex.set(uid, meta);
                }
            }

            await sleep(200); // Brief pause between batches
        }

        const dayHighs = allBroken.filter(r => r.date === dateStr && r.type === 'high').length;
        const dayLows = allBroken.filter(r => r.date === dateStr && r.type === 'low').length;
        const dayBroken = dayHighs + dayLows;
        console.log(`  ${dateStr}: 🔥 ${dayHighs} highs, ❄️ ${dayLows} lows (${dayBroken} total)`);
    }

    const recentRecords = buildRecentRecords(todayStr, yesterdayStr, allBroken, allDates);
    validateRecentRecords(recentRecords, allDates);

    const yHighs = recentRecords.yesterday.filter(r => r.type === 'high').length;
    const yLows = recentRecords.yesterday.filter(r => r.type === 'low').length;
    const tHighs = recentRecords.last7Days.filter(r => r.type === 'high').length;
    const tLows = recentRecords.last7Days.filter(r => r.type === 'low').length;

    console.log(`\n  Yesterday: 🔥 ${yHighs} highs, ❄️ ${yLows} lows`);
    console.log(`  Last 7 days: 🔥 ${tHighs} highs, ❄️ ${tLows} lows (${skippedDates.length} days from cache)`);
    console.log(`  📦 Collected ${stationIndex.size} unique stations across all dates`);

    let totalObs = 0;
    for (const obs of dailyObservations.values()) totalObs += obs.length;
    console.log(`  📦 Collected ${totalObs} total observations for archival`);

    return {
        recentRecords,
        dailyObservations,
        stationIndex,
    };
}

function sortBrokenRecords(records) {
    return [...records].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'high' ? -1 : 1;
        return a.type === 'high' ? b.tempF - a.tempF : a.tempF - b.tempF;
    });
}

export function buildRecentRecords(asOf, yesterdayStr, brokenRecords, expectedDates) {
    const dateSet = new Set(expectedDates);
    const windowBroken = brokenRecords.filter(record => dateSet.has(record.date));

    return {
        asOf,
        dates: [...expectedDates],
        yesterday: sortBrokenRecords(windowBroken.filter(record => record.date === yesterdayStr)),
        last7Days: sortBrokenRecords(windowBroken),
    };
}

export function validateRecentRecords(recentRecords, expectedDates, expectedYesterday = expectedDates[0]) {
    if (!recentRecords || !Array.isArray(recentRecords.yesterday) || !Array.isArray(recentRecords.last7Days)) {
        throw new Error('recentRecords.json must include yesterday and last7Days arrays');
    }

    const invalidSection = ['yesterday', 'last7Days'].find(section => (
        recentRecords[section].some(record => !record || typeof record !== 'object' || typeof record.date !== 'string')
    ));
    if (invalidSection) {
        throw new Error(`recentRecords.json ${invalidSection} includes records without valid dates`);
    }

    const expectedDateSet = new Set(expectedDates);
    const actualDates = new Set(recentRecords.last7Days.map(record => record.date));
    const unexpectedDates = [...actualDates].filter(date => !expectedDateSet.has(date));

    if (unexpectedDates.length > 0) {
        throw new Error(`recentRecords.json includes dates outside the requested window: ${unexpectedDates.join(', ')}`);
    }

    const unexpectedYesterdayDates = [...new Set(recentRecords.yesterday.map(record => record.date))]
        .filter(date => date !== expectedYesterday);
    if (unexpectedYesterdayDates.length > 0) {
        throw new Error(`recentRecords.json yesterday includes dates other than ${expectedYesterday}: ${unexpectedYesterdayDates.join(', ')}`);
    }

    if (actualDates.size > expectedDateSet.size) {
        throw new Error(`recentRecords.json includes ${actualDates.size} dates, expected at most ${expectedDateSet.size}`);
    }
}

function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseBackfillDays(argv = process.argv) {
    const defaultDays = 7;
    const argIndex = argv.findIndex(arg => arg === '--backfill-days' || arg.startsWith('--backfill-days='));
    if (argIndex === -1) return defaultDays;

    const arg = argv[argIndex];
    const rawValue = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[argIndex + 1];
    if (!rawValue || rawValue.startsWith('--') || !/^\d+$/.test(rawValue)) {
        throw new Error('Invalid --backfill-days value. Use an integer from 1 to 366.');
    }

    const days = Number(rawValue);
    if (!Number.isSafeInteger(days) || days < 1 || days > 366) {
        throw new Error('Invalid --backfill-days value. Use an integer from 1 to 366.');
    }

    return days;
}

// ─── 5. Build Output Files ───────────────────────────────────────────

/**
 * Generate climate trends data from county records.
 * Produces decade aggregations, yearly counts, and 10-year rolling ratios.
 */
export function generateClimateTrends(countyGeoJson, endYear = new Date().getUTCFullYear()) {
    const firstYear = 1890;
    if (!Number.isSafeInteger(endYear) || endYear < firstYear) {
        throw new Error(`Climate trend end year must be an integer on or after ${firstYear}`);
    }

    const yearCounts = {}; // year → { highs, lows }

    for (const feature of countyGeoJson.features) {
        const { type, date } = feature.properties;
        if (!date || date.length < 4) continue;
        const year = parseInt(date.slice(0, 4), 10);
        if (isNaN(year) || year < firstYear || year > endYear) continue;

        if (!yearCounts[year]) yearCounts[year] = { highs: 0, lows: 0 };
        if (type === 'high') yearCounts[year].highs++;
        else if (type === 'low') yearCounts[year].lows++;
    }

    // By calendar year, including years when no current standing record was set.
    const years = Array.from(
        { length: endYear - firstYear + 1 },
        (_, index) => firstYear + index,
    );
    const byYear = years.map(year => ({
        year,
        highs: yearCounts[year]?.highs ?? 0,
        lows: yearCounts[year]?.lows ?? 0,
    }));

    // By decade
    const decadeCounts = {};
    for (const { year, highs, lows } of byYear) {
        const decade = Math.floor(year / 10) * 10;
        if (!decadeCounts[decade]) decadeCounts[decade] = { highs: 0, lows: 0 };
        decadeCounts[decade].highs += highs;
        decadeCounts[decade].lows += lows;
    }

    const decades = Object.keys(decadeCounts).map(Number).sort((a, b) => a - b);
    const byDecade = decades.map(decade => ({
        decade,
        label: `${decade}s`,
        highs: decadeCounts[decade].highs,
        lows: decadeCounts[decade].lows,
        ratio: decadeCounts[decade].lows > 0
            ? Math.round((decadeCounts[decade].highs / decadeCounts[decade].lows) * 100) / 100
            : null,
    }));

    // 10-year rolling ratio
    const rollingRatio = [];
    for (let i = 9; i < byYear.length; i++) {
        let h = 0, l = 0;
        for (let j = i - 9; j <= i; j++) {
            h += byYear[j].highs;
            l += byYear[j].lows;
        }
        rollingRatio.push({
            year: byYear[i].year,
            ratio: l > 0 ? Math.round((h / l) * 100) / 100 : null,
            highs10yr: h,
            lows10yr: l,
        });
    }

    let totalHighs = 0, totalLows = 0;
    for (const d of byYear) { totalHighs += d.highs; totalLows += d.lows; }

    return {
        source: 'Derived from countyRecords.json',
        description: 'County all-time temperature record age analysis',
        totalHighs,
        totalLows,
        byDecade,
        byYear,
        rollingRatio,
    };
}

/**
 * Write daily observation files and station index to temp directory for S3 upload.
 */
function normalizeStationEntry(uid, meta) {
    const numericUid = Number(uid);
    if (!Number.isFinite(numericUid) || !meta || typeof meta !== 'object') return null;
    return [numericUid, { ...meta, uid: numericUid }];
}

export function mergeStationIndexes(previousStationIndex, stationIndex) {
    const merged = new Map();

    for (const [uid, meta] of previousStationIndex) {
        const entry = normalizeStationEntry(uid, meta);
        if (entry) merged.set(entry[0], entry[1]);
    }

    for (const [uid, meta] of stationIndex) {
        const entry = normalizeStationEntry(uid, meta);
        if (entry) merged.set(entry[0], entry[1]);
    }
    return merged;
}

function writeDailyObservations(dailyObservations, stationIndex, previousStationIndex = new Map()) {
    for (const [dateStr, observations] of dailyObservations) {
        if (observations.length === 0) continue;
        const subpath = dailySubpath(dateStr);
        const filePath = resolve(DAILY_DIR, subpath);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, JSON.stringify({ date: dateStr, count: observations.length, observations }));
        console.log(`  📁 daily/${subpath} — ${observations.length} observations`);
    }

    if (stationIndex.size === 0) {
        console.log('  📁 stations.json — no new stations to merge');
        return;
    }

    const mergedStationIndex = mergeStationIndexes(previousStationIndex, stationIndex);
    const stations = Array.from(mergedStationIndex.values()).sort((a, b) => a.uid - b.uid);
    const indexPath = resolve(DAILY_DIR, '..', 'stations.json');
    writeFileSync(indexPath, JSON.stringify({
        generated: new Date().toISOString(),
        count: stations.length,
        stations,
    }));
    console.log(`  📁 stations.json — ${stations.length} stations`);
}

function buildStateGeoJson(records) {
    return {
        type: 'FeatureCollection',
        features: records.map((r) => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [r.lon, r.lat],
            },
            properties: {
                state: r.state,
                stateName: r.stateName,
                type: r.type,
                tempF: r.tempF,
                date: r.date,
                location: r.location,
                station: r.station,
            },
        })),
    };
}

function buildCountyGeoJson(records, countyMeta) {
    return {
        type: 'FeatureCollection',
        features: records
            .filter((r) => {
                const county = countyMeta.get(r.countyFips);
                return county != null;
            })
            .map((r) => {
                const county = countyMeta.get(r.countyFips);
                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [county?.lon ?? r.lon, county?.lat ?? r.lat],
                    },
                    properties: {
                        countyFips: r.countyFips,
                        countyName: county?.name ?? '',
                        state: r.state,
                        type: r.type,
                        tempF: r.tempF,
                        date: r.date,
                        stationName: r.stationName,
                        lat: r.lat,
                        lon: r.lon,
                    },
                };
            }),
    };
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
    const recentOnly = process.argv.includes('--recent-only');
    const backfillDays = parseBackfillDays(process.argv);

    console.log('🌡️  Temperature Records Sync');
    console.log('='.repeat(50));
    console.log(`  📂 Intermediary dir: ${TEMP_DATA_DIR}`);
    if (backfillDays !== 7) console.log(`  📅 Backfill: ${backfillDays} days`);

    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Verify TEMP_DATA_DIR is accessible before doing any real work
    try {
        mkdirSync(TEMP_DATA_DIR, { recursive: true });
        const { accessSync, constants } = await import('fs');
        accessSync(TEMP_DATA_DIR, constants.R_OK | constants.W_OK);
    } catch (err) {
        console.error(`\n❌ Intermediary dir is not accessible: ${TEMP_DATA_DIR}`);
        console.error(`   ${err.message}`);
        console.error(`   Set TEMP_DATA_DIR to a writable path, e.g.:`);
        console.error(`   TEMP_DATA_DIR=.temp/temperatures npm run sync-temperatures`);
        process.exit(1);
    }

    if (!recentOnly) {
        // 1. State records from SCEC
        const stateRecords = await fetchStateRecords();
        const stateGeoJson = buildStateGeoJson(stateRecords);

        writeFileSync(
            resolve(OUTPUT_DIR, 'stateRecords.json'),
            JSON.stringify(stateGeoJson, null, 2)
        );
        console.log(`\n✅ Wrote stateRecords.json (${stateRecords.length} features)`);

        // 2. County records from ACIS (process states in batches)
        console.log('\n📊 Fetching county-level records from ACIS...');
        console.log('  (This queries each state individually — will take a few minutes)');

        const allStationRecords = [];
        const stateAbbrs = Object.keys(US_STATES).filter(s => s !== 'AK' && s !== 'HI');

        for (let i = 0; i < stateAbbrs.length; i++) {
            const abbr = stateAbbrs[i];
            process.stdout.write(`  [${i + 1}/${stateAbbrs.length}] ${abbr}...`);
            const records = await fetchCountyRecordsForState(abbr);
            allStationRecords.push(...records);
            console.log(` ${records.length} station records`);
            await sleep(200); // Be nice to ACIS
        }

        const countyRecords = aggregateToCounty(allStationRecords);
        console.log(`  Aggregated to ${countyRecords.length} county-level records`);

        // 3. County metadata (centroids)
        const countyMeta = await fetchCountyMeta();
        const countyGeoJson = buildCountyGeoJson(countyRecords, countyMeta);

        writeFileSync(
            resolve(OUTPUT_DIR, 'countyRecords.json'),
            JSON.stringify(countyGeoJson)  // No pretty print — this file can be large
        );
        console.log(`✅ Wrote countyRecords.json (${countyGeoJson.features.length} features)`);

        // Climate trends (derived from county records)
        const climateTrends = generateClimateTrends(countyGeoJson);
        writeFileSync(
            resolve(OUTPUT_DIR, 'climateTrends.json'),
            JSON.stringify(climateTrends, null, 2)
        );
        console.log(`✅ Wrote climateTrends.json (${climateTrends.byYear.length} years, ${climateTrends.byDecade.length} decades)`);

        // 5. Summary metadata
        const summary = {
            lastUpdated: new Date().toISOString(),
            stateRecordCount: stateRecords.length,
            countyRecordCount: countyGeoJson.features.length,
            statesProcessed: stateAbbrs.length,
        };

        writeFileSync(
            resolve(OUTPUT_DIR, 'summary.json'),
            JSON.stringify(summary, null, 2)
        );
        console.log(`✅ Wrote summary.json`);
    }

    // 4. Recent records summary + daily observations
    const { recentRecords, dailyObservations, stationIndex } = await fetchRecentRecords(backfillDays);

    writeFileSync(
        resolve(OUTPUT_DIR, 'recentRecords.json'),
        JSON.stringify(recentRecords, null, 2)
    );
    console.log(`✅ Wrote recentRecords.json`);

    // 6. Write daily observation archives for S3 upload
    console.log('\n📦 Writing daily observation archives...');
    const previousStationIndex = stationIndex.size > 0 ? await loadPreviousStationIndex() : new Map();
    writeDailyObservations(dailyObservations, stationIndex, previousStationIndex);

    if (ACIS_CACHE_STATS.hits + ACIS_CACHE_STATS.misses > 0) {
        console.log(`\n📊 ACIS cache: ${ACIS_CACHE_STATS.hits} hits, ${ACIS_CACHE_STATS.misses} misses (${Math.round(100 * ACIS_CACHE_STATS.hits / (ACIS_CACHE_STATS.hits + ACIS_CACHE_STATS.misses))}% hit rate)`);
    }

    console.log('\n🎉 Temperature records sync complete!');

    // GitHub Actions output
    if (process.env.GITHUB_OUTPUT) {
        const { appendFileSync } = await import('fs');
        appendFileSync(process.env.GITHUB_OUTPUT, 'changed=true\n');
    }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
    main().catch((err) => {
        console.error('\n❌ Sync failed:', err.message);
        process.exit(1);
    });
}
