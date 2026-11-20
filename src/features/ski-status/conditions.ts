import { z } from 'zod';
import type { SkiArea } from './catalog';
import { httpsUrl, isoTime, sha256, skiId } from './schemas';

const source = z.strictObject({ name: z.string().min(1), url: httpsUrl, license: httpsUrl, exportable: z.boolean() });
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

const operationSchema = z.strictObject({
    areaId: skiId, source, retrievedAt: isoTime, reportedAt: isoTime.optional(), reportedOn: z.iso.date().optional(),
    status: z.enum(Object.keys(statusLabels) as (keyof typeof statusLabels)[]),
    freshHours: z.number().positive().max(168).optional(),
    lifts: opening(count).optional(), trails: opening(count).optional(), acres: opening(amount).optional(),
    baseCm: depth.optional(), snowfallCm: depth.optional(), snowfallHours: z.number().positive().optional(),
    snowfallOn: z.iso.date().optional(), snowReportedOn: z.iso.date().optional(),
    snowLocation: z.string().min(1).optional(), nightOpen: z.boolean().optional(),
    opensOn: z.iso.date().optional(), closedOn: z.iso.date().optional(), hours: z.string().min(1).optional(),
}).refine(({ reportedAt, retrievedAt }) => !reportedAt || Date.parse(reportedAt) <= Date.parse(retrievedAt))
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
}).refine(({ generatedAt, reports }) => reports.every(report => Date.parse(report.retrievedAt) <= Date.parse(generatedAt)),
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

export function reportAgeHours(report: ResortReport | undefined, now: number) {
    if (!report?.reportedAt) return undefined;
    const age = (now - Date.parse(report.reportedAt)) / hour;
    return age >= 0 ? age : undefined;
}

export function reportStatus(report: ResortReport | undefined, now: number): ResortStatus {
    const age = reportAgeHours(report, now);
    return report && age !== undefined && age <= (report.freshHours ?? 24) ? report.status : 'unknown';
}

export function reportStatusText(report: ResortReport | undefined, now: number) {
    if (!report) return undefined;
    if (report.status === 'unknown') return statusLabels.unknown;
    const age = reportAgeHours(report, now);
    if (age === undefined) return `${statusLabels[report.status]} (age unknown)`;
    if (age > (report.freshHours ?? 24)) return `${statusLabels[report.status]} (stale)`;
    return statusLabels[report.status];
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
