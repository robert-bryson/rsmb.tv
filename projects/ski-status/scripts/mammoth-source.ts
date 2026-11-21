import type { Element } from '@xmldom/xmldom';
import { reportSnapshotSchema, type ResortReport } from '../../../src/features/ski-status/conditions.ts';
import { localSkiDate } from '../../../src/features/ski-status/localSkiDate.ts';
import { isoTime } from '../../../src/features/ski-status/schemas.ts';
import resortBases from '../data/resort-bases.json' with { type: 'json' };
import { conditionsXmlNumber, conditionsXmlRoot, fetchConditionsXml } from './conditions-xml.ts';

const feedUrl = 'https://reportpal-cdn.resorts-interactive.com/mtnxml/525';
const reportUrl = 'https://www.mammothmountain.com/on-the-mountain/mountain-report#lifts-and-trails';
const resort = 'Mammoth Mountain';
const timeZone = 'America/Los_Angeles';
const mainLodge = resortBases.bases['mammoth-mountain'];
export const mammothBase = {
    areaId: 'mammoth-mountain', location: mainLodge.name, latitude: mainLodge.coordinates[1], longitude: mainLodge.coordinates[0],
} as const;

type TerrainItem = NonNullable<ResortReport['terrain']>['items'][number];
const winterAreas = ['Main Lodge', 'Canyon Lodge', 'Eagle Lodge'];
const kinds = ['lift', 'trail'] as const;
const statuses: ReadonlyMap<string, TerrainItem['status']> = new Map([
    ['open', 'open'], ['closed', 'closed'], ['on hold', 'on-hold'], ['delayed', 'on-hold'],
    ['scheduled', 'scheduled'], ['expected', 'scheduled'],
]);
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function children(element: Element | undefined, tag: string) {
    return Array.from(element?.children ?? []).filter(child => child.tagName === tag);
}

function attribute(element: Element, name: string) {
    const value = element.getAttribute(name)?.trim();
    return value && !/^(?:--|n\/a)$/i.test(value) ? value : undefined;
}

function flag(element: Element, name: string) {
    const value = attribute(element, name)?.toLowerCase();
    if (value === 'yes') return true;
    if (value === 'no') return false;
}

function alpineInventory(root: Element) {
    const [facilities] = children(root, 'facilities');
    const [areas] = children(facilities, 'areas');
    const groups = children(areas, 'area');
    return winterAreas.flatMap(area => {
        const matches = groups.filter(group => attribute(group, 'name') === area);
        if (matches.length !== 1) throw Error(`Expected one Mammoth terrain group for ${area}`);
        const [group] = matches;
        return kinds.flatMap(kind => {
            const [list] = children(group, `${kind}s`);
            if (!list) throw Error(`Mammoth omitted the ${area} ${kind} inventory`);
            return children(list, kind).map((feature): TerrainItem => {
                const name = attribute(feature, 'name');
                if (!name) throw Error(`Mammoth omitted a ${kind} name in ${area}`);
                const status = statuses.get(attribute(feature, 'status')?.toLowerCase() ?? '') ?? 'unknown';
                const item = { id: `${kind}:${area}:${name}`, name, kind, area, status };
                return kind === 'lift' ? { ...item, liftType: attribute(feature, 'type') } : {
                    ...item, difficulty: attribute(feature, 'difficulty'),
                    groomed: flag(feature, 'groomed'), snowmaking: flag(feature, 'snowMaking'),
                };
            });
        });
    });
}

function openCounts(items: TerrainItem[], kind: TerrainItem['kind']) {
    const inventory = items.filter(item => item.kind === kind);
    if (!inventory.length) throw Error(`Mammoth omitted its alpine ${kind} inventory`);
    return {
        open: inventory.some(item => item.status === 'unknown') ? undefined : inventory.filter(item => item.status === 'open').length,
        total: inventory.length,
    };
}

