// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLakeLouiseReport, lakeLouiseReport } from '../../projects/ski-status/scripts/lake-louise-source';
import { reportStatus, terrainStatusText } from '../../src/features/ski-status/conditions';

const retrievedAt = '2026-11-20T17:40:05Z';
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<report name="The Lake Louise Ski Resort" units="metric" updated="2026-11-20T11:40:00-06:00">
    <operations resortStatus="Open" openTime="9am" closeTime="4pm" totalAcres="4200"/>
    <currentConditions>
        <resortwide totalAcresOpen="200" lastSnowfallUpdate="2026-11-20T05:10:08-06:00"/>
        <resortLocations>
            <location name="Lower Mountain" base="23" snow24Hours="2"/>
            <location name="Upper Mountain" base="28" snow24Hours="0" temperature="-11"
                weatherTimestamp="2026-11-20T11:20:44-06:00" stationName="Paradise-Top"/>
        </resortLocations>
        <liftsAndRuns lifts="1" runs="1"/>
    </currentConditions>
    <facilities>
        <areas><area name="Front Side">
            <lifts>
                <lift id="1" name="Glacier Express" status="Open" realtime="Closed"/>
                <lift id="2" name="Back Bowl Chair" status="Closed"/>
            </lifts>
            <trails>
                <trail id="1" name="Wiwaxy" status="Open"/>
                <trail id="2" name="Bald Eagle" status="On Hold"/>
            </trails>
        </area></areas>
    </facilities>
</report>`;

describe('Lake Louise operations report', () => {
    it('uses matching daily counts and named states, with separately timed observations', () => {
        const report = lakeLouiseReport(xml, retrievedAt);
        expect(report).toMatchObject({
            areaId: 'lake-louise', status: 'limited', retrievedAt, reportedOn: '2026-11-20',
            source: { exportable: false },
            lifts: { open: 1, total: 2 }, trails: { open: 1, total: 2 },
            baseCm: 28, snowfallCm: 0, snowfallHours: 24, snowLocation: 'Upper Mountain', snowReportedOn: '2026-11-20',
            temperature: { valueC: -11, measuredAt: '2026-11-20T11:20:44-06:00', location: 'Paradise-Top' },
        });
        expect(report.reportedAt).toBeUndefined();
        expect(report.acres).toBeUndefined();
        expect(report.hours).toBeUndefined();
        expect(report.terrain?.items).toEqual([
            { id: 'lift:1', name: 'Glacier Express', kind: 'lift', status: 'open' },
            { id: 'lift:2', name: 'Back Bowl Chair', kind: 'lift', status: 'closed' },
            { id: 'trail:1', name: 'Wiwaxy', kind: 'trail', status: 'open' },
            { id: 'trail:2', name: 'Bald Eagle', kind: 'trail', status: 'on-hold' },
        ]);
    });

    it('expires the daily operations at midnight Alberta time', () => {
        const report = lakeLouiseReport(xml, retrievedAt);
        const midnight = Date.parse('2026-11-21T06:00:00Z');
        expect(reportStatus(report, midnight - 1)).toBe('limited');
        expect(reportStatus(report, midnight)).toBe('unknown');
        expect(terrainStatusText(report.terrain!.items[0], report, midnight)).toBe('Open (stale)');
    });

    it('keeps measurements and leaves operations unknown on a day without a verified report', () => {
        const report = lakeLouiseReport(xml.replace('2026-11-20T05:10', '2026-11-19T05:10'), retrievedAt);
        expect(report).toMatchObject({ status: 'unknown', snowReportedOn: '2026-11-19', temperature: { valueC: -11 } });
        expect(report.validThrough).toBeUndefined();
        expect(terrainStatusText(report.terrain!.items[0], report, Date.parse(retrievedAt))).toBe('Open (age unknown)');
        expect(lakeLouiseReport(xml, '2026-11-21T06:00:00Z').status).toBe('unknown');
    });

    it.each([
        ['Open', 'unknown'],
        ['Closed', 'temporarily-closed'],
        ['Closed for the season', 'season-closed'],
    ] as const)('uses the resort flag %s when no skiing is reported', (flag, expected) => {
        const closed = xml.replace('resortStatus="Open"', `resortStatus="${flag}"`)
            .replaceAll('status="Open"', 'status="Closed"').replace('lifts="1" runs="1"', 'lifts="0" runs="0"');
        expect(lakeLouiseReport(closed, retrievedAt)).toMatchObject({
            status: expected, lifts: { open: 0, total: 2 }, trails: { open: 0, total: 2 },
        });
    });

    it('omits weather observations whose measurement time is in the future', () => {
        const report = lakeLouiseReport(xml.replace('T11:20:44', 'T11:42:00'), retrievedAt);
        expect(report.temperature).toBeUndefined();
        expect(report.status).toBe('limited');
    });

    it('keeps verified operations when optional snow fields contain invalid values', () => {
        const report = lakeLouiseReport(xml.replace('base="28" snow24Hours="0"', 'base="-1" snow24Hours="N/A"'), retrievedAt);
        expect(report.status).toBe('limited');
        expect(report.lifts).toEqual({ open: 1, total: 2 });
        expect(report.baseCm).toBeUndefined();
        expect(report.snowfallCm).toBeUndefined();
    });

    it('counts only lift and trail names in the ski facilities', () => {
        const report = lakeLouiseReport(xml.replace('<facilities>', '<comments><lift id="3" name="Other facility" status="Open"/></comments><facilities>'), retrievedAt);
        expect(report.lifts).toEqual({ open: 1, total: 2 });
    });

    it.each([
        { name: 'another resort', source: xml.replace('The Lake Louise Ski Resort', 'Other resort') },
        { name: 'different units', source: xml.replace('units="metric"', 'units="imperial"') },
        { name: 'divergent counts', source: xml.replace('runs="1"', 'runs="0"') },
        { name: 'duplicate lift ID', source: xml.replace('<lift id="2"', '<lift id="1"') },
        { name: 'invalid structure', source: xml.replace('</report>', '') },
        { name: 'document type', source: '<!DOCTYPE report>' + xml },
    ])('rejects $name', ({ source }) => {
        expect(() => lakeLouiseReport(source, retrievedAt)).toThrow();
    });
});

describe('Lake Louise feed download', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('loads a valid XML response from the configured HTTPS endpoint without following redirects', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(retrievedAt));
        const fetch = vi.fn(async () => new Response(xml));
        vi.stubGlobal('fetch', fetch);
        await expect(fetchLakeLouiseReport()).resolves.toMatchObject({ reportedOn: '2026-11-20', status: 'limited' });
        expect(fetch).toHaveBeenCalledWith('https://lamp10.skilouise.com/app/mtnxml.php', expect.objectContaining({ redirect: 'error' }));
    });

    it('rejects an oversized response without depending on content-length', async () => {
        vi.stubGlobal('fetch', async () => new Response(new Uint8Array(300 * 1024), { headers: { 'content-length': '8' } }));
        await expect(fetchLakeLouiseReport()).rejects.toThrow('exceeds the size limit');
    });

    it('cancels the response stream on an HTTP error', async () => {
        const cancel = vi.fn();
        vi.stubGlobal('fetch', async () => new Response(new ReadableStream({ cancel }), { status: 503 }));
        await expect(fetchLakeLouiseReport()).rejects.toThrow('Lake Louise returned HTTP 503');
        expect(cancel).toHaveBeenCalledOnce();
    });
});
