import { getProjectPreview } from '../content/projectImages';
import { ResponsivePicture } from './ResponsivePicture';

export function ProjectPreview({ src, alt, sizes, priority = false, className }: {
    src: string;
    alt: string;
    sizes: string;
    priority?: boolean;
    className?: string;
}) {
    const image = getProjectPreview(src);
    const original = { src, width: image?.width, height: image?.height };
    return <ResponsivePicture image={image ?? original} fallback={image ? original : undefined}
        alt={alt} sizes={sizes} priority={priority} className={className} />;
}
