// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMammothReport, mammothReport } from '../../projects/ski-status/scripts/mammoth-source';
import { mergeResortReports, skiDayStatus, terrainStatusText } from '../../src/features/ski-status/conditions';

const retrievedAt = '2026-11-21T18:00:00.000Z';
const xml = `<report name="Mammoth Mountain" units="USC" updated="2026-11-21T09:59:00-0800">
    <currentConditions><resortLocations>
        <location name="Base" base="33 - 37" snowOverNight="0" snow24Hours="0" snow48Hours="7"
            snow72Hours="12" snow7Days="--" snowSeasonTotal="30" primarySurface="Packed Powder"/>
        <location name="Mid Mountain" base="--" snow48Hours="9" snow7Days="22"/>
        <location name="Summit" base="42" snow24Hours="-3" snow48Hours="11"/>
    </resortLocations></currentConditions>
    <forecast>
        <day name="Today" high="25" low="7" weather="Sunny"/>
        <day name="Sunday" high="--" low="13" weather="Light snow"/>
        <day name="Wednesday" high="30" low="16"/>
        <day name="Tuesday" high="-5" low="-10"/>
        <day name="Wednesday" high="15" low="25" weather="Chance of snow"/>
    </forecast>
    <facilities><areas>
        <area name="Main Lodge">
            <lifts><lift name="Broadway Express 1" type="High-Speed 6 Chair" status="Open"/></lifts>
            <trails><trail name="Main Run" status="Open" difficulty="Difficult" groomed="Yes" snowMaking="No"/></trails>
        </area>
        <area name="Canyon Lodge">
            <lifts><lift name="Canyon Express" status="On Hold"/></lifts>
            <trails><trail name="Main Run" status="Closed" groomed="No" snowMaking="Yes"/></trails>
        </area>
        <area name="Eagle Lodge"><lifts/><trails/></area>
        <area name="MTB - Mammoth Mountain">
            <lifts><lift name="Bike Park Shuttle" status="Open"/></lifts>
            <trails><trail name="Bike Trail" status="Open"/></trails>
        </area>
    </areas></facilities>
</report>`;

