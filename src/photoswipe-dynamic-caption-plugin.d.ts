declare module 'photoswipe-dynamic-caption-plugin' {
    import type PhotoSwipeLightbox from 'photoswipe/lightbox';

    interface DynamicCaptionOptions {
        type?: 'auto' | 'below' | 'aside';
        captionContent?: string | ((slide: {
            data: { element?: HTMLElement };
        }) => string | HTMLElement | null | undefined);
        mobileLayoutBreakpoint?: number;
        horizontalEdgeThreshold?: number;
        mobileCaptionOverlapRatio?: number;
        verticallyCenterImage?: boolean;
    }

    export default class PhotoSwipeDynamicCaption {
        constructor(lightbox: PhotoSwipeLightbox, options?: DynamicCaptionOptions);
    }
}