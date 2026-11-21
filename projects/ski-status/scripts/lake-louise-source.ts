import { reportSnapshotSchema, type ResortReport } from '../../../src/features/ski-status/conditions.ts';
import { isoTime } from '../../../src/features/ski-status/schemas.ts';
import { conditionsXmlNumber, conditionsXmlRoot, fetchConditionsXml } from './conditions-xml.ts';

const feedUrl = 'https://lamp10.skilouise.com/app/mtnxml.php';
const reportUrl = 'https://www.skilouise.com/snow-conditions/';
export const lakeLouiseBase = { areaId: 'lake-louise', location: 'Lake Louise base', latitude: 51.44172, longitude: -116.16257 } as const;

type TerrainItem = NonNullable<ResortReport['terrain']>['items'][number];
const statuses: ReadonlyMap<string, TerrainItem['status']> = new Map([
    ['open', 'open'], ['closed', 'closed'], ['on hold', 'on-hold'], ['scheduled', 'scheduled'],
]);

export function lakeLouiseReport(xml: string, retrievedAt: string) {
    const root = conditionsXmlRoot(xml, 'Lake Louise');
    if (root?.tagName !== 'report' || root.getAttribute('name') !== 'The Lake Louise Ski Resort' || root.getAttribute('units') !== 'metric') {
        throw Error('Expected a metric Lake Louise resort report');
    }
    const generatedAt = isoTime.parse(root.getAttribute('updated'));
    const offset = /[+-]\d{2}:\d{2}$/.exec(generatedAt)?.[0];
    if (!offset || Date.parse(generatedAt) > Date.parse(retrievedAt)) throw Error('Lake Louise XML needs a valid local generation time');
    const reportDay = generatedAt.slice(0, 10);
    const endOfDay = `${reportDay}T23:59:59.999${offset}`;
    const operations = root.getElementsByTagName('operations').item(0);
    const conditions = root.getElementsByTagName('currentConditions').item(0);
    const counts = conditions?.getElementsByTagName('liftsAndRuns').item(0);
    const areas = root.getElementsByTagName('facilities').item(0)?.getElementsByTagName('areas').item(0);
    const resortStatus = operations?.getAttribute('resortStatus')?.trim().toLowerCase();
    if (!resortStatus || !conditions || !counts || !areas) throw Error('Lake Louise omitted resort operations');

    const items: TerrainItem[] = [];
    const inventory = (kind: TerrainItem['kind'], countName: string) => {
        const open = conditionsXmlNumber(counts.getAttribute(countName));
        const features = Array.from(areas.getElementsByTagName(kind));
        if (open === undefined || !features.length) throw Error(`Lake Louise omitted ${kind} counts or names`);
        const numberOpen = features.reduce((sum, feature) => {
            const id = feature.getAttribute('id')?.trim();
            const name = feature.getAttribute('name')?.trim();
            if (!id || !name) throw Error(`Lake Louise omitted a ${kind} ID or name`);
            const flag = feature.getAttribute('status')?.trim().toLowerCase();
            const status = statuses.get(flag ?? '') ?? 'unknown';
            items.push({ id: `${kind}:${id}`, name, kind, status });
            return sum + Number(status === 'open');
        }, 0);
        if (numberOpen !== open) throw Error(`Lake Louise ${kind} count does not match the named inventory`);
        return { open, total: features.length };
    };
    const lifts = inventory('lift', 'lifts');
    const trails = inventory('trail', 'runs');

    const mountain = Array.from(conditions.getElementsByTagName('location')).find(location => location.getAttribute('name') === 'Upper Mountain');
    const snowTime = isoTime.safeParse(conditions.getElementsByTagName('resortwide').item(0)?.getAttribute('lastSnowfallUpdate')).data;
    const snowUpdatedAt = snowTime ? Date.parse(snowTime) : NaN;
    const snowReportedOn = snowUpdatedAt <= Date.parse(generatedAt) ? snowTime?.slice(0, 10) : undefined;
    const baseCm = snowReportedOn ? conditionsXmlNumber(mountain?.getAttribute('base')) : undefined;
    const snowfallCm = snowReportedOn ? conditionsXmlNumber(mountain?.getAttribute('snow24Hours')) : undefined;
    const temperatureTime = isoTime.safeParse(mountain?.getAttribute('weatherTimestamp')).data;
    const valueC = conditionsXmlNumber(mountain?.getAttribute('temperature'), -Infinity);
    const temperature = valueC !== undefined && temperatureTime && Date.parse(temperatureTime) <= Date.parse(retrievedAt) ?
        { valueC, measuredAt: temperatureTime, location: mountain?.getAttribute('stationName')?.trim() || 'Upper Mountain' } : undefined;

    const seasonClosed = resortStatus === 'closed for the season' || resortStatus === 'closed for season';
    // The provider generates the root timestamp per request. Use the dated daily report to confirm the ski day.
    const snowUpdatedToday = snowReportedOn && snowUpdatedAt >= Date.parse(`${reportDay}T00:00:00${offset}`);
    const confirmedDay = Date.parse(retrievedAt) <= Date.parse(endOfDay) && (seasonClosed || snowUpdatedToday);
    let status: ResortReport['status'] = 'unknown';
    if (confirmedDay) {
        if (resortStatus === 'open' && lifts.open && trails.open) {
            status = lifts.open === lifts.total && trails.open === trails.total ? 'open' : 'limited';
        } else if (!lifts.open && !trails.open && (seasonClosed || resortStatus === 'closed')) {
            status = seasonClosed ? 'season-closed' : 'temporarily-closed';
        }
    }
    const reportedOn = status === 'unknown' ? undefined : reportDay;
    const { reports: [report] } = reportSnapshotSchema.parse({
        version: 1, generatedAt: retrievedAt,
        reports: [{
            areaId: lakeLouiseBase.areaId, source: { name: 'Lake Louise Ski Resort', url: reportUrl, exportable: false },
            retrievedAt, reportedOn, validThrough: reportedOn ? endOfDay : undefined,
            status, lifts, trails, terrain: { items }, baseCm, snowfallCm, snowfallHours: snowfallCm === undefined ? undefined : 24,
            snowReportedOn, snowLocation: baseCm !== undefined || snowfallCm !== undefined ? 'Upper Mountain' : undefined, temperature,
        }],
    });
    return report;
}

export async function fetchLakeLouiseReport() {
    const { xml, retrievedAt } = await fetchConditionsXml(feedUrl, 'Lake Louise');
    return lakeLouiseReport(xml, retrievedAt);
}
