import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TripStoryProvider } from '../features/trips/TripStoryProvider';
import { TripFacts } from '../features/trips/components/TripFacts';
import { TripPhoto } from '../features/trips/components/TripPhoto';
import { parseTripManifest } from '../features/trips/tripManifests';
import type { TripManifest } from '../features/trips/types';

const manifest: TripManifest = {
    id: 'coastal-loop',
    dates: { start: '2024-05-01', end: '2024-05-03' },
    distanceMiles: 642,
    motorcycle: 'Honda VFR',
    regions: ['Oregon', 'California'],
    hero: {
        id: 'hero',
        src: '/images/trips/coastal-loop/hero.webp',
        width: 1600,
        height: 1067,
        alt: 'Motorcycle parked above the Pacific coast.',
    },
    route: { geoJson: '/data/trips/coastal-loop.geojson' },
    stops: [],
    photos: [{
        id: 'camp',
        src: '/images/trips/coastal-loop/camp.webp',
        width: 1200,
        height: 800,
        alt: 'A tent beside the motorcycle at dusk.',
        caption: 'Camp at the end of the first day.',
    }],
    galleries: { highlights: ['camp'] },
};

function renderStory(children: React.ReactNode) {
    return render(
        <MemoryRouter>
            <TripStoryProvider manifest={manifest}>{children}</TripStoryProvider>
        </MemoryRouter>,
    );
}

describe('trip story primitives', () => {
    it('renders trip facts as readable metadata', () => {
        renderStory(<TripFacts />);

        expect(screen.getByText('642 miles')).toBeInTheDocument();
        expect(screen.getByText('Honda VFR')).toBeInTheDocument();
        expect(screen.getByText('Oregon · California')).toBeInTheDocument();
    });

    it('renders linked photos with intrinsic dimensions and captions', () => {
        renderStory(<TripPhoto photoId="camp" />);

        const image = screen.getByRole('img', { name: 'A tent beside the motorcycle at dusk.' });
        expect(image).toHaveAttribute('width', '1200');
        expect(image).toHaveAttribute('height', '800');
        expect(image).toHaveAttribute('loading', 'lazy');
        expect(screen.getByText('Camp at the end of the first day.')).toBeInTheDocument();
        expect(image.closest('a')).toHaveAttribute('href', '/images/trips/coastal-loop/camp.webp');
    });

    it('rejects gallery references to unknown photos', () => {
        expect(() => parseTripManifest({
            ...manifest,
            galleries: { highlights: ['missing-photo'] },
        })).toThrow(/references unknown photo/);
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
});