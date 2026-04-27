#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../..');
const DEFAULT_SOURCE_URL = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/';
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, 'public/data/tornadoes');
const DEFAULT_CACHE_DIR = path.join(REPO_ROOT, '.cache/tornado-tracks');
const DEFAULT_START_YEAR = 1950;
const DEFAULT_END_YEAR = new Date().getUTCFullYear();

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

export function parseDamage(value) {
    const raw = cleanText(value).replace(/[$,]/g, '').toUpperCase();
    if (!raw || raw === '0' || raw === '0.00') return 0;

    const match = raw.match(/^(-?\d+(?:\.\d+)?)([KMB])?$/);
    if (!match) return 0;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return 0;

    const multiplier = match[2] === 'B' ? 1_000_000_000 : match[2] === 'M' ? 1_000_000 : match[2] === 'K' ? 1_000 : 1;
    return Math.round(amount * multiplier);
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
    };

    if (includeNarratives) {
        properties.narrative = cleanText(row.EVENT_NARRATIVE);
        properties.episodeNarrative = cleanText(row.EPISODE_NARRATIVE);
    }

    return {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: [[beginLon, beginLat], [endLon, endLat]],
        },
        properties,
    };
}

export function parseTornadoCsv(csvText, options = {}) {
    const rows = parse(csvText, {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        relax_quotes: true,
    });

    return rows
        .map((row) => normalizeTornadoRow(row, options))
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

function median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : round((sorted[middle - 1] + sorted[middle]) / 2, 1);
}

export function buildTornadoOutputs(features) {
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
                generatedAt: new Date().toISOString(),
                count: sortedFeatures.length,
            },
            features: sortedFeatures,
        },
        trackPoints: {
            type: 'FeatureCollection',
            metadata: {
                source: 'NOAA/NCEI StormEvents details CSV',
                generatedAt: new Date().toISOString(),
                count: sortedFeatures.length,
            },
            features: sortedFeatures.map(toPointFeature),
        },
        annualSummary,
        stateSummary: [...stateYears.values()].sort((a, b) => a.state.localeCompare(b.state) || a.year - b.year),
        notableEvents,
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
            metadata: {
                ...collection.metadata,
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
}

function range(start, end) {
    const years = [];
    for (let year = start; year <= end; year += 1) years.push(year);
    return years;
}

function wait(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function fetchWithRetries(url, { responseType = 'text', attempts = 4, log = console.warn } = {}) {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'rsmb.tv tornado-tracks data sync (https://rsmb.tv)' },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
            return responseType === 'buffer'
                ? Buffer.from(await response.arrayBuffer())
                : response.text();
        } catch (error) {
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

export async function syncTornadoes({
    sourceUrl = DEFAULT_SOURCE_URL,
    outputDir = DEFAULT_OUTPUT_DIR,
    startYear = DEFAULT_START_YEAR,
    endYear = DEFAULT_END_YEAR,
    years,
    fixturePath,
    cacheDir = DEFAULT_CACHE_DIR,
    includeNarratives = false,
    log = console.log,
} = {}) {
    let features = [];

    if (fixturePath) {
        const csvText = fs.readFileSync(fixturePath, 'utf-8');
        features = parseTornadoCsv(csvText, { includeNarratives });
    } else {
        const directoryHtml = await fetchText(sourceUrl, { log });
        const files = discoverStormEventsFiles(directoryHtml, sourceUrl);
        const selectedYears = years?.length ? years : range(startYear, endYear);

        for (const year of selectedYears) {
            const file = files.get(year);
            if (!file) {
                log(`Skipping ${year}: no StormEvents details file found`);
                continue;
            }

            log(`Downloading ${file.filename}`);
            const csvText = await fetchGzipCsv(file.url, { filename: file.filename, cacheDir, log });
            const yearFeatures = parseTornadoCsv(csvText, { includeNarratives });
            features.push(...yearFeatures);
            log(`  ${yearFeatures.length} tornado tracks`);
        }
    }

    const outputs = buildTornadoOutputs(features);
    writeTornadoOutputs(outputs, outputDir);
    return {
        outputDir,
        count: outputs.tracks.features.length,
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
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    syncTornadoes(parseArgs(process.argv.slice(2)))
        .then(({ outputDir, count, years }) => {
            const yearRange = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : 'no years';
            console.log(`Tornado data generated → ${outputDir} (${count} tracks, ${yearRange})`);
        })
        .catch((error) => {
            console.error(error);
            process.exitCode = 1;
        });
}