import { fireEvent, render, screen } from '@testing-library/react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripPhotoLink } from '../features/trips/components/TripPhotoLink';
import { createTripPhotoLightbox } from '../features/trips/components/tripPhotoSwipe';
import type { TripPhotoData } from '../features/trips/types';

const photo: TripPhotoData = {
    id: 'camp', src: '/camp.webp', width: 1200, height: 800,
    srcSet: '/camp-small.webp 480w, /camp.webp 1200w',
    alt: 'A tent beside a lake.', caption: 'First night.', location: 'Coast',
};
const lightboxes: PhotoSwipeLightbox[] = [];

afterEach(() => {
    for (const lightbox of lightboxes.splice(0)) lightbox.destroy();
    vi.restoreAllMocks();
});

function viewer(gallery: HTMLElement, getPhotos?: () => HTMLAnchorElement[]) {
    const lightbox = createTripPhotoLightbox(gallery, getPhotos);
    lightboxes.push(lightbox);
    const open = vi.spyOn(lightbox, 'loadAndOpen').mockImplementation((index, dataSource) => {
        lightbox.options.dataSource = dataSource;
        lightbox.options.index = index;
        return true;
    });
    return { lightbox, open };
}

describe('trip photo viewer', () => {
    it('retains alt text, responsive sources, and captions for hidden slides', () => {
        const { container } = render(<div>
            <TripPhotoLink photo={photo}><img src={photo.src} alt={photo.alt} /></TripPhotoLink>
            <TripPhotoLink photo={{ ...photo, id: 'hidden', alt: 'A motorcycle at dusk.' }} hidden />
        </div>);
        const { lightbox } = viewer(container);
        fireEvent.click(screen.getByRole('img'));
        expect(lightbox.getNumItems()).toBe(2);
        expect(lightbox.getItemData(0).alt).toBe(photo.alt);
        expect(lightbox.getItemData(1)).toMatchObject({
            alt: 'A motorcycle at dusk.', width: 1200, height: 800, srcset: photo.srcSet,
        });
        expect(lightbox.getItemData(1).element?.dataset.tripCaption).toBe('First night. · Coast');
    });

    it('opens a newly mounted photo after a previous session populated the child snapshot', () => {
        const story = (includeSecond: boolean) => <div>
            <TripPhotoLink photo={photo}><img src={photo.src} alt={photo.alt} /></TripPhotoLink>
            {includeSecond && <TripPhotoLink photo={{ ...photo, id: 'second', src: '/second.webp' }}>
                <img src="/second.webp" alt="Second photo" />
            </TripPhotoLink>}
        </div>;
        const { container, rerender } = render(story(false));
        const { lightbox, open } = viewer(container, () => [...container.querySelectorAll<HTMLAnchorElement>('a')]);
        fireEvent.click(screen.getByRole('img', { name: photo.alt }));
        expect(lightbox.getNumItems()).toBe(1);

        rerender(story(true));
        fireEvent.click(screen.getByRole('img', { name: 'Second photo' }));

        expect(open).toHaveBeenCalledTimes(2);
        expect(lightbox.options.index).toBe(1);
        expect(lightbox.getNumItems()).toBe(2);
        expect(lightbox.getItemData(1).src).toBe(new URL('/second.webp', window.location.href).href);
    });

    it('allows modified clicks and unrelated controls to use their default actions', () => {
        const { container } = render(<div>
            <TripPhotoLink photo={photo}><img src={photo.src} alt={photo.alt} /></TripPhotoLink>
            <button type="button">Expand</button>
        </div>);
        const { open } = viewer(container, () => [...container.querySelectorAll<HTMLAnchorElement>('a')]);
        const image = screen.getByRole('img');
        for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
            expect(fireEvent.click(image, { [modifier]: true })).toBe(true);
        }
        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(container);
        expect(open).not.toHaveBeenCalled();
    });

    it('returns focus to the opening control and tolerates removal of that control', () => {
        const { container } = render(<div>
            <TripPhotoLink photo={photo}><img src={photo.src} alt={photo.alt} /></TripPhotoLink>
            <button type="button">View photos</button>
        </div>);
        const { lightbox } = viewer(container);
        const button = screen.getByRole('button');
        const link = screen.getByRole('link');
        fireEvent.click(screen.getByRole('img'));
        button.focus();
        lightbox.dispatch('destroy');
        expect(link).toHaveFocus();

        fireEvent.click(button);
        link.focus();
        lightbox.dispatch('destroy');
        expect(button).toHaveFocus();

        button.remove();
        link.focus();
        lightbox.dispatch('destroy');
        expect(link).toHaveFocus();
    });

    it('removes click handling when the gallery is destroyed', () => {
        const { container } = render(<TripPhotoLink photo={photo}><img src={photo.src} alt={photo.alt} /></TripPhotoLink>);
        const { lightbox, open } = viewer(container);
        lightbox.destroy();
        fireEvent.click(screen.getByRole('img'));
        expect(open).not.toHaveBeenCalled();
    });
});
