import { tripManifestSchema } from '../../../shared/tripManifestSchema';
import type { TripManifest } from './types';
import { loaders, issues } from 'virtual:trip-content';
export { tripManifestSchema };

export function parseTripManifest(value: unknown): TripManifest {
    const manifest = tripManifestSchema.parse(value);
    if (!import.meta.env.DEV) return manifest;

    const localUrl = (url: string) => url.replace(/^https:\/\/data\.rsmb\.tv(?=\/trips\/)/, '/data');
    const localPhoto = (photo: TripManifest['photos'][number]) => ({
        ...photo,
        src: localUrl(photo.src),
        srcSet: photo.srcSet?.replaceAll('https://data.rsmb.tv', '/data'),
    });

    return {
        ...manifest,
        route: {
            ...manifest.route,
            geoJson: localUrl(manifest.route.geoJson),
            staticImage: manifest.route.staticImage ? localUrl(manifest.route.staticImage) : undefined,
        },
        photos: manifest.photos.map(localPhoto),
    };
}

const pending = new Map<string, Promise<TripManifest | undefined>>();
export function loadTripManifest(id: string): Promise<TripManifest | undefined> {
    const loader = loaders[id];
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
    return id ? issues[id] : undefined;
}
