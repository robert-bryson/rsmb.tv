import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getTripHero } from '../types';
import { useTripStory } from '../TripStoryContext';
import { TripPhotoFigure } from './TripPhoto';
import { createTripPhotoLightbox } from './tripPhotoSwipe';
import { TripPhotoLink } from './TripPhotoLink';

export function TripHeroGallery({ children }: { children?: ReactNode }) {
    const { manifest } = useTripStory();
    const galleryRef = useRef<HTMLDivElement>(null);
    const lightboxRef = useRef<ReturnType<typeof createTripPhotoLightbox> | null>(null);
    const photos = useMemo(() => [getTripHero(manifest), ...manifest.photos.filter(photo => photo.id !== manifest.hero)], [manifest]);
    const [selection, setSelection] = useState({ manifest, index: 0 });
    const selectedIndex = selection.manifest === manifest ? selection.index : 0;
    const selectedPhoto = photos[selectedIndex];
    const navigate = (direction: -1 | 1) => setSelection(current => ({
        manifest,
        index: ((current.manifest === manifest ? current.index : 0) + direction + photos.length) % photos.length,
    }));
    useEffect(() => {
        if (!galleryRef.current) return;
        const lightbox = createTripPhotoLightbox(galleryRef.current);
        lightboxRef.current = lightbox;
        return () => { lightbox.destroy(); lightboxRef.current = null; };
    }, [manifest]);
    return (
        <div id="trip-photos" ref={galleryRef} role="region" aria-label="Trip photos" aria-roledescription="carousel"
            className="trip-hero-gallery scroll-mt-24">
            {/* Keep photo links in a fixed order so the hero and viewer share indexes. */}
            {photos.map((photo, index) => index === selectedIndex
                ? <TripPhotoFigure key={photo.id} photo={photo} priority showCaption={false} className="trip-hero" sizes="100vw" />
                : <TripPhotoLink key={photo.id} photo={photo} hidden />)}
            {children}
            {photos.length > 1 && <>
                <button type="button" aria-label="Previous photo" title="Previous photo" onClick={() => navigate(-1)}
                    className="trip-hero-control trip-hero-previous">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                        <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <button type="button" aria-label="Next photo" title="Next photo" onClick={() => navigate(1)}
                    className="trip-hero-control trip-hero-next">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                        <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </>}
            <button type="button" aria-label="Expand photo" title="Expand photo"
                onClick={() => lightboxRef.current?.loadAndOpen(selectedIndex)} className="trip-hero-control trip-hero-expand">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                    <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            <button type="button" onClick={() => lightboxRef.current?.loadAndOpen(selectedIndex)}
                className="absolute bottom-6 right-6 z-2 min-h-11 rounded-md border border-white/30 bg-zinc-950/80 px-4 text-sm text-white backdrop-blur-sm hover:bg-zinc-900 focus-visible:outline-white">
                View all {manifest.photos.length} photos
            </button>
            <p role="status" aria-atomic="true" className="sr-only">Photo {selectedIndex + 1} of {photos.length}: {selectedPhoto.alt}</p>
        </div>
    );
}
