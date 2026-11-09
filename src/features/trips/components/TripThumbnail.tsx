import thumbnails from '../../../content/trip-thumbnails.json' with { type: 'json' };
import type { TripPhotoData } from '../types';
import type { ResponsiveImage } from '../../../../shared/responsiveImage';
import { ResponsivePicture } from '../../../components/ResponsivePicture';

const images: Readonly<Record<string, ResponsiveImage>> = thumbnails;

export function TripThumbnail({ photo, sizes, className }: { photo: TripPhotoData; sizes: string; className: string }) {
    // New or unpublished heroes can use their regular responsive photos until regenerated.
    const source = photo.src.replace(/^\/data\/trips\//, 'https://data.rsmb.tv/trips/');
    const image = Object.hasOwn(images, source) ? images[source] : undefined;
    return <ResponsivePicture image={image ?? photo} fallback={image ? photo : undefined}
        alt="" sizes={sizes} className={className} />;
}
