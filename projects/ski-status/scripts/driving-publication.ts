import { createHash } from 'node:crypto';
import { drivingCameraRefreshMs, drivingCamerasSchema, drivingManifestLimit, drivingManifestSchema, drivingProviders,
    drivingReportsSchema, drivingSnapshotLimit, type DrivingBulletin, type DrivingCamera, type DrivingManifest,
    type DrivingProvider } from '../../../shared/skiDriving.ts';
import { decodeConditionsJson } from '../../../src/features/ski-status/conditions-response.ts';
import { manifestName, type ConditionsStore } from './conditions-store.ts';

type Collectors = {
    reports?: () => Promise<DrivingBulletin[]>;
    cameras?: () => Promise<DrivingCamera[]>;
};
export type DrivingCollectors = Partial<Record<DrivingProvider, Collectors>>;
type FeedKind = keyof Collectors;
type ProviderFeeds = NonNullable<DrivingManifest['providers'][DrivingProvider]>;
const feedKinds = ['reports', 'cameras'] as const;

export function drivingDigest(bytes: Buffer) {
    return createHash('sha256').update(bytes).digest('hex');
}

export async function publishDriving(store: ConditionsStore, collectors: DrivingCollectors, clock = () => new Date()) {
    const old = await store.read(manifestName, drivingManifestLimit);
    if (old && old.body.length > drivingManifestLimit) throw Error('Driving manifest is too large');
    const previous = old && drivingManifestSchema.parse(decodeConditionsJson(old.body));
    const now = +clock();
    const previousTime = previous ? Date.parse(previous.updatedAt) : -Infinity;
    if (now < previousTime) throw Error('Driving publication time moved backward');
    const checkedAt = new Date(now).toISOString();
    // Wait for every write before the store removes the staging directory, even when a write fails.
    const results = await Promise.allSettled(drivingProviders.flatMap(provider => feedKinds.map(async kind => ({
        provider, kind,
        feed: await refresh(kind, provider, collectors[provider]?.[kind], previous?.providers[provider]?.[kind]),
    }))));
    const providers: Partial<Record<DrivingProvider, Partial<ProviderFeeds>>> = {};
    for (const result of results) {
        if (result.status === 'rejected') throw result.reason;
        const { provider, kind, feed } = result.value;
        (providers[provider] ??= {})[kind] = feed;
    }
    const updatedAt = new Date(Math.max(now, +clock(), previousTime + 1)).toISOString();
    const manifest = drivingManifestSchema.parse({ version: 1, updatedAt, providers });
    await store.commit(Buffer.from(JSON.stringify(manifest)), old);
    return manifest;

    async function refresh(
        kind: FeedKind, provider: DrivingProvider, collect: Collectors[FeedKind],
        previous: ProviderFeeds[FeedKind] | undefined,
    ): Promise<ProviderFeeds[FeedKind]> {
        if (!collect) return { file: previous?.file, status: 'unconfigured' };
        const schema = kind === 'reports' ? drivingReportsSchema : drivingCamerasSchema;
        if (kind === 'cameras' && previous?.file && previous.status === 'available') {
            const cached = await readCachedCameras(store, previous.file, provider, previousTime);
            if (!cached) previous = undefined;
            else if (now >= Date.parse(cached.checkedAt) && now - Date.parse(cached.checkedAt) < drivingCameraRefreshMs(provider)) return previous;
        }
        let bytes: Buffer;
        try {
            const entries = new Map<string, DrivingBulletin | DrivingCamera>();
            for (const entry of await collect()) {
                const duplicate = entries.get(entry.id);
                if (duplicate && JSON.stringify(duplicate) !== JSON.stringify(entry)) throw Error('Conflicting road feed IDs');
                entries.set(entry.id, entry);
            }
            const payload = schema.parse({ version: 1, provider, checkedAt, entries: [...entries.values()] });
            bytes = Buffer.from(JSON.stringify(payload));
            if (bytes.length > drivingSnapshotLimit) throw Error('Driving snapshot is too large');
        } catch {
            // Provider failures can contain credential-bearing URLs. Publish status and retain the verified snapshot.
            return { file: previous?.file, status: 'unavailable' };
        }
        const file = `${kind}-${drivingDigest(bytes)}.json`;
        if (file !== previous?.file) await store.write(file, bytes);
        return { file, status: 'available' };
    }
}

async function readCachedCameras(store: ConditionsStore, file: string, provider: DrivingProvider, manifestTime: number) {
    try {
        const cached = await store.read(file, drivingSnapshotLimit);
        if (!cached || cached.body.length > drivingSnapshotLimit || file !== `cameras-${drivingDigest(cached.body)}.json`) return;
        const snapshot = drivingCamerasSchema.parse(decodeConditionsJson(cached.body));
        if (snapshot.provider === provider && Date.parse(snapshot.checkedAt) <= manifestTime) return snapshot;
    } catch {
        // The cache is optional. A successful collection replaces an unreadable snapshot.
        return;
    }
}
