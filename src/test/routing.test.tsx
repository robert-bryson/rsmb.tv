import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdvAtlasRedirect, LegacyPostsRedirect } from '../App';
import { ScrollToTop } from '../components/ScrollToTop';

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
        render(
            <MemoryRouter initialEntries={[route]}>
                <LocationProbe />
                <Routes>
                    <Route path="/blog" element={<LegacyPostsRedirect type={type} />} />
                    <Route path="/trips" element={<LegacyPostsRedirect type={type} />} />
                    <Route path="/posts" element={null} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByTestId('location')).toHaveTextContent(expectedLocation);
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
