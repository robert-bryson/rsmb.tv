import type { ReactNode } from 'react';
import type { TripPhotoData } from '../types';
import { tripPhotoCaption } from './tripPhotoSwipe';

export function TripPhotoLink({ photo, children, hidden, describedBy }: {
    photo: TripPhotoData;
    children?: ReactNode;
    hidden?: boolean;
    describedBy?: string;
}) {
    return <a
        href={photo.full?.src ?? photo.src}
        hidden={hidden}
        data-pswp-width={photo.full?.width ?? photo.width}
        data-pswp-height={photo.full?.height ?? photo.height}
        data-pswp-srcset={photo.full ? photo.full.srcSet : photo.srcSet}
        data-trip-alt={photo.alt}
        data-trip-caption={tripPhotoCaption(photo)}
        target="_blank"
        rel="noopener noreferrer"
        aria-describedby={describedBy}
    >{children}</a>;
}
