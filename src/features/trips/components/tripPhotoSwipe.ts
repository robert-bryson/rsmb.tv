import PhotoSwipeLightbox from 'photoswipe/lightbox';
import PhotoSwipeDynamicCaption from 'photoswipe-dynamic-caption-plugin';
import 'photoswipe/style.css';
import 'photoswipe-dynamic-caption-plugin/photoswipe-dynamic-caption-plugin.css';

export function createTripPhotoLightbox(gallery: HTMLElement, paginationCount = 0) {
    const lightbox = new PhotoSwipeLightbox({
        gallery,
        children: 'a[data-pswp-width]',
        pswpModule: () => import('photoswipe'),
    });

    new PhotoSwipeDynamicCaption(lightbox, {
        type: 'auto',
        captionContent: (slide) => {
            const figure = slide.data.element?.closest('figure');
            return figure?.querySelector('figcaption')?.textContent
                ?? figure?.querySelector('img')?.alt
                ?? '';
        },
    });

    if (paginationCount > 1) {
        lightbox.on('uiRegister', () => {
            lightbox.pswp?.ui?.registerElement({
                name: 'trip-pagination',
                className: 'trip-lightbox-pagination',
                order: 8,
                appendTo: 'root',
                onInit: (element, pswp) => {
                    element.setAttribute('role', 'navigation');
                    element.setAttribute('aria-label', 'Choose gallery image');

                    const buttons = Array.from({ length: paginationCount }, (_, index) => {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.className = 'trip-lightbox-pagination-dot';
                        button.setAttribute('aria-label', `View image ${index + 1} of ${paginationCount}`);
                        button.addEventListener('click', (event) => {
                            event.stopPropagation();
                            pswp.goTo(index);
                        });
                        element.append(button);
                        return button;
                    });

                    const updatePagination = () => {
                        buttons.forEach((button, index) => {
                            const isCurrent = index === pswp.currIndex;
                            button.classList.toggle('trip-lightbox-pagination-dot--current', isCurrent);
                            if (isCurrent) button.setAttribute('aria-current', 'true');
                            else button.removeAttribute('aria-current');
                        });
                    };

                    pswp.on('change', updatePagination);
                    updatePagination();
                },
            });
        });
    }

    lightbox.init();
    return lightbox;
}