import { createHash } from 'node:crypto';
import {
    conditionsFileDigest, conditionsManifestSchema, forecastSnapshotSchema, mergeResortReports, reportAgeHours, reportSnapshotSchema, skiDayStatus,
    type BaseForecast, type ResortReport,
} from '../../../src/features/ski-status/conditions.ts';
import { decodeConditionsJson, maxConditionsManifestBytes, maxConditionsSnapshotBytes } from '../../../src/features/ski-status/conditions-response.ts';
import { manifestName, type ConditionsStore } from './conditions-store.ts';

type PilotArea = { areaId: string };
type PublicationOptions<T extends PilotArea> = {
    areas: readonly T[];
    catalogRevision: string;
    refreshForecasts: boolean;
    fetchReport: (area: T, previous: ResortReport | undefined) => Promise<ResortReport>;
    fetchForecast: (area: T) => Promise<BaseForecast>;
    warn: (message: string) => void;
    now?: () => number;
};

function serialize(data: unknown, limit = Infinity) {
    const body = Buffer.from(`${JSON.stringify(data, null, 2)}\n`);
    if (body.length > limit) throw Error('Ski conditions publication exceeds the size limit');
    return body;
}
export const digest = (body: Buffer) => createHash('sha256').update(body).digest('hex');

async function readSnapshot<T extends { generatedAt: string }>(
    store: ConditionsStore, file: string | undefined, updatedAt: string | undefined, parse: (value: unknown) => T, warn: (message: string) => void,
) {
    if (!file || !updatedAt) return;
    const object = await store.read(file);
    try {
        if (object && object.body.length > maxConditionsSnapshotBytes) throw Error('Snapshot exceeds the size limit');
        if (!object || digest(object.body) !== conditionsFileDigest(file)) throw Error('Invalid checksum or missing snapshot');
        const data = parse(decodeConditionsJson(object.body));
        if (Date.parse(data.generatedAt) > Date.parse(updatedAt)) throw Error('Snapshot is newer than its manifest');
        return { file, data };
    } catch (error) {
        warn(`${file}: ${String(error)}`);
    }
}

async function updateRows<T extends PilotArea, Row extends PilotArea>(
    areas: readonly T[], previous: Row[], fetchRow: (area: T, previous: Row | undefined) => Promise<Row>, warn: (message: string) => void,
) {
    const lookup = new Set(areas.map(area => area.areaId));
    const rows = new Map(previous.filter(row => lookup.has(row.areaId)).map(row => [row.areaId, row]));
    const results = await Promise.allSettled(areas.map(async area => fetchRow(area, rows.get(area.areaId))));
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

const reportFields: (keyof ResortReport)[] = [
    'status', 'lifts', 'trails', 'acres', 'baseCm', 'snowfallCm', 'temperature', 'nightOpen', 'opensOn', 'terrain',
];

export async function publishConditions<T extends PilotArea>(store: ConditionsStore, {
    areas, catalogRevision, refreshForecasts, fetchReport, fetchForecast, warn, now = Date.now,
}: PublicationOptions<T>) {
    const previousObject = await store.read(manifestName);
    const previous = previousObject && conditionsManifestSchema.parse(decodeConditionsJson(previousObject.body));
    const [oldReports, oldForecasts] = await Promise.all([
        readSnapshot(store, previous?.reports, previous?.updatedAt, reportSnapshotSchema.parse, warn),
        readSnapshot(store, previous?.forecasts, previous?.updatedAt, forecastSnapshotSchema.parse, warn),
    ]);
    const areaIds = new Set(areas.map(area => area.areaId));
    const previousReports = oldReports?.data.reports ?? [];
    const previousForecasts = oldForecasts?.data.forecasts ?? [];
    const retainedForecasts = previousForecasts.filter(row => areaIds.has(row.areaId));
    const [reports, forecasts] = await Promise.all([
        updateRows(areas, previousReports, fetchReport, warn),
        refreshForecasts || !retainedForecasts.length
            ? updateRows(areas, retainedForecasts, fetchForecast, warn)
            : { rows: retainedForecasts, received: 0 },
    ]);
    if (!reports.received && !forecasts.received) throw Error('No valid ski conditions updates received');
    const observedAt = now();
    const reportsByArea = new Map(previousReports.map(report => [report.areaId, report]));
    const reportRows = reports.rows.map(next => {
        const prior = reportsByArea.get(next.areaId);
        return prior ? mergeResortReports(prior, next, observedAt) : next;
    });
    const manifestTime = previous ? Math.max(observedAt, Date.parse(previous.updatedAt) + 1) : observedAt;
    const updatedAt = new Date(manifestTime).toISOString();
    const reportAges = reportRows.flatMap(report => {
        const age = reportAgeHours(report, observedAt);
        return age === undefined ? [] : [{ id: report.areaId, age }];
    });
    const coverage = {
        areas: areas.length, reports: reportRows.length,
        recentReports: reportRows.filter(report => skiDayStatus(report, observedAt) !== 'unknown').length,
        reportAgesHours: Object.fromEntries(reportAges.map(({ id, age }) => [id, Math.round(age * 10) / 10])),
        reportFields: Object.fromEntries(reportFields.map(field => [field, reportRows.filter(report =>
            field === 'status' ? report.status !== 'unknown' : report[field] !== undefined).length])),
        forecasts: forecasts.rows.filter(forecast => Date.parse(forecast.endsAt) > observedAt).length,
    };

    const reportsData = reportSnapshotSchema.parse({ version: 1, generatedAt: updatedAt, reports: reportRows });
    const forecastsData = forecastSnapshotSchema.parse({ version: 1, generatedAt: updatedAt, forecasts: forecasts.rows });
    const reportsChanged = reports.received > 0 || reportRows.length !== previousReports.length;
    const forecastsChanged = forecasts.received > 0 || forecasts.rows.length !== previousForecasts.length;
    const reportsBody = reportsChanged ? serialize(reportsData, maxConditionsSnapshotBytes) : undefined;
    const forecastsBody = forecastsChanged ? serialize(forecastsData, maxConditionsSnapshotBytes) : undefined;
    const manifest = conditionsManifestSchema.parse({
        version: 1, updatedAt, catalogRevision, coverage,
        reports: reportsBody ? await writeVersion(store, 'reports', reportsBody) : oldReports?.file,
        forecasts: forecastsBody ? await writeVersion(store, 'forecasts', forecastsBody) : oldForecasts?.file,
        previousManifest: previousObject && await writeVersion(store, 'manifest', previousObject.body),
    });
    const received = { reports: reports.received, forecasts: forecasts.received };
    const manifestBody = serialize(manifest, maxConditionsManifestBytes);
    const historyPrefix = `history/${updatedAt.slice(0, 10)}/${updatedAt.replaceAll(':', '-')}`;
    await writeVersion(store, historyPrefix, serialize({ ...manifest, received }));
    await store.commit(manifestBody, previousObject);
    return { manifest, coverage, received };
}
