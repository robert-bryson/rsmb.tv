// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { verifyTemperaturePublication } from '../verify-temperature-publication.js';
import { asOf, fixture, generatedAt, reader } from './fixtures/temperaturePublication';

function recentRecord(uid = 1) {
    return { stationName: 'Test', uid, state: 'CA', stateName: 'California', county: '06001',
        lat: 37, lon: -120, elev: null, type: 'high' as const, tempF: 100, prevRecordF: 99,
        prevRecordDate: '2000-11-08', normalF: null, date: '2026-11-08' };
}

describe('publication integrity regressions', () => {
    it.each(['empty', 'missing low', 'unknown state'])('rejects %s state coverage', async kind => {
        const data = fixture();
        const state = data['stateRecords.json'];
        if (kind === 'empty') state.features = [];
        if (kind === 'missing low') state.features = state.features.filter(feature => feature.properties.state !== 'CA' || feature.properties.type !== 'low');
        if (kind === 'unknown state') state.features[0].properties.state = 'ZZ';
        data['summary.json'].stateRecordCount = state.features.length;
        await expect(verifyTemperaturePublication({ asOf, fetchImpl: reader(data) })).rejects.toThrow('State');
    });

    it.each(['decade', 'decade ratio', 'rolling count', 'rolling ratio', 'missing rolling'])('rejects inconsistent %s aggregates', async kind => {
        const data = fixture();
        const trends = data['climateTrends.json'];
        if (kind === 'decade') trends.byDecade[11].highs++;
        if (kind === 'decade ratio') trends.byDecade[11].ratio = 2;
        if (kind === 'rolling count') trends.rollingRatio[101].lows10yr++;
        if (kind === 'rolling ratio') trends.rollingRatio[101].ratio = 2;
        if (kind === 'missing rolling') trends.rollingRatio.pop();
        await expect(verifyTemperaturePublication({ asOf, fetchImpl: reader(data) })).rejects.toThrow('Standing-record history');
    });

    it.each(['duplicate', 'county code', 'coordinates', 'geometry', 'future date'])('rejects invalid county %s', async kind => {
        const data = fixture();
        const county = data['countyRecords.json'];
        const feature = county.features[0];
        if (kind === 'duplicate') county.features.push(structuredClone(feature));
        if (kind === 'county code') feature.properties.countyFips = '06001';
        if (kind === 'coordinates') feature.geometry.coordinates[1] = feature.properties.lat = 91;
        if (kind === 'geometry') feature.geometry.coordinates[0] = 181;
        if (kind === 'future date') feature.properties.date = '2027-01-01';
        data['summary.json'].countyRecordCount = county.features.length;
        await expect(verifyTemperaturePublication({ asOf, fetchImpl: reader(data) })).rejects.toThrow('County');
    });

    it.each([0, -1, NaN, Infinity])('rejects invalid request timeout %s before fetching', async timeoutMs => {
        const fetchImpl = reader();
        await expect(verifyTemperaturePublication({ asOf, timeoutMs, fetchImpl })).rejects.toThrow('timeout');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('accepts matching recent rows in different orders and a declared backfill date', async () => {
        const data = fixture();
        const recent = data['recentRecords.json'];
        recent.last7Days = [recentRecord(1), recentRecord(2)];
        recent.yesterday = [...recent.last7Days].reverse();
        recent.dates.push('2026-11-01');
        recent.coverageByDate['2026-11-01'] = structuredClone(recent.coverageByDate['2026-11-08']);
        const result = await verifyTemperaturePublication({ asOf, fetchImpl: reader(data) });
        expect(result.recentCoverage['2026-11-08'].records).toBe(2);
        expect(result.recentCoverage['2026-11-01'].records).toBe(0);
    });

    it('allows county marker centroids to differ from the source station coordinates', async () => {
        const data = fixture();
        data['countyRecords.json'].features[0].geometry.coordinates = [-101, 40];
        await expect(verifyTemperaturePublication({ asOf, fetchImpl: reader(data) })).resolves.toMatchObject({ countyRecords: 96 });
    });

    it.each(['duplicate', 'fractional UID', 'negative UID', 'state', 'latitude', 'missing yesterday', 'extra yesterday', 'changed yesterday', 'outside window'])('rejects recent %s inconsistencies', async kind => {
        const data = fixture();
        const recent = data['recentRecords.json'];
        const record = recentRecord();
        recent.last7Days = [record];
        if (kind === 'duplicate') recent.last7Days.push(structuredClone(record));
        if (kind === 'fractional UID') record.uid = 1.5;
        if (kind === 'negative UID') record.uid = -1;
        if (kind === 'state') record.state = 'ZZ';
        if (kind === 'latitude') record.lat = 91;
        if (kind === 'outside window') record.date = '2026-11-01';
        recent.yesterday = structuredClone(recent.last7Days);
        if (kind === 'missing yesterday') recent.yesterday = [];
        if (kind === 'extra yesterday') recent.yesterday.push(recentRecord(2));
        if (kind === 'changed yesterday') recent.yesterday[0].tempF++;
        await expect(verifyTemperaturePublication({ asOf, fetchImpl: reader(data) })).rejects.toThrow('Recent');
    });

    it.each(['date', 'early date', 'future date', 'since', 'timestamp', 'state location', 'state date', 'duplicate date', 'future recent date'])('rejects invalid %s inputs', async kind => {
        const data = fixture();
        const fetchImpl = reader(data);
        let date = asOf;
        let updatedSince = generatedAt;
        if (kind === 'date') date = '2026-02-30';
        if (kind === 'early date') date = '1889-12-31';
        if (kind === 'future date') date = '2999-01-01';
        if (kind === 'since') updatedSince = 'invalid';
        if (kind === 'timestamp') data['summary.json'].lastUpdated = 'November 9, 2026';
        if (kind === 'state location') data['stateRecords.json'].features[0].geometry.coordinates[0] = 181;
        if (kind === 'state date') data['stateRecords.json'].features[0].properties.date = '2999-01-01';
        if (kind === 'duplicate date') data['recentRecords.json'].dates.push('2026-11-08');
        if (kind === 'future recent date') data['recentRecords.json'].dates.push('2999-01-01');
        await expect(verifyTemperaturePublication({ asOf: date, updatedSince, fetchImpl })).rejects.toThrow();
        if (['date', 'early date', 'future date', 'since'].includes(kind)) expect(fetchImpl).not.toHaveBeenCalled();
    });
});
