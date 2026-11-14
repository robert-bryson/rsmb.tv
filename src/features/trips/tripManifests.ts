import { tripManifestSchema } from '../../../shared/tripManifestSchema';
import { localTripAssetUrl, localTripPhoto } from '../../../shared/tripAssetUrls';
import type { TripManifest } from './types';
import { loaders, issues } from 'virtual:trip-content';
export { tripManifestSchema };

export function parseTripManifest(value: unknown): TripManifest {
    const manifest = tripManifestSchema.parse(value);
    if (!import.meta.env.DEV) return manifest;

    return {
        ...manifest,
        route: {
            ...manifest.route,
            geoJson: localTripAssetUrl(manifest.route.geoJson),
            staticImage: manifest.route.staticImage ? localTripAssetUrl(manifest.route.staticImage) : undefined,
        },
        photos: manifest.photos.map(localTripPhoto),
    };
}

const pending = new Map<string, Promise<TripManifest | undefined>>();
export function loadTripManifest(id: string): Promise<TripManifest | undefined> {
    const loader = Object.hasOwn(loaders, id) ? loaders[id] : undefined;
    if (!loader) return Promise.resolve(undefined);
    let result = pending.get(id);
    if (!result) {
        result = loader().then((module) => parseTripManifest(module.default)).catch((error: unknown) => {
            pending.delete(id);
            throw error;
        });
        pending.set(id, result);
    }
    return result;
}
export function getTripManifestIssue(id: string | undefined) {
    return id && Object.hasOwn(issues, id) ? issues[id] : undefined;
}
