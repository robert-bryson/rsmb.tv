#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../..');
const DEFAULT_SOURCE_URL = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/';
const DEFAULT_WARNING_SOURCE_URL = 'https://mesonet.agron.iastate.edu/cgi-bin/request/gis/watchwarn.py';
const DEFAULT_WATCH_SOURCE_URL = 'https://mesonet.agron.iastate.edu/cgi-bin/request/gis/spc_watch.py';
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, 'public/data/tornadoes');
const DEFAULT_CACHE_DIR = path.join(REPO_ROOT, '.cache/tornado-tracks');
const DEFAULT_START_YEAR = 1950;
const DEFAULT_END_YEAR = new Date().getUTCFullYear();
const STORM_BASED_WARNING_START_YEAR = 2002;
const SPC_WATCH_START_YEAR = 1997;
const SEVERE_REPORT_TYPES = new Set(['TORNADO', 'HAIL', 'THUNDERSTORM WIND']);

const MONTHS = new Map([
    ['JAN', 1], ['FEB', 2], ['MAR', 3], ['APR', 4], ['MAY', 5], ['JUN', 6],
    ['JUL', 7], ['AUG', 8], ['SEP', 9], ['OCT', 10], ['NOV', 11], ['DEC', 12],
]);

const MONTH_NAMES = new Map([
    ['JANUARY', 1], ['FEBRUARY', 2], ['MARCH', 3], ['APRIL', 4], ['MAY', 5], ['JUNE', 6],
    ['JULY', 7], ['AUGUST', 8], ['SEPTEMBER', 9], ['OCTOBER', 10], ['NOVEMBER', 11], ['DECEMBER', 12],
]);

const STATE_ABBREVIATIONS = new Map(Object.entries({
    ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO',
    CONNECTICUT: 'CT', DELAWARE: 'DE', 'DISTRICT OF COLUMBIA': 'DC', FLORIDA: 'FL', GEORGIA: 'GA',
    HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY',
    LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN',
    MISSISSIPPI: 'MS', MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH',
    'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND',
    OHIO: 'OH', OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'PUERTO RICO': 'PR', 'RHODE ISLAND': 'RI',
    'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT',
    VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY',
}));

// Approximate bounding boxes [lonMin, latMin, lonMax, latMax] per state with a
// generous ±2° buffer so legitimate near-border events are never excluded.
// Used to detect source-data typos (e.g. -12.18 instead of -117.18).
const STATE_BBOX = new Map(Object.entries({
    AL: [-91, 28, -82, 37], AK: [-171, 49, -128, 74], AZ: [-117, 29, -107, 39],
    AR: [-97, 31, -87, 38], CA: [-127, 30, -112, 44], CO: [-111, 35, -100, 43],
    CT: [-76, 39, -69, 44], DC: [-80, 36, -74, 42], DE: [-78, 36, -73, 42],
    FL: [-90, 22, -78, 33], GA: [-88, 28, -78, 37], HI: [-163, 16, -152, 25],
    ID: [-119, 40, -109, 51], IL: [-94, 35, -85, 44], IN: [-90, 35, -82, 44],
    IA: [-99, 38, -88, 45], KS: [-104, 35, -92, 42], KY: [-92, 34, -80, 41],
    LA: [-96, 26, -86, 35], ME: [-73, 41, -65, 50], MD: [-81, 35, -73, 41],
    MA: [-75, 39, -68, 44], MI: [-92, 39, -80, 50], MN: [-99, 41, -87, 51],
    MS: [-94, 28, -86, 37], MO: [-98, 33, -87, 42], MT: [-119, 42, -102, 51],
    NE: [-106, 38, -93, 45], NV: [-122, 33, -112, 44], NH: [-74, 40, -68, 47],
    NJ: [-78, 37, -71, 43], NM: [-111, 29, -101, 39], NY: [-82, 38, -69, 47],
    NC: [-87, 31, -73, 39], ND: [-106, 43, -94, 51], OH: [-87, 36, -78, 44],
    OK: [-105, 31, -92, 39], OR: [-127, 39, -114, 48], PA: [-83, 37, -72, 44],
    PR: [-70, 15, -63, 20], RI: [-74, 39, -69, 44], SC: [-86, 30, -76, 37],
    SD: [-106, 41, -94, 48], TN: [-93, 32, -79, 38], TX: [-109, 23, -91, 39],
    UT: [-117, 35, -107, 44], VT: [-76, 41, -69, 47], VA: [-86, 34, -73, 39],
    WA: [-127, 43, -114, 51], WV: [-85, 35, -75, 42], WI: [-95, 40, -84, 49],
    WY: [-113, 39, -102, 47],
}));

const TITLECASE_EXCEPTIONS = new Map([
    ['DC', 'DC'], ['WFO', 'WFO'], ['NWS', 'NWS'], ['USA', 'USA'],
]);

function pad(value, length = 2) {
    return String(value).padStart(length, '0');
}

function round(value, digits = 2) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function cleanText(value) {
    return String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim();
}

