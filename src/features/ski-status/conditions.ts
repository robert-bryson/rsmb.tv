import { z } from 'zod';
import { skiAreas, type SkiArea } from './catalog';
import { localSkiDate } from './localSkiDate';
import { httpsUrl, isoTime, sha256, skiId } from './schemas';

const source = z.strictObject({ name: z.string().min(1), url: httpsUrl, license: httpsUrl.optional(), exportable: z.boolean() })
    .refine(({ exportable, license }) => !exportable || license, 'Exportable data needs a license');
const amount = z.number().nonnegative();
const count = z.int().nonnegative();
const percentage = amount.max(100);
const range = z.tuple([amount, amount]).refine(([min, max]) => min <= max);
const depth = z.union([amount, range]);
const opening = <T extends typeof amount | typeof count>(value: T) => z.strictObject({ open: value.optional(), total: value.optional() })
    .refine(({ open, total }) => open !== undefined || total !== undefined)
    .refine(({ open, total }) => open === undefined || total === undefined || open <= total);

export const statusLabels = {
    open: 'Open', limited: 'Limited', 'temporarily-closed': 'Temporarily closed',
    'season-closed': 'Season closed', unknown: 'Unknown',
} as const;

const terrainItem = z.strictObject({
    id: z.string().min(1), name: z.string().trim().min(1), kind: z.enum(['lift', 'trail']),
    status: z.enum(['open', 'closed', 'on-hold', 'scheduled', 'unknown']),
    updatedAt: isoTime.optional(),
});
const terrainReport = z.strictObject({
    source: source.optional(),
    retrievedAt: isoTime.optional(),
    items: z.array(terrainItem).min(1).refine(items => new Set(items.map(({ id }) => id)).size === items.length, 'Use unique terrain IDs'),
});
const areaTimeZones = new Map(skiAreas.map(area => [area.id, area.location.timeZone]));

const operationSchema = z.strictObject({
    areaId: skiId, source, retrievedAt: isoTime, reportedAt: isoTime.optional(), reportedOn: z.iso.date().optional(),
    status: z.enum(Object.keys(statusLabels) as (keyof typeof statusLabels)[]),
    freshHours: z.number().positive().max(168).optional(), validThrough: isoTime.optional(),
    lifts: opening(count).optional(), trails: opening(count).optional(), acres: opening(amount).optional(),
    baseCm: depth.optional(), snowfallCm: depth.optional(), snowfallHours: z.number().positive().optional(),
    snowfallOn: z.iso.date().optional(), snowReportedOn: z.iso.date().optional(),
    snowLocation: z.string().min(1).optional(), nightOpen: z.boolean().optional(),
    temperature: z.strictObject({ valueC: z.number(), measuredAt: isoTime, location: z.string().min(1) }).optional(),
    opensOn: z.iso.date().optional(), closedOn: z.iso.date().optional(), hours: z.string().min(1).optional(),
    terrain: terrainReport.optional(),
}).refine(({ reportedAt, retrievedAt }) => !reportedAt || Date.parse(reportedAt) <= Date.parse(retrievedAt))
    .refine(({ areaId, validThrough, reportedAt, reportedOn, retrievedAt }) => {
        if (!validThrough) return true;
        const deadline = Date.parse(validThrough);
        if (reportedAt) return Date.parse(reportedAt) <= deadline;
        const retrieved = Date.parse(retrievedAt);
        if (reportedOn !== validThrough.slice(0, 10) || !(retrieved <= deadline)) return false;
        const timeZone = areaTimeZones.get(areaId);
        if (timeZone) return localSkiDate(retrieved, timeZone) === reportedOn;
        const offset = validThrough.endsWith('Z') ? 'Z' : validThrough.slice(-6);
        return Date.parse(`${reportedOn}T00:00:00${offset}`) <= retrieved;
    }, 'Use a known report time or a matching local ski day')
    .refine(({ terrain, retrievedAt }) => !terrain?.items.some(item =>
        item.updatedAt && Date.parse(item.updatedAt) > Date.parse(terrain.retrievedAt ?? retrievedAt)))
    .refine(({ temperature, retrievedAt }) => !temperature || Date.parse(temperature.measuredAt) <= Date.parse(retrievedAt))
    .refine(({ snowfallCm, snowfallHours, snowfallOn }) =>
        (snowfallCm !== undefined) === (snowfallHours !== undefined || snowfallOn !== undefined));

