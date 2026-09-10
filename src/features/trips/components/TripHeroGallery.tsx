import { useEffect, useRef } from 'react';
import { getTripHero } from '../types';
import { useTripStory } from '../TripStoryContext';
import { TripPhotoFigure } from './TripPhoto';
import { createTripPhotoLightbox } from './tripPhotoSwipe';

export function TripHeroGallery() {
    const { manifest } = useTripStory();
    const galleryRef = useRef<HTMLDivElement>(null);
    const hero = getTripHero(manifest);

    useEffect(() => {
        if (!galleryRef.current) return;

        const lightbox = createTripPhotoLightbox(galleryRef.current, manifest.photos.length);
        return () => lightbox.destroy();
    }, [manifest]);

    return (
        <div ref={galleryRef} className="trip-breakout [&_a]:cursor-zoom-in">
            {manifest.photos.map((photo) => photo.id === hero.id ? (
                <TripPhotoFigure key={photo.id} photo={photo} priority />
            ) : (
                <div key={photo.id} hidden>
                    <TripPhotoFigure photo={photo} />
                </div>
            ))}
        </div>
    );
}