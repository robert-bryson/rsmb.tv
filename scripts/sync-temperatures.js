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
 *   public/data/temperatures/stateRecords.json
 *   public/data/temperatures/countyRecords.json
 *   public/data/temperatures/recentRecords.json
 *   public/data/temperatures/summary.json
 *
 * USAGE
 * -----
 *   node scripts/sync-temperatures.js
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../public/data/temperatures');

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

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
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
        const data = await postJson('https://data.rcc-acis.org/MultiStnData', params);
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

/**
 * For each of the last 7 days, compare station observations against the
 * all-time record for that calendar date across all CONUS states.
 * A "broken record" is when a station's observed max exceeds the previous
 * all-time max for that day of year, or its observed min is below the
 * previous all-time min.
 */
async function fetchRecentRecords() {
    console.log('\n📅 Detecting daily record-breaking temperatures (last 7 days)...');

    const now = new Date();
    const todayStr = formatDate(now);
    const stateAbbrs = Object.keys(US_STATES).filter(s => s !== 'AK' && s !== 'HI');

    // Build array of the last 7 dates (most recent first)
    const dates = [];
    for (let d = 1; d <= 7; d++) {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - d);
        dates.push(formatDate(dt));
    }
    const yesterdayStr = dates[0];

    console.log(`  Checking dates: ${dates.join(', ')}`);

    // Collect broken records for all 7 days
    const allBroken = []; // { ...record, date }

    for (const dateStr of dates) {
        const mmdd = dateStr.slice(5); // "MM-DD"
        const year = parseInt(dateStr.slice(0, 4), 10);
        console.log(`\n  ── ${dateStr} ──`);

        let dayBroken = 0;

        for (let i = 0; i < stateAbbrs.length; i++) {
            const abbr = stateAbbrs[i];
            process.stdout.write(`\r    [${i + 1}/${stateAbbrs.length}] ${abbr}...  `);

            try {
                // Query 1: observations for this date
                const obs = await postJson('https://data.rcc-acis.org/MultiStnData', {
                    state: abbr,
                    date: dateStr,
                    meta: ['name', 'll', 'state', 'county', 'elev', 'uid'],
                    elems: ['maxt', 'mint'],
                });

                if (obs.error) continue;
                await sleep(200);

                // Query 2: historical records + normals for this calendar date (all prior years)
                const hist = await postJson('https://data.rcc-acis.org/MultiStnData', {
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
                });

                if (hist.error) continue;

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

                // Compare observations against historical records
                for (const stn of obs.data || []) {
                    const uid = stn.meta?.uid;
                    if (!uid || !histMap[uid]) continue;
                    const row = stn.data;
                    if (!Array.isArray(row) || row.length < 2) continue;

                    const [maxtStr, mintStr] = row;
                    const meta = stn.meta;
                    const rec = histMap[uid];

                    if (maxtStr !== 'M' && maxtStr !== 'T' && rec.recordHigh != null) {
                        const maxt = parseFloat(maxtStr);
                        if (!isNaN(maxt) && maxt > rec.recordHigh) {
                            allBroken.push({
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
                            });
                            dayBroken++;
                        }
                    }

                    if (mintStr !== 'M' && mintStr !== 'T' && rec.recordLow != null) {
                        const mint = parseFloat(mintStr);
                        if (!isNaN(mint) && mint < rec.recordLow) {
                            allBroken.push({
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
                            });
                            dayBroken++;
                        }
                    }
                }
            } catch {
                // continue on failure
            }

            await sleep(300);
        }

        const dayHighs = allBroken.filter(r => r.date === dateStr && r.type === 'high').length;
        const dayLows = allBroken.filter(r => r.date === dateStr && r.type === 'low').length;
        console.log(`  ${dateStr}: 🔥 ${dayHighs} highs, ❄️ ${dayLows} lows (${dayBroken} total)`);
    }

    // Split into yesterday vs full 7-day window
    const yesterdayRecords = allBroken
        .filter(r => r.date === yesterdayStr)
        .sort((a, b) => a.type === 'high' ? b.tempF - a.tempF : a.tempF - b.tempF);

    const last7Days = allBroken
        .sort((a, b) => a.type === 'high' ? b.tempF - a.tempF : a.tempF - b.tempF);

    const yHighs = yesterdayRecords.filter(r => r.type === 'high').length;
    const yLows = yesterdayRecords.filter(r => r.type === 'low').length;
    const tHighs = last7Days.filter(r => r.type === 'high').length;
    const tLows = last7Days.filter(r => r.type === 'low').length;

    console.log(`\n  Yesterday: 🔥 ${yHighs} highs, ❄️ ${yLows} lows`);
    console.log(`  Last 7 days: 🔥 ${tHighs} highs, ❄️ ${tLows} lows`);

    return {
        asOf: todayStr,
        yesterday: yesterdayRecords,
        last7Days,
    };
}

function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 5. Build Output Files ───────────────────────────────────────────

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

    console.log('🌡️  Temperature Records Sync');
    console.log('='.repeat(50));

    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
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

    // 4. Recent records summary
    const recentRecords = await fetchRecentRecords();

    writeFileSync(
        resolve(OUTPUT_DIR, 'recentRecords.json'),
        JSON.stringify(recentRecords, null, 2)
    );
    console.log(`✅ Wrote recentRecords.json`);

    console.log('\n🎉 Temperature records sync complete!');

    // GitHub Actions output
    if (process.env.GITHUB_OUTPUT) {
        const { appendFileSync } = await import('fs');
        appendFileSync(process.env.GITHUB_OUTPUT, 'changed=true\n');
    }
}

main().catch((err) => {
    console.error('\n❌ Sync failed:', err.message);
    process.exit(1);
});
