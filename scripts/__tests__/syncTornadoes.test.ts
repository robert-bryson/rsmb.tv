// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    buildTornadoOutputs,
    discoverStormEventsFiles,
    normalizeTornadoScale,
    parseDamage,
    parseNoaaDateTime,
    parseTornadoCsv,
    writeTornadoOutputs,
} from '../../projects/tornado-tracks/scripts/syncTornadoes.js';

const sampleCsv = `BEGIN_YEARMONTH,BEGIN_DAY,BEGIN_TIME,END_DAY,END_TIME,EPISODE_ID,EVENT_ID,STATE,YEAR,MONTH_NAME,EVENT_TYPE,CZ_FIPS,CZ_NAME,WFO,BEGIN_DATE_TIME,CZ_TIMEZONE,END_DATE_TIME,INJURIES_DIRECT,INJURIES_INDIRECT,DEATHS_DIRECT,DEATHS_INDIRECT,DAMAGE_PROPERTY,DAMAGE_CROPS,SOURCE,TOR_F_SCALE,TOR_LENGTH,TOR_WIDTH,BEGIN_LAT,BEGIN_LON,END_LAT,END_LON,EPISODE_NARRATIVE,EVENT_NARRATIVE,DATA_SOURCE
202405,21,1520,21,1543,1,1001,IOWA,2024,May,Tornado,123,MAHASKA,DMX,21-MAY-24 15:20:00,CST-6,21-MAY-24 15:43:00,2,1,0,1,120.00K,1.50M,NWS Storm Survey,EF3,12.4,600,41.25,-92.64,41.31,-92.41,Episode text,Event text,CSV
202405,21,1600,21,1605,1,1002,IOWA,2024,May,Thunderstorm Wind,123,MAHASKA,DMX,21-MAY-24 16:00:00,CST-6,21-MAY-24 16:05:00,0,0,0,0,,,ASOS,,0,0,41.2,-92.6,41.2,-92.6,,,CSV
202405,21,1700,21,1710,1,1003,IOWA,2024,May,Tornado,123,MAHASKA,DMX,21-MAY-24 17:00:00,CST-6,21-MAY-24 17:10:00,0,0,0,0,,,NWS Storm Survey,EF1,1.0,50,,,,,CSV
`;

describe('parseDamage', () => {
    it('normalizes StormEvents damage shorthand', () => {
        expect(parseDamage('120.00K')).toBe(120000);
        expect(parseDamage('1.50M')).toBe(1500000);
        expect(parseDamage('$2.5B')).toBe(2500000000);
        expect(parseDamage('')).toBe(0);
    });

    it('clamps negative values to zero (damage cannot be negative)', () => {
        // Malformed data like '-5K' should not produce negative output.
        expect(parseDamage('-5K')).toBe(0);
        expect(parseDamage('-100')).toBe(0);
    });

    it('returns 0 for missing or non-numeric values', () => {
        expect(parseDamage('N/A')).toBe(0);
        expect(parseDamage('unknown')).toBe(0);
    });
});

describe('normalizeTornadoScale', () => {
    it('keeps legacy F labels and modern EF labels', () => {
        expect(normalizeTornadoScale('F4', 1974)).toEqual({ scale: 4, scaleLabel: 'F4' });
        expect(normalizeTornadoScale('EF3', 2024)).toEqual({ scale: 3, scaleLabel: 'EF3' });
        expect(normalizeTornadoScale('2', 1957)).toEqual({ scale: 2, scaleLabel: 'F2' });
        expect(normalizeTornadoScale('EFU', 2024)).toEqual({ scale: -1, scaleLabel: 'Unknown' });
    });
});

describe('parseNoaaDateTime', () => {
    it('parses StormEvents local date-time strings', () => {
        expect(parseNoaaDateTime('21-MAY-24 15:20:00')).toEqual({
            year: 2024,
            month: 5,
            date: '2024-05-21',
            dateTime: '2024-05-21T15:20:00',
        });
    });
});

