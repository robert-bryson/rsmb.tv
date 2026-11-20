import { describe, expect, it } from 'vitest';
import { openDataHubReport, openMeteoForecast, pilotAreas } from '../../projects/ski-status/scripts/conditions-sources';
import { filterSkiAreas, formatSkiStat, sortSkiAreas, visibleSkiColumns } from '../features/ski-status/browse';
import { locationLicense, skiAreas, type SkiArea } from '../features/ski-status/catalog';
import { reportAgeHours, reportStatus, reportStatusText, type Conditions, type ResortReport } from '../features/ski-status/conditions';
import { markerAppearance, markerLegend } from '../features/ski-status/mapAppearance';
import { evaluatePass, localSkiDate, passProducts, readPassRules, readSkiDate } from '../features/ski-status/passRules';
import { skiAreaCsv } from '../features/ski-status/skiCsv';

const area = (id: string) => skiAreas.find(candidate => candidate.id === id)!;
const product = (id: string) => passProducts.get(id)!;
const now = Date.parse('2026-12-26T06:59:00Z');

describe('ski-status pass products', () => {
    it('evaluates the selected date in the destination time zone and gives explicit local dates precedence', () => {
        const snowbird = area('snowbird');
        expect(localSkiDate(now, snowbird.location.timeZone!)).toBe('2026-12-25');
        expect(localSkiDate(now, 'Asia/Tokyo')).toBe('2026-12-26');
        expect(readSkiDate('2027-02-29')).toBeUndefined();
        expect(evaluatePass(product('ikon-base'), snowbird, now)).toMatchObject({ status: 'included', rule: { days: 5 } });
        expect(evaluatePass(product('ikon-base'), snowbird, now + 60_000).status).toBe('blackout');
        expect(evaluatePass(product('ikon-base'), snowbird, now, '2026-12-30').status).toBe('blackout');
        expect(evaluatePass(product('ikon-base'), snowbird, now, '2026-12-31').status).toBe('included');
    });

    it('distinguishes shared days, product exclusions and reservation rules', () => {
        const alta = area('alta');
        const snowbird = area('snowbird');
        const fernie = area('fernie-alpine-resort');
        const shared = { status: 'included', rule: { days: 7, shared: 'Alta and Snowbird' } };
        expect(evaluatePass(product('ikon-pass'), alta, now)).toMatchObject(shared);
        expect(evaluatePass(product('ikon-pass'), snowbird, now)).toMatchObject(shared);
        expect(evaluatePass(product('ikon-base'), alta, now).status).toBe('excluded');
        expect(evaluatePass(product('epic-day-3-all-unrestricted'), fernie, now).status).toBe('excluded');
        expect(evaluatePass(product('epic-day-4-all-unrestricted'), fernie, now)).toMatchObject({ status: 'included', totalDays: 4 });
        expect(evaluatePass(product('mountain-collective-pass'), area('jackson-hole-mountain-resort'), now))
            .toMatchObject({ rule: { days: 2, reservation: 'required' } });
        expect(filterSkiAreas([alta, snowbird], { product: { pass: product('ikon-base'), date: '2027-01-17', now } })).toEqual([]);
        expect(filterSkiAreas([alta, snowbird], { product: { pass: product('ikon-base'), date: '2027-01-18', now } })).toEqual([snowbird]);
    });

    it('honors partner windows across the calendar year', () => {
        const resort = area('alta-badia');
        expect(evaluatePass(product('ikon-pass'), resort, now, '2026-11-14').status).toBe('outside-dates');
        expect(evaluatePass(product('ikon-pass'), resort, now, '2026-11-15').status).toBe('included');
        expect(evaluatePass(product('ikon-pass'), resort, now, '2027-04-15').status).toBe('included');
        expect(evaluatePass(product('ikon-pass'), resort, now, '2027-04-16').status).toBe('outside-dates');
    });

    it('requires the Indy Add-On home area and excludes it from the results', () => {
        const berkshire = area('berkshire-east-ski-resort');
        const catamount = area('catamount-mountain-resort');
        const addOn = product('indy-plus-addon');
        expect(evaluatePass(addOn, berkshire, now)).toMatchObject({ status: 'home-area-required', rule: { reservation: 'required' } });
        expect(evaluatePass(addOn, berkshire, now, undefined, berkshire.id).status).toBe('home-area');
        expect(evaluatePass(addOn, berkshire, now, '2027-05-31', catamount.id).status).toBe('included');
        expect(evaluatePass(addOn, berkshire, now, '2027-06-01', catamount.id).status).toBe('outside-dates');
        expect(filterSkiAreas([berkshire, catamount], { product: { pass: addOn, now, homeAreaId: berkshire.id } })).toEqual([catamount]);
    });

    it('shows the mandatory Ski Arlberg stay with its shared consecutive days', () => {
        const lech = area('lech-am-arlberg');
        const epic = product('epic-pass');
        expect(evaluatePass(epic, lech, now)).toMatchObject({
            status: 'lodging-required', rule: { days: 3, consecutiveDays: true, shared: 'Ski Arlberg' },
        });
        expect(filterSkiAreas([lech], { product: { pass: epic, now } })).toEqual([lech]);
    });

    const fixtureRule = {
        areaId: 'alta', products: ['test-pass'], access: 'included', days: 2,
        source: 'https://example.test/pass', checkedOn: '2026-11-20',
    };
    const fixtureSeason = {
        season: '2026/27', family: 'ikon', seasonDates: ['2026-11-01', '2027-04-30'],
        products: [{ id: 'test-pass', name: 'Current name' }], rules: [fixtureRule],
    };

    it.each([
        [{ season: '2026/28' }, 'next year'],
        [{ seasonDates: ['2025-11-01', '2027-04-30'] }, 'Dates do not match'],
        [{ rules: [{ ...fixtureRule, validDates: [['2026-10-01', '2027-04-30']] }] }, 'Rule dates fall outside'],
        [{ rules: [{ ...fixtureRule, days: 1, consecutiveDays: true }] }, 'Consecutive days'],
        [{ rules: [{ ...fixtureRule, access: 'excluded' }] }, 'Excluded access'],
        [{ rules: [{ ...fixtureRule, shared: 'Two mountains' }, {
            ...fixtureRule, areaId: 'snowbird', shared: 'Two mountains', days: 3,
        }] }, 'Conflicting shared allowance'],
        [{ products: [...fixtureSeason.products, { id: 'unused', name: 'Unverified' }] }, 'no verified rules'],
    ])('rejects contradictory dated terms (%j)', (fields, message) => {
        expect(() => readPassRules([{ ...fixtureSeason, ...fields }], [area('alta'), area('snowbird')])).toThrow(message);
    });

    it('keeps the latest product name when the source files arrive in either order', () => {
        const old = { ...fixtureSeason, season: '2025/26', seasonDates: ['2025-11-01', '2026-04-30'],
            products: [{ id: 'test-pass', name: 'Old name' }] };
        for (const files of [[fixtureSeason, old], [old, fixtureSeason]]) {
            const current = readPassRules(files, [area('alta')]).get('test-pass')!;
            expect(current.name).toBe('Current name');
            expect(evaluatePass(current, area('alta'), now, '2026-01-01').status).toBe('included');
        }
    });
});

