import type { TripManifest } from './tripManifestSchema';

/** Only this origin and path have a local development mirror. */
export function localTripAssetUrl(url: string): string {
    return url.replace(/^https:\/\/data\.rsmb\.tv(?=\/trips\/)/, '/data');
}

export function localTripAssetSrcSet(srcSet: string | undefined): string | undefined {
    // Match the start of each candidate URL. Leave other hosts and URL query
    // values intact, and preserve the original width descriptors and spacing.
    return srcSet?.replace(/(^\s*|,\s*)https:\/\/data\.rsmb\.tv(?=\/trips\/)/g, '$1/data');
}

export function localTripPhoto(photo: TripManifest['photos'][number]): TripManifest['photos'][number] {
    return {
        ...photo,
        src: localTripAssetUrl(photo.src),
        srcSet: localTripAssetSrcSet(photo.srcSet),
        ...(photo.full ? { full: {
            ...photo.full,
            src: localTripAssetUrl(photo.full.src),
            srcSet: localTripAssetSrcSet(photo.full.srcSet),
        } } : {}),
    };
}
