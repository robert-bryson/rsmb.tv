import { describe, expect, it } from 'vitest';
import { buildBrokenRecordsGeoJson, buildFreshnessGeoJson } from '../features/temperatures/map/temperatureMapLayers';
import { escapeMapText } from '../features/temperatures/map/temperatureMapPopup';
import type { BrokenRecord, CountyRecordsCollection } from '../features/temperatures/types';

function brokenRecord(overrides: Partial<BrokenRecord> = {}): BrokenRecord {
    return {
        stationName: 'Test Station',
        uid: 1,
        state: 'TX',
        stateName: 'Texas',
        county: '48001',
        lat: 31.5,
        lon: -99.3,
        elev: 100,
        type: 'high',
        tempF: 105,
        prevRecordF: 101,
        prevRecordDate: '2011-09-02',
        normalF: 91,
        date: '2026-09-02',
        recordScope: 'monthly',
        ...overrides,
    };
}

describe('temperature map layers', () => {
    it('escapes untrusted feature labels before HTML interpolation', () => {
        expect(escapeMapText('<img src=x onerror="alert(1)">'))
            .toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
        expect(escapeMapText(undefined)).toBe('');
    });

    it('removes only the missing-coordinate sentinel', () => {
        const collection = buildBrokenRecordsGeoJson([
            brokenRecord({ uid: 1, lat: 0, lon: 0 }),
            brokenRecord({ uid: 2, lat: 0, lon: -90 }),
            brokenRecord({ uid: 3, lat: 35, lon: 0 }),
        ], 'last7Days');

        expect(collection.features.map(feature => feature.properties.uid)).toEqual([2, 3]);
        expect(collection.features[0].properties.period).toBe('last7Days');
    });

    it('adds a color and numeric year to the selected record type', () => {
        const countyRecords: CountyRecordsCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [-99, 31] },
                    properties: { countyFips: '48001', countyName: 'Anderson County', state: 'TX', type: 'high', tempF: 110, date: '2020-08-01', stationName: 'High Station', lat: 31, lon: -99 },
                },
                {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [-99, 31] },
                    properties: { countyFips: '48001', countyName: 'Anderson County', state: 'TX', type: 'low', tempF: 0, date: '1980-01-01', stationName: 'Low Station', lat: 31, lon: -99 },
                },
            ],
        };

        const collection = buildFreshnessGeoJson(countyRecords, 'high');

        expect(collection.features).toHaveLength(1);
        expect(collection.features[0].properties).toMatchObject({ type: 'high', year: 2020 });
        expect(collection.features[0].properties.color).toMatch(/^#[0-9a-f]{6}$/i);
    });
});