describe('parseTornadoCsv', () => {
    it('filters tornadoes and drops rows without valid coordinates', () => {
        const features = parseTornadoCsv(sampleCsv, { includeNarratives: true });

        expect(features).toHaveLength(1);
        expect(features[0].properties).toMatchObject({
            id: 'ncei-2024-1001',
            state: 'IA',
            county: 'Mahaska',
            scale: 3,
            deaths: 1,
            injuries: 3,
            propertyDamage: 120000,
            cropDamage: 1500000,
            narrative: 'Event text',
        });
    });
});

describe('buildTornadoOutputs', () => {
    it('builds annual, state, point, and notable summaries', () => {
        const outputs = buildTornadoOutputs(parseTornadoCsv(sampleCsv));

        expect(outputs.tracks.features).toHaveLength(1);
        expect(outputs.trackPoints.features[0].geometry).toEqual({ type: 'Point', coordinates: [-92.64, 41.25] });
        expect(outputs.annualSummary[0]).toMatchObject({ year: 2024, count: 1, ef2Plus: 1, deaths: 1, injuries: 3 });
        expect(outputs.stateSummary[0]).toMatchObject({ state: 'IA', year: 2024, count: 1, ef2Plus: 1 });
        expect(outputs.notableEvents[0]).toMatchObject({ id: 'ncei-2024-1001' });
    });
});

describe('discoverStormEventsFiles', () => {
    it('selects the newest version for each year', () => {
        const files = discoverStormEventsFiles(`
            <a href="StormEvents_details-ftp_v1.0_d2024_c20250301.csv.gz">old</a>
            <a href="StormEvents_details-ftp_v1.0_d2024_c20260421.csv.gz">new</a>
            <a href="StormEvents_details-ftp_v1.0_d2025_c20260323.csv.gz">next</a>
        `, 'https://example.test/data/');

        expect(files.get(2024)?.filename).toBe('StormEvents_details-ftp_v1.0_d2024_c20260421.csv.gz');
        expect(files.get(2024)?.url).toBe('https://example.test/data/StormEvents_details-ftp_v1.0_d2024_c20260421.csv.gz');
        expect(files.get(2025)?.version).toBe('20260323');
    });
});

// ---------------------------------------------------------------------------
// Coordinate clamping for out-of-state source data errors
// ---------------------------------------------------------------------------

const badBeginLonCsv = `BEGIN_YEARMONTH,BEGIN_DAY,BEGIN_TIME,END_DAY,END_TIME,EPISODE_ID,EVENT_ID,STATE,YEAR,MONTH_NAME,EVENT_TYPE,CZ_FIPS,CZ_NAME,WFO,BEGIN_DATE_TIME,CZ_TIMEZONE,END_DATE_TIME,INJURIES_DIRECT,INJURIES_INDIRECT,DEATHS_DIRECT,DEATHS_INDIRECT,DAMAGE_PROPERTY,DAMAGE_CROPS,SOURCE,TOR_F_SCALE,TOR_LENGTH,TOR_WIDTH,BEGIN_LAT,BEGIN_LON,END_LAT,END_LON,EPISODE_NARRATIVE,EVENT_NARRATIVE,DATA_SOURCE
199705,18,1550,18,1600,2062475,5599610,CALIFORNIA,1997,May,Tornado,71,SAN BERNARDINO,SGX,18-MAY-97 15:50:00,PST,18-MAY-97 16:00:00,0,0,0,0,,,PDC,F1,9,40,34.6,-12.18,34.63,-117.03,,,PDC
`;