const source = { name: 'Test operator', url: 'https://example.test/report', license: 'https://example.test/license', exportable: true };
const reportedAt = '2026-12-25T06:59:00Z';
const partial: ResortReport = {
    areaId: 'alta', source, status: 'limited', reportedAt, retrievedAt: '2026-12-25T07:19:00Z',
    trails: { open: 2, total: 4 }, lifts: { open: 0, total: 2 }, baseCm: [12, 17], snowfallCm: 0, snowfallHours: 24,
};

describe('ski-status conditions and CSV', () => {
    it('uses the source timestamp for freshness and retains the last report text', () => {
        const resort = area('alta');
        const conditions: Conditions = { reports: new Map([[resort.id, partial]]), forecasts: new Map(), now };
        const stale = { ...conditions, now: now + 1 };
        expect(reportAgeHours(partial, now)).toBe(24);
        expect(reportStatus(partial, now)).toBe('limited');
        expect(reportStatus(partial, stale.now)).toBe('unknown');
        expect(reportStatusText(partial, stale.now)).toBe('Limited (stale)');
        expect(reportAgeHours({ ...partial, reportedAt: undefined }, now)).toBeUndefined();
        expect(reportStatus({ ...partial, reportedAt: undefined }, now)).toBe('unknown');
        expect(markerAppearance(resort, 'operatingStatus', undefined, conditions).color)
            .toBe(markerLegend('operatingStatus', 'metric').find(entry => entry.label === 'Limited')?.color);
        expect(markerAppearance(resort, 'operatingStatus', undefined, stale).color)
            .toBe(markerAppearance(area('snowbird'), 'operatingStatus', undefined, stale).color);
        expect(formatSkiStat(resort, 'reportLifts', 'metric', conditions)).toBe('0 / 2');
        expect(formatSkiStat(resort, 'trailsOpenPct', 'metric', conditions)).toBe('50%');
        expect(formatSkiStat(resort, 'baseSnow', 'metric', conditions)).toBe('12–17 cm');
        expect(sortSkiAreas([area('snowbird'), resort], { key: 'reportLifts', direction: 'desc' }, conditions)[0]).toBe(resort);
    });

    it('exports licensed fields in row order with quotes, dates, units and source links', () => {
        const resort = { ...area('alta'), name: '=Test, "quoted"\nname' };
        const unavailable = area('snowbird');
        const conditions: Conditions = { reports: new Map([[resort.id, partial], [unavailable.id, {
            ...partial, source: { ...source, url: 'https://example.test/restricted', exportable: false },
        }]]), forecasts: new Map(), now };
        const csv = skiAreaCsv([unavailable, resort], ['name', 'acres', 'mappedLifts', 'measuredSnow'], 'metric', conditions);
        expect(csv).toContain('"\'=Test, ""quoted""\nname"');
        expect(csv).toContain('"0 cm · 24 h"');
        expect(csv).toContain(reportedAt);
        expect(csv).toContain('https://example.test/report');
        expect(csv).toContain('https://opendatacommons.org/licenses/odbl/1-0/');
        expect(csv).not.toContain('Skiable area');
        expect(csv).not.toContain('/restricted');
        expect(csv.indexOf('Snowbird')).toBeLessThan(csv.indexOf('quoted'));
        expect(visibleSkiColumns(['measuredSnow', 'obsolete']).map(({ key }) => key)).toEqual(['name', 'measuredSnow']);
    });

    it.each(['＝1', '  +1', '\u200b@name', '\nText'])('escapes the spreadsheet cell prefix in %j', name => {
        expect(skiAreaCsv([{ ...area('alta'), name }], ['name'], 'metric')).toContain(`"'${name}"`);
    });

    it('credits only the source of the exported values when sources use the same license', () => {
        const url = 'https://example.test/operator-stats';
        const resort: SkiArea = { ...area('alta'), statSources: [{
            source: url, fields: ['acres'], checkedOn: '2026-11-20', exportLicense: locationLicense,
        }] };
        const csv = skiAreaCsv([resort], ['name', 'acres'], 'imperial');
        expect(csv).toContain(url);
        expect(csv).toContain(locationLicense);
        expect(csv).not.toContain('OpenSkiData');
        expect(skiAreaCsv([], ['name', 'acres'], 'metric')).toMatch(/^"Ski area","Report time"/);
    });
});