describe('Mammoth Mountain operations', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('derives alpine counts from the lodge inventories and keeps the published item metadata', () => {
        const report = mammothReport(xml, retrievedAt);
        expect(report).toMatchObject({
            areaId: 'mammoth-mountain', status: 'limited', reportedAt: '2026-11-21T09:59:00-08:00', reportedOn: '2026-11-21',
            lifts: { open: 1, total: 2 }, trails: { open: 1, total: 2 }, source: { exportable: false },
        });
        expect(report.terrain?.items).toMatchObject([
            { name: 'Broadway Express 1', kind: 'lift', status: 'open', area: 'Main Lodge', liftType: 'High-Speed 6 Chair' },
            { name: 'Main Run', kind: 'trail', status: 'open', area: 'Main Lodge', difficulty: 'Difficult', groomed: true, snowmaking: false },
            { name: 'Canyon Express', kind: 'lift', status: 'on-hold', area: 'Canyon Lodge' },
            { name: 'Main Run', kind: 'trail', status: 'closed', area: 'Canyon Lodge', groomed: false, snowmaking: true },
        ]);
        expect(report.terrain?.items[1].id).not.toBe(report.terrain?.items[3].id);
        expect(report.terrain?.items[1].updatedAt).toBeUndefined();
        expect(report.hours).toBeUndefined();
        expect(report.temperature).toBeUndefined();
        expect(report.acres).toBeUndefined();
    });

    it('preserves separate snow locations and periods, including a reported zero', () => {
        const report = mammothReport(xml, retrievedAt);
        expect(report).toMatchObject({ baseCm: [83.82, 93.98], snowfallCm: 0, snowfallHours: 24, snowLocation: 'Base' });
        expect(report.snowByLocation).toEqual([
            { location: 'Base', baseCm: [83.82, 93.98], overnightCm: 0, snow24HoursCm: 0, snow48HoursCm: 17.78,
                snow72HoursCm: 30.48, seasonTotalCm: 76.2, surface: 'Packed Powder' },
            { location: 'Mid Mountain', snow48HoursCm: 22.86, snow7DaysCm: 55.88 },
            { location: 'Summit', baseCm: 106.68, snow48HoursCm: 27.94 },
        ]);
        expect(report.snowReportedOn).toBeUndefined();
    });

    it('uses the report ski day for forecasts and skips mismatched day labels and invalid temperature ranges', () => {
        expect(mammothReport(xml, retrievedAt).forecastDays).toEqual([
            { date: '2026-11-21', highC: -3.89, lowC: -13.89, description: 'Sunny' },
            { date: '2026-11-22', lowC: -10.56, description: 'Light snow' },
            { date: '2026-11-24', highC: -20.56, lowC: -23.33 },
            { date: '2026-11-25', description: 'Chance of snow' },
        ]);
    });

    it('ends the ski day at local midnight and keeps a newer same-source report with no confirmed opening', () => {
        const report = mammothReport(xml, retrievedAt);
        const midnight = Date.parse('2026-11-22T08:00:00Z');
        expect(skiDayStatus(report, midnight - 1, 'America/Los_Angeles')).toBe('limited');
        expect(skiDayStatus(report, midnight, 'America/Los_Angeles')).toBe('unknown');
        expect(terrainStatusText(report.terrain!.items[0], report, midnight)).toBe('Open (stale)');

        const closed = mammothReport(xml.replace('09:59:00', '15:59:00').replace('Chair" status="Open"', 'Chair" status="Closed"'),
            '2026-11-22T00:00:00Z');
        expect(closed).toMatchObject({ status: 'unknown', lifts: { open: 0, total: 2 }, trails: { open: 1, total: 2 } });
        const retrieval = Date.parse(closed.retrievedAt);
        expect(mergeResortReports(report, closed, retrieval - 1)).toBe(report);
        expect(mergeResortReports(report, closed, retrieval)).toBe(closed);
    });

    it('keeps a current report when a newer same-source status has already expired', () => {
        const current = mammothReport(xml, retrievedAt);
        const expired = { ...current, status: 'unknown' as const, reportedAt: '2026-11-21T18:10:00Z',
            retrievedAt: '2026-11-21T18:15:00Z', validThrough: '2026-11-21T18:20:00Z' };
        const now = Date.parse('2026-11-21T18:30:00Z');
        expect(mergeResortReports(current, expired, now)).toBe(current);
        expect(mergeResortReports(expired, current, now)).toBe(current);
    });

    it('keeps the total and named inventory when the open count is unverified', () => {
        const report = mammothReport(xml.replace('status="On Hold"', 'status="Not reported"'), retrievedAt);
        expect(report).toMatchObject({ status: 'unknown', lifts: { total: 2 }, trails: { open: 1, total: 2 } });
        expect(report.lifts?.open).toBeUndefined();
        expect(report.terrain?.items[2].status).toBe('unknown');
    });

    it.each([
        ['another resort', xml.replace('name="Mammoth Mountain"', 'name="Other resort"')],
        ['unexpected units', xml.replace('units="USC"', 'units="metric"')],
        ['a future report time', xml.replace('09:59', '10:01')],
        ['a missing lodge', xml.replace('Eagle Lodge', 'Other lodge')],
        ['a missing inventory', xml.replace('<lifts/><trails/>', '<trails/>')],
        ['duplicate items within a lodge', xml.replace('</lifts>', '<lift name="Broadway Express 1" status="Closed"/></lifts>')],
        ['a document type', '<!DOCTYPE report>' + xml],
    ])('rejects %s', (_, source) => {
        expect(() => mammothReport(source, retrievedAt)).toThrow();
    });

    it('uses the documented syndication CDN without following redirects', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(retrievedAt));
        const fetch = vi.fn(async () => new Response(xml));
        vi.stubGlobal('fetch', fetch);
        await expect(fetchMammothReport()).resolves.toMatchObject({ areaId: 'mammoth-mountain', retrievedAt, status: 'limited' });
        expect(fetch).toHaveBeenCalledWith('https://reportpal-cdn.resorts-interactive.com/mtnxml/525',
            expect.objectContaining({ redirect: 'error' }));
    });
});