describe('parseTornadoCsv — coordinate clamping', () => {
    it('clamps a bad begin coordinate to the valid end coordinate', () => {
        const features = parseTornadoCsv(badBeginLonCsv);
        expect(features).toHaveLength(1);
        // begin should be clamped to the valid end point
        expect(features[0].geometry.coordinates[0]).toEqual([-117.03, 34.63]);
        expect(features[0].geometry.coordinates[1]).toEqual([-117.03, 34.63]);
    });

    it('clamps a bad end coordinate to the valid begin coordinate', () => {
        // valid begin (-117.18 is in CA), bad end (-12.03 is not)
        const badEndLonCsv = badBeginLonCsv.replace('34.6,-12.18,34.63,-117.03', '34.6,-117.18,34.63,-12.03');
        const features = parseTornadoCsv(badEndLonCsv);
        expect(features).toHaveLength(1);
        // end should be clamped to the valid begin point
        expect(features[0].geometry.coordinates[0]).toEqual([-117.18, 34.6]);
        expect(features[0].geometry.coordinates[1]).toEqual([-117.18, 34.6]);
    });

    it('drops a row where both begin and end coordinates are outside state bounds', () => {
        const bothBadCsv = badBeginLonCsv.replace('-12.18,34.63,-117.03', '-12.18,34.63,-12.03');
        const features = parseTornadoCsv(bothBadCsv);
        expect(features).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// buildTornadoOutputs — edge cases
// ---------------------------------------------------------------------------

describe('buildTornadoOutputs — empty input', () => {
    it('returns empty collections and summaries for zero features', () => {
        const outputs = buildTornadoOutputs([]);
        expect(outputs.tracks.features).toHaveLength(0);
        expect(outputs.trackPoints.features).toHaveLength(0);
        expect(outputs.annualSummary).toHaveLength(0);
        expect(outputs.stateSummary).toHaveLength(0);
        expect(outputs.notableEvents).toHaveLength(0);
    });
});

describe('buildTornadoOutputs — notable events ordering', () => {
    const lowScoreCsv = `BEGIN_YEARMONTH,BEGIN_DAY,BEGIN_TIME,END_DAY,END_TIME,EPISODE_ID,EVENT_ID,STATE,YEAR,MONTH_NAME,EVENT_TYPE,CZ_FIPS,CZ_NAME,WFO,BEGIN_DATE_TIME,CZ_TIMEZONE,END_DATE_TIME,INJURIES_DIRECT,INJURIES_INDIRECT,DEATHS_DIRECT,DEATHS_INDIRECT,DAMAGE_PROPERTY,DAMAGE_CROPS,SOURCE,TOR_F_SCALE,TOR_LENGTH,TOR_WIDTH,BEGIN_LAT,BEGIN_LON,END_LAT,END_LON,EPISODE_NARRATIVE,EVENT_NARRATIVE,DATA_SOURCE
202405,21,1520,21,1543,1,2001,IOWA,2024,May,Tornado,123,MAHASKA,DMX,21-MAY-24 15:20:00,CST-6,21-MAY-24 15:43:00,0,0,0,0,,,NWS Storm Survey,EF0,1.0,50,41.25,-92.64,41.31,-92.41,,,CSV
202405,22,1600,22,1630,1,2002,IOWA,2024,May,Tornado,123,MAHASKA,DMX,22-MAY-24 16:00:00,CST-6,22-MAY-24 16:30:00,50,0,5,0,5.00M,,NWS Storm Survey,EF4,30.0,1200,41.10,-92.50,41.40,-91.90,,,CSV
`;

    it('sorts notable events by score (highest first) and strips the score field', () => {
        const features = parseTornadoCsv(lowScoreCsv);
        expect(features).toHaveLength(2);

        const outputs = buildTornadoOutputs(features);
        expect(outputs.notableEvents).toHaveLength(2);

        // EF4 with deaths and injuries scores higher than EF0 with nothing
        expect(outputs.notableEvents[0].id).toBe('ncei-2024-2002');
        expect(outputs.notableEvents[1].id).toBe('ncei-2024-2001');

        // score field must not leak into the output
        for (const event of outputs.notableEvents) {
            expect(event).not.toHaveProperty('score');
        }
    });
});

// ---------------------------------------------------------------------------
// parseNoaaDateTime — fallback path
// ---------------------------------------------------------------------------

describe('parseNoaaDateTime — fallback path', () => {
    it('uses row fields when BEGIN_DATE_TIME is empty', () => {
        const result = parseNoaaDateTime('', { year: 2019, month: 6, day: 3, time: '1430' });
        expect(result).toEqual({
            year: 2019,
            month: 6,
            date: '2019-06-03',
            dateTime: '2019-06-03T14:30:00',
        });
    });

    it('uses row fields when BEGIN_DATE_TIME is malformed', () => {
        const result = parseNoaaDateTime('BAD DATA', { year: 2010, month: 12, day: 25, time: '0000' });
        expect(result).toEqual({
            year: 2010,
            month: 12,
            date: '2010-12-25',
            dateTime: '2010-12-25T00:00:00',
        });
    });

    it('returns null when neither direct nor fallback fields are usable', () => {
        expect(parseNoaaDateTime('', {})).toBeNull();
        expect(parseNoaaDateTime('', { year: NaN, month: 5, day: 1 })).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// discoverStormEventsFiles — URL construction
// ---------------------------------------------------------------------------

describe('discoverStormEventsFiles — sourceUrl without trailing slash', () => {
    it('still constructs correct absolute URLs', () => {
        const files = discoverStormEventsFiles(
            '<a href="StormEvents_details-ftp_v1.0_d2023_c20240101.csv.gz">file</a>',
            'https://example.test/data',
        );
        expect(files.get(2023)?.url).toBe(
            'https://example.test/data/StormEvents_details-ftp_v1.0_d2023_c20240101.csv.gz',
        );
    });
});

// ---------------------------------------------------------------------------
// writeTornadoOutputs — filesystem integration
// ---------------------------------------------------------------------------

describe('writeTornadoOutputs', () => {
    it('writes per-year track GeoJSON, track-point GeoJSON, and summary JSON files', () => {
        const features = parseTornadoCsv(sampleCsv);
        const outputs = buildTornadoOutputs(features);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tornado-test-'));

        try {
            writeTornadoOutputs(outputs, tmpDir);

            // Per-year track file
            const trackPath = path.join(tmpDir, 'tracks', '2024.geojson');
            expect(fs.existsSync(trackPath)).toBe(true);
            const trackData = JSON.parse(fs.readFileSync(trackPath, 'utf-8'));
            expect(trackData.type).toBe('FeatureCollection');
            expect(trackData.features).toHaveLength(1);

            // Per-year track-point file
            const pointPath = path.join(tmpDir, 'track-points', '2024.geojson');
            expect(fs.existsSync(pointPath)).toBe(true);
            const pointData = JSON.parse(fs.readFileSync(pointPath, 'utf-8'));
            expect(pointData.features[0].geometry.type).toBe('Point');

            // Annual summary
            const summaryPath = path.join(tmpDir, 'annual-summary.json');
            expect(fs.existsSync(summaryPath)).toBe(true);
            const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
            expect(Array.isArray(summary)).toBe(true);
            expect(summary[0].year).toBe(2024);

            // State summary
            const stateStatePath = path.join(tmpDir, 'state-summary.json');
            expect(fs.existsSync(stateStatePath)).toBe(true);

            // Notable events
            const notablePath = path.join(tmpDir, 'notable-events.json');
            expect(fs.existsSync(notablePath)).toBe(true);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it('removes stale monolithic track/track-points GeoJSON files if they exist', () => {
        const features = parseTornadoCsv(sampleCsv);
        const outputs = buildTornadoOutputs(features);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tornado-test-'));

        try {
            // Plant stale monolithic files that the old format used to produce.
            fs.writeFileSync(path.join(tmpDir, 'tracks.geojson'), '{}');
            fs.writeFileSync(path.join(tmpDir, 'track-points.geojson'), '{}');
            writeTornadoOutputs(outputs, tmpDir);
            expect(fs.existsSync(path.join(tmpDir, 'tracks.geojson'))).toBe(false);
            expect(fs.existsSync(path.join(tmpDir, 'track-points.geojson'))).toBe(false);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it('per-year track metadata includes source, count, and year fields', () => {
        const features = parseTornadoCsv(sampleCsv);
        const outputs = buildTornadoOutputs(features);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tornado-test-'));

        try {
            writeTornadoOutputs(outputs, tmpDir);
            const trackData = JSON.parse(
                fs.readFileSync(path.join(tmpDir, 'tracks', '2024.geojson'), 'utf-8'),
            );
            expect(trackData.metadata).toMatchObject({ source: expect.any(String), count: 1, year: 2024 });
            // The per-year file intentionally omits generatedAt to prevent git churn.
            expect(trackData.metadata.generatedAt).toBeUndefined();
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
