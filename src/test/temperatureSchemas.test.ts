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

    it('rejects record-age totals that do not match the annual data', () => {
        const payload = {
            source: 'test',
            description: 'test',
            totalHighs: 2,
            totalLows: 1,
            byDecade: [],
            byYear: [{ year: 2025, highs: 1, lows: 1 }],
            rollingRatio: [],
        };

        expect(() => parseTemperaturePayload(climateTrendsSchema, payload, 'record ages'))
            .toThrow('Invalid record ages at totalHighs: Must equal the sum of byYear high counts');
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
});