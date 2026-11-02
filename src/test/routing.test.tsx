import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App, { AdvAtlasRedirect, LegacyPostsRedirect } from '../App';
import { ScrollToTop } from '../components/ScrollToTop';

vi.mock('../pages/Home', () => ({ Home: () => <h1>Home page</h1> }));
vi.mock('../pages/About', () => ({ About: () => <h1>About page</h1> }));
vi.mock('../pages/Parc', () => ({ default: () => <h1>Parc page</h1> }));

describe('generated HTML routes', () => {
    it.each([
        ['/index.html', '/', 'Home page'],
        ['/about.html', '/about', 'About page'],
        ['/about/', '/about', 'About page'],
        ['/projects/parc.html/', '/projects/parc', 'Parc page'],
    ])('renders %s without losing navigation state or adding a history entry', async (pathname, canonical, heading) => {
        vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
        const returnState = { restoreScroll: true };
        window.history.replaceState({ usr: returnState, key: 'html-route', idx: 0 }, '', `${pathname}?source=share#heading`);
        const historyLength = window.history.length;

        const { unmount } = render(<App />);
        expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
        expect(window.location.pathname).toBe(canonical);
        expect(window.location.search).toBe('?source=share');
        expect(window.location.hash).toBe('#heading');
        expect(window.history.length).toBe(historyLength);
        expect(window.history.state.usr).toEqual(returnState);
        unmount();
        window.history.replaceState(null, '', '/');
    });
});

function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location" data-state={JSON.stringify(location.state)}>{location.pathname}{location.search}{location.hash}</output>;
}

function NavigationControls() {
    const navigate = useNavigate();
    return (
        <>
            <button type="button" onClick={() => navigate('/second')}>Change page</button>
            <button type="button" onClick={() => navigate('?tag=Maps')}>Change query</button>
        </>
    );
}

describe('legacy post index routes', () => {
    it.each([
        ['/blog?tag=Maps', 'writing', '/posts?tag=Maps&type=writing'],
        ['/trips?tag=Travel', 'trips', '/posts?tag=Travel&type=trips'],
    ] as const)('redirects %s and preserves its tag filter', (route, type, expectedLocation) => {
        const url = new URL(route, 'https://rsmb.tv');
        render(
            <MemoryRouter initialEntries={[{ pathname: url.pathname, search: url.search, hash: '#heading', state: { restoreScroll: true } }]}>
                <LocationProbe />
                <Routes>
                    <Route path="/blog" element={<LegacyPostsRedirect type={type} />} />
                    <Route path="/trips" element={<LegacyPostsRedirect type={type} />} />
                    <Route path="/posts" element={null} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByTestId('location')).toHaveTextContent(`${expectedLocation}#heading`);
        expect(screen.getByTestId('location')).toHaveAttribute('data-state', '{"restoreScroll":true}');
    });
});

describe('ADV Atlas redirects', () => {
    it.each([
        '/projects/adv-atlas',
        '/projects/motorcycle-trips',
        '/projects/motorcycle-trips/map',
    ])('preserves selected trips, filters, fragments, and return state from %s', pathname => {
        render(
            <MemoryRouter initialEntries={[{ pathname, search: '?trip=coast&view=selected', hash: '#atlas-panel-toggle', state: { restoreScroll: true } }]}>
                <LocationProbe />
                <Routes>
                    <Route path={pathname} element={<AdvAtlasRedirect />} />
                    <Route path="/projects/adv-atlas/map" element={null} />
                </Routes>
            </MemoryRouter>,
        );
        expect(screen.getByTestId('location')).toHaveTextContent('/projects/adv-atlas/map?trip=coast&view=selected#atlas-panel-toggle');
        expect(screen.getByTestId('location')).toHaveAttribute('data-state', '{"restoreScroll":true}');
    });
});

describe('ScrollToTop', () => {
    it('scrolls on page changes but not query changes', () => {
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
        render(
            <MemoryRouter initialEntries={['/first']}>
                <ScrollToTop />
                <NavigationControls />
            </MemoryRouter>,
        );

        expect(scrollTo).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Change query' }));
        expect(scrollTo).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Change page' }));
        expect(scrollTo).toHaveBeenCalledTimes(2);
        expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    });
});
