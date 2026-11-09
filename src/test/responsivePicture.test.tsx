import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProjectPreview } from '../components/ProjectPreview';
import { TripThumbnail } from '../features/trips/components/TripThumbnail';
import { ResponsivePicture } from '../components/ResponsivePicture';
import previews from '../content/project-previews.json';
import thumbnails from '../content/trip-thumbnails.json';

describe('optimized image recovery', () => {
    it('tries WebP after AVIF fails, then the original after WebP fails, and stops retrying', () => {
        const original = Object.keys(previews)[0] as keyof typeof previews;
        const optimized = previews[original];
        const { container } = render(<ProjectPreview src={original} alt="Map" sizes="720px" priority />);
        const image = container.querySelector('img')!;
        expect(container.querySelector('source')).not.toBeNull();
        fireEvent.error(image);
        expect(container.querySelector('source')).toBeNull();
        expect(image).toHaveAttribute('src', optimized.src);
        fireEvent.error(image);
        expect(image).toHaveAttribute('src', original);
        expect(image).not.toHaveAttribute('srcset');
        fireEvent.error(image);
        expect(image).toHaveAttribute('src', original);
        expect(image).toHaveAttribute('loading', 'eager');
        expect(image).toHaveAttribute('fetchpriority', 'high');
        expect(image).toHaveAttribute('alt', 'Map');
    });

    it('tries the original responsive trip photo after its thumbnail fails', () => {
        const original = Object.keys(thumbnails)[0];
        const photo = { id: 'hero', src: original, srcSet: '/photo-480.webp 480w, /photo-960.webp 960w', width: 1600, height: 1200, alt: 'Coast' };
        const { container } = render(<TripThumbnail photo={photo} sizes="128px" className="thumbnail" />);
        const image = container.querySelector('img')!;
        fireEvent.error(image);
        expect(image).toHaveAttribute('src', photo.src);
        expect(image).toHaveAttribute('srcset', photo.srcSet);
        expect(image).toHaveAttribute('width', '1600');
        expect(image).toHaveAttribute('loading', 'lazy');
    });

    it('resets recovery when a component receives a different image', () => {
        const [first, second] = Object.keys(previews);
        const { container, rerender } = render(<ProjectPreview src={first} alt="Map" sizes="720px" />);
        fireEvent.error(container.querySelector('img')!);
        fireEvent.error(container.querySelector('img')!);
        rerender(<ProjectPreview src={second} alt="Next map" sizes="720px" />);
        expect(container.querySelector('source')).not.toBeNull();
        expect(container.querySelector('img')).toHaveAttribute('src', previews[second as keyof typeof previews].src);
    });

    it('uses an unknown source directly without looking up object prototype properties', () => {
        const { container } = render(<ProjectPreview src="toString" alt="Original" sizes="128px" />);
        const image = container.querySelector('img')!;
        fireEvent.error(image);
        expect(image).toHaveAttribute('src', 'toString');
        expect(container.querySelector('source')).toBeNull();
    });

    it('can recover an AVIF-only optimization to its default source', () => {
        const { container } = render(<ResponsivePicture image={{ src: '/image.webp', avifSrcSet: '/image.avif 480w' }} alt="Map" sizes="128px" />);
        fireEvent.error(container.querySelector('img')!);
        expect(container.querySelector('source')).toBeNull();
        expect(container.querySelector('img')).toHaveAttribute('src', '/image.webp');
    });
});
