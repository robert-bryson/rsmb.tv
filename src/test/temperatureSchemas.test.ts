import { describe, expect, it } from 'vitest';
import { climateTrendsSchema, parseTemperaturePayload, recentRecordsSchema, stateRecordsSchema } from '../features/temperatures/schemas';

describe('temperature payload schemas', () => {
    it('accepts the missing-coordinate sentinel from the data pipeline', () => {
        const payload = {
            asOf: '2026-09-03',
            yesterday: [{
                stationName: 'Unknown Location', uid: 1, state: 'ID', stateName: 'Idaho', county: '',
                lat: 0, lon: 0, elev: null, type: 'high', tempF: 102, prevRecordF: 101,
                prevRecordDate: '1971-08-27', normalF: 87, date: '2026-08-27', recordScope: 'daily',
            }],
            last7Days: [],
        };

        expect(parseTemperaturePayload(recentRecordsSchema, payload, 'recent records').yesterday[0].lat).toBe(0);
    });

    it('reports the first invalid nested field', () => {
        const payload = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-120, 35] },
                properties: { state: 'CA', stateName: 'California', type: 'high', tempF: Number.NaN, date: '1913-07-10', location: 'Death Valley', station: 'USC00042319' },
            }],
        };

        expect(() => parseTemperaturePayload(stateRecordsSchema, payload, 'state records'))
            .toThrow('Invalid state records at features.0.properties.tempF');
    });

    it('calculates record-age totals from the annual data', () => {
        const payload = {
            source: 'test',
            description: 'test',
            totalHighs: 2,
            totalLows: 1,
            byDecade: [],
            byYear: [{ year: 2025, highs: 1, lows: 1 }],
            rollingRatio: [],
        };

        const parsed = parseTemperaturePayload(climateTrendsSchema, payload, 'record ages');

        expect(parsed.totalHighs).toBe(1);
        expect(parsed.totalLows).toBe(1);
    });

    it('rejects duplicate or unsorted record-age years', () => {
        const payload = {
            source: 'test',
            description: 'test',
            totalHighs: 2,
            totalLows: 0,
            byDecade: [],
            byYear: [
                { year: 2025, highs: 1, lows: 0 },
                { year: 2024, highs: 1, lows: 0 },
            ],
            rollingRatio: [],
        };

        expect(() => parseTemperaturePayload(climateTrendsSchema, payload, 'record ages'))
            .toThrow('Invalid record ages at byYear.1.year: Years must be unique and in ascending order');
    });

    it('replaces decade aggregates that contradict the annual data', () => {
        const payload = {
            source: 'test',
            description: 'test',
            totalHighs: 1,
            totalLows: 1,
            byDecade: [{ decade: 2020, label: '2020s', highs: 2, lows: 1, ratio: 2 }],
            byYear: [{ year: 2025, highs: 1, lows: 1 }],
            rollingRatio: [],
        };

        const parsed = parseTemperaturePayload(climateTrendsSchema, payload, 'record ages');

        expect(parsed.byDecade).toEqual([
            { decade: 2020, label: '2020s', highs: 1, lows: 1, ratio: 1 },
        ]);
    });

    it('replaces rolling aggregates that contradict the annual data', () => {
        const byYear = Array.from({ length: 10 }, (_, index) => ({
            year: 2016 + index,
            highs: index === 9 ? 1 : 0,
            lows: index === 9 ? 1 : 0,
        }));
        const payload = {
            source: 'test',
            description: 'test',
            totalHighs: 1,
            totalLows: 1,
            byDecade: [
                { decade: 2010, label: '2010s', highs: 0, lows: 0, ratio: null },
                { decade: 2020, label: '2020s', highs: 1, lows: 1, ratio: 1 },
            ],
            byYear,
            rollingRatio: [{ year: 2025, ratio: 2, highs10yr: 2, lows10yr: 1 }],
        };

        const parsed = parseTemperaturePayload(climateTrendsSchema, payload, 'record ages');

        expect(parsed.rollingRatio).toEqual([
            { year: 2025, ratio: 1, highs10yr: 1, lows10yr: 1 },
        ]);
    });

    it('fills missing calendar years before it calculates rolling aggregates', () => {
        const payload = {
            source: 'test',
            description: 'test',
            totalHighs: 2,
            totalLows: 1,
            byDecade: [],
            byYear: [
                { year: 2000, highs: 1, lows: 0 },
                { year: 2010, highs: 1, lows: 1 },
            ],
            rollingRatio: [],
        };

        const parsed = parseTemperaturePayload(climateTrendsSchema, payload, 'record ages');

        expect(parsed.byYear).toHaveLength(11);
        expect(parsed.byYear[1]).toEqual({ year: 2001, highs: 0, lows: 0 });
        expect(parsed.rollingRatio).toEqual([
            { year: 2009, ratio: null, highs10yr: 1, lows10yr: 0 },
            { year: 2010, ratio: 1, highs10yr: 1, lows10yr: 1 },
        ]);
    });
});