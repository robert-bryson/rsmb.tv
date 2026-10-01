import type { TripManifest } from '../../../shared/tripManifestSchema';
export type { TripManifest };
export type TripPhotoData = TripManifest['photos'][number];
export type TripStop = TripManifest['stops'][number];
export type TripTrack = NonNullable<TripManifest['route']['tracks']>[number];

export function getTripHero(manifest: TripManifest): TripPhotoData {
    const hero = manifest.photos.find((photo) => photo.id === manifest.hero);
    if (!hero) throw new Error(`Trip manifest "${manifest.id}" references unknown hero photo: ${manifest.hero}`);
    return hero;
}