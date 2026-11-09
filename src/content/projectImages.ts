import previews from './project-previews.json' with { type: 'json' };
import type { ResponsiveImage } from '../../shared/responsiveImage.ts';

const images: Readonly<Record<string, ResponsiveImage>> = previews;

export function getProjectPreview(source: string | undefined): ResponsiveImage | undefined {
    return source && Object.hasOwn(images, source) ? images[source] : undefined;
}
