import previews from './project-previews.json' with { type: 'json' };
import type { ResponsiveImage } from '../../shared/responsiveImage.ts';

interface ProjectPreviewImage extends ResponsiveImage {
    /** SHA-256 of the original screenshot; used to detect stale generated variants. */
    sourceHash: string;
}

const images: Readonly<Record<string, ProjectPreviewImage>> = previews;

export function getProjectPreview(source: string | undefined): ResponsiveImage | undefined {
    return source && Object.hasOwn(images, source) ? images[source] : undefined;
}
