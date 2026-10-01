import { useEffect, useId, useRef, useState } from 'react';
import { useTripStory } from '../TripStoryContext';
import { TripPhotoFigure } from './TripPhoto';
import { createTripPhotoLightbox } from './tripPhotoSwipe';

export function TripGallery({ galleryId }: { galleryId: string }) {
    const { manifest, photos } = useTripStory();
    const elementId = `trip-gallery-${useId().replaceAll(':', '')}`;
    const galleryRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);
    const photoIds = manifest.galleries?.[galleryId];
    useEffect(() => {
        if (!galleryRef.current) return;
        const lightbox = createTripPhotoLightbox(galleryRef.current);
        return () => lightbox.destroy();
    }, [galleryId, expanded]);
    if (!photoIds) throw new Error(`Unknown trip gallery: ${galleryId}`);
    const visibleIds = expanded ? photoIds : photoIds.slice(0, 6);
    return (
        <section aria-labelledby={elementId} className="trip-breakout my-10">
            <h2 id={elementId} className="sr-only">Photo gallery</h2>
            <div ref={galleryRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photoIds.map((id, index) => {
                    const photo = photos.get(id);
                    if (!photo) throw new Error(`Unknown trip photo: ${id}`);
                    if (!visibleIds.includes(id)) return <a key={id} hidden href={photo.src} data-pswp-width={photo.width} data-pswp-height={photo.height} data-pswp-srcset={photo.srcSet} data-trip-caption={photo.caption || photo.alt} />;
                    const lead = index === 0 && visibleIds.length % 2 === 1;
                    const single = photoIds.length === 1;
                    return <TripPhotoFigure key={id} photo={photo}
                        sizes={single ? '(min-width: 1184px) 1152px, calc(100vw - 2rem)' : `${lead ? '(max-width: 639px) calc(100vw - 2rem), ' : ''}(min-width: 1184px) 376px, (min-width: 640px) calc((100vw - 3.5rem) / 3), calc((100vw - 2.75rem) / 2)`}
                        className={`${single ? 'col-span-full' : lead ? 'col-span-2 sm:col-span-1' : ''} ${single ? '' : '[&>div]:aspect-[4/3] [&_img]:h-full [&_img]:object-cover'}`} />;
                })}
            </div>
            {photoIds.length > 6 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}
                className="mt-3 min-h-11 rounded-md border border-zinc-700 px-4 text-sm text-zinc-200 hover:bg-zinc-800">
                {expanded ? 'Show fewer photos' : `Show all ${photoIds.length} photos`}
            </button>}
        </section>
    );
}
