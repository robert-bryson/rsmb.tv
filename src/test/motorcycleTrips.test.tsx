import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPostMeta } from '../content/posts';
import type { TripSummary } from '../features/trips/types';
import MotorcycleTrips from '../pages/MotorcycleTrips';
import { renderWithRouter } from './helpers/router';

const fixtures = vi.hoisted(() => {
    const summary = (id: string): TripSummary => ({
        id, dates: { start: '2024-05-01', end: '2024-05-02' },
        hero: { id: 'hero', src: '/hero.webp', width: 800, height: 600, alt: 'A mountain road.' },
        route: { geoJson: `/routes/${id}.geojson` },
    });
    const post = (slug: string, title: string, tripId: string, draft = false): BlogPostMeta => ({
        slug, title, tripId, format: 'trip', description: 'A synthetic motorcycle journey.', date: '2024-05-03', tags: [],
        ...(draft ? { development: { published: false, rowNumber: 2, issues: [], contentAvailable: true, manifestAvailable: true } } : {}),
    });
    return {
        posts: [
            post('published', 'Published journey', 'published'),
            post('draft', 'Draft journey', 'draft', true),
            post('part-one', 'Published part', 'mixed'),
            post('part-two', 'Unpublished part', 'mixed', true),
            post('unconfigured', 'Unconfigured journey', 'missing', true),
        ],
        summaries: { published: summary('published'), draft: summary('draft'), mixed: summary('mixed') } as Record<string, TripSummary>,
        retry: () => {},
    };
});

vi.mock('../content/posts', () => ({ getTripPosts: () => fixtures.posts }));
vi.mock('../features/trips/tripSummaries', () => ({ getTripSummary: (id: string) => fixtures.summaries[id] }));
vi.mock('../features/trips/useTripRoute', () => ({ useTripRoute: () => ({ route: null, error: '', retry: fixtures.retry }) }));
vi.mock('../features/trips/atlas/TripAtlasMap', () => ({
    default: ({ selectedId, highlightedId, fitVersion }: { selectedId?: string; highlightedId?: string; fitVersion: number }) => (
        <output data-testid="atlas-renderer" data-selected={selectedId ?? ''} data-highlighted={highlightedId ?? ''} data-fit-version={fitVersion} />
    ),
}));

beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
});

describe('atlas card interactions', () => {
    it('selects a route from card content and fits it once per click, including the native route button', async () => {
        renderWithRouter(<MotorcycleTrips />, { route: '/projects/motorcycle-trips/map' });
        const renderer = await screen.findByTestId('atlas-renderer');
        const card = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        fireEvent.click(within(card).getByRole('img'));
        expect(renderer).toHaveAttribute('data-selected', 'published');
        expect(renderer).toHaveAttribute('data-fit-version', '1');
        fireEvent.click(within(card).getByText('A synthetic motorcycle journey.'));
        expect(renderer).toHaveAttribute('data-fit-version', '2');
        fireEvent.click(within(card).getByRole('button', { name: /^Show route:/ }));
        expect(renderer).toHaveAttribute('data-fit-version', '3');
    });

    it('keeps report links independent of route selection and camera fitting', async () => {
        renderWithRouter(<MotorcycleTrips />, { route: '/projects/motorcycle-trips/map' });
        const renderer = await screen.findByTestId('atlas-renderer');
        const card = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        fireEvent.click(within(card).getByRole('link', { name: /Read trip report/ }));
        expect(renderer).toHaveAttribute('data-selected', '');
        expect(renderer).toHaveAttribute('data-fit-version', '0');
    });

    it('previews the card and map together without selecting or fitting the route', async () => {
        renderWithRouter(<MotorcycleTrips />, { route: '/projects/motorcycle-trips/map' });
        const renderer = await screen.findByTestId('atlas-renderer');
        const card = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        fireEvent.pointerEnter(card);
        expect(card).toHaveAttribute('data-highlighted', 'true');
        expect(renderer).toHaveAttribute('data-highlighted', 'published');
        expect(renderer).toHaveAttribute('data-selected', '');
        expect(renderer).toHaveAttribute('data-fit-version', '0');
        fireEvent.pointerLeave(card);
        expect(card).not.toHaveAttribute('data-highlighted');
        expect(renderer).toHaveAttribute('data-highlighted', '');
    });
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('atlas publication labels', () => {
    it('includes configured development drafts with subtle amber labels and identifies mixed multipart reports', () => {
        vi.stubEnv('DEV', true);
        renderWithRouter(<MotorcycleTrips />, { route: '/projects/motorcycle-trips/map' });
        const draft = screen.getByRole('heading', { name: 'Draft journey' }).closest('li')!;
        const badge = within(draft).getByText('DEV · Unpublished draft');
        expect(badge).toHaveClass('text-amber-300', 'bg-amber-950/40');
        expect(within(draft).getByRole('link', { name: /Read trip report/ })).toHaveAttribute('href', '/trips/draft');
        const mixed = screen.getByRole('heading', { name: 'Published part' }).closest('li')!;
        expect(within(mixed).getByText('DEV · Includes drafts')).toBeInTheDocument();
        expect(within(mixed).getByRole('link', { name: /Unpublished part.*Draft/ })).toHaveAttribute('href', '/trips/part-two');
        expect(screen.queryByRole('heading', { name: 'Unconfigured journey' })).not.toBeInTheDocument();
        const published = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        expect(within(published).queryByText(/DEV ·/)).not.toBeInTheDocument();
    });

    it('excludes drafts and development badges from production, including unpublished parts of a published trip', () => {
        vi.stubEnv('DEV', false);
        renderWithRouter(<MotorcycleTrips />, { route: '/projects/motorcycle-trips/map' });
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
        expect(screen.queryByRole('heading', { name: 'Draft journey' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Unpublished part/ })).not.toBeInTheDocument();
        expect(screen.queryByText(/DEV ·/)).not.toBeInTheDocument();
    });
});
