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
}: {
    photo: TripPhotoData;
    priority?: boolean;
    linked?: boolean;
    className?: string;
}) {
    const image = (
        <img
            src={photo.src}
            srcSet={photo.srcSet}
            sizes={photo.sizes ?? '(min-width: 768px) 720px, calc(100vw - 2rem)'}
            width={photo.width}
            height={photo.height}
            alt={photo.alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className="block h-auto w-full"
        />
    );

    return (
        <figure className={className}>
            <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
                {linked ? (
                    <a
                        href={photo.src}
                        data-pswp-width={photo.width}
                        data-pswp-height={photo.height}
                        data-pswp-srcset={photo.srcSet}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {image}
                    </a>
                ) : image}
            </div>
            {(photo.caption || photo.location || photo.date) && (
                <figcaption className="mt-2 text-sm leading-snug text-zinc-400">
                    {photo.caption}
                    {(photo.location || photo.date) && (
                        <span className="ml-2 text-zinc-500">
                            {[photo.location, photo.date].filter(Boolean).join(' · ')}
                        </span>
                    )}
                </figcaption>
            )}
        </figure>
    );
}

export function TripPhoto({ photoId, ...props }: TripPhotoProps) {
    const { photos } = useTripStory();
    const photo = photos.get(photoId);
    if (!photo) throw new Error(`Unknown trip photo: ${photoId}`);
    return <TripPhotoFigure photo={photo} className={`trip-breakout my-8 ${props.className ?? ''}`} {...props} />;
}