// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asOf, fixture, generatedAt, reader } from './fixtures/temperaturePublication';
import { verifyTemperaturePublication } from '../verify-temperature-publication.js';


afterEach(() => vi.useRealTimers());

describe('full temperature publication verification', () => {
    it('accepts complete coverage with zero broken records and records California separately', async () => {
        const data = fixture();
        const fetchImpl = reader(data);
        const report = await verifyTemperaturePublication({ baseUrl: 'https://example.test/data', asOf, updatedSince: generatedAt, fetchImpl });
        expect(report).toMatchObject({ countyRecords: 96, stateRecords: 100, californiaCountyRecords: 2, monthlyThresholdVersion: 2,
            recentCoverage: { '2026-11-08': { states: 48, records: 0 } } });
        expect(Object.keys(report.recentCoverage)).toHaveLength(7);
        expect(fetchImpl.mock.calls.map(([url]) => url.pathname).sort()).toEqual(Object.keys(data).map(file => '/data/' + file).sort());
    });

    it('rejects missing California records even when metadata claims complete coverage', async () => {
        const data = fixture();
        data['countyRecords.json'].features = data['countyRecords.json'].features.filter(feature => feature.properties.state !== 'CA');
        data['summary.json'].countyRecordCount -= 2;
        await expect(verifyTemperaturePublication({ asOf, fetchImpl: reader(data) })).rejects.toThrow('County high records');
    });

    it('rejects missing low records independently of high coverage', async () => {
        const data = fixture();
        data['countyRecords.json'].features = data['countyRecords.json'].features.filter(feature => feature.properties.state !== 'CA' || feature.properties.type !== 'low');
        data['summary.json'].countyRecordCount -= 1;
        await expect(verifyTemperaturePublication({ asOf, fetchImpl: reader(data) })).rejects.toThrow('County low records');
    });

    it.each(['year', 'gap', 'count', 'total'])('rejects inconsistent standing-history %s data', async kind => {
        const data = fixture();
        const trends = data['climateTrends.json'];
        if (kind === 'year') trends.byYear.pop();
        if (kind === 'gap') trends.byYear.splice(1, 1);
        if (kind === 'count') trends.byYear[110].highs++;
        if (kind === 'total') trends.totalLows++;
        await expect(verifyTemperaturePublication({ asOf, fetchImpl: reader(data) })).rejects.toThrow('Standing-record history');
    });

    it.each(['county', 'daily', 'duplicate'])('rejects incomplete %s completion metadata', async kind => {
        const data = fixture();
        const coverage = kind === 'county' ? data['summary.json'].countyCoverage : data['recentRecords.json'].coverageByDate['2026-11-08'];
        if (kind === 'duplicate') coverage.completedStates[0] = coverage.completedStates[1];
        else coverage.completedStates.pop();
        await expect(verifyTemperaturePublication({ asOf, fetchImpl: reader(data) })).rejects.toThrow('48 contiguous states');
    });

    it.each(['count', 'version', 'asOf', 'dates', 'stale', 'missing timestamp'])('rejects %s inconsistencies', async kind => {
        const data = fixture();
        if (kind === 'count') data['summary.json'].countyRecordCount++;
        if (kind === 'version') data['recentRecords.json'].monthlyThresholdVersion = 1;
        if (kind === 'asOf') data['recentRecords.json'].asOf = '2026-11-08';
        if (kind === 'dates') data['recentRecords.json'].dates.pop();
        if (kind === 'stale') data['summary.json'].lastUpdated = '2026-11-01T00:00:00Z';
        if (kind === 'missing timestamp') delete (data['recentRecords.json'] as { generatedAt?: string }).generatedAt;
        await expect(verifyTemperaturePublication({ asOf, updatedSince: generatedAt, fetchImpl: reader(data) })).rejects.toThrow();
    });

    it.each(['file:///tmp/data', 'https://user:secret@example.test', 'https://example.test?key=private', 'https://example.test/#fragment'])('rejects unsafe data locations', async baseUrl => {
        const fetchImpl = reader();
        await expect(verifyTemperaturePublication({ asOf, baseUrl, fetchImpl })).rejects.toThrow('HTTP(S)');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each(['http', 'mime', 'json'])('identifies the file with a failed %s response', async failure => {
        const data = fixture();
        const fetchImpl = async (url: URL) => url.pathname.endsWith('countyRecords.json')
            ? new Response(failure === 'json' ? '{' : 'Unavailable', { status: failure === 'http' ? 503 : 200, headers: { 'content-type': failure === 'mime' ? 'text/html' : 'application/json' } })
            : reader(data)(url);
        await expect(verifyTemperaturePublication({ asOf, fetchImpl })).rejects.toThrow('countyRecords.json:');
    });

    it('bounds a stalled response body', async () => {
        vi.useFakeTimers();
        const fetchImpl = async (_url: URL, options: RequestInit) => new Response(new ReadableStream({
            start(controller) { options.signal!.addEventListener('abort', () => controller.error(options.signal!.reason), { once: true }); },
        }), { headers: { 'content-type': 'application/json' } });
        const result = expect(verifyTemperaturePublication({ asOf, fetchImpl, timeoutMs: 100 })).rejects.toThrow('Request timed out');
        await vi.advanceTimersByTimeAsync(100);
        await result;
    });
});
