import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TripThumbnail } from '../features/trips/components/TripThumbnail';

vi.mock('../content/trip-thumbnails.json', () => ({ default: {
    'https://data.rsmb.tv/trips/coast/photos/hero.webp': {
        src: '/images/trip-thumbnails/coast-320-abc.webp',
        srcSet: '/images/trip-thumbnails/coast-160-abc.webp 160w, /images/trip-thumbnails/coast-320-abc.webp 320w',
        width: 320, height: 240,
    },
} }));

const photo = { id: 'hero', src: 'https://data.rsmb.tv/trips/coast/photos/hero.webp', width: 1600, height: 1200, alt: 'Coast' };

describe('trip card thumbnail selection', () => {
    it.each([photo.src, '/data/trips/coast/photos/hero.webp'])('uses bundled thumbnails for the published or locally mirrored hero %s', src => {
        const { container } = render(<TripThumbnail photo={{ ...photo, src }} sizes="128px" className="card-image" />);
        const image = container.querySelector('img')!;
        expect(image.src).toContain('/images/trip-thumbnails/coast-320-abc.webp');
        expect(image.srcset).toContain('160w');
        expect(image).toHaveAttribute('sizes', '128px');
    });

    it('keeps new heroes usable before their thumbnails have been generated', () => {
        const nextPhoto = { ...photo, src: 'https://data.rsmb.tv/trips/coast/photos/new-hero.webp', srcSet: '/new-480.webp 480w, /new-960.webp 960w' };
        const { container } = render(<TripThumbnail photo={nextPhoto} sizes="128px" className="card-image" />);
        const image = container.querySelector('img')!;
        expect(image).toHaveAttribute('src', nextPhoto.src);
        expect(image).toHaveAttribute('srcset', nextPhoto.srcSet);
        expect(image).toHaveAttribute('width', '1600');
    });
});
