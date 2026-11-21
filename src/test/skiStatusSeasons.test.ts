import { describe, expect, it } from 'vitest';
import operatorReports from '../../projects/ski-status/data/conditions/operator-reports.json';
import { dolomitiTerrainReport } from '../../projects/ski-status/scripts/conditions-sources';
import { filterSkiAreas, formatSkiStat, sortSkiAreas } from '../features/ski-status/browse';
import { skiAreas } from '../features/ski-status/catalog';
import {
    areaForecast, mergeResortReports, reportSnapshotSchema, reportStatus, reportStatusText, skiDayStatus, terrainStatusText,
    type BaseForecast, type ResortReport,
} from '../features/ski-status/conditions';
import { includesSeasonMonth, readSeasonCalendar, readSeasonMonth, seasonCalendar, skiSeasonOutlook, upcomingSeasonPlan } from '../features/ski-status/seasons';
import { skiAreaCsv } from '../features/ski-status/skiCsv';

const area = (id: string) => skiAreas.find(candidate => candidate.id === id)!;
const now = Date.parse('2026-11-20T18:00:00Z');

describe('ski season dates', () => {
    it('uses recent completed seasons and keeps archived dates available', () => {
        const alta = seasonCalendar.byArea.get('alta')!;
        expect(alta.typical).toMatchObject({ opening: 'Nov 25', closing: 'Apr 23', evidence: { count: 5, latest: '2025/26' } });
        expect(alta.actual.find(row => row.season === '2024/25')?.openingTerrain).toMatchObject({ lifts: 2, baseCm: 58.42 });
        const historyOnly = seasonCalendar.byArea.get('mount-snow')!;
        expect(historyOnly.typical).toBeUndefined();
        expect(historyOnly.actual[0]).toMatchObject({ opensOn: '2018-10-27', closesOn: '2019-04-14' });
    });

    it('uses the correctly scoped operator dates and keeps opening-day limits visible', () => {
        const blueMountain = seasonCalendar.byArea.get('blue-mountain-resort-on')!;
        expect(blueMountain.typical).toMatchObject({ opening: 'Dec 9', closing: 'Apr 18', evidence: { count: 5 } });
        expect(blueMountain.planned[0].opensOn).toBe('2026-12-10');
        expect(blueMountain.actual.find(row => row.season === '2024/25')?.note).toContain('13 days');
        expect(seasonCalendar.byArea.get('blue-mountain-resort')).toBeUndefined();
        const louise = seasonCalendar.byArea.get('lake-louise')!;
        expect(louise.typical).toMatchObject({ opening: 'Nov 4', closing: 'May 4', evidence: { count: 3 } });
        expect(louise.actual[0]).toMatchObject({ opensOn: '2026-11-01', openingTerrain: { lifts: 1, trails: 1 } });
        const sunshine = seasonCalendar.byArea.get('banff-sunshine')!;
        expect(sunshine.typical).toMatchObject({ opening: 'Nov 8', closing: 'May 19', evidence: { count: 3 } });
    });

    it('matches the month in cross-year and same-year seasons without using planned windows', () => {
        const areas = [area('killington'), area('coronet-peak'), area('telluride-ski-resort'), area('big-snow-american-dream')];
        expect(filterSkiAreas(areas, { seasonMonth: 12 }).map(({ id }) => id)).toEqual(['killington', 'big-snow-american-dream']);
        expect(filterSkiAreas(areas, { seasonMonth: 8 }).map(({ id }) => id)).toEqual(['coronet-peak', 'big-snow-american-dream']);
        expect(formatSkiStat(areas[2], 'plannedClosing', 'imperial')).toBe('2027-04-04');
        expect(sortSkiAreas(areas, { key: 'typicalOpening', direction: 'asc' }).map(({ id }) => id))
            .toEqual(['big-snow-american-dream', 'coronet-peak', 'killington', 'telluride-ski-resort']);
        expect(readSeasonMonth('00')).toBeUndefined();
        expect(readSeasonMonth('13')).toBeUndefined();
    });

    it('uses the same published season for details, month filters, and comparison', () => {
        const cannon = area('cannon-mountain');
        const killington = area('killington');
        expect(skiSeasonOutlook(cannon, '2026-11-20').typical).toMatchObject({ opensIn: 11, closesIn: 4 });
        expect(filterSkiAreas([cannon], { seasonMonth: 11 })).toEqual([cannon]);
        expect(filterSkiAreas([cannon], { seasonMonth: 4 })).toEqual([cannon]);
        expect(filterSkiAreas([cannon], { seasonMonth: 5 })).toEqual([]);
        expect(formatSkiStat(cannon, 'typicalOpening', 'imperial')).toBe('November');
        expect(formatSkiStat(cannon, 'typicalClosing', 'imperial')).toBe('April');
        expect(sortSkiAreas([killington, cannon], { key: 'typicalClosing', direction: 'asc' })).toEqual([cannon, killington]);
    });

    it('uses local season boundaries and advances to typical dates after the current schedule', () => {
        const sunshine = area('banff-sunshine');
        expect(skiSeasonOutlook(sunshine, '2027-01-20')).toMatchObject({
            season: '2026/27',
            opening: { date: '2026-11-07', basis: 'Recorded' },
            closing: { date: '2027-05-24', basis: 'Scheduled' },
        });
        expect(skiSeasonOutlook(sunshine, '2027-07-15')).toMatchObject({
            season: '2027/28',
            opening: { month: 11, label: 'Nov 8', basis: 'Estimated' },
            closing: { month: 5, label: 'May 19', basis: 'Estimated' },
        });
        expect(skiSeasonOutlook(area('coronet-peak'), '2026-12-01')).toMatchObject({
            season: '2027', opening: { month: 5, basis: 'Scheduled' }, closing: { month: 10, basis: 'Scheduled' },
        });
    });

    const sources = { operator: 'https://example.test/seasons' };
    const candidate = {
        season: '2025/26', source: 'operator', opensOn: '2025-12-31', closesOn: '2026-04-10',
    };
    const calendar = (actual: unknown) => ({ version: 1, checkedOn: '2026-11-20', sources, areas: [{ areaId: 'alta', actual }] });

    it('identifies the last recorded season and keeps a current opening separate', () => {
        const resort = { ...area('alta'), seasonWindow: undefined };
        const fixture = readSeasonCalendar(calendar([candidate]), skiAreas);
        expect(skiSeasonOutlook(resort, '2026-11-20', undefined, fixture)).toMatchObject({
            season: '2025/26', historical: true, typical: undefined,
            opening: { date: '2025-12-31', basis: 'Recorded' },
            closing: { date: '2026-04-10', basis: 'Recorded' },
        });

        const report: ResortReport = {
            areaId: resort.id, status: 'season-closed', opensOn: '2026-11-28',
            reportedAt: '2026-11-20T17:30:00Z', retrievedAt: '2026-11-20T17:40:00Z',
            source: { name: 'Operator', url: sources.operator, exportable: false },
        };
        const conditions = { reports: new Map([[resort.id, report]]), forecasts: new Map(), now };
        expect(skiSeasonOutlook(resort, '2026-11-20', conditions, fixture)).toMatchObject({
            season: undefined, historical: false, closing: undefined,
            opening: { date: '2026-11-28', basis: 'Scheduled', source: sources.operator },
        });
    });

    it.each([
        { name: 'uses a compatible closing plan', plan: { season: '2026/27', closesOn: '2027-04-08' },
            season: '2026/27', closing: { date: '2027-04-08', basis: 'Scheduled' } },
        { name: 'ignores a closing plan before the reported opening', plan: { season: '2026/27', closesOn: '2026-11-26' } },
        { name: 'ignores a closing plan for a later season', plan: { season: '2027/28', closesOn: '2028-04-08' } },
    ])('$name for a reported opening', ({ plan, season, closing }) => {
        const resort = { ...area('alta'), seasonWindow: undefined };
        const fixture = readSeasonCalendar({
            ...calendar([]), areas: [{ areaId: resort.id, planned: [{ ...plan, source: 'operator' }] }],
        }, skiAreas);
        const report: ResortReport = {
            areaId: resort.id, status: 'season-closed', opensOn: '2026-11-28',
            reportedAt: '2026-11-20T17:30:00Z', retrievedAt: '2026-11-20T17:40:00Z',
            source: { name: 'Operator', url: sources.operator, exportable: false },
        };
        const conditions = { reports: new Map([[resort.id, report]]), forecasts: new Map(), now };
        expect(skiSeasonOutlook(resort, '2026-11-20', conditions, fixture)).toMatchObject({
            season, historical: false, closing,
            opening: { date: '2026-11-28', basis: 'Scheduled' },
        });
    });

    it('clears an opening announcement from the comparison once the season has opened', () => {
        const sunshine = area('banff-sunshine');
        const report: ResortReport = {
            areaId: sunshine.id, status: 'limited', opensOn: '2026-11-28',
            reportedAt: '2026-11-20T17:30:00Z', retrievedAt: '2026-11-20T17:40:00Z',
            source: { name: 'Operator', url: sources.operator, exportable: true, license: 'https://example.test/license' },
        };
        const conditions = { reports: new Map([[sunshine.id, report]]), forecasts: new Map(), now };
        expect(skiSeasonOutlook(sunshine, '2026-11-20', conditions).opening).toMatchObject({ date: '2026-11-07', basis: 'Recorded' });
        expect(formatSkiStat(sunshine, 'opensOn', 'imperial', conditions)).toBeUndefined();
        expect(formatSkiStat(sunshine, 'plannedClosing', 'imperial', conditions)).toBe('2027-05-24');
        expect(skiAreaCsv([sunshine], ['name', 'opensOn'], 'imperial', conditions)).not.toContain('2026-11-28');
    });

    it('orders December and January within their ski season before taking a median', () => {
        const result = readSeasonCalendar(calendar([
            candidate,
            { ...candidate, season: '2024/25', opensOn: '2025-01-02', closesOn: '2025-04-11' },
            { ...candidate, season: '2023/24', opensOn: '2023-12-30', closesOn: '2024-04-12' },
            { ...candidate, season: '2022/23', opensOn: '2023-01-03', closesOn: '2023-04-11' },
        ]), skiAreas).byArea.get('alta')!.typical;
        expect(result).toMatchObject({ opening: 'Jan 1', closing: 'Apr 11' });
        expect(includesSeasonMonth(result, 2)).toBe(true);
        expect(includesSeasonMonth(result, 12)).toBe(false);
    });

    it('retains the season label when typical operations begin and end in the second calendar year', () => {
        const fixture = readSeasonCalendar(calendar([
            { ...candidate, opensOn: '2026-01-05' },
            { ...candidate, season: '2024/25', opensOn: '2025-01-08', closesOn: '2025-04-20' },
            { ...candidate, season: '2023/24', opensOn: '2024-01-10', closesOn: '2024-04-01' },
        ]), skiAreas);
        expect(skiSeasonOutlook(area('alta'), '2026-12-01', undefined, fixture)).toMatchObject({
            season: '2026/27',
            opening: { basis: 'Estimated', label: 'Jan 8' },
            closing: { basis: 'Estimated', label: 'Apr 10' },
        });
    });

    it('uses the nearest viable schedule and advances after its closing date', () => {
        const first = { ...candidate, season: '2026/27', opensOn: '2026-12-01', closesOn: '2027-04-11' };
        const next = { ...candidate, season: '2027/28', opensOn: '2027-12-02', closesOn: '2028-04-08' };
        const fixture = readSeasonCalendar({
            ...calendar([]), areas: [{ areaId: 'alta', planned: [next, first] }],
        }, skiAreas);
        const plans = fixture.byArea.get('alta');
        expect(upcomingSeasonPlan(plans, '2026-11-20')).toEqual(first);
        expect(upcomingSeasonPlan(plans, '2027-04-12')).toEqual(next);
        expect(skiSeasonOutlook(area('alta'), '2026-11-20', undefined, fixture)).toMatchObject({ season: '2026/27' });
    });

    it('keeps only the remaining plan for a season that has already opened', () => {
        const plan = { ...candidate, season: '2026/27', opensOn: '2026-11-27', closesOn: '2027-03-31' };
        const restrict = (actual: unknown) => readSeasonCalendar({
            ...calendar(actual), areas: [{ areaId: 'alta', actual, planned: [plan] }],
        }, skiAreas).byArea.get('alta');
        const opened = restrict([{ ...plan, opensOn: '2026-11-19', closesOn: undefined }]);
        expect(upcomingSeasonPlan(opened, '2026-11-20')).toMatchObject({ opensOn: undefined, closesOn: plan.closesOn });
        expect(upcomingSeasonPlan(opened, '2027-04-01')).toBeUndefined();
        const closed = restrict([{ ...plan, opensOn: '2026-11-18', closesOn: '2026-11-19' }]);
        expect(upcomingSeasonPlan(closed, '2026-11-20')).toBeUndefined();
    });

    it.each([
        { label: 'inverted dates', actual: [{ ...candidate, opensOn: '2026-05-01' }] },
        { label: 'impossible date', actual: [{ ...candidate, opensOn: '2026-02-29' }] },
        { label: 'future dates', actual: [{ ...candidate, season: '2026/27', opensOn: '2026-12-01', closesOn: '2027-04-10' }] },
        { label: 'missing source', actual: [{ ...candidate, source: 'missing' }] },
        { label: 'closing source without a closing date', actual: [{ ...candidate, closesOn: undefined, closingSource: 'operator' }] },
        { label: 'duplicate season', actual: [candidate, candidate] },
    ])('rejects $label in actual records', ({ actual }) => {
        expect(() => readSeasonCalendar(calendar(actual), skiAreas)).toThrow();
    });
});

