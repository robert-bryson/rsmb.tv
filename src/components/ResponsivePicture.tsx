import { useState } from 'react';
import type { ResponsiveImage } from '../../shared/responsiveImage';

interface ResponsivePictureProps {
    image: ResponsiveImage;
    fallback?: ResponsiveImage;
    alt: string;
    sizes: string;
    priority?: boolean;
    className?: string;
}

/** Advance from AVIF to the default source, then to the original after errors. */
export function ResponsivePicture({ image, fallback, alt, sizes, priority = false, className }: ResponsivePictureProps) {
    const sourceKey = JSON.stringify([image.src, image.srcSet, image.avifSrcSet, fallback?.src, fallback?.srcSet]);
    const [failure, setFailure] = useState<{ sourceKey: string; stage: number }>();
    const stage = failure?.sourceKey === sourceKey ? failure.stage : 0;
    const hasAvif = Boolean(image.avifSrcSet);
    const lastStage = Number(hasAvif) + Number(Boolean(fallback));
    const selected = fallback && stage === lastStage ? fallback : image;

    return <picture className="contents">
        {hasAvif && stage === 0 && <source type="image/avif" srcSet={image.avifSrcSet} sizes={sizes} />}
        <img
            src={selected.src}
            srcSet={selected.srcSet}
            sizes={sizes}
            width={selected.width}
            height={selected.height}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className={className}
            onError={() => {
                if (stage < lastStage) setFailure({ sourceKey, stage: stage + 1 });
            }}
        />
    </picture>;
}
