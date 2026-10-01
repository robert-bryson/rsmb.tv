import PhotoSwipeLightbox from 'photoswipe/lightbox';
import PhotoSwipeDynamicCaption from 'photoswipe-dynamic-caption-plugin';
import type { TripPhotoData } from '../types';
import 'photoswipe/style.css';
import 'photoswipe-dynamic-caption-plugin/photoswipe-dynamic-caption-plugin.css';

export function tripPhotoCaption(photo: TripPhotoData) {
    return [photo.caption?.trim() || photo.alt, photo.location?.trim()].filter(Boolean).join(' · ');
}

export function createTripPhotoLightbox(gallery: HTMLElement, getGalleryPhotos?: () => HTMLAnchorElement[]) {
    const lightbox = new PhotoSwipeLightbox({
        gallery, children: 'a[data-pswp-width]', pswpModule: () => import('photoswipe'),
    });
    if (getGalleryPhotos) {
        lightbox.addFilter('clickedIndex', (_index, event) => {
            if (!(event.target instanceof Element)) return -1;
            const trigger = event.target.closest('a[data-pswp-width]');
            if (!trigger || !gallery.contains(trigger)) return -1;
            // Snapshot the current grids, including hidden photos, for this viewer session.
            const photos = getGalleryPhotos();
            lightbox.options.children = photos;
            return photos.findIndex(photo => photo === trigger);
        });
    }
    lightbox.addFilter('domItemData', (itemData, element) => ({
        ...itemData,
        alt: element.dataset.tripAlt ?? itemData.alt,
    }));
    let returnTarget: HTMLElement | null = null;
    const rememberTrigger = (event: Event) => {
        if (event.target instanceof Element) returnTarget = event.target.closest<HTMLElement>('a[data-pswp-width], button');
    };
    gallery.addEventListener('click', rememberTrigger, true);
    lightbox.on('bindEvents', () => lightbox.pswp?.element?.focus({ preventScroll: true }));
    lightbox.on('destroy', () => { if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true }); });
    const destroy = lightbox.destroy.bind(lightbox);
    lightbox.destroy = () => { gallery.removeEventListener('click', rememberTrigger, true); destroy(); };
    new PhotoSwipeDynamicCaption(lightbox, {
        type: 'auto',
        captionContent: (slide) => {
            const element = slide.data.element;
            const caption = document.createElement('div');
            caption.textContent = element?.dataset.tripCaption
                ?? element?.closest('figure')?.querySelector('figcaption')?.textContent
                ?? element?.querySelector('img')?.alt ?? '';
            // The plugin inserts an HTML string; serialize the text node to keep captions escaped.
            return caption.innerHTML;
        },
    });
    lightbox.init();
    return lightbox;
}
