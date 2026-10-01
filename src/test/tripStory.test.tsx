import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { TripFacts } from '../features/trips/components/TripFacts';
import { TripGallery } from '../features/trips/components/TripGallery';
import { TripHeroGallery } from '../features/trips/components/TripHeroGallery';
import { TripPhoto } from '../features/trips/components/TripPhoto';
import { parseTripManifest } from '../features/trips/tripManifests';
import type { TripManifest } from '../features/trips/types';

const manifest: TripManifest = {
    id: 'coastal-loop',
    dates: { start: '2024-05-01', end: '2024-05-03' },
    ridingDays: 3,
    distanceMiles: 642.6,
    motorcycle: 'Honda CB500X',
    regions: ['Oregon', 'Idaho'],
    hero: 'hero',
    route: { geoJson: '/data/trips/coastal-loop.geojson' },
    stops: [],
    photos: [
        {
            id: 'hero',
            src: '/images/trips/coastal-loop/hero.webp',
            width: 1600,
            height: 1067,
            alt: 'Motorcycle parked above the Pacific coast.',
        },
        {
            id: 'camp',
            src: '/images/trips/coastal-loop/camp.webp',
            width: 1200,
            height: 800,
            alt: 'A tent beside the motorcycle at dusk.',
            caption: 'Camp at the end of the first day.',
        },
    ],
    galleries: { highlights: ['camp'] },
};

function renderStory(children: React.ReactNode, tripManifest = manifest) {
    return render(
        <MemoryRouter>
            <TripStoryProvider manifest={tripManifest}>{children}</TripStoryProvider>
        </MemoryRouter>,
    );
}

