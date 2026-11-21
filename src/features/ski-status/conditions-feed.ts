import {
    conditionsFileDigest, conditionsManifestSchema, forecastSnapshotSchema, reportSnapshotSchema,
    type ConditionsManifest, type ForecastSnapshot, type ReportSnapshot,
} from './conditions';
import { decodeConditionsJson, maxConditionsManifestBytes, maxConditionsSnapshotBytes, readConditionsBytes } from './conditions-response';

const localFeed = import.meta.env.DEV && import.meta.env.VITE_SKI_CONDITIONS_LOCAL;
const baseUrl = localFeed === '1' || localFeed === 'rockies'
    ? new URL(localFeed === 'rockies' ? '/.cache/ski-status-rockies/' : '/.cache/ski-status/', window.location.origin).href
    : 'https://data.rsmb.tv/ski-status/';

type Snapshot<T> = { file: string; data: T };
export type ConditionsFeed = {
    manifest?: ConditionsManifest;
    reports?: Snapshot<ReportSnapshot>;
    forecasts?: Snapshot<ForecastSnapshot>;
};

async function getFile(file: string, signal: AbortSignal, limit: number) {
    const response = await fetch(new URL(file, baseUrl), {
        signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
        credentials: 'omit',
        redirect: 'error',
    });
    return readConditionsBytes(response, limit, 'Ski conditions');
}

async function loadSnapshot<T extends { generatedAt: string }>(
    file: string | undefined, previous: Snapshot<T> | undefined, updatedAt: number, signal: AbortSignal, parse: (value: unknown) => T,
) {
    if (!file) return undefined;
    if (file === previous?.file) return previous;
    const bytes = await getFile(file, signal, maxConditionsSnapshotBytes);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hex !== conditionsFileDigest(file)) throw Error(`Invalid checksum for ${file}`);
    const data = parse(decodeConditionsJson(bytes));
    if (Date.parse(data.generatedAt) > updatedAt) throw Error(`Snapshot is newer than its manifest for ${file}`);
    return { file, data };
}

export async function loadConditionsFeed(previous: ConditionsFeed, signal: AbortSignal): Promise<ConditionsFeed> {
    const manifest = conditionsManifestSchema.parse(decodeConditionsJson(await getFile('manifest.json', signal, maxConditionsManifestBytes)));
    const updatedAt = Date.parse(manifest.updatedAt);
    const lastUpdate = previous.manifest ? Date.parse(previous.manifest.updatedAt) : -Infinity;
    if (updatedAt < lastUpdate || (updatedAt === lastUpdate &&
        (manifest.reports !== previous.manifest?.reports || manifest.forecasts !== previous.manifest?.forecasts))) return previous;

    const [reportResult, forecastResult] = await Promise.allSettled([
        loadSnapshot(manifest.reports, previous.reports, updatedAt, signal, reportSnapshotSchema.parse),
        loadSnapshot(manifest.forecasts, previous.forecasts, updatedAt, signal, forecastSnapshotSchema.parse),
    ]);
    const reports = reportResult.status === 'fulfilled' ? reportResult.value : previous.reports;
    const forecasts = forecastResult.status === 'fulfilled' ? forecastResult.value : previous.forecasts;
    if (updatedAt === lastUpdate && reports === previous.reports && forecasts === previous.forecasts) return previous;
    return { manifest, reports, forecasts };
}
