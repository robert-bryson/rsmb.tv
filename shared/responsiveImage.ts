/** Image sources shared by generated manifests, HTML preloads, and React. */
export interface ImageDimensions {
    width: number;
    height: number;
}

export interface ResponsiveImage {
    src: string;
    srcSet?: string;
    avifSrcSet?: string;
    width?: number;
    height?: number;
}

/** Compare a resized image with its original, allowing one pixel of rounding. */
export function hasMatchingImageAspectRatio(image: ImageDimensions, original: ImageDimensions): boolean {
    return Math.abs(image.height - image.width * original.height / original.width) <= 1;
}
