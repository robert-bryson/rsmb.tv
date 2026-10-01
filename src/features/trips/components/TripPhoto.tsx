import { useEffect, useId, useRef, useState } from 'react';
import { createTripPhotoLightbox } from './tripPhotoSwipe';
import { useDismissibleCaption } from '../../../hooks/useDismissibleCaption';
import type { TripPhotoData } from '../types';
import { useTripStory } from '../TripStoryContext';

interface TripPhotoProps {
    photoId: string;
    priority?: boolean;
    linked?: boolean;
    className?: string;
}

export function TripPhotoFigure({
    photo,
    priority = false,
    linked = true,
    className = '',
    sizes = '(min-width: 1184px) 1152px, calc(100vw - 2rem)',
}: {
    photo: TripPhotoData;
    sizes?: string;
    priority?: boolean;
    linked?: boolean;
    className?: string;
}) {
    const [failedSrc, setFailedSrc] = useState<string>();
    const failed = failedSrc === photo.src;
    const captionId = `trip-photo-caption-${useId().replaceAll(':', '')}`;
    const caption = photo.caption?.trim() || photo.alt;
    const hasSupplementalCaption = Boolean(photo.caption || photo.location);
    const { dismissed, captionInteractionProps } = useDismissibleCaption();
    const image = failed ? (
        <div role="img" aria-label={photo.alt} className="grid min-h-40 place-items-center p-6 text-center text-sm text-zinc-400" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>Photo unavailable</div>
    ) : (
        <img
            src={photo.src}
            onError={() => setFailedSrc(photo.src)}
            srcSet={photo.srcSet}
            sizes={sizes}
            width={photo.width}
            height={photo.height}
            alt={photo.alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className="block h-auto w-full"
            aria-describedby={!linked && hasSupplementalCaption ? captionId : undefined}
        />
    );

    return (
        <figure
            className={`image-caption-figure ${className}`}
            data-caption-dismissed={dismissed || undefined}
            tabIndex={!linked ? 0 : undefined}
            {...captionInteractionProps}
        >
            <div className="image-caption-frame overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
                {linked ? (
                    <a
                        href={photo.src}
                        data-pswp-width={photo.width}
                        data-pswp-height={photo.height}
                        data-pswp-srcset={photo.srcSet}
                        data-trip-caption={[caption, photo.location].filter(Boolean).join(" · ")}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-describedby={hasSupplementalCaption ? captionId : undefined}
                    >
                        {image}
                    </a>
                ) : image}
            </div>
            <figcaption
                id={captionId}
                className={`${hasSupplementalCaption ? "" : "sr-only "}image-caption-overlay mt-2 text-sm leading-snug text-zinc-400`}
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

export function TripPhoto({ photoId, className = '', ...props }: TripPhotoProps) {
    const galleryRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!galleryRef.current || props.linked === false) return;
        const lightbox = createTripPhotoLightbox(galleryRef.current);
        return () => lightbox.destroy();
    }, [photoId, props.linked]);
    const { photos } = useTripStory();
    const photo = photos.get(photoId);
    if (!photo) throw new Error(`Unknown trip photo: ${photoId}`);
    return <div ref={galleryRef}><TripPhotoFigure photo={photo} {...props} className={`trip-breakout my-8 ${className}`} /></div>;
}