import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPostMeta } from '../content/posts';
import type { TripSummary } from '../features/trips/types';
import type { TripAtlasEntry } from '../features/trips/atlas/tripAtlasEntries';
import type { AtlasRouteState } from '../features/trips/atlas/tripAtlasView';
import { readAtlasSession } from '../features/trips/atlas/tripAtlasSession';
import AdvAtlas from '../pages/AdvAtlas';
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
    default: ({ selectedId, highlightedId, fitVersion, entries, routes, onSelect }: {
        selectedId?: string; highlightedId?: string; fitVersion: number; entries: TripAtlasEntry[]; routes: Record<string, AtlasRouteState>;
        onSelect: (id: string, options?: { focusCard: boolean }) => void;
    }) => (
        <>
            <output data-testid="atlas-renderer" data-selected={selectedId ?? ''} data-highlighted={highlightedId ?? ''} data-fit-version={fitVersion}
                data-trips={entries.map(entry => entry.id).join(',')} data-routes={Object.keys(routes).join(',')} />
            <button onClick={() => onSelect('published', { focusCard: true })}>Keyboard route choice</button>
            <button onClick={() => onSelect('published', { focusCard: false })}>Pointer route choice</button>
        </>
    ),
}));

beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
});

describe('atlas card interactions', () => {
    it.each(['Keyboard', 'Pointer'])('reveals a %s route choice and moves focus only for keyboard input', async input => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        const choice = await screen.findByRole('button', { name: `${input} route choice` });
        const toggle = screen.getByRole('button', { name: /Hide trips/ });
        const card = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        card.scrollIntoView = vi.fn();
        fireEvent.click(toggle);
        choice.focus();
        fireEvent.click(choice);
        const routeControl = screen.getByRole('button', { name: 'Show route: Published journey' });
        expect(card.scrollIntoView).toHaveBeenCalled();
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(input === 'Keyboard' ? routeControl : choice).toHaveFocus();
        fireEvent.click(toggle);
        toggle.focus();
        fireEvent.click(toggle);
        expect(toggle).toHaveFocus();
    });

    it('saves the current panel and card position before page unload and removes the listener after navigation', async () => {
        const add = vi.spyOn(window, 'addEventListener');
        const remove = vi.spyOn(window, 'removeEventListener');
        const { unmount } = renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map?test=pagehide' });
        await screen.findByTestId('atlas-renderer');
        const list = document.getElementById('atlas-trip-list')!;
        fireEvent.scroll(list, { target: { scrollTop: 180 } });
        fireEvent.click(screen.getByRole('button', { name: /Hide trips/ }));
        window.dispatchEvent(new Event('pagehide'));
        expect(readAtlasSession('new-key', '/projects/adv-atlas/map?test=pagehide')).toMatchObject({ panelOpen: false, scrollTop: 180 });
        const listener = add.mock.calls.find(([type]) => type === 'pagehide')![1];
        fireEvent.click(screen.getByRole('button', { name: /Browse trips/ }));
        unmount();
        expect(remove).toHaveBeenCalledWith('pagehide', listener);
        add.mockRestore();
        remove.mockRestore();
    });

    it('filters map and cards to the selected trip without refitting, and restores all trips when turned off', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        const renderer = await screen.findByTestId('atlas-renderer');
        const filter = screen.getByRole('button', { name: 'Show only selected trip' });
        expect(filter).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Show route: Published journey' }));
        expect(filter).toBeEnabled();
        const fitVersion = renderer.getAttribute('data-fit-version');
        fireEvent.click(filter);
        expect(filter).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
        expect(renderer).toHaveAttribute('data-trips', 'published');
        expect(renderer).toHaveAttribute('data-routes', 'published');
        expect(renderer).toHaveAttribute('data-selected', 'published');
        expect(renderer).toHaveAttribute('data-fit-version', fitVersion);
        fireEvent.click(filter);
        expect(renderer.getAttribute('data-trips')?.split(',')).toHaveLength(3);
        expect(renderer.getAttribute('data-routes')?.split(',')).toHaveLength(3);
        expect(renderer).toHaveAttribute('data-selected', 'published');
        expect(renderer).toHaveAttribute('data-fit-version', fitVersion);
    });

    it('opens a shared filtered view and Zoom to all trips clears both the filter and selection', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map?trip=published&view=selected' });
        const renderer = await screen.findByTestId('atlas-renderer');
        expect(screen.getByRole('button', { name: 'Show only selected trip' })).toHaveAttribute('aria-pressed', 'true');
        expect(renderer).toHaveAttribute('data-trips', 'published');
        fireEvent.click(screen.getByRole('button', { name: 'Zoom to all trips' }));
        expect(screen.getByRole('button', { name: 'Show only selected trip' })).toHaveAttribute('aria-pressed', 'false');
        expect(renderer.getAttribute('data-trips')?.split(',')).toHaveLength(3);
        expect(renderer).toHaveAttribute('data-selected', '');
    });

    it('selects a route from card content and fits it once per click, including the native route button', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        const renderer = await screen.findByTestId('atlas-renderer');
        const card = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        expect(screen.queryByRole('button', { name: 'Zoom to all trips' })).not.toBeInTheDocument();
        fireEvent.click(within(card).getByRole('img'));
        expect(renderer).toHaveAttribute('data-selected', 'published');
        expect(screen.getByRole('button', { name: 'Zoom to all trips' })).toBeInTheDocument();
        expect(renderer).toHaveAttribute('data-fit-version', '1');
        fireEvent.click(within(card).getByText('A synthetic motorcycle journey.'));
        expect(renderer).toHaveAttribute('data-fit-version', '2');
        fireEvent.click(within(card).getByRole('button', { name: /^Show route:/ }));
        expect(renderer).toHaveAttribute('data-fit-version', '3');
    });

    it('keeps report links independent of route selection and camera fitting', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        const renderer = await screen.findByTestId('atlas-renderer');
        const card = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        fireEvent.click(within(card).getByRole('link', { name: /Read trip report/ }));
        expect(renderer).toHaveAttribute('data-selected', '');
        expect(renderer).toHaveAttribute('data-fit-version', '0');
    });

    it('previews the card and map together without selecting or fitting the route', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        const renderer = await screen.findByTestId('atlas-renderer');
        const card = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        fireEvent.pointerEnter(card);
        expect(card).toHaveAttribute('data-highlighted', 'true');
        expect(renderer).toHaveAttribute('data-highlighted', 'published');
        expect(renderer).toHaveAttribute('data-selected', '');
        expect(renderer).toHaveAttribute('data-fit-version', '0');
        fireEvent.pointerLeave(card);
        expect(screen.queryByRole('button', { name: 'Zoom to all trips' })).not.toBeInTheDocument();
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
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        const draft = screen.getByRole('heading', { name: 'Draft journey' }).closest('li')!;
        const badge = within(draft).getByText('DEV · Unpublished draft');
        expect(badge).toHaveClass('text-amber-300', 'bg-amber-950/40');
        expect(within(draft).getByRole('link', { name: /Read trip report/ })).toHaveAttribute('href', '/trips/draft');
        const mixed = screen.getByRole('heading', { name: 'Published part' }).closest('li')!;
        expect(within(mixed).getByText('DEV · Includes drafts')).toBeInTheDocument();
        expect(within(mixed).getByRole('link', { name: /Unpublished part.*Draft/ })).toHaveAttribute('href', '/trips/part-two');
        const incomplete = screen.getByRole('heading', { name: 'Unconfigured journey' }).closest('li')!;
        expect(within(incomplete).getByRole('button', { name: /^Show route:/ })).toBeDisabled();
        expect(within(incomplete).getByRole('link', { name: /Preview report/ })).toHaveAttribute('href', '/trips/unconfigured');
        expect(within(incomplete).getByText('Trip dates not set')).toBeInTheDocument();
        expect(within(incomplete).getByText('Route data not available yet.')).toBeInTheDocument();
        expect(within(incomplete).queryByText('Loading route…')).not.toBeInTheDocument();
        const published = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        expect(within(published).queryByText(/DEV ·/)).not.toBeInTheDocument();
    });

    it('includes incomplete reports in a built development preview even with the production React runtime', async () => {
        vi.stubEnv('DEV', false);
        vi.stubEnv('MODE', 'development');
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        expect(screen.getByRole('heading', { name: 'Draft journey' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Unconfigured journey' })).toBeInTheDocument();
        const renderer = await screen.findByTestId('atlas-renderer');
        expect(renderer.getAttribute('data-trips')).not.toContain('missing');
        expect(renderer.getAttribute('data-routes')).not.toContain('missing');
    });

    it('excludes drafts and development badges from production, including unpublished parts of a published trip', () => {
        vi.stubEnv('DEV', false);
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
        expect(screen.queryByRole('heading', { name: 'Draft journey' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Unpublished part/ })).not.toBeInTheDocument();
        expect(screen.queryByText(/DEV ·/)).not.toBeInTheDocument();
    });
});