const forecastSchema = z.strictObject({
    areaId: skiId, source, retrievedAt: isoTime, issuedAt: isoTime.optional(),
    startsAt: isoTime, endsAt: isoTime, location: z.string().min(1), elevationM: z.number().optional(),
    temperatureC: z.number().optional(), snowfallCm: amount.optional(), precipitationPct: percentage.optional(),
    description: z.string().min(1).optional(),
}).refine(({ startsAt, endsAt, issuedAt, retrievedAt }) => Date.parse(startsAt) < Date.parse(endsAt) &&
    Date.parse(retrievedAt) < Date.parse(endsAt) &&
    (!issuedAt || Date.parse(issuedAt) <= Date.parse(retrievedAt)))
    .refine(({ temperatureC, snowfallCm, precipitationPct, description }) =>
        temperatureC !== undefined || snowfallCm !== undefined || precipitationPct !== undefined || description !== undefined);

function uniqueAreas<T extends { areaId: string }>(rows: T[]) {
    return new Set(rows.map(row => row.areaId)).size === rows.length;
}

export const reportSnapshotSchema = z.strictObject({
    version: z.literal(1), generatedAt: isoTime, reports: z.array(operationSchema).refine(uniqueAreas),
}).refine(({ generatedAt, reports }) => reports.every(report =>
    [report.retrievedAt, report.terrain?.retrievedAt].every(time => !time || Date.parse(time) <= Date.parse(generatedAt))),
    'Report retrieval must precede snapshot publication');
export const forecastSnapshotSchema = z.strictObject({
    version: z.literal(1), generatedAt: isoTime, forecasts: z.array(forecastSchema).refine(uniqueAreas),
}).refine(({ generatedAt, forecasts }) => forecasts.every(forecast => Date.parse(forecast.retrievedAt) <= Date.parse(generatedAt)),
    'Forecast retrieval must precede snapshot publication');

export const conditionsManifestSchema = z.strictObject({
    version: z.literal(1), updatedAt: isoTime, catalogRevision: sha256,
    reports: z.string().regex(/^reports-[a-f0-9]{64}\.json$/).optional(),
    forecasts: z.string().regex(/^forecasts-[a-f0-9]{64}\.json$/).optional(),
    previousManifest: z.string().regex(/^manifest-[a-f0-9]{64}\.json$/).optional(),
    coverage: z.strictObject({
        areas: count, reports: count, recentReports: count, reportAgesHours: z.record(skiId, amount),
        reportFields: z.record(z.string(), count), forecasts: count,
    }).optional(),
}).refine(({ reports, forecasts }) => reports !== undefined || forecasts !== undefined, 'Include at least one conditions snapshot');

export type ResortReport = z.infer<typeof operationSchema>;
export type BaseForecast = z.infer<typeof forecastSchema>;
export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
export type ForecastSnapshot = z.infer<typeof forecastSnapshotSchema>;
export type ConditionsManifest = z.infer<typeof conditionsManifestSchema>;
export type Conditions = { reports: ReadonlyMap<string, ResortReport>; forecasts: ReadonlyMap<string, BaseForecast>; now: number };
export type ResortStatus = ResortReport['status'];

export function conditionsFileDigest(file: string) {
    return /-([a-f0-9]{64})\.json$/.exec(file)?.[1];
}

const hour = 3_600_000;
const freshHours = 24;

export const statusFilterLabels = { open: 'Open for skiing', closed: 'Closed', unknown: 'Status unknown' } as const;
export type StatusFilter = keyof typeof statusFilterLabels;

export function readStatusFilter(value: string | null): StatusFilter | undefined {
    return value === 'open' || value === 'closed' || value === 'unknown' ? value : undefined;
}

export function reportAgeHours(report: ResortReport | undefined, now: number) {
    if (!report?.reportedAt) return undefined;
    const age = (now - Date.parse(report.reportedAt)) / hour;
    return age >= 0 ? age : undefined;
}

