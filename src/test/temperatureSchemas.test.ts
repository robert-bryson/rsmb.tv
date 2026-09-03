import { describe, expect, it } from 'vitest';
import { parseTemperaturePayload, recentRecordsSchema, stateRecordsSchema } from '../features/temperatures/schemas';

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
});