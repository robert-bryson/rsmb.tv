import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, parsePath, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPostMeta } from '../content/posts';
import type { TripSummary } from '../features/trips/types';
import type { TripAtlasEntry } from '../features/trips/atlas/tripAtlasEntries';
import type { AtlasRouteState } from '../features/trips/atlas/tripAtlasView';
import { readAtlasSession, saveAtlasSession, type AtlasCamera } from '../features/trips/atlas/tripAtlasSession';
import AdvAtlas from '../pages/AdvAtlas';

let visit = 0;
function renderWithRouter(ui: React.ReactElement, { route = '/', state = null as unknown } = {}) {
    return render(<MemoryRouter initialEntries={[{ ...parsePath(route), key: `atlas-unit-${++visit}`, state }]}>{ui}</MemoryRouter>);
}
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
function UrlProbe() { const location = useLocation(); return <output data-testid="atlas-url" data-history-key={location.key}>{location.pathname + location.search}</output>; }

const fixtures = vi.hoisted(() => {
    const summary = (id: string): TripSummary => ({
        id, dates: { start: '2024-05-01', end: '2024-05-02' },
        hero: { id: 'hero', src: '/hero.webp', width: 800, height: 600, alt: 'A mountain road.' },
        route: { geoJson: `/routes/${id}.geojson` },
        ...(id === 'published' ? { ridingDays: 3, distanceMiles: 600.1, motorcycle: 'Honda CB500X', countries: [{ code: 'US', regions: ['Washington'] }] } : {}),
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
        route: { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [[-123, 46], [-124, 45]] } },
    };
});

vi.mock('../content/posts', () => ({ getTripPosts: () => fixtures.posts }));
vi.mock('../features/trips/tripSummaries', () => ({ getTripSummary: (id: string) => fixtures.summaries[id] }));
vi.mock('../features/trips/useTripRoute', () => ({ useTripRoute: () => ({
    route: fixtures.route,
    error: '', retry: fixtures.retry,
}) }));
vi.mock('../features/trips/atlas/TripAtlasMap', () => ({
    default: ({ selectedId, highlightedId, fitVersion, fitRequest, entries, routes, initialCamera, onSelect, onCameraChange, onCameraIdle }: {
        selectedId?: string; highlightedId?: string; fitVersion: number; entries: TripAtlasEntry[]; routes: Record<string, AtlasRouteState>;
        initialCamera?: AtlasCamera; onCameraChange: (camera: AtlasCamera) => void; onCameraIdle: (camera: AtlasCamera) => void;
        fitRequest?: { bounds?: number[] };
        onSelect: (id: string, options?: { focusCard: boolean }) => void;
    }) => (
        <>
            <output data-testid="atlas-renderer" data-selected={selectedId ?? ''} data-highlighted={highlightedId ?? ''} data-fit-version={fitVersion}
                data-trips={entries.map(entry => entry.id).join(',')} data-routes={Object.keys(routes).join(',')} data-initial-camera={JSON.stringify(initialCamera)}
                data-fit-bounds={JSON.stringify(fitRequest?.bounds)} />
            <button onClick={() => onSelect('published', { focusCard: true })}>Keyboard route choice</button>
            <button onClick={() => onSelect('published', { focusCard: false })}>Pointer route choice</button>
            <button onClick={() => onCameraChange({ center: [-110, 42], zoom: 6.456789, bearing: -12, pitch: 20 })}>Move map gesture</button>
            <button onClick={() => onCameraIdle({ center: [-110, 42], zoom: 6.456789, bearing: -12, pitch: 20 })}>End map gesture</button>
            <button onClick={() => { onSelect('published', { focusCard: false }); onCameraIdle({ center: [-110, 42], zoom: 6, bearing: 0, pitch: 0 }); }}>Select and finish fit</button>
        </>
    ),
}));

beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: vi.fn() });
});

