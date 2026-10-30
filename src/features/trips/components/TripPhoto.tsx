import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createTripPhotoLightbox } from './tripPhotoSwipe';
import { TripPhotoLink } from './TripPhotoLink';
import { useDismissibleCaption } from '../../../hooks/useDismissibleCaption';
import type { TripPhotoData } from '../types';
import { useTripStory } from '../TripStoryContext';

interface TripPhotoProps {
    photoId: string;
    layout?: 'default' | 'pano';
    priority?: boolean;
    linked?: boolean;
    className?: string;
}

function TripPhotoImage({ photo, sizes, priority, describedBy }: {
    photo: TripPhotoData;
    sizes: string;
    priority: boolean;
    describedBy?: string;
}) {
    const [failed, setFailed] = useState(false);
    if (failed) {
        return (
            <div role="img" aria-label={photo.alt} aria-describedby={describedBy}
                className="relative text-center text-sm text-zinc-400"
                style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
                <span className="absolute inset-0 grid place-items-center p-2">Photo unavailable</span>
            </div>
        );
    }
    return (
        <img
            src={photo.src}
            onError={() => setFailed(true)}
            srcSet={photo.srcSet}
            sizes={sizes}
            width={photo.width}
            height={photo.height}
            alt={photo.alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className="block h-auto w-full"
            aria-describedby={describedBy}
        />
    );
}

export function TripPhotoFigure({
    photo,
    priority = false,
    linked = true,
    showCaption = true,
    className = '',
    style,
    sizes = '(min-width: 1184px) 1152px, calc(100vw - 2rem)',
}: {
    photo: TripPhotoData;
    sizes?: string;
    priority?: boolean;
    linked?: boolean;
    showCaption?: boolean;
    className?: string;
    style?: CSSProperties;
}) {
    const captionId = `trip-photo-caption-${useId().replaceAll(':', '')}`;
    const caption = photo.caption?.trim() || photo.alt;
    const hasSupplementalCaption = Boolean(photo.caption?.trim() || photo.location?.trim());
    const { dismissed, captionInteractionProps } = useDismissibleCaption();
    const image = (
        <TripPhotoImage
            // A new responsive source selection must get a fresh load attempt, even after an earlier failure.
            key={JSON.stringify([photo.src, photo.srcSet, sizes])}
            photo={photo}
            sizes={sizes}
            priority={priority}
            describedBy={!linked && hasSupplementalCaption ? captionId : undefined}
        />
    );

    return (
        <figure
            className={`image-caption-figure ${className}`}
            style={style}
            data-caption-dismissed={dismissed || undefined}
            tabIndex={!linked ? 0 : undefined}
            {...captionInteractionProps}
        >
            <div className="image-caption-frame overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
                {linked ? (
                    <TripPhotoLink photo={photo} describedBy={hasSupplementalCaption ? captionId : undefined}>
                        {image}
                    </TripPhotoLink>
                ) : image}
            </div>
            <figcaption
                id={captionId}
                className={showCaption ? 'image-caption-overlay mt-2 text-sm leading-snug text-zinc-400' : 'sr-only'}
                aria-hidden={!hasSupplementalCaption || undefined}
            >
                {caption}
                {photo.location && (
                    <span className="ml-2 text-zinc-400">{photo.location}</span>
                )}
            </figcaption>
        </figure>
    );
}

export function TripPhoto({ photoId, layout = 'default', className = '', ...props }: TripPhotoProps) {
    const galleryRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!galleryRef.current || props.linked === false) return;
        const lightbox = createTripPhotoLightbox(galleryRef.current);
        return () => lightbox.destroy();
    }, [photoId, props.linked]);
    const { photos } = useTripStory();
    const photo = photos.get(photoId);
    if (!photo) throw new Error(`Unknown trip photo: ${photoId}`);
    const portraitOnly = photo.height > photo.width;
    return (
        <div ref={galleryRef}>
            <TripPhotoFigure photo={photo} {...props}
                sizes={layout === 'pano' ? '100vw' : portraitOnly ? '(min-width: 768px) 720px, calc(100vw - 3rem)' : undefined}
                className={`${layout === 'pano' ? 'trip-photo-pano' : portraitOnly ? '' : 'trip-breakout'} my-8 ${className}`} />
        </div>
    );
}
