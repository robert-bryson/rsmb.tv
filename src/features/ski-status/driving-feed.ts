import {
    drivingCamerasSchema, drivingDirectory, drivingManifestLimit, drivingManifestSchema, drivingPrefix, drivingReportsSchema, drivingSnapshotLimit,
    type DrivingCameras, type DrivingManifest, type DrivingProvider, type DrivingReports,
} from '../../../shared/skiDriving';
import { readResponseBytes } from '../../../shared/readResponseBytes';
import { decodeConditionsJson } from './conditions-response';

type FeedEntry<T> = { file: string; data: T };
export type ProviderFeed = {
    reports?: FeedEntry<DrivingReports>;
    cameras?: FeedEntry<DrivingCameras>;
    reportsReady: boolean;
    camerasReady: boolean;
    reportsStatus?: 'available' | 'unavailable' | 'unconfigured';
    camerasStatus?: 'available' | 'unavailable' | 'unconfigured';
};
export type DrivingFeed = { manifest?: DrivingManifest; providers: Partial<Record<DrivingProvider, ProviderFeed>> };

const local = import.meta.env.DEV && import.meta.env.VITE_SKI_DRIVING_LOCAL === '1';
const base = local ? `/${drivingDirectory}/` : `https://data.rsmb.tv/${drivingPrefix}`;

async function readFile(file: string, signal: AbortSignal, limit: number) {
    const deadline = local && file === 'manifest.json' ? 22_000 : 12_000;
    const response = await fetch(base + file, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(deadline)]), credentials: 'omit', redirect: 'error',
    });
    return readResponseBytes(response, limit, 'Ski driving');
}

async function snapshot<T extends DrivingReports | DrivingCameras>(
    provider: DrivingProvider, kind: 'reports' | 'cameras', file: string | undefined, previous: FeedEntry<T> | undefined,
    updatedAt: number, signal: AbortSignal, parse: (input: unknown) => T,
) {
    if (!file) return undefined;
    if (previous?.file === file) return previous;
    const bytes = await readFile(file, signal, drivingSnapshotLimit);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (file !== `${kind}-${hash}.json`) throw Error('Road feed checksum did not match');
    const data = parse(decodeConditionsJson(bytes));
    if (data.provider !== provider || Date.parse(data.checkedAt) > updatedAt) {
        throw Error('Invalid road feed publication');
    }
    return { file, data };
}

export async function loadDrivingFeed(previous: DrivingFeed, requested: readonly DrivingProvider[], signal: AbortSignal): Promise<DrivingFeed> {
    signal.throwIfAborted();
    const manifest = drivingManifestSchema.parse(decodeConditionsJson(await readFile('manifest.json', signal, drivingManifestLimit)));
    const published = Date.parse(manifest.updatedAt);
    const previousTime = previous.manifest && Date.parse(previous.manifest.updatedAt);
    if (previousTime !== undefined && (published < previousTime || (published === previousTime
        && JSON.stringify(manifest.providers) !== JSON.stringify(previous.manifest?.providers)))) throw Error('Road feed publication is older than expected');
    const results = await Promise.all(requested.map(async provider => {
        const info = manifest.providers[provider];
        const before = previous.providers[provider];
        const [reports, cameras] = await Promise.allSettled([
            snapshot(provider, 'reports', info?.reports.file, before?.reports, published, signal, drivingReportsSchema.parse),
            snapshot(provider, 'cameras', info?.cameras.file, before?.cameras, published, signal, drivingCamerasSchema.parse),
        ]);
        const verifiedReports = reports.status === 'fulfilled' ? reports.value : undefined;
        const verifiedCameras = cameras.status === 'fulfilled' ? cameras.value : undefined;
        const feed: ProviderFeed = {
            reports: reports.status === 'rejected' ? before?.reports : verifiedReports,
            cameras: cameras.status === 'rejected' ? before?.cameras : verifiedCameras,
            reportsReady: Boolean(verifiedReports && info?.reports.status === 'available'),
            camerasReady: Boolean(verifiedCameras && info?.cameras.status === 'available'),
            reportsStatus: info?.reports.status, camerasStatus: info?.cameras.status,
        };
        return [provider, feed] as const;
    }));
    signal.throwIfAborted();
    return { manifest, providers: { ...previous.providers, ...Object.fromEntries(results) } };
}
