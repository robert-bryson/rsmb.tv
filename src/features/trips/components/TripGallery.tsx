import { useEffect, useId, useRef } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import { useTripStory } from '../TripStoryContext';
import { TripPhotoFigure } from './TripPhoto';

export function TripGallery({ galleryId }: { galleryId: string }) {
    const { manifest, photos } = useTripStory();
    const elementId = `trip-gallery-${useId().replaceAll(':', '')}`;
    const galleryRef = useRef<HTMLDivElement>(null);
    const photoIds = manifest.galleries?.[galleryId];

    if (!photoIds) throw new Error(`Unknown trip gallery: ${galleryId}`);

    useEffect(() => {
        if (!galleryRef.current) return;

        const lightbox = new PhotoSwipeLightbox({
            gallery: galleryRef.current,
            children: 'a[data-pswp-width]',
            pswpModule: () => import('photoswipe'),
        });

        lightbox.on('uiRegister', () => {
            lightbox.pswp?.ui?.registerElement({
                name: 'trip-caption',
                className: 'trip-lightbox-caption',
                order: 9,
                appendTo: 'root',
                onInit: (element, pswp) => {
                    const updateCaption = () => {
                        const slideElement = pswp.currSlide?.data.element;
                        const figure = slideElement instanceof HTMLElement ? slideElement.closest('figure') : null;
                        element.textContent = figure?.querySelector('figcaption')?.textContent ?? '';
                    };
                    pswp.on('change', updateCaption);
                    updateCaption();
                },
            });
        });

        lightbox.init();
        return () => lightbox.destroy();
    }, []);

    const galleryPhotos = photoIds.map((photoId) => {
        const photo = photos.get(photoId);
        if (!photo) throw new Error(`Unknown trip photo in gallery "${galleryId}": ${photoId}`);
        return photo;
    });

    return (
        <section aria-labelledby={elementId} className="trip-breakout my-10">
            <h2 id={elementId} className="sr-only">Photo gallery</h2>
            <div ref={galleryRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {galleryPhotos.map((photo) => (
                    <TripPhotoFigure
                        key={photo.id}
                        photo={photo}
                        className="[&>div]:aspect-square [&_img]:h-full [&_img]:object-cover"
                    />
                ))}
            </div>
        </section>
    );
}