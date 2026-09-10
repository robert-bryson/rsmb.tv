import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LegacyPostsRedirect } from '../App';
import { ScrollToTop } from '../components/ScrollToTop';

function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{location.pathname}{location.search}</output>;
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