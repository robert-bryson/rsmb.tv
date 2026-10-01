import { useEffect, useRef } from 'react';
import { getTripHero } from '../types';
import { useTripStory } from '../TripStoryContext';
import { TripPhotoFigure } from './TripPhoto';
import { createTripPhotoLightbox } from './tripPhotoSwipe';

export function TripHeroGallery() {
    const { manifest } = useTripStory();
    const galleryRef = useRef<HTMLDivElement>(null);
    const lightboxRef = useRef<ReturnType<typeof createTripPhotoLightbox> | null>(null);
    const hero = getTripHero(manifest);
    useEffect(() => {
        if (!galleryRef.current) return;
        const lightbox = createTripPhotoLightbox(galleryRef.current);
        lightboxRef.current = lightbox;
        return () => { lightbox.destroy(); lightboxRef.current = null; };
    }, [manifest]);
    return (
        <div id="trip-photos" ref={galleryRef} className="trip-breakout trip-hero-gallery relative scroll-mt-24 [&_a]:cursor-zoom-in">
            <TripPhotoFigure photo={hero} priority className="trip-hero" sizes="(min-width: 1440px) 1408px, calc(100vw - 2rem)" />
            {manifest.photos.filter(photo => photo.id !== hero.id).map(photo => (
                <a key={photo.id} hidden href={photo.src} data-pswp-width={photo.width}
                    data-pswp-height={photo.height} data-pswp-srcset={photo.srcSet}
                    data-trip-caption={[photo.caption || photo.alt, photo.location].filter(Boolean).join(' · ')} />
            ))}
            <button type="button" onClick={() => lightboxRef.current?.loadAndOpen(0)}
                className="absolute right-3 top-3 min-h-11 rounded-md border border-white/20 bg-zinc-950/75 px-4 text-sm text-zinc-100 backdrop-blur-sm hover:bg-zinc-900">
                View all {manifest.photos.length} photos
            </button>
        </div>
    );
}
