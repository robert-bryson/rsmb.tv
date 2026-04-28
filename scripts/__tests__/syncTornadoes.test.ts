import { describe, expect, it } from 'vitest';
import {
    buildTornadoOutputs,
    discoverStormEventsFiles,
    normalizeTornadoScale,
    parseDamage,
    parseNoaaDateTime,
    parseTornadoCsv,
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