import { createHash } from 'node:crypto';
import {
    conditionsFileDigest, conditionsManifestSchema, forecastSnapshotSchema, reportAgeHours, reportSnapshotSchema,
    type BaseForecast, type ResortReport,
} from '../../../src/features/ski-status/conditions.ts';
import { manifestName, type ConditionsStore } from './conditions-store.ts';

type PilotArea = { areaId: string };
type PublicationOptions<T extends PilotArea> = {
    areas: readonly T[];
    catalogRevision: string;
    refreshForecasts: boolean;
    fetchReport: (area: T) => Promise<ResortReport>;
    fetchForecast: (area: T) => Promise<BaseForecast>;
    warn: (message: string) => void;
    now?: () => number;
};

const serialize = (data: unknown) => Buffer.from(`${JSON.stringify(data, null, 2)}\n`);
export const digest = (body: Buffer) => createHash('sha256').update(body).digest('hex');
const decode = (body: Buffer): unknown => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));

async function readSnapshot<T extends { generatedAt: string }>(
    store: ConditionsStore, file: string | undefined, updatedAt: string | undefined, parse: (value: unknown) => T, warn: (message: string) => void,
) {
    if (!file || !updatedAt) return;
    const object = await store.read(file);
    try {
        if (!object || digest(object.body) !== conditionsFileDigest(file)) throw Error('Invalid checksum or missing snapshot');
        const data = parse(decode(object.body));
        if (Date.parse(data.generatedAt) > Date.parse(updatedAt)) throw Error('Snapshot is newer than its manifest');
        return { file, data };
    } catch (error) {
        warn(`${file}: ${String(error)}`);
    }
}

async function updateRows<T extends PilotArea, Row extends PilotArea>(
    areas: readonly T[], previous: Row[], fetchRow: (area: T) => Promise<Row>, warn: (message: string) => void,
) {
    const lookup = new Set(areas.map(area => area.areaId));
    const rows = new Map(previous.filter(row => lookup.has(row.areaId)).map(row => [row.areaId, row]));
    const results = await Promise.allSettled(areas.map(area => fetchRow(area)));
    let received = 0;
    for (const [index, result] of results.entries()) {
        const { areaId } = areas[index];
        if (result.status === 'rejected') {
            warn(`${areaId}: ${String(result.reason)}`);
        } else if (result.value.areaId === areaId) {
            rows.set(areaId, result.value);
            received++;
        } else {
            warn(`${areaId}: Provider returned ${result.value.areaId}`);
        }
    }
    return { rows: [...rows.values()].sort((first, second) => first.areaId.localeCompare(second.areaId)), received };
}

async function writeVersion(store: ConditionsStore, prefix: string, body: Buffer) {
    const file = `${prefix}-${digest(body)}.json`;
    await store.write(file, body);
    return file;
}

const reportFields: (keyof ResortReport)[] = ['status', 'lifts', 'trails', 'acres', 'baseCm', 'snowfallCm', 'nightOpen', 'opensOn'];

export async function publishConditions<T extends PilotArea>(store: ConditionsStore, {
    areas, catalogRevision, refreshForecasts, fetchReport, fetchForecast, warn, now = Date.now,
}: PublicationOptions<T>) {
    const previousObject = await store.read(manifestName);
    const previous = previousObject && conditionsManifestSchema.parse(decode(previousObject.body));
    const oldReports = await readSnapshot(store, previous?.reports, previous?.updatedAt, reportSnapshotSchema.parse, warn);
    const oldForecasts = await readSnapshot(store, previous?.forecasts, previous?.updatedAt, forecastSnapshotSchema.parse, warn);
    const [reports, forecasts] = await Promise.all([
        updateRows(areas, oldReports?.data.reports ?? [], fetchReport, warn),
        refreshForecasts || !oldForecasts?.data.forecasts.length
            ? updateRows(areas, oldForecasts?.data.forecasts ?? [], fetchForecast, warn)
            : { rows: oldForecasts.data.forecasts, received: 0 },
    ]);
    if (!reports.received && !forecasts.received) throw Error('No valid ski conditions updates received');

    const observedAt = now();
    const manifestTime = previous ? Math.max(observedAt, Date.parse(previous.updatedAt) + 1) : observedAt;
    const updatedAt = new Date(manifestTime).toISOString();
    const reportAges = reports.rows.flatMap(report => {
        const age = reportAgeHours(report, observedAt);
        return age === undefined ? [] : [{ id: report.areaId, age, recent: age <= (report.freshHours ?? 24) }];
    });
    const coverage = {
        areas: areas.length, reports: reports.rows.length, recentReports: reportAges.filter(report => report.recent).length,
        reportAgesHours: Object.fromEntries(reportAges.map(({ id, age }) => [id, Math.round(age * 10) / 10])),
        reportFields: Object.fromEntries(reportFields.map(field => [field, reports.rows.filter(report =>
            field === 'status' ? report.status !== 'unknown' : report[field] !== undefined).length])),
        forecasts: forecasts.rows.filter(forecast => Date.parse(forecast.endsAt) > observedAt).length,
    };

    const reportsData = reportSnapshotSchema.parse({ version: 1, generatedAt: updatedAt, reports: reports.rows });
    const forecastsData = forecastSnapshotSchema.parse({ version: 1, generatedAt: updatedAt, forecasts: forecasts.rows });
    const manifest = conditionsManifestSchema.parse({
        version: 1, updatedAt, catalogRevision, coverage,
        reports: reports.received ? await writeVersion(store, 'reports', serialize(reportsData)) : oldReports?.file,
        forecasts: forecasts.received ? await writeVersion(store, 'forecasts', serialize(forecastsData)) : oldForecasts?.file,
        previousManifest: previousObject && await writeVersion(store, 'manifest', previousObject.body),
    });
    await store.commit(serialize(manifest), previousObject);
    const received = { reports: reports.received, forecasts: forecasts.received };
    const historyFile = `history/${updatedAt.slice(0, 10)}/${updatedAt.replaceAll(':', '-')}.json`;
    try {
        await store.write(historyFile, serialize({ updatedAt, coverage, received }));
    } catch (error) {
        throw Error(`Published the ski conditions manifest but could not write ${historyFile}`, { cause: error });
    }
    return { manifest, coverage, received };
}
