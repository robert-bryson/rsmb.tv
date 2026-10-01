import PhotoSwipeLightbox from 'photoswipe/lightbox';
import PhotoSwipeDynamicCaption from 'photoswipe-dynamic-caption-plugin';
import 'photoswipe/style.css';
import 'photoswipe-dynamic-caption-plugin/photoswipe-dynamic-caption-plugin.css';

export function createTripPhotoLightbox(gallery: HTMLElement) {
    const lightbox = new PhotoSwipeLightbox({
        gallery, children: 'a[data-pswp-width]', pswpModule: () => import('photoswipe'),
    });
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