describe('ski operations and terrain', () => {
    const reports = new Map(reportSnapshotSchema.parse(operatorReports).reports.map(row => [row.areaId, row]));
    const louise = reports.get('lake-louise')!;
    const deadline = Date.parse(louise.validThrough!);
    const areas = [area('lake-louise'), area('mt-norquay'), area('telluride-ski-resort'), area('pico-mountain')];

    it('uses current resort reports for filters and expires daily reports at local midnight', () => {
        const matching = (filter: 'open' | 'closed' | 'unknown', now: number) =>
            filterSkiAreas(areas, { operations: { filter, reports, now } }).map(({ id }) => id);
        expect(matching('open', now)).toEqual(['lake-louise', 'mt-norquay']);
        expect(matching('closed', now)).toEqual(['telluride-ski-resort']);
        expect(matching('unknown', now)).toEqual(['pico-mountain']);
        expect(deadline).toBe(Date.parse('2026-11-21T05:59:59.999Z'));
        expect(matching('open', deadline)).toEqual(['lake-louise', 'mt-norquay']);
        expect(matching('open', deadline + 1)).toEqual([]);
        expect(reportStatusText(louise, deadline + 1)).toBe('Limited (stale)');
        expect(terrainStatusText(louise.terrain!.items[0], louise, deadline + 1)).toBe('Open (stale)');
    });

    it.each(['2026-11-20T23:59:59.999-06:00', '2026-11-21T05:59:59.999Z'])(
        'accepts a deadline on the resort ski day in %s', validThrough => {
        const report = { ...louise, reportedAt: undefined, reportedOn: '2026-11-20', validThrough };
        const snapshot = reportSnapshotSchema.parse({ ...operatorReports, reports: [report] });
        expect(reportStatus(snapshot.reports[0], Date.parse(louise.retrievedAt) - 1)).toBe('unknown');
        expect(reportStatus(snapshot.reports[0], now)).toBe('limited');
        expect(reportStatus(snapshot.reports[0], deadline + 1)).toBe('unknown');
    });

    it('rejects a deadline that falls on a different day in the resort time zone', () => {
        expect(reportSnapshotSchema.safeParse({
            ...operatorReports, reports: [{
                ...louise, reportedAt: undefined, reportedOn: '2026-11-20', validThrough: '2026-11-20T23:59:59.999-08:00',
            }],
        }).success).toBe(false);
    });

    it('rejects a report date that disagrees with the timestamp in the resort time zone', () => {
        const report: ResortReport = {
            areaId: 'alta', source: louise.source, status: 'open',
            reportedAt: '2026-11-21T06:30:00Z', retrievedAt: '2026-11-21T06:35:00Z', reportedOn: '2026-11-21',
        };
        const snapshot = { version: 1, generatedAt: report.retrievedAt, reports: [report] };
        expect(reportSnapshotSchema.safeParse(snapshot).success).toBe(false);
        expect(reportSnapshotSchema.safeParse({ ...snapshot, reports: [{ ...report, reportedOn: '2026-11-20' }] }).success).toBe(true);
    });

    it('uses the resort ski day in the catalog filter and excludes reports collected in the future', () => {
        const alta = area('alta');
        const report: ResortReport = {
            areaId: alta.id, source: louise.source, status: 'limited',
            reportedAt: '2026-11-21T06:30:00Z', retrievedAt: '2026-11-21T06:35:00Z',
        };
        const midnight = Date.parse('2026-11-21T07:00:00Z');
        const openAt = (now: number) => filterSkiAreas([alta], { operations: { filter: 'open', reports: new Map([[alta.id, report]]), now } });
        expect(openAt(midnight - 1)).toEqual([alta]);
        expect(openAt(midnight)).toEqual([]);
        expect(skiDayStatus(report, Date.parse('2026-11-21T06:34:59Z'), alta.location.timeZone)).toBe('unknown');
        expect(reportStatusText(report, Date.parse('2026-11-21T06:34:59Z'), alta.location.timeZone)).toBe('Limited (age unknown)');
    });

    it('requires a date-only report to be collected during its local ski day', () => {
        const report = {
            ...louise, reportedAt: undefined, reportedOn: '2026-11-21', validThrough: '2026-11-21T23:59:59.999-06:00',
        };
        const snapshot = (retrievedAt: string) => ({
            ...operatorReports, generatedAt: retrievedAt, reports: [{ ...report, retrievedAt }],
        });
        expect(reportSnapshotSchema.safeParse(snapshot('2026-11-21T05:59:59.999Z')).success).toBe(false);
        expect(reportSnapshotSchema.safeParse(snapshot('2026-11-21T06:00:00Z')).success).toBe(true);
    });

    it('accepts a local ski day with different offsets at the start and end', () => {
        const retrievedAt = '2026-11-01T06:30:00Z';
        const report = {
            ...reports.get('telluride-ski-resort'), retrievedAt, reportedOn: '2026-11-01',
            validThrough: '2026-11-01T23:59:59.999-07:00',
        };
        const { reports: [parsed] } = reportSnapshotSchema.parse({ version: 1, generatedAt: retrievedAt, reports: [report] });
        expect(reportStatus(parsed, Date.parse(retrievedAt))).toBe('season-closed');
    });

    it('uses a dated report over a newly retrieved copy with an older source date', () => {
        const older: ResortReport = {
            ...louise, status: 'unknown', retrievedAt: '2026-11-22T06:00:00Z', reportedAt: undefined,
            reportedOn: '2026-11-19', validThrough: undefined,
        };
        expect(mergeResortReports(louise, older, Date.parse(older.retrievedAt))).toBe(louise);
    });

    it('keeps current operations and attaches a newer independently timed terrain report', () => {
        const previous = { ...louise, terrain: undefined };
        const retrievedAt = '2026-11-20T17:30:00Z';
        const terrain: NonNullable<ResortReport['terrain']> = {
            source: { name: 'Terrain operator', url: 'https://example.test/terrain', exportable: false },
            items: [{ id: 'lift:current', name: 'Current chair', kind: 'lift', status: 'open', updatedAt: retrievedAt }],
        };
        const next: ResortReport = {
            ...previous, status: 'unknown', retrievedAt, reportedAt: undefined, validThrough: undefined, terrain,
        };
        const merged = mergeResortReports(previous, next, now);
        expect(merged).toEqual({ ...previous, terrain: { ...terrain, retrievedAt } });
        expect(reportSnapshotSchema.safeParse({ ...operatorReports, reports: [merged] }).success).toBe(true);
    });

    it.each(['limited', 'unknown'] as const)('keeps the latest named observations when new operations are %s', status => {
        const source = { name: 'Terrain operator', url: 'https://example.test/terrain', exportable: false };
        const lift = { id: 'lift:chair', name: 'Main chair', kind: 'lift', status: 'open', updatedAt: '2026-11-20T17:00:00Z' } as const;
        const run = { id: 'trail:main', name: 'Main run', kind: 'trail', status: 'open', updatedAt: '2026-11-20T16:00:00Z' } as const;
        const previous: ResortReport = { ...louise, terrain: { source, retrievedAt: lift.updatedAt, items: [
            lift, run, { ...lift, id: 'lift:removed' },
        ] } };
        const retrievedAt = '2026-11-20T17:30:00Z';
        const closedRun = { ...run, status: 'closed', updatedAt: retrievedAt } as const;
        const next: ResortReport = { ...previous, status, retrievedAt, terrain: { source, items: [
            { ...lift, status: 'closed', updatedAt: '2026-11-20T16:30:00Z' }, closedRun,
        ] } };

        for (const [first, second] of [[previous, next], [next, previous]]) {
            const merged = mergeResortReports(first, second, now);
            expect(merged.terrain).toEqual({ source, retrievedAt, items: [lift, closedRun] });
            expect(reportSnapshotSchema.safeParse({ ...operatorReports, reports: [merged] }).success).toBe(true);
        }
    });

    it('keeps terrain observations under the license that supplied them', () => {
        const source = { name: 'Terrain operator', url: 'https://example.test/terrain', exportable: false };
        const item = { id: 'lift:chair', name: 'Main chair', kind: 'lift', status: 'open', updatedAt: '2026-11-20T17:00:00Z' } as const;
        const previous: ResortReport = { ...louise, terrain: { source, items: [item], retrievedAt: item.updatedAt } };
        const next: ResortReport = {
            ...previous, status: 'unknown', retrievedAt: '2026-11-20T17:30:00Z',
            terrain: { source: { ...source, exportable: true, license: 'https://example.test/license' }, items: [item] },
        };
        expect(mergeResortReports(previous, next, now)).toBe(previous);
    });

    it('displays a base forecast from retrieval until the end of the forecast period', () => {
        const forecast: BaseForecast = {
            areaId: louise.areaId, source: louise.source, retrievedAt: '2026-11-20T17:50:00Z',
            startsAt: '2026-11-20T18:00:00Z', endsAt: '2026-11-21T18:00:00Z', location: 'Base', snowfallCm: 0,
        };
        const forecasts = new Map([[forecast.areaId, forecast]]);
        const forecastAt = (now: number) => areaForecast({ forecasts, reports, now }, forecast.areaId);
        expect(forecastAt(Date.parse(forecast.retrievedAt) - 1)).toBeUndefined();
        expect(forecastAt(Date.parse(forecast.retrievedAt))).toBe(forecast);
        expect(forecastAt(Date.parse(forecast.endsAt) - 1)).toBe(forecast);
        expect(forecastAt(Date.parse(forecast.endsAt))).toBeUndefined();
    });

    it('keeps a catalog schedule out of CSV when a separate report has an export license', () => {
        const resort = area('telluride-ski-resort');
        const report = reports.get(resort.id)!;
        const conditions = { reports: new Map([[resort.id, {
            ...report, opensOn: undefined, source: { ...report.source, exportable: true, license: 'https://example.test/license' },
        }]]), forecasts: new Map(), now };
        expect(formatSkiStat(resort, 'opensOn', 'imperial', conditions)).toBe('2026-12-05');
        expect(skiAreaCsv([resort], ['name', 'opensOn'], 'imperial', conditions)).not.toContain('2026-12-05');
    });

    it('uses the same fresh opening date in the table, details, and CSV', () => {
        const resort = area('telluride-ski-resort');
        const report = reports.get(resort.id)!;
        const current: ResortReport = {
            ...report, opensOn: '2026-12-07', source: { ...report.source, exportable: true, license: 'https://example.test/license' },
        };
        const conditions = { reports: new Map([[resort.id, current]]), forecasts: new Map(), now };
        expect(formatSkiStat(resort, 'opensOn', 'imperial', conditions)).toBe('2026-12-07');
        expect(skiAreaCsv([resort], ['name', 'opensOn'], 'imperial', conditions)).toContain('2026-12-07');
        expect(skiSeasonOutlook(resort, '2026-11-20', conditions).opening?.date).toBe('2026-12-07');
        const closingOfOpeningDay = Date.parse('2026-12-06T06:59:59.999Z');
        const stale = { ...conditions, now: closingOfOpeningDay };
        expect(formatSkiStat(resort, 'opensOn', 'imperial', stale)).toBe('2026-12-05');
        expect(skiSeasonOutlook(resort, '2026-12-05', stale).opening?.date).toBe('2026-12-05');
        expect(skiAreaCsv([resort], ['name', 'opensOn'], 'imperial', stale)).not.toContain('Planned opening');
        expect(formatSkiStat(resort, 'opensOn', 'imperial', { ...stale, now: closingOfOpeningDay + 1 })).toBeUndefined();
    });

    it('labels the age of counts and percentages when their status column is hidden', () => {
        const resort = area('telluride-ski-resort');
        const alpine = { reports, forecasts: new Map(), now: deadline + 2 * 3_600_000 };
        expect(formatSkiStat(resort, 'reportTrails', 'imperial', alpine)).toBe('0 / 149 (stale)');
        expect(formatSkiStat(resort, 'trailsOpenPct', 'imperial', alpine)).toBe('0% (stale)');
        const dateUnknown = { ...reports.get(resort.id)!, reportedOn: undefined, validThrough: undefined };
        expect(formatSkiStat(resort, 'reportTrails', 'imperial', { ...alpine, reports: new Map([[resort.id, dateUnknown]]) }))
            .toBe('0 / 149 (age unknown)');
    });

    const record = {
        Id: 'urn:odhactivitypoi:dss:lift:3_296', Source: 'dss', Shortname: 'Col Alto', 'Mapping.dss.regionId': '3',
        LastChange: '2026-11-20T09:00:00+00:00', IsOpen: true, LicenseInfo: { License: 'CC0', ClosedData: false }, TagIds: ['lifts'],
    };
    const url = 'https://example.test/terrain';
    const read = (items: unknown[]) => dolomitiTerrainReport({ TotalResults: items.length, TotalPages: 1, Items: items },
        '3', url, louise.retrievedAt);

    it('keeps scoped provider IDs and states while excluding unrelated activities', () => {
        const result = read([
            record,
            { ...record, Id: 'urn:odhactivitypoi:dss:slope:3_600', Shortname: 'Run', IsOpen: null, TagIds: ['alpine skiing'] },
            { ...record, Id: 'urn:odhactivitypoi:dss:slope:3_900', Shortname: 'Nordic', TagIds: ['cross-country'] },
        ])!;
        expect(result.items).toMatchObject([
            { id: record.Id, name: 'Col Alto', status: 'open', kind: 'lift', updatedAt: record.LastChange },
            { name: 'Run', status: 'unknown', kind: 'trail' },
        ]);
        expect(terrainStatusText(result.items[0], louise, now)).toBe('Open');
        expect(terrainStatusText(result.items[0], louise, now + 86_400_000)).toBe('Open (record stale)');
        expect(() => read([{ ...record, 'Mapping.dss.regionId': '4' }])).toThrow('Invalid or duplicate');
        expect(() => read([record, record])).toThrow('Invalid or duplicate');
        expect(() => read([{ ...record, LicenseInfo: { License: 'closed', ClosedData: true } }])).toThrow();
    });
});
