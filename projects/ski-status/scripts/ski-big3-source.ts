import { reportSnapshotSchema, type ResortReport } from '../../../src/features/ski-status/conditions.ts';
import { conditionsXmlRoot, fetchConditionsXml } from './conditions-xml.ts';

export const skiBig3Areas = [
    { areaId: 'banff-sunshine', name: 'Banff Sunshine', feed: 'https://xml.skibanff.com/',
        reportUrl: 'https://www.skibanff.com/the-mountain/mountain-report/current-conditions', location: 'Banff Sunshine ski area',
        latitude: 51.08739, longitude: -115.770014 },
    { areaId: 'mt-norquay', name: 'Mt. Norquay', feed: 'https://banffnorquay.com/xml/',
        reportUrl: 'https://banffnorquay.com/conditions/', location: 'Mt. Norquay ski area', latitude: 51.198172, longitude: -115.598973 },
] as const;

type SkiBig3Area = typeof skiBig3Areas[number];
const timeZone = 'America/Edmonton';
const mountainTime = new Intl.DateTimeFormat('en-CA', { timeZone, timeZoneName: 'longOffset' });
const wallClock = new Intl.DateTimeFormat('sv-SE', { timeZone, dateStyle: 'short', timeStyle: 'medium' });
const day = 86_400_000;

function reportedTime(value: string | undefined) {
    if (!value || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return;
    const local = value.replace(' ', 'T');
    const nominal = Date.parse(`${local}Z`);
    if (!Number.isFinite(nominal)) return;
    // Check both sides of a possible offset change. A repeated wall time has two matches.
    const offsets = new Set([nominal - day, nominal + day].map(instant =>
        mountainTime.formatToParts(instant).find(part => part.type === 'timeZoneName')?.value.slice(3)));
    const matches = Array.from(offsets, offset => `${local}${offset}`).filter(candidate => {
        const instant = Date.parse(candidate);
        return Number.isFinite(instant) && wallClock.format(instant) === value;
    });
    return matches.length === 1 ? matches[0] : undefined;
}

export function skiBig3Report(xml: string, area: SkiBig3Area, retrievedAt: string): ResortReport {
    const root = conditionsXmlRoot(xml, area.name);
    if (root?.tagName !== 'conditions') throw Error(`${area.name} XML omitted conditions`);
    const field = (tag: string) => {
        const fields = Array.from(root.getElementsByTagName(tag)).filter(element => element.parentNode === root);
        if (fields.length === 1 && !fields[0].getElementsByTagName('*').length) return fields[0].textContent?.trim();
    };
    const number = (tag: string) => {
        const value = field(tag);
        return value && /^\d{1,5}$/.test(value) ? Number(value) : undefined;
    };
    const totals = (name: string) => {
        const open = number(`${name}-open`);
        const total = number(`${name}-total`);
        if (open === undefined || total === undefined || open > total || !total) throw Error(`${area.name} omitted verified ${name} counts`);
        return { open, total };
    };
    const reportedAt = reportedTime(field('last_updated'));
    if (!reportedAt || Date.parse(reportedAt) > Date.parse(retrievedAt)) throw Error(`${area.name} XML needs a valid local report time`);
    const lifts = totals('lifts');
    const trails = totals('runs');
    // Counts establish skiing when both kinds of terrain are open. Zero counts alone cannot establish a closure.
    const status = lifts.open > 0 && trails.open > 0 ? lifts.open === lifts.total && trails.open === trails.total ? 'open' : 'limited' : 'unknown';
    const { reports: [report] } = reportSnapshotSchema.parse({
        version: 1, generatedAt: retrievedAt,
        reports: [{ areaId: area.areaId, source: { name: area.name, url: area.reportUrl, exportable: false },
            retrievedAt, reportedAt, status, lifts, trails }],
    });
    return report;
}

export async function fetchSkiBig3Report(area: SkiBig3Area) {
    const { xml, retrievedAt } = await fetchConditionsXml(area.feed, area.name);
    return skiBig3Report(xml, area, retrievedAt);
}