describe('ski-status pilot sources', () => {
    it('keeps report times and measured snowfall separate and preserves reported zero counts', () => {
        const target = pilotAreas[0];
        const snapshot = { Items: [{
            RID: target.sourceId, LastUpdate: '0001-01-01T00:00:00', openskilift: '0', totalskilift: '48',
            openskislopes: '0', totalskislopes: '93', Measuringpoints: [{
                LastUpdate: '2026-12-24T11:00:00', Shortname: 'Talstation', SnowHeight: '0', newSnowHeight: '15',
                LastSnowDate: '2026-12-23T00:00:00', Source: 'lts',
            }, {
                LastUpdate: '2026-12-25T11:00:00', Shortname: 'Talstation', SnowHeight: '', newSnowHeight: '0x0',
                LastSnowDate: '2026-12-25T00:00:00', Source: 'lts',
            }],
        }] };
        expect(openDataHubReport(snapshot, target, source.url, reportedAt)).toMatchObject({
            status: 'unknown', lifts: { open: 0, total: 48 }, baseCm: 0, snowfallCm: 15, snowfallOn: '2026-12-23',
            snowReportedOn: '2026-12-24', reportedAt: undefined,
        });
        expect(() => openDataHubReport({ Items: [] }, target, source.url, reportedAt)).toThrow(/omitted/);
    });

    it('uses actual count denominators to distinguish full and partial operations', () => {
        const target = pilotAreas[0];
        const item = { RID: target.sourceId, LastUpdate: '2026-12-25T05:59:00Z', openskilift: '2', totalskilift: '2',
            openskislopes: '3', totalskislopes: '3' };
        function read(fields = {}) {
            return openDataHubReport({ Items: [{ ...item, ...fields }] }, target, source.url, reportedAt);
        }
        expect(read()).toMatchObject({ status: 'open', reportedAt: item.LastUpdate });
        expect(read({ totalskislopes: '10' }).status).toBe('limited');
        expect(read({ openskilift: '0x1', LastUpdate: '2026-12-25 invalid' })).toMatchObject({
            status: 'unknown', reportedOn: undefined, lifts: { total: 2, open: undefined },
        });
        expect(read({ totalskislopes: null }).status).toBe('unknown');
        expect(() => read({ openskilift: '', totalskilift: null, openskislopes: null, totalskislopes: null })).toThrow(/no measurements/);
        expect(() => openDataHubReport({ Items: [item, item] }, target, source.url, reportedAt)).toThrow(/duplicate reports/);
    });

    function hourlyForecast() {
        const start = Date.parse('2026-12-26T00:00:00Z');
        return {
            utc_offset_seconds: 0, elevation: 1500,
            hourly_units: { temperature_2m: '°C', precipitation_probability: '%', snowfall: 'cm' },
            hourly: {
                time: Array.from({ length: 25 }, (_, index) => new Date(start + index * 3_600_000).toISOString().slice(0, 16)),
                temperature_2m: Array(25).fill(-4), precipitation_probability: Array(25).fill(0), snowfall: Array<number | null>(25).fill(0),
            },
        };
    }

    const startsAt = '2026-12-26T00:00:00Z';

    it('sums complete forecast hours and leaves missing forecast snow unknown', () => {
        const meteo = hourlyForecast();
        meteo.hourly.snowfall[0] = 20;
        expect(openMeteoForecast(meteo, pilotAreas[0], source.url, startsAt))
            .toMatchObject({ snowfallCm: 0, temperatureC: -4, precipitationPct: 0, endsAt: '2026-12-27T00:00:00.000Z' });
        meteo.hourly.snowfall[3] = null;
        expect(openMeteoForecast(meteo, pilotAreas[0], source.url, startsAt).snowfallCm).toBeUndefined();
    });

    it('rejects impossible, missing, or unmatched forecast hours', () => {
        const meteo = hourlyForecast();
        const read = () => openMeteoForecast(meteo, pilotAreas[0], source.url, startsAt);
        meteo.hourly.time[5] = '2026-11-31T05:00';
        expect(read).toThrow();
        meteo.hourly.time[5] = '2026-12-26T06:00';
        expect(read).toThrow('24 consecutive hours');
        meteo.hourly.time[5] = '2026-12-26T05:00';
        meteo.hourly.precipitation_probability.pop();
        expect(read).toThrow('hourly values must match');
    });
});