function snowDepth(element: Element, name: string): ResortReport['baseCm'] {
    const parts = attribute(element, name)?.split(/\s*[-–]\s*/u);
    if (!parts || parts.length > 2) return;
    const [first, second] = parts.map(part => conditionsXmlNumber(part));
    if (first === undefined || (parts.length === 2 && (second === undefined || second < first))) return;
    const toCm = (inches: number) => Math.round(inches * 254) / 100;
    return second === undefined ? toCm(first) : [toCm(first), toCm(second)];
}

function locationSnow(root: Element) {
    const [conditions] = children(root, 'currentConditions');
    const [locations] = children(conditions, 'resortLocations');
    return children(locations, 'location').flatMap(element => {
        const location = attribute(element, 'name');
        if (!location) return [];
        const values = {
            baseCm: snowDepth(element, 'base'), surface: attribute(element, 'primarySurface'),
            overnightCm: snowDepth(element, 'snowOverNight'), snow24HoursCm: snowDepth(element, 'snow24Hours'),
            snow48HoursCm: snowDepth(element, 'snow48Hours'), snow72HoursCm: snowDepth(element, 'snow72Hours'),
            snow7DaysCm: snowDepth(element, 'snow7Days'), seasonTotalCm: snowDepth(element, 'snowSeasonTotal'),
        };
        return Object.values(values).some(value => value !== undefined) ? [{ location, ...values }] : [];
    });
}

function forecastDays(root: Element, reportedOn: string) {
    const [forecast] = children(root, 'forecast');
    const celsius = (day: Element, field: string) => {
        const fahrenheit = conditionsXmlNumber(day.getAttribute(field), -Infinity);
        return fahrenheit === undefined ? undefined : Math.round((fahrenheit - 32) * 500 / 9) / 100;
    };
    return children(forecast, 'day').flatMap((day, index) => {
        const date = new Date(`${reportedOn}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + index);
        const name = attribute(day, 'name')?.toLowerCase();
        if (name !== weekdays[date.getUTCDay()] && !(index === 0 && name === 'today') && !(index === 1 && name === 'tomorrow')) return [];
        const highC = celsius(day, 'high');
        const lowC = celsius(day, 'low');
        const description = attribute(day, 'weather');
        const temperature = highC !== undefined && lowC !== undefined && highC < lowC ? {} : { highC, lowC };
        return (temperature.highC !== undefined || temperature.lowC !== undefined || description)
            ? [{ date: date.toISOString().slice(0, 10), ...temperature, description }] : [];
    });
}

export function mammothReport(xml: string, retrievedAt: string) {
    const root = conditionsXmlRoot(xml, resort);
    if (root?.tagName !== 'report' || attribute(root, 'name') !== resort || attribute(root, 'units') !== 'USC') {
        throw Error('Expected a Mammoth Mountain report in US customary units');
    }
    const reportedAt = isoTime.parse(attribute(root, 'updated')?.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    const reportedOn = localSkiDate(Date.parse(reportedAt), timeZone);
    const items = alpineInventory(root);
    const lifts = openCounts(items, 'lift');
    const trails = openCounts(items, 'trail');
    const status = lifts.open && trails.open
        ? lifts.open === lifts.total && trails.open === trails.total ? 'open' : 'limited'
        : 'unknown';
    const snow = locationSnow(root);
    const base = snow.find(location => location.location === 'Base');
    const baseCm = base?.baseCm;
    const snowfallCm = base?.snow24HoursCm;
    const forecast = forecastDays(root, reportedOn);
    const { reports: [report] } = reportSnapshotSchema.parse({
        version: 1, generatedAt: retrievedAt,
        reports: [{
            areaId: mammothBase.areaId, source: { name: resort, url: reportUrl, exportable: false },
            retrievedAt, reportedAt, reportedOn, status, lifts, trails, terrain: { items },
            baseCm, snowfallCm, snowfallHours: snowfallCm === undefined ? undefined : 24,
            snowLocation: baseCm !== undefined || snowfallCm !== undefined ? base?.location : undefined,
            snowByLocation: snow.length ? snow : undefined, forecastDays: forecast.length ? forecast : undefined,
        }],
    });
    return report;
}

export async function fetchMammothReport() {
    const { xml, retrievedAt } = await fetchConditionsXml(feedUrl, resort);
    return mammothReport(xml, retrievedAt);
}