describe('trip story primitives', () => {
    it('renders trip facts as readable metadata', () => {
        renderStory(<TripFacts />);

        expect(screen.getByText('Dates')).toBeInTheDocument();
        expect(screen.getByText('May 1–3, 2024')).toBeInTheDocument();
        expect(screen.getByText('Riding days')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('Distance')).toBeInTheDocument();
        expect(screen.getByText('643 mi · 1,034 km')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Motorcycle' })).toHaveAttribute('href', '/posts?tag=motorcycle');
        expect(screen.getByRole('link', { name: 'Honda CB500X' })).toHaveAttribute('href', '/posts?tag=honda-cb500x');
        expect(screen.getByText('Region')).toBeInTheDocument();
        expect(screen.queryByText('Route')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Oregon' })).toHaveAttribute('href', '/posts?tag=oregon');
        expect(screen.getByRole('link', { name: 'Idaho' })).toHaveAttribute('href', '/posts?tag=idaho');
    });

    it('omits optional trip facts when the manifest does not provide them', () => {
        const minimalManifest: TripManifest = {
            id: manifest.id,
            dates: manifest.dates,
            hero: manifest.hero,
            route: manifest.route,
            stops: manifest.stops,
            photos: manifest.photos,
        };
        renderStory(<TripFacts />, minimalManifest);

        expect(screen.getByText('May 1–3, 2024')).toBeInTheDocument();
        expect(screen.queryByText('Riding days')).not.toBeInTheDocument();
        expect(screen.queryByText('Distance')).not.toBeInTheDocument();
        expect(screen.queryByText('Motorcycle')).not.toBeInTheDocument();
        expect(screen.queryByText('Region')).not.toBeInTheDocument();
    });

    it('renders linked photos with intrinsic dimensions and captions', () => {
        renderStory(<TripPhoto photoId="camp" />, {
            ...manifest,
            photos: manifest.photos.map((photo) => photo.id === 'camp'
                ? { ...photo, location: 'Pacific Beach', date: '2024-05-02' }
                : photo),
        });

        const image = screen.getByRole('img', { name: 'A tent beside the motorcycle at dusk.' });
        const link = image.closest('a');
        const figure = image.closest('figure');
        expect(image).toHaveAttribute('width', '1200');
        expect(image).toHaveAttribute('height', '800');
        expect(image).toHaveAttribute('loading', 'lazy');
        expect(screen.getByText('Camp at the end of the first day.')).toBeInTheDocument();
        expect(screen.getByText('Pacific Beach')).toBeInTheDocument();
        expect(screen.queryByText('2024-05-02')).not.toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/images/trips/coastal-loop/camp.webp');
        expect(link).toHaveAttribute('aria-describedby', screen.getByText('Camp at the end of the first day.').id);
        expect(figure).toHaveClass('image-caption-figure');

        fireEvent.keyDown(link!, { key: 'Escape' });
        expect(figure).toHaveAttribute('data-caption-dismissed', 'true');
        fireEvent.mouseLeave(figure!);
        expect(figure).not.toHaveAttribute('data-caption-dismissed');
    });

    it('makes the hero a lightbox trigger containing every trip photo', () => {
        const { container } = renderStory(<TripHeroGallery />);

        const links = container.querySelectorAll('a[data-pswp-width]');
        expect(links).toHaveLength(2);
        expect(links[0]).toHaveAttribute('href', '/images/trips/coastal-loop/hero.webp');
        expect(links[1]).toHaveAttribute('href', '/images/trips/coastal-loop/camp.webp');
        expect(screen.getByRole('img', { name: manifest.photos[0].alt }).closest('a')).toBeVisible();
    });

    it('keeps each gallery caption inside its own figure', () => {
        const { container } = renderStory(<TripGallery galleryId="highlights" />);

        const figures = container.querySelectorAll('.image-caption-figure');
        expect(figures).toHaveLength(1);
        expect(figures[0].querySelectorAll(':scope > .image-caption-overlay')).toHaveLength(1);
        expect(figures[0].querySelector('.image-caption-overlay')).toHaveTextContent(
            'Camp at the end of the first day.',
        );
    });

    it('rejects gallery references to unknown photos', () => {
        expect(() => parseTripManifest({
            ...manifest,
            galleries: { highlights: ['missing-photo'] },
        })).toThrow(/references unknown photo/);
    });

    it('keeps hidden and expanded gallery captions equal, including locations', () => {
        const photos = Array.from({ length: 11 }, (_, index) => ({
            ...manifest.photos[1], id: `photo-${index}`, src: `/photo-${index}.webp`,
            caption: index === 10 ? '   ' : ' Camp. ', location: ' Coast ',
        }));
        const { container } = renderStory(<TripGallery galleryId="highlights" />, {
            ...manifest, photos, hero: photos[0].id, galleries: { highlights: photos.map(photo => photo.id) },
        });
        const captions = () => Array.from(container.querySelectorAll('a[data-pswp-width]'))
            .map(link => link.getAttribute('data-trip-caption'));
        const collapsed = captions();
        expect(screen.getAllByRole('img')).toHaveLength(9);
        expect(collapsed[9]).toBe('Camp. · Coast');
        expect(collapsed[10]).toBe(`${manifest.photos[1].alt} · Coast`);
        fireEvent.click(screen.getByRole('button', { name: 'Show all 11 photos' }));
        expect(screen.getAllByRole('img')).toHaveLength(11);
        expect(captions()).toEqual(collapsed);
        expect(screen.getByRole('button', { name: 'Show fewer photos' })).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Show fewer photos' }));
        expect(screen.getAllByRole('img')).toHaveLength(9);
        expect(captions()).toEqual(collapsed);
    });

    it('resets expansion when the gallery changes', () => {
        const photos = Array.from({ length: 11 }, (_, index) => ({
            ...manifest.photos[1], id: `photo-${index}`, src: `/photo-${index}.webp`,
        }));
        const tripManifest = {
            ...manifest, photos, hero: photos[0].id,
            galleries: { first: photos.map(photo => photo.id), second: photos.map(photo => photo.id) },
        };
        const story = (galleryId: string) => (
            <TripStoryProvider manifest={tripManifest}><TripGallery galleryId={galleryId} /></TripStoryProvider>
        );
        const { rerender } = render(story('first'));
        fireEvent.click(screen.getByRole('button', { name: 'Show all 11 photos' }));
        expect(screen.getAllByRole('img')).toHaveLength(11);

        rerender(story('second'));

        expect(screen.getAllByRole('img')).toHaveLength(9);
        expect(screen.getByRole('button', { name: 'Show all 11 photos' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows alt-only captions without repeating them to assistive technology', () => {
        renderStory(<TripPhoto photoId="hero" />);
        const image = screen.getByRole('img', { name: manifest.photos[0].alt });
        const caption = image.closest('figure')!.querySelector('figcaption')!;
        expect(caption).toHaveTextContent(manifest.photos[0].alt);
        expect(caption).not.toHaveClass('sr-only');
        expect(caption).toHaveAttribute('aria-hidden', 'true');
        expect(image.closest('a')).not.toHaveAttribute('aria-describedby');
    });

    it('uses alt text for blank captions in the hero viewer', () => {
        const { container } = renderStory(<TripHeroGallery />, {
            ...manifest, photos: manifest.photos.map(photo => ({ ...photo, caption: '  ', location: ' Coast ' })),
        });
        const captions = Array.from(container.querySelectorAll('a[data-pswp-width]'))
            .map(link => link.getAttribute('data-trip-caption'));
        expect(captions).toEqual(manifest.photos.map(photo => `${photo.alt} · Coast`));
    });

    it('rejects a hero reference to an unknown photo', () => {
        expect(() => parseTripManifest({ ...manifest, hero: 'missing-photo' }))
            .toThrow(/Hero references unknown photo/);
    });

    it('rejects invalid and reversed dates', () => {
        expect(() => parseTripManifest({
            ...manifest,
            dates: { start: '2024-05-03', end: '2024-05-01' },
        })).toThrow(/end date must be on or after/);
        expect(() => parseTripManifest({
            ...manifest,
            photos: [{ ...manifest.photos[0], date: 'May 2, 2024' }],
        })).toThrow(/Invalid ISO date/);
    });

    it('rejects duplicate route track IDs', () => {
        expect(() => parseTripManifest({
            ...manifest,
            route: {
                ...manifest.route,
                tracks: [
                    { id: 'outbound', name: 'Outbound' },
                    { id: 'outbound', name: 'Return' },
                ],
            },
        })).toThrow(/Duplicate track ID/);
    });

    it('rejects a non-positive riding-day count', () => {
        expect(() => parseTripManifest({
            ...manifest,
            ridingDays: 0,
        })).toThrow();
    });
});