describe('atlas card interactions', () => {
    it.each(['Keyboard', 'Pointer'])('reveals a %s route choice and moves focus only for keyboard input', async input => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        const choice = await screen.findByRole('button', { name: `${input} route choice` });
        const toggle = screen.getByRole('button', { name: 'Collapse trip panel' });
        const card = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        card.scrollIntoView = vi.fn();
        fireEvent.click(toggle);
        choice.focus();
        fireEvent.click(choice);
        const routeControl = screen.getByRole('button', { name: 'Published journey' });
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
        fireEvent.click(screen.getByRole('button', { name: 'Collapse trip panel' }));
        window.dispatchEvent(new Event('pagehide'));
        expect(readAtlasSession('new-key', '/projects/adv-atlas/map?test=pagehide')).toMatchObject({ panelOpen: false, scrollTop: 180 });
        const listener = add.mock.calls.find(([type]) => type === 'pagehide')![1];
        fireEvent.click(screen.getByRole('button', { name: 'Show trips' }));
        unmount();
        expect(remove).toHaveBeenCalledWith('pagehide', listener);
        add.mockRestore();
        remove.mockRestore();
    });

    it('filters map and cards to the selected trip without refitting, and restores all trips when turned off', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        const renderer = await screen.findByTestId('atlas-renderer');
        expect(screen.queryByRole('button', { name: 'Show only selected trip' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Published journey' }));
        const filter = screen.getByRole('button', { name: 'Show only selected trip' });
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
        expect(screen.queryByRole('button', { name: 'Show only selected trip' })).not.toBeInTheDocument();
        expect(renderer.getAttribute('data-trips')?.split(',')).toHaveLength(3);
        expect(renderer).toHaveAttribute('data-selected', '');
    });

    it('selects a route from card content and fits it once per click, including the trip title', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        const renderer = await screen.findByTestId('atlas-renderer');
        const card = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        expect(screen.queryByRole('button', { name: /Show route/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Zoom to all trips' })).not.toBeInTheDocument();
        fireEvent.click(within(card).getByRole('img'));
        expect(renderer).toHaveAttribute('data-selected', 'published');
        expect(screen.getByRole('button', { name: 'Zoom to all trips' })).toBeInTheDocument();
        expect(renderer).toHaveAttribute('data-fit-version', '1');
        fireEvent.click(within(card).getByText('A synthetic motorcycle journey.'));
        expect(renderer).toHaveAttribute('data-fit-version', '2');
        fireEvent.click(within(card).getByRole('button', { name: /^(?:Published journey|Unconfigured journey)$/ }));
        expect(renderer).toHaveAttribute('data-fit-version', '3');
    });

    it('explores a card region with its geographic bounds, replacing location and selected-only filters', async () => {
        renderWithRouter(<><AdvAtlas /><UrlProbe /></>, { route: '/projects/adv-atlas/map?trip=published&view=selected&sort=miles-asc&from=2024-01-01&to=2024-12-31' });
        const renderer = await screen.findByTestId('atlas-renderer');
        fireEvent.click(screen.getByRole('button', { name: 'Explore Washington, United States' }));
        const params = new URLSearchParams(screen.getByTestId('atlas-url').textContent!.split('?')[1]);
        expect(params.get('region')).toBe('US/washington');
        expect(params.has('country')).toBe(false);
        expect(params.has('trip')).toBe(false);
        expect(params.has('view')).toBe(false);
        expect(params.get('from')).toBe('2024-01-01');
        expect(params.get('sort')).toBe('miles-asc');
        expect(renderer).toHaveAttribute('data-fit-bounds', '[-124.71,45.5911,-116.8965,48.9931]');
        expect(renderer).toHaveAttribute('data-trips', 'published');
        expect(renderer).toHaveAttribute('data-fit-version', '1');
        expect(screen.getByRole('button', { name: /^Filters/ })).toHaveFocus();
    });

    it('keeps report links independent of route selection and camera fitting', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        const renderer = await screen.findByTestId('atlas-renderer');
        const card = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        fireEvent.click(within(card).getByRole('link', { name: /Read trip report/ }));
        expect(renderer).toHaveAttribute('data-selected', '');
        expect(renderer).toHaveAttribute('data-fit-version', '0');
    });

    it('selects table row content once while keeping route buttons, region details, and report links independent', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map?panel=expanded&results=table' });
        const renderer = await screen.findByTestId('atlas-renderer');
        const row = screen.getByRole('heading', { name: 'Published journey' }).closest('tr')!;
        expect(screen.getByRole('columnheader', { name: 'Motorcycle' })).toBeInTheDocument();
        expect(within(row).getByRole('cell', { name: 'Honda CB500X' })).toBeInTheDocument();
        expect(screen.queryByText(/Compare matching trips/)).not.toBeInTheDocument();
        fireEvent.click(within(row).getByRole('heading'));
        expect(renderer).toHaveAttribute('data-selected', 'published');
        expect(renderer).toHaveAttribute('data-fit-version', '1');
        fireEvent.click(within(row).getByRole('cell', { name: 'Honda CB500X' }));
        expect(renderer).toHaveAttribute('data-fit-version', '2');
        fireEvent.click(within(row).getByRole('button', { name: /^(?:Published journey|Unconfigured journey)$/ }));
        expect(renderer).toHaveAttribute('data-fit-version', '3');
        fireEvent.click(within(row).getByRole('link', { name: /Read trip report/ }));
        expect(renderer).toHaveAttribute('data-fit-version', '3');
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
    if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

describe('atlas browsing controls', () => {
    it('resets every applied filter from the header while keeping the selected trip and table view', async () => {
        renderWithRouter(<><AdvAtlas /><UrlProbe /></>, { route: '/projects/adv-atlas/map?trip=published&view=selected&milesMin=600&panel=expanded&results=table' });
        const renderer = await screen.findByTestId('atlas-renderer');
        const controls = screen.getByRole('group', { name: 'Trip browsing controls' });
        expect(within(controls).getByRole('button', { name: 'Show only selected trip' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(within(controls).getByRole('button', { name: 'Reset filters' }));
        expect(renderer.getAttribute('data-trips')?.split(',')).toHaveLength(3);
        expect(renderer).toHaveAttribute('data-selected', 'published');
        expect(within(controls).getByRole('button', { name: 'Show only selected trip' })).toHaveAttribute('aria-pressed', 'false');
        expect(within(controls).queryByRole('button', { name: 'Reset filters' })).not.toBeInTheDocument();
        expect(within(controls).getByRole('button', { name: 'Filters' })).toHaveFocus();
        expect(screen.getByRole('radio', { name: 'Table' })).toBeChecked();
        const params = new URL(screen.getByTestId('atlas-url').textContent!, 'https://rsmb.tv').searchParams;
        expect(params.has('view')).toBe(false);
        expect(params.has('milesMin')).toBe(false);
    });

    it('suspends camera URL writes during a browser history transition and resumes after the location commits', async () => {
        const before = window.location.href;
        const beforeState: unknown = window.history.state;
        window.history.replaceState(null, '', '/projects/adv-atlas/map');
        try {
            renderWithRouter(<><AdvAtlas /><UrlProbe /></>, { route: '/projects/adv-atlas/map' });
            await screen.findByTestId('atlas-renderer');
            window.history.replaceState({ key: 'uncommitted-destination' }, '', '/projects/adv-atlas/map');
            fireEvent.click(screen.getByRole('button', { name: 'End map gesture' }));
            expect(screen.getByTestId('atlas-url').textContent).toBe('/projects/adv-atlas/map');
            fireEvent.click(screen.getByRole('button', { name: 'Expand trip panel' }));
            window.history.replaceState({ key: screen.getByTestId('atlas-url').getAttribute('data-history-key') }, '', '/projects/adv-atlas/map');
            fireEvent.click(screen.getByRole('button', { name: 'End map gesture' }));
            expect(screen.getByTestId('atlas-url')).toHaveTextContent('camera=-110%2C42%2C6.4568%2C-12%2C20');
        } finally { window.history.replaceState(beforeState, '', before); }
    });

    it('does not let a late camera event interrupt report navigation', async () => {
        renderWithRouter(<><AdvAtlas /><UrlProbe /></>, { route: '/projects/adv-atlas/map' });
        await screen.findByTestId('atlas-renderer');
        const card = screen.getByRole('heading', { name: 'Published journey' }).closest('li')!;
        fireEvent.click(within(card).getByRole('link', { name: 'Read trip report' }));
        expect(screen.getByTestId('atlas-url')).toHaveTextContent('/trips/published');
        fireEvent.click(screen.getByRole('button', { name: 'End map gesture' }));
        expect(screen.getByTestId('atlas-url').textContent).toBe('/trips/published');
    });

    it('retains a requested panel opening if a fit ends before the URL transition commits', async () => {
        renderWithRouter(<><AdvAtlas /><UrlProbe /></>, { route: '/projects/adv-atlas/map?panel=collapsed&results=table' });
        await screen.findByTestId('atlas-renderer');
        fireEvent.click(screen.getByRole('button', { name: 'Select and finish fit' }));
        const url = new URL(screen.getByTestId('atlas-url').textContent!, 'https://rsmb.tv');
        expect(url.searchParams.get('panel')).toBe('compact');
        expect(url.searchParams.get('results')).toBe('table');
        expect(url.searchParams.get('trip')).toBe('published');
    });

    it('composes trip selection, panel opening, and camera URLs without losing browse filters', async () => {
        renderWithRouter(<><AdvAtlas /><UrlProbe /></>, { route: '/projects/adv-atlas/map?country=US&sort=days-desc' });
        await screen.findByTestId('atlas-renderer');
        fireEvent.click(screen.getByRole('button', { name: 'Collapse trip panel' }));
        expect(screen.getByTestId('atlas-url')).toHaveTextContent('panel=collapsed');
        fireEvent.click(screen.getByRole('button', { name: 'Keyboard route choice' }));
        const url = () => new URL(screen.getByTestId('atlas-url').textContent!, 'https://rsmb.tv');
        expect(url().searchParams.get('trip')).toBe('published');
        expect(url().searchParams.get('panel')).toBe('compact');
        fireEvent.click(screen.getByRole('button', { name: 'Move map gesture' }));
        expect(url().searchParams.has('camera')).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: 'End map gesture' }));
        expect(url().searchParams.get('camera')).toBe('-110,42,6.4568,-12,20');
        expect(url().searchParams.get('country')).toBe('US');
        expect(url().searchParams.get('sort')).toBe('days-desc');
    });

    it('gives an explicit shared presentation and camera priority over a different saved view', async () => {
        const url = '/projects/adv-atlas/map?panel=expanded&results=table&camera=-100,40,5,22,30';
        saveAtlasSession('url-priority', url, { panelOpen: false, panelState: 'collapsed', resultsView: 'cards', scrollTop: 0,
            camera: { center: [-120, 48], zoom: 8, bearing: 0, pitch: 0 } });
        renderWithRouter(<AdvAtlas />, { route: url, state: { restoreScroll: true, returnKey: 'url-priority' } });
        const map = await screen.findByTestId('atlas-renderer');
        expect(screen.getByRole('main')).toHaveAttribute('data-panel-state', 'expanded');
        expect(screen.getByRole('radio', { name: 'Table' })).toBeChecked();
        expect(JSON.parse(map.getAttribute('data-initial-camera')!)).toEqual({ center: [-100, 40], zoom: 5, bearing: 22, pitch: 30 });
    });

    it('reaches all drawer states, removes collapsed controls from tab order, and preserves the expanded table preference', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        await screen.findByTestId('atlas-renderer');
        const root = screen.getByRole('main');
        expect(root).toHaveAttribute('data-panel-state', 'compact');
        fireEvent.click(screen.getByRole('button', { name: 'Expand trip panel' }));
        expect(root).toHaveAttribute('data-panel-state', 'expanded');
        const list = document.getElementById('atlas-trip-list')!;
        fireEvent.scroll(list, { target: { scrollTop: 300 } });
        fireEvent.click(screen.getByRole('radio', { name: 'Table' }));
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(list.scrollTop).toBe(0);
        fireEvent.scroll(list, { target: { scrollTop: 300 } });
        fireEvent.click(screen.getByRole('button', { name: 'Use compact trip panel' }));
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        expect(list.scrollTop).toBe(0);
        fireEvent.scroll(list, { target: { scrollTop: 300 } });
        fireEvent.click(screen.getByRole('button', { name: 'Expand trip panel' }));
        expect(screen.getByRole('radio', { name: 'Table' })).toBeChecked();
        expect(list.scrollTop).toBe(0);
        const route = screen.getByRole('button', { name: 'Published journey' });
        route.focus();
        fireEvent.click(screen.getByRole('button', { name: 'Collapse trip panel' }));
        expect(root).toHaveAttribute('data-panel-state', 'collapsed');
        expect(screen.queryByRole('button', { name: 'Published journey' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Expand trip panel' })).toHaveFocus();
    });

    it('keeps preset drafts separate and synchronizes applied cards and map IDs', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map' });
        const renderer = await screen.findByTestId('atlas-renderer');
        fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
        fireEvent.change(screen.getByLabelText('Distance'), { target: { value: '500/1500' } });
        expect(renderer.getAttribute('data-trips')?.split(',')).toHaveLength(3);
        fireEvent.submit(screen.getByRole('form', { name: 'Filter trips' }));
        expect(renderer).toHaveAttribute('data-trips', 'published');
        expect(renderer).toHaveAttribute('data-routes', 'published');
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
        expect(screen.getByRole('button', { name: /^Filters/ })).toHaveFocus();
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(renderer.getAttribute('data-trips')?.split(',')).toHaveLength(3);
    });

    it('retains a selection excluded by filters without drawing its route, and shows selected-only only for that valid selection', async () => {
        renderWithRouter(<AdvAtlas />, { route: '/projects/adv-atlas/map?trip=mixed&milesMin=600' });
        const renderer = await screen.findByTestId('atlas-renderer');
        expect(screen.getByText('Selected trip “Published part” is outside these filters.')).toBeInTheDocument();
        expect(renderer).toHaveAttribute('data-trips', 'published');
        expect(renderer).toHaveAttribute('data-routes', 'published');
        expect(screen.getByRole('button', { name: 'Show only selected trip' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Show only selected trip' }));
        expect(renderer).toHaveAttribute('data-trips', '');
        fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
        expect(screen.queryByRole('button', { name: 'Show only selected trip' })).not.toBeInTheDocument();
        expect(renderer).toHaveAttribute('data-trips', 'published');
    });

    it('restores expanded tables from a named source visit and migrates legacy collapsed sessions', async () => {
        const url = '/projects/adv-atlas/map?test=preferences';
        saveAtlasSession('expanded-source', url, { panelOpen: true, panelState: 'expanded', resultsView: 'table', scrollTop: 80 });
        const first = renderWithRouter(<AdvAtlas />, { route: url, state: { restoreScroll: true, returnKey: 'expanded-source' } });
        await screen.findByTestId('atlas-renderer');
        expect(screen.getByRole('main')).toHaveAttribute('data-panel-state', 'expanded');
        expect(screen.getByRole('radio', { name: 'Table' })).toBeChecked();
        first.unmount();
        saveAtlasSession('legacy-source', url, { panelOpen: false, scrollTop: 0 });
        renderWithRouter(<AdvAtlas />, { route: url, state: { restoreScroll: true, returnKey: 'legacy-source' } });
        expect(screen.getByRole('main')).toHaveAttribute('data-panel-state', 'collapsed');
        fireEvent.click(screen.getByRole('button', { name: 'Show trips' }));
        expect(screen.getByRole('main')).toHaveAttribute('data-panel-state', 'compact');
    });
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
        expect(within(incomplete).getByRole('button', { name: /^(?:Published journey|Unconfigured journey)$/ })).toBeDisabled();
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