export function reportStatus(report: ResortReport | undefined, now: number): ResortStatus {
    return report && isFreshReport(report, now) ? report.status : 'unknown';
}

export function isFreshReport(report: ResortReport, now: number) {
    if (report.validThrough && now > Date.parse(report.validThrough)) return false;
    const age = reportAgeHours(report, now);
    if (age !== undefined) return age <= (report.freshHours ?? freshHours);
    return !report.reportedAt && Boolean(report.reportedOn && report.validThrough) && Date.parse(report.retrievedAt) <= now;
}

function operationsTime(report: ResortReport) {
    if (report.reportedAt) return Date.parse(report.reportedAt);
    if (report.reportedOn) return Date.parse(report.validThrough ? report.retrievedAt : report.reportedOn);
}

function selectOperations(previous: ResortReport, next: ResortReport, now: number) {
    const wasCurrent = reportStatus(previous, now) !== 'unknown';
    const isCurrent = reportStatus(next, now) !== 'unknown';
    if (wasCurrent !== isCurrent) return isCurrent ? next : previous;
    const previousTime = operationsTime(previous);
    const nextTime = operationsTime(next);
    if (previousTime !== undefined && nextTime !== undefined && previousTime !== nextTime) {
        return nextTime > previousTime ? next : previous;
    }
    return Date.parse(next.retrievedAt) >= Date.parse(previous.retrievedAt) ? next : previous;
}

export function mergeResortReports(previous: ResortReport, next: ResortReport, now: number) {
    const report = selectOperations(previous, next, now);
    const other = report === previous ? next : previous;
    const terrain = other.terrain;
    if (!terrain?.source || terrain.items.some(item => !item.updatedAt)) return report;
    const retrievedAt = terrain.retrievedAt ?? other.retrievedAt;
    if (report.terrain && (report.terrain.source?.url !== terrain.source.url ||
        Date.parse(report.terrain.retrievedAt ?? report.retrievedAt) >= Date.parse(retrievedAt))) return report;
    return { ...report, terrain: { ...terrain, retrievedAt } };
}

export function reportAgeLabel(report: ResortReport, now: number) {
    if (isFreshReport(report, now)) return;
    const hasReportTime = report.reportedAt ? Date.parse(report.reportedAt) <= now
        : report.reportedOn && report.validThrough && Date.parse(report.retrievedAt) <= now;
    return hasReportTime ? 'stale' : 'age unknown';
}

export function matchesOperatingStatus(report: ResortReport | undefined, now: number, filter: StatusFilter) {
    const status = reportStatus(report, now);
    if (filter === 'open') return status === 'open' || status === 'limited';
    if (filter === 'closed') return status === 'temporarily-closed' || status === 'season-closed';
    return status === 'unknown';
}

export function reportStatusText(report: ResortReport | undefined, now: number) {
    if (!report) return undefined;
    if (report.status === 'unknown') return statusLabels.unknown;
    const age = reportAgeLabel(report, now);
    const label = statusLabels[report.status];
    return age ? `${label} (${age})` : label;
}

export function terrainStatusText(item: z.infer<typeof terrainItem>, report: ResortReport, now: number) {
    if (item.status === 'unknown') return 'Unknown';
    const labels = { open: 'Open', closed: 'Closed', 'on-hold': 'On hold', scheduled: 'Scheduled' } as const;
    const label = labels[item.status];
    if (item.updatedAt) {
        const age = now - Date.parse(item.updatedAt);
        return age < 0 || age > freshHours * hour ? `${label} (record stale)` : label;
    }
    const age = reportAgeLabel(report, now);
    return age ? `${label} (${age})` : label;
}

export function areaForecast(conditions: Conditions | undefined, areaId: string) {
    const forecast = conditions?.forecasts.get(areaId);
    return forecast && conditions && Date.parse(forecast.endsAt) > conditions.now ? forecast : undefined;
}

export function localReportTime(value: string, area: SkiArea) {
    return new Intl.DateTimeFormat('en', {
        timeZone: area.location.timeZone ?? 'UTC', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(value));
}

export function openPercent(values: ResortReport['trails']) {
    return values?.open !== undefined && values.total ? values.open / values.total * 100 : undefined;
}