function titleCase(value) {
    const cleaned = cleanText(value).toLowerCase();
    if (!cleaned) return '';
    return cleaned
        .split(/([\s-]+)/)
        .map((part) => {
            if (/^[\s-]+$/.test(part)) return part;
            const upper = part.toUpperCase();
            if (TITLECASE_EXCEPTIONS.has(upper)) return TITLECASE_EXCEPTIONS.get(upper);
            return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join('');
}

function parseNumeric(value) {
    if (value === null || value === undefined || value === '') return 0;
    const numeric = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(numeric) ? numeric : 0;
}

function parseBoolean(value) {
    return ['1', 'T', 'TRUE', 'Y', 'YES'].includes(cleanText(value).toUpperCase());
}

function parseTimezoneOffsetHours(value) {
    const match = cleanText(value).match(/([+-]\d{1,2})(?::?\d{2})?$/);
    if (!match) return null;
    const offset = Number(match[1]);
    return Number.isFinite(offset) ? offset : null;
}

function localNoaaTimeToUtcIso(dateTime, timezone) {
    const parsed = cleanText(dateTime).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
    const offsetHours = parseTimezoneOffsetHours(timezone);
    if (!parsed || offsetHours === null) return null;
    const [, year, month, day, hour, minute, second] = parsed.map(Number);
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offsetHours * 60 * 60 * 1000;
    return new Date(utcMs).toISOString();
}

function parseUtcTimestamp(value) {
    const raw = cleanText(value);
    if (!raw) return null;

    const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (compact) {
        const [, year, month, day, hour, minute] = compact;
        return `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;
    }

    const dashed = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?Z?$/);
    if (dashed) {
        const [, year, month, day, hour, minute, second = '00'] = dashed;
        return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
    }

    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function timestampMs(value) {
    const iso = parseUtcTimestamp(value);
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
}

function extractWktBbox(wkt) {
    const coordinates = [...cleanText(wkt).matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
        .map((match) => [Number(match[1]), Number(match[2])])
        .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
    if (!coordinates.length) return null;
    return coordinates.reduce((bbox, [lon, lat]) => ({
        west: Math.min(bbox.west, lon),
        east: Math.max(bbox.east, lon),
        south: Math.min(bbox.south, lat),
        north: Math.max(bbox.north, lat),
    }), { west: Infinity, east: -Infinity, south: Infinity, north: -Infinity });
}

function pointInBbox(report, bbox) {
    return bbox
        && report.lon >= bbox.west
        && report.lon <= bbox.east
        && report.lat >= bbox.south
        && report.lat <= bbox.north;
}

function parseCoordinate(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const coordinate = Number(raw);
    return Number.isFinite(coordinate) ? coordinate : null;
}

function isValidCoordinate(lat, lon) {
    return lat !== null
        && lon !== null
        && lat >= -90
        && lat <= 90
        && lon >= -180
        && lon <= 180;
}

// Returns true when [lat, lon] falls within the generous bounding box for the
// given state abbreviation. Unknown states always pass. Used to detect source
// typos like -12.18 lon (missing digit) when the state is CA.
function isCoordInStateBounds(lat, lon, state) {
    const bbox = STATE_BBOX.get(state);
    if (!bbox) return true;
    const [lonMin, latMin, lonMax, latMax] = bbox;
    return lon >= lonMin && lon <= lonMax && lat >= latMin && lat <= latMax;
}

export function parseDamage(value) {
    const raw = cleanText(value).replace(/[$,]/g, '').toUpperCase();
    if (!raw || raw === '0' || raw === '0.00') return 0;

    const match = raw.match(/^(-?\d+(?:\.\d+)?)([KMB])?$/);
    if (!match) return 0;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return 0;

    const multiplier = match[2] === 'B' ? 1_000_000_000 : match[2] === 'M' ? 1_000_000 : match[2] === 'K' ? 1_000 : 1;
    return Math.max(0, Math.round(amount * multiplier));
}

export function normalizeTornadoScale(rawScale, year = DEFAULT_END_YEAR) {
    const raw = cleanText(rawScale).toUpperCase();
    const unknown = { scale: -1, scaleLabel: 'Unknown' };
    if (!raw || raw === 'UNK' || raw === 'UNKN' || raw === 'EFU' || raw === 'FU') return unknown;

    const match = raw.match(/^(?:EF|F)?([0-5])$/);
    if (!match) return unknown;

    const scale = Number(match[1]);
    const prefix = raw.startsWith('EF') ? 'EF' : raw.startsWith('F') ? 'F' : year < 2007 ? 'F' : 'EF';
    return { scale, scaleLabel: `${prefix}${scale}` };
}

export function parseNoaaDateTime(dateTime, fallback = {}) {
    const raw = cleanText(dateTime).toUpperCase();
    const direct = raw.match(/^(\d{1,2})-([A-Z]{3})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})$/);

    if (direct) {
        const day = Number(direct[1]);
        const month = MONTHS.get(direct[2]);
        const shortYear = Number(direct[3]);
        const year = shortYear >= 50 ? 1900 + shortYear : 2000 + shortYear;
        const hour = Number(direct[4]);
        const minute = Number(direct[5]);
        const second = Number(direct[6]);

        if (month && day >= 1 && day <= 31) {
            const date = `${year}-${pad(month)}-${pad(day)}`;
            return {
                year,
                month,
                date,
                dateTime: `${date}T${pad(hour)}:${pad(minute)}:${pad(second)}`,
            };
        }
    }

    const fallbackYear = Number(fallback.year);
    const fallbackMonth = Number(fallback.month);
    const fallbackDay = Number(fallback.day);
    const fallbackTime = String(fallback.time ?? '').padStart(4, '0');

    if (Number.isFinite(fallbackYear) && Number.isFinite(fallbackMonth) && Number.isFinite(fallbackDay)) {
        const hour = Number(fallbackTime.slice(0, -2) || 0);
        const minute = Number(fallbackTime.slice(-2) || 0);
        const date = `${fallbackYear}-${pad(fallbackMonth)}-${pad(fallbackDay)}`;
        return {
            year: fallbackYear,
            month: fallbackMonth,
            date,
            dateTime: `${date}T${pad(hour)}:${pad(minute)}:00`,
        };
    }

    return null;
}

function parseNoaaDateTimeUtc(row) {
    const year = Number(row.YEAR);
    const month = parseMonth(row);
    const parsed = parseNoaaDateTime(row.BEGIN_DATE_TIME, {
        year,
        month,
        day: row.BEGIN_DAY,
        time: row.BEGIN_TIME,
    });
    if (!parsed) return null;
    const utc = localNoaaTimeToUtcIso(parsed.dateTime, row.CZ_TIMEZONE);
    return utc ? { ...parsed, dateTimeUtc: utc, timeMs: Date.parse(utc) } : null;
}

function parseMonth(row) {
    const yearMonth = cleanText(row.BEGIN_YEARMONTH);
    if (/^\d{6}$/.test(yearMonth)) return Number(yearMonth.slice(4, 6));
    return MONTH_NAMES.get(cleanText(row.MONTH_NAME).toUpperCase()) ?? 1;
}

function getStateAbbreviation(stateName) {
    const normalized = cleanText(stateName).toUpperCase();
    if (/^[A-Z]{2}$/.test(normalized)) return normalized;
    return STATE_ABBREVIATIONS.get(normalized) ?? normalized.slice(0, 2);
}

function normalizeTornadoRow(row, { includeNarratives = false } = {}) {
    if (cleanText(row.EVENT_TYPE).toUpperCase() !== 'TORNADO') return null;

    const beginLat = parseCoordinate(row.BEGIN_LAT);
    const beginLon = parseCoordinate(row.BEGIN_LON);
    const endLat = parseCoordinate(row.END_LAT) ?? beginLat;
    const endLon = parseCoordinate(row.END_LON) ?? beginLon;

    if (!isValidCoordinate(beginLat, beginLon) || !isValidCoordinate(endLat, endLon)) return null;

    const year = Number(row.YEAR);
    const month = parseMonth(row);
    const begin = parseNoaaDateTime(row.BEGIN_DATE_TIME, {
        year,
        month,
        day: row.BEGIN_DAY,
        time: row.BEGIN_TIME,
    });
    const end = parseNoaaDateTime(row.END_DATE_TIME, {
        year,
        month,
        day: row.END_DAY,
        time: row.END_TIME,
    });

    if (!begin || !Number.isFinite(year)) return null;

    const { scale, scaleLabel } = normalizeTornadoScale(row.TOR_F_SCALE, year);
    const stateName = titleCase(row.STATE);
    const state = getStateAbbreviation(row.STATE);

    // Clamp coordinates that are globally valid but outside the state's
    // approximate bounds — these are source-data typos (e.g. a missing leading
    // digit in a western-US longitude). If one endpoint is bad, degrade to a
    // point using the good endpoint. If both are bad, drop the row.
    const beginOk = isCoordInStateBounds(beginLat, beginLon, state);
    const endOk = isCoordInStateBounds(endLat, endLon, state);
    if (!beginOk && !endOk) return null;
    const finalBeginLat = beginOk ? beginLat : endLat;
    const finalBeginLon = beginOk ? beginLon : endLon;
    const finalEndLat = endOk ? endLat : beginLat;
    const finalEndLon = endOk ? endLon : beginLon;

    const deaths = parseNumeric(row.DEATHS_DIRECT) + parseNumeric(row.DEATHS_INDIRECT);
    const injuries = parseNumeric(row.INJURIES_DIRECT) + parseNumeric(row.INJURIES_INDIRECT);
    const lengthMiles = round(parseNumeric(row.TOR_LENGTH), 2);
    const widthYards = Math.round(parseNumeric(row.TOR_WIDTH));

    const properties = {
        id: `ncei-${year}-${cleanText(row.EVENT_ID)}`,
        eventId: cleanText(row.EVENT_ID),
        episodeId: cleanText(row.EPISODE_ID),
        year,
        month: begin.month,
        date: begin.date,
        beginTime: begin.dateTime,
        endTime: end?.dateTime ?? begin.dateTime,
        timezone: cleanText(row.CZ_TIMEZONE),
        state,
        stateName,
        county: titleCase(row.CZ_NAME),
        countyFips: cleanText(row.CZ_FIPS),
        wfo: cleanText(row.WFO),
        scale,
        scaleLabel,
        lengthMiles,
        widthYards,
        deaths,
        injuries,
        propertyDamage: parseDamage(row.DAMAGE_PROPERTY),
        cropDamage: parseDamage(row.DAMAGE_CROPS),
        source: cleanText(row.SOURCE),
        dataSource: cleanText(row.DATA_SOURCE) || 'NCEI StormEvents',
        ...(includeNarratives && {
            narrative: cleanText(row.EVENT_NARRATIVE),
            episodeNarrative: cleanText(row.EPISODE_NARRATIVE),
        }),
    };

    return {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: [[finalBeginLon, finalBeginLat], [finalEndLon, finalEndLat]],
        },
        properties,
    };
}

const CSV_PARSE_OPTIONS = {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
};

function parseRows(csvText) {
    return parse(csvText, CSV_PARSE_OPTIONS);
}

export function parseTornadoCsv(csvText, options = {}) {
    return parseRows(csvText)
        .map((row) => normalizeTornadoRow(row, options))
        .filter(Boolean);
}

function normalizeSevereReportRow(row) {
    const eventType = cleanText(row.EVENT_TYPE).toUpperCase();
    if (!SEVERE_REPORT_TYPES.has(eventType)) return null;

    const beginLat = parseCoordinate(row.BEGIN_LAT);
    const beginLon = parseCoordinate(row.BEGIN_LON);
    if (!isValidCoordinate(beginLat, beginLon)) return null;

    const begin = parseNoaaDateTimeUtc(row);
    if (!begin || !Number.isFinite(begin.timeMs)) return null;

    return {
        id: `ncei-report-${begin.year}-${cleanText(row.EVENT_ID)}`,
        eventId: cleanText(row.EVENT_ID),
        year: begin.year,
        month: begin.month,
        date: begin.date,
        time: begin.dateTimeUtc,
        timeMs: begin.timeMs,
        eventType,
        wfo: cleanText(row.WFO),
        state: getStateAbbreviation(row.STATE),
        stateName: titleCase(row.STATE),
        lat: beginLat,
        lon: beginLon,
    };
}

export function parseSevereReportCsv(csvText) {
    return parseRows(csvText)
        .map(normalizeSevereReportRow)
        .filter(Boolean);
}

/**
 * Parse a StormEvents CSV in a single pass, returning tornado track features
 * and all severe-report rows together. Prefer this over calling parseTornadoCsv
 * and parseSevereReportCsv separately when you need both — it avoids parsing
 * the same potentially-large CSV twice.
 */
export function parseStormEventsCsv(csvText, options = {}) {
    const rows = parseRows(csvText);
    return {
        features: rows.map((row) => normalizeTornadoRow(row, options)).filter(Boolean),
        severeReports: rows.map(normalizeSevereReportRow).filter(Boolean),
    };
}

function normalizeWarningRow(row) {
    const phenomena = cleanText(row.phenomena).toUpperCase();
    const significance = cleanText(row.significance).toUpperCase();
    if (!['TO', 'SV'].includes(phenomena) || significance !== 'W') return null;

    const issueTime = parseUtcTimestamp(row.utc_issue);
    const expireTime = parseUtcTimestamp(row.utc_expire);
    const issueMs = timestampMs(row.utc_issue);
    const expireMs = timestampMs(row.utc_expire);
    if (!issueTime || !expireTime || issueMs === null || expireMs === null) return null;

    const year = Number(row.vtec_year) || new Date(issueMs).getUTCFullYear();
    const productId = cleanText(row.product_id);
    const wfo = cleanText(row.wfo);
    const eventId = cleanText(row.eventid);

    return {
        id: `iem-warning-${year}-${wfo}-${phenomena}-${eventId}-${productId || issueMs}`,
        year,
        month: new Date(issueMs).getUTCMonth() + 1,
        date: issueTime.slice(0, 10),
        wfo,
        phenomena,
        significance,
        eventId,
        status: cleanText(row.status).toUpperCase(),
        issueTime,
        expireTime,
        issueMs,
        expireMs,
        productIssueTime: parseUtcTimestamp(row.utc_prodissue),
        polygonBeginTime: parseUtcTimestamp(row.utc_polygon_begin),
        polygonEndTime: parseUtcTimestamp(row.utc_polygon_end),
        areaKm2: round(parseNumeric(row.area2d), 2),
        isEmergency: parseBoolean(row.is_emergency),
        windTag: parseNumeric(row.windtag),
        hailTag: parseNumeric(row.hailtag),
        tornadoTag: cleanText(row.tornadotag),
        damageTag: cleanText(row.damagetag),
        productId,
        forecaster: cleanText(row.fcster),
    };
}

export function parseWarningCsv(csvText) {
    return parseRows(csvText)
        .map(normalizeWarningRow)
        .filter(Boolean);
}

function normalizeWatchRow(row) {
    const type = cleanText(row.TYPE).toUpperCase();
    if (!['TOR', 'SVR'].includes(type)) return null;
    const issueTime = parseUtcTimestamp(row.ISSUE);
    const expireTime = parseUtcTimestamp(row.EXPIRE);
    const issueMs = timestampMs(row.ISSUE);
    const expireMs = timestampMs(row.EXPIRE);
    if (!issueTime || !expireTime || issueMs === null || expireMs === null) return null;

    const year = new Date(issueMs).getUTCFullYear();
    const watchNumber = cleanText(row.NUM) || cleanText(row.SEL);

    return {
        id: `iem-spc-watch-${year}-${watchNumber}`,
        year,
        month: new Date(issueMs).getUTCMonth() + 1,
        date: issueTime.slice(0, 10),
        type,
        watchNumber,
        sel: cleanText(row.SEL),
        issueTime,
        expireTime,
        issueMs,
        expireMs,
        bbox: extractWktBbox(row.geom),
        isPds: parseBoolean(row.IS_PDS),
        tornadoProbability: parseNumeric(row.P_TORTWO),
        strongTornadoProbability: parseNumeric(row.P_TOREF2),
        windProbability: parseNumeric(row.P_WIND10),
        significantWindProbability: parseNumeric(row.P_WIND65),
        hailProbability: parseNumeric(row.P_HAIL10),
        significantHailProbability: parseNumeric(row.P_HAIL2I),
        combinedHailWindProbability: parseNumeric(row.P_HAILWND),
        maxHailInches: parseNumeric(row.MAX_HAIL),
        maxGustKnots: parseNumeric(row.MAX_GUST),
    };
}

export function parseWatchCsv(csvText) {
    return parseRows(csvText)
        .map(normalizeWatchRow)
        .filter(Boolean);
}

export function discoverStormEventsFiles(html, sourceUrl = DEFAULT_SOURCE_URL) {
    const baseUrl = sourceUrl.endsWith('/') ? sourceUrl : `${sourceUrl}/`;
    const matches = html.matchAll(/href="(StormEvents_details-ftp_v1\.0_d(\d{4})_c(\d{8})\.csv\.gz)"/g);
    const byYear = new Map();

    for (const match of matches) {
        const [, filename, yearText, version] = match;
        const year = Number(yearText);
        const existing = byYear.get(year);

        if (!existing || version > existing.version) {
            byYear.set(year, {
                year,
                version,
                filename,
                url: new URL(filename, baseUrl).toString(),
            });
        }
    }

    return byYear;
}

export function warningCsvUrl(year, sourceUrl = DEFAULT_WARNING_SOURCE_URL) {
    const url = new URL(sourceUrl);
    url.searchParams.set('accept', 'csv');
    url.searchParams.set('sts', `${year}-01-01T00:00Z`);
    url.searchParams.set('ets', `${year + 1}-01-01T00:00Z`);
    url.searchParams.set('limit1', '1');
    url.searchParams.set('limitps', '1');
    url.searchParams.set('phenomena', 'TO,SV');
    url.searchParams.set('significance', 'W,W');
    return url.toString();
}

export function watchCsvUrl(year, sourceUrl = DEFAULT_WATCH_SOURCE_URL) {
    const url = new URL(sourceUrl);
    url.searchParams.set('format', 'csv');
    url.searchParams.set('sts', `${year}-01-01T00:00:00Z`);
    url.searchParams.set('ets', `${year + 1}-01-01T00:00:00Z`);
    return url.toString();
}

function toPointFeature(feature) {
    const [lon, lat] = feature.geometry.coordinates[0];
    const p = feature.properties;

    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
            id: p.id,
            year: p.year,
            month: p.month,
            state: p.state,
            stateName: p.stateName,
            scale: p.scale,
            scaleLabel: p.scaleLabel,
            lengthMiles: p.lengthMiles,
            deaths: p.deaths,
            injuries: p.injuries,
        },
    };
}

function emptyAnnualSummary(year) {
    return {
        year,
        count: 0,
        unknown: 0,
        ef0: 0,
        ef1: 0,
        ef2: 0,
        ef3: 0,
        ef4: 0,
        ef5: 0,
        ef1Plus: 0,
        ef2Plus: 0,
        deaths: 0,
        injuries: 0,
        trackMiles: 0,
        medianWidthYards: 0,
    };
}

function emptyAnnualWarningSummary(year) {
    return {
        year,
        warnings: 0,
        tornadoWarnings: 0,
        severeThunderstormWarnings: 0,
        emergencyWarnings: 0,
        matchedWarnings: 0,
        tornadoMatchedWarnings: 0,
        severeThunderstormMatchedWarnings: 0,
        warningAreaKm2: 0,
        watches: 0,
        tornadoWatches: 0,
        severeThunderstormWatches: 0,
        pdsWatches: 0,
        matchedWatches: 0,
        tornadoMatchedWatches: 0,
        severeThunderstormMatchedWatches: 0,
    };
}

function emptyWfoWarningSummary(year, wfo) {
    return {
        year,
        wfo,
        warnings: 0,
        tornadoWarnings: 0,
        severeThunderstormWarnings: 0,
        emergencyWarnings: 0,
        matchedWarnings: 0,
        tornadoMatchedWarnings: 0,
        severeThunderstormMatchedWarnings: 0,
        warningAreaKm2: 0,
    };
}

function reportMatchesWarning(warning, report) {
    if (warning.wfo !== report.wfo) return false;
    if (report.timeMs < warning.issueMs || report.timeMs > warning.expireMs) return false;
    if (warning.phenomena === 'TO') return report.eventType === 'TORNADO';
    return report.eventType === 'HAIL' || report.eventType === 'THUNDERSTORM WIND' || report.eventType === 'TORNADO';
}

function reportMatchesWatch(watch, report) {
    if (report.timeMs < watch.issueMs || report.timeMs > watch.expireMs) return false;
    if (!pointInBbox(report, watch.bbox)) return false;
    if (watch.type === 'TOR') return report.eventType === 'TORNADO';
    return report.eventType === 'HAIL' || report.eventType === 'THUNDERSTORM WIND' || report.eventType === 'TORNADO';
}

function groupReportsByYearAndWfo(reports) {
    const grouped = new Map();
    for (const report of reports) {
        const key = `${report.year}-${report.wfo}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(report);
    }
    return grouped;
}

function groupReportsByYear(reports) {
    const grouped = new Map();
    for (const report of reports) {
        if (!grouped.has(report.year)) grouped.set(report.year, []);
        grouped.get(report.year).push(report);
    }
    return grouped;
}

export function buildWarningSummary({ warnings = [], watches = [], severeReports = [] } = {}) {
    const annual = new Map();
    const wfoYear = new Map();
    const reportsByYearAndWfo = groupReportsByYearAndWfo(severeReports);
    const reportsByYear = groupReportsByYear(severeReports);

    for (const warning of [...warnings].sort((a, b) => a.year - b.year || a.wfo.localeCompare(b.wfo))) {
        if (!annual.has(warning.year)) annual.set(warning.year, emptyAnnualWarningSummary(warning.year));
        const annualRow = annual.get(warning.year);

        const wfoKey = `${warning.year}-${warning.wfo}`;
        if (!wfoYear.has(wfoKey)) wfoYear.set(wfoKey, emptyWfoWarningSummary(warning.year, warning.wfo));
        const wfoRow = wfoYear.get(wfoKey);

        const candidates = reportsByYearAndWfo.get(wfoKey) ?? [];
        const matched = candidates.some((report) => reportMatchesWarning(warning, report));

        for (const row of [annualRow, wfoRow]) {
            row.warnings += 1;
            row.warningAreaKm2 = round(row.warningAreaKm2 + warning.areaKm2, 2);
            if (warning.phenomena === 'TO') row.tornadoWarnings += 1;
            if (warning.phenomena === 'SV') row.severeThunderstormWarnings += 1;
            if (warning.isEmergency) row.emergencyWarnings += 1;
            if (matched) {
                row.matchedWarnings += 1;
                if (warning.phenomena === 'TO') row.tornadoMatchedWarnings += 1;
                if (warning.phenomena === 'SV') row.severeThunderstormMatchedWarnings += 1;
            }
        }
    }

    for (const watch of [...watches].sort((a, b) => a.year - b.year || a.watchNumber.localeCompare(b.watchNumber))) {
        if (!annual.has(watch.year)) annual.set(watch.year, emptyAnnualWarningSummary(watch.year));
        const row = annual.get(watch.year);
        const candidates = reportsByYear.get(watch.year) ?? [];
        const matched = candidates.some((report) => reportMatchesWatch(watch, report));

        row.watches += 1;
        if (watch.type === 'TOR') row.tornadoWatches += 1;
        if (watch.type === 'SVR') row.severeThunderstormWatches += 1;
        if (watch.isPds) row.pdsWatches += 1;
        if (matched) {
            row.matchedWatches += 1;
            if (watch.type === 'TOR') row.tornadoMatchedWatches += 1;
            if (watch.type === 'SVR') row.severeThunderstormMatchedWatches += 1;
        }
    }

    return {
        source: 'Iowa Environmental Mesonet VTEC/SPC archives with NOAA/NCEI StormEvents report matching',
        availability: {
            stormBasedWarningsStartYear: STORM_BASED_WARNING_START_YEAR,
            spcWatchStartYear: SPC_WATCH_START_YEAR,
            reportMatchMethod: 'StormEvents reports matched by WFO/time for warnings and by watch bounding box/time for SPC watches',
        },
        annual: [...annual.values()].sort((a, b) => a.year - b.year),
        wfoYear: [...wfoYear.values()].sort((a, b) => a.year - b.year || a.wfo.localeCompare(b.wfo)),
    };
}

function median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : round((sorted[middle - 1] + sorted[middle]) / 2, 1);
}

export function buildTornadoOutputs(features, warningContext = {}) {
    const sortedFeatures = [...features].sort((a, b) => {
        const yearDelta = a.properties.year - b.properties.year;
        if (yearDelta !== 0) return yearDelta;
        return a.properties.id.localeCompare(b.properties.id);
    });
    const annual = new Map();
    const annualWidths = new Map();
    const stateYears = new Map();

    for (const feature of sortedFeatures) {
        const p = feature.properties;
        if (!annual.has(p.year)) {
            annual.set(p.year, emptyAnnualSummary(p.year));
            annualWidths.set(p.year, []);
        }

        const yearSummary = annual.get(p.year);
        yearSummary.count += 1;
        yearSummary.deaths += p.deaths;
        yearSummary.injuries += p.injuries;
        yearSummary.trackMiles = round(yearSummary.trackMiles + p.lengthMiles, 2);
        if (p.widthYards > 0) annualWidths.get(p.year).push(p.widthYards);

        if (p.scale >= 0 && p.scale <= 5) {
            yearSummary[`ef${p.scale}`] += 1;
            if (p.scale >= 1) yearSummary.ef1Plus += 1;
            if (p.scale >= 2) yearSummary.ef2Plus += 1;
        } else {
            yearSummary.unknown += 1;
        }

        const stateKey = `${p.state}-${p.year}`;
        if (!stateYears.has(stateKey)) {
            stateYears.set(stateKey, {
                state: p.state,
                stateName: p.stateName,
                year: p.year,
                count: 0,
                ef2Plus: 0,
                deaths: 0,
                injuries: 0,
                trackMiles: 0,
            });
        }

        const stateSummary = stateYears.get(stateKey);
        stateSummary.count += 1;
        stateSummary.ef2Plus += p.scale >= 2 ? 1 : 0;
        stateSummary.deaths += p.deaths;
        stateSummary.injuries += p.injuries;
        stateSummary.trackMiles = round(stateSummary.trackMiles + p.lengthMiles, 2);
    }

    const annualSummary = [...annual.values()].map((summary) => ({
        ...summary,
        medianWidthYards: median(annualWidths.get(summary.year) ?? []),
    }));

    const notableEvents = sortedFeatures
        .map((feature) => ({
            ...feature.properties,
            coordinates: feature.geometry.coordinates,
            score: Math.max(feature.properties.scale, 0) * 10
                + feature.properties.deaths * 25
                + feature.properties.injuries * 1.5
                + feature.properties.lengthMiles,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 24)
        .map(({ score, ...event }) => event);

    return {
        tracks: {
            type: 'FeatureCollection',
            metadata: {
                source: 'NOAA/NCEI StormEvents details CSV',
                count: sortedFeatures.length,
            },
            features: sortedFeatures,
        },
        trackPoints: {
            type: 'FeatureCollection',
            metadata: {
                source: 'NOAA/NCEI StormEvents details CSV',
                count: sortedFeatures.length,
            },
            features: sortedFeatures.map(toPointFeature),
        },
        annualSummary,
        stateSummary: [...stateYears.values()].sort((a, b) => a.state.localeCompare(b.state) || a.year - b.year),
        notableEvents,
        warningSummary: buildWarningSummary(warningContext),
    };
}

function writeJson(filePath, data, pretty = false) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, pretty ? 2 : 0)}\n`, 'utf-8');
}

function groupFeaturesByYear(features) {
    const byYear = new Map();

    for (const feature of features) {
        const year = feature.properties.year;
        if (!byYear.has(year)) byYear.set(year, []);
        byYear.get(year).push(feature);
    }

    return byYear;
}

function writeYearCollections(outputDir, name, collection) {
    const directory = path.join(outputDir, name);
    fs.rmSync(directory, { recursive: true, force: true });
    fs.mkdirSync(directory, { recursive: true });

    for (const [year, features] of groupFeaturesByYear(collection.features)) {
        writeJson(path.join(directory, `${year}.geojson`), {
            type: 'FeatureCollection',
            // Omit generatedAt from per-year files so repeated full syncs
            // don't produce git churn when the underlying data hasn't changed.
            metadata: {
                source: collection.metadata.source,
                count: features.length,
                year,
            },
            features,
        });
    }
}

export function writeTornadoOutputs(outputs, outputDir = DEFAULT_OUTPUT_DIR) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.rmSync(path.join(outputDir, 'tracks.geojson'), { force: true });
    fs.rmSync(path.join(outputDir, 'track-points.geojson'), { force: true });
    writeYearCollections(outputDir, 'tracks', outputs.tracks);
    writeYearCollections(outputDir, 'track-points', outputs.trackPoints);
    writeJson(path.join(outputDir, 'annual-summary.json'), outputs.annualSummary, true);
    writeJson(path.join(outputDir, 'state-summary.json'), outputs.stateSummary, true);
    writeJson(path.join(outputDir, 'notable-events.json'), outputs.notableEvents, true);
    writeJson(path.join(outputDir, 'warning-summary.json'), outputs.warningSummary, true);
}

function range(start, end) {
    const years = [];
    for (let year = start; year <= end; year += 1) years.push(year);
    return years;
}

function wait(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function fetchWithRetries(url, { responseType = 'text', attempts = 4, timeoutMs = 60_000, log = console.warn } = {}) {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'User-Agent': 'rsmb.tv tornado-tracks data sync (https://rsmb.tv)' },
            });
            if (!response.ok) {
                clearTimeout(timer);
                throw new Error(`HTTP ${response.status} fetching ${url}`);
            }
            const body = responseType === 'buffer'
                ? Buffer.from(await response.arrayBuffer())
                : await response.text();
            clearTimeout(timer);
            return body;
        } catch (error) {
            clearTimeout(timer);
            lastError = error;
            if (attempt === attempts) break;
            log(`Retrying ${url} after failed attempt ${attempt}/${attempts}`);
            await wait(750 * attempt);
        }
    }

    throw lastError;
}

async function fetchText(url, { log } = {}) {
    return fetchWithRetries(url, { responseType: 'text', log });
}

async function fetchGzipCsv(url, { filename, cacheDir = DEFAULT_CACHE_DIR, log } = {}) {
    const cachePath = cacheDir && filename ? path.join(cacheDir, filename) : null;

    if (cachePath && fs.existsSync(cachePath)) {
        return gunzipSync(fs.readFileSync(cachePath)).toString('utf-8');
    }

    const buffer = await fetchWithRetries(url, { responseType: 'buffer', log });

    if (cachePath) {
        fs.mkdirSync(path.dirname(cachePath), { recursive: true });
        fs.writeFileSync(cachePath, buffer);
    }

    return gunzipSync(buffer).toString('utf-8');
}

async function fetchCachedText(url, { filename, cacheDir = DEFAULT_CACHE_DIR, log } = {}) {
    const cachePath = cacheDir && filename ? path.join(cacheDir, filename) : null;

    if (cachePath && fs.existsSync(cachePath)) {
        return fs.readFileSync(cachePath, 'utf-8');
    }

    const text = await fetchWithRetries(url, { responseType: 'text', log });

    if (cachePath) {
        fs.mkdirSync(path.dirname(cachePath), { recursive: true });
        fs.writeFileSync(cachePath, text, 'utf-8');
    }

    return text;
}

export async function syncTornadoes({
    sourceUrl = DEFAULT_SOURCE_URL,
    outputDir = DEFAULT_OUTPUT_DIR,
    startYear = DEFAULT_START_YEAR,
    endYear = DEFAULT_END_YEAR,
    years,
    fixturePath,
    cacheDir = DEFAULT_CACHE_DIR,
    includeNarratives = false,
    includeWarnings = true,
    warningSourceUrl = DEFAULT_WARNING_SOURCE_URL,
    watchSourceUrl = DEFAULT_WATCH_SOURCE_URL,
    log = console.log,
} = {}) {
    let features = [];
    let severeReports = [];
    let warnings = [];
    let watches = [];
    let selectedYears = years?.length ? years : range(startYear, endYear);

    if (fixturePath) {
        const csvText = fs.readFileSync(fixturePath, 'utf-8');
        ({ features, severeReports } = parseStormEventsCsv(csvText, { includeNarratives }));
    } else {
        const directoryHtml = await fetchText(sourceUrl, { log });
        const files = discoverStormEventsFiles(directoryHtml, sourceUrl);

        for (const year of selectedYears) {
            const file = files.get(year);
            if (!file) {
                log(`Skipping ${year}: no StormEvents details file found`);
                continue;
            }

            log(`Downloading ${file.filename}`);
            const csvText = await fetchGzipCsv(file.url, { filename: file.filename, cacheDir, log });
            const { features: yearFeatures, severeReports: yearReports } = parseStormEventsCsv(csvText, { includeNarratives });
            features.push(...yearFeatures);
            severeReports.push(...yearReports);
            log(`  ${yearFeatures.length} tornado tracks`);
        }

        if (includeWarnings) {
            for (const year of selectedYears) {
                if (year >= STORM_BASED_WARNING_START_YEAR) {
                    const warningUrl = warningCsvUrl(year, warningSourceUrl);
                    const warningCsv = await fetchCachedText(warningUrl, { filename: `warnings/${year}.csv`, cacheDir, log });
                    const yearWarnings = parseWarningCsv(warningCsv);
                    warnings.push(...yearWarnings);
                    log(`  ${yearWarnings.length} storm-based warnings for ${year}`);
                }

                if (year >= SPC_WATCH_START_YEAR) {
                    const watchUrl = watchCsvUrl(year, watchSourceUrl);
                    const watchCsv = await fetchCachedText(watchUrl, { filename: `watches/${year}.csv`, cacheDir, log });
                    const yearWatches = parseWatchCsv(watchCsv);
                    watches.push(...yearWatches);
                    log(`  ${yearWatches.length} SPC watches for ${year}`);
                }
            }
        }
    }

    const outputs = buildTornadoOutputs(features, { warnings, watches, severeReports });
    writeTornadoOutputs(outputs, outputDir);
    return {
        outputDir,
        count: outputs.tracks.features.length,
        warningCount: outputs.warningSummary.annual.reduce((sum, row) => sum + row.warnings, 0),
        watchCount: outputs.warningSummary.annual.reduce((sum, row) => sum + row.watches, 0),
        years: outputs.annualSummary.map((summary) => summary.year),
    };
}

function parseArgs(argv) {
    const options = {};

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];

        switch (arg) {
            case '--source-url':
                options.sourceUrl = next;
                index += 1;
                break;
            case '--output':
                options.outputDir = path.resolve(next);
                index += 1;
                break;
            case '--start-year':
                options.startYear = Number(next);
                index += 1;
                break;
            case '--end-year':
                options.endYear = Number(next);
                index += 1;
                break;
            case '--years':
                options.years = next.split(',').map((year) => Number(year.trim())).filter(Number.isFinite);
                index += 1;
                break;
            case '--fixture':
                options.fixturePath = path.resolve(next);
                index += 1;
                break;
            case '--cache-dir':
                options.cacheDir = path.resolve(next);
                index += 1;
                break;
            case '--no-cache':
                options.cacheDir = null;
                break;
            case '--include-narratives':
                options.includeNarratives = true;
                break;
            case '--no-warnings':
                options.includeWarnings = false;
                break;
            case '--warning-source-url':
                options.warningSourceUrl = next;
                index += 1;
                break;
            case '--watch-source-url':
                options.watchSourceUrl = next;
                index += 1;
                break;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    syncTornadoes(parseArgs(process.argv.slice(2)))
        .then(({ outputDir, count, years, warningCount, watchCount }) => {
            const yearRange = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : 'no years';
            console.log(`Tornado data generated → ${outputDir} (${count} tracks, ${warningCount} warnings, ${watchCount} watches, ${yearRange})`);
        })
        .catch((error) => {
            console.error(error);
            process.exitCode = 1;
        });
}