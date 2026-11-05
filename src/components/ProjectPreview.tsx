import previews from '../content/project-previews.json' with { type: 'json' };

const images: Record<string, { src: string; srcSet: string; avifSrcSet?: string; width: number; height: number }> = previews;

export function ProjectPreview({ src, alt, sizes, priority = false, className }: {
    src: string;
    alt: string;
    sizes: string;
    priority?: boolean;
    className?: string;
}) {
    const image = images[src];
    return <picture className="contents">
        {image?.avifSrcSet && <source type="image/avif" srcSet={image.avifSrcSet} sizes={sizes} />}
        <img
            src={image?.src ?? src}
            srcSet={image?.srcSet}
            sizes={sizes}
            width={image?.width}
            height={image?.height}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className={className}
        />
    </picture>;
}
