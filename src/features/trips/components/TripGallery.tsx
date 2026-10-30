import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useTripStory } from '../TripStoryContext';
import { TripPhotoFigure } from './TripPhoto';
import { createTripPhotoLightbox } from './tripPhotoSwipe';
import { TripPhotoLink } from './TripPhotoLink';
import { galleryLength, layoutTripGallery, tripGallerySizes, TRIP_GALLERY_GAP } from '../tripGalleryLayout';

const COLLAPSED_PHOTO_COUNT = 9;

export function TripGallery({ galleryId }: { galleryId: string }) {
    return <TripGalleryContent key={galleryId} galleryId={galleryId} />;
}

function TripGalleryContent({ galleryId }: { galleryId: string }) {
    const { manifest, photos, registerGallery, getGalleryPhotos } = useTripStory();
    const elementId = `trip-gallery-${useId().replaceAll(':', '')}`;
    const galleryRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);
    const photoIds = manifest.galleries && Object.hasOwn(manifest.galleries, galleryId)
        ? manifest.galleries[galleryId] : undefined;
    useEffect(() => {
        if (!galleryRef.current) return;
        const unregister = registerGallery(galleryRef.current);
        const lightbox = createTripPhotoLightbox(galleryRef.current, getGalleryPhotos);
        return () => {
            lightbox.destroy();
            unregister();
        };
    }, [photoIds, expanded, registerGallery, getGalleryPhotos]);
    if (!photoIds) throw new Error(`Unknown trip gallery: ${galleryId}`);
    const visibleCount = expanded ? photoIds.length : Math.min(photoIds.length, COLLAPSED_PHOTO_COUNT);
    const galleryPhotos = photoIds.map(id => {
        const photo = photos.get(id);
        if (!photo) throw new Error(`Unknown trip photo: ${id}`);
        return photo;
    });
    const visiblePhotos = galleryPhotos.slice(0, visibleCount);
    const narrow = layoutTripGallery(visiblePhotos, false);
    const wide = layoutTripGallery(visiblePhotos, true);
    const portraitOnly = galleryPhotos.length === 1 && galleryPhotos[0].height > galleryPhotos[0].width;
    return (
        <section aria-labelledby={elementId} className={`${portraitOnly ? '' : 'trip-breakout'} my-10`}>
            <h2 id={elementId} className="sr-only">Photo gallery</h2>
            <div ref={galleryRef} className="trip-gallery-grid" style={{ gap: TRIP_GALLERY_GAP }}>
                {galleryPhotos.map((photo, index) => {
                    if (index >= visibleCount) return <TripPhotoLink key={photo.id} photo={photo} hidden />;
                    return <TripPhotoFigure key={photo.id} photo={photo}
                        sizes={tripGallerySizes(narrow[index], wide[index], portraitOnly)}
                        className="trip-gallery-photo"
                        style={{
                            '--trip-photo-ratio': `${photo.width} / ${photo.height}`,
                            '--gallery-row': narrow[index].row,
                            '--gallery-span': narrow[index].rowSpan,
                            '--gallery-width': galleryLength(narrow[index].width),
                            '--gallery-offset': galleryLength(narrow[index].offset),
                            '--gallery-wide-row': wide[index].row,
                            '--gallery-wide-span': wide[index].rowSpan,
                            '--gallery-wide-width': galleryLength(wide[index].width),
                            '--gallery-wide-offset': galleryLength(wide[index].offset),
                        } as CSSProperties} />;
                })}
            </div>
            {photoIds.length > COLLAPSED_PHOTO_COUNT && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}
                className="mt-3 min-h-11 rounded-md border border-zinc-700 px-4 text-sm text-zinc-200 hover:bg-zinc-800">
                {expanded ? 'Show fewer photos' : `Show all ${photoIds.length} photos`}
            </button>}
        </section>
    );
}
