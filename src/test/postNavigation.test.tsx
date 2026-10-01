import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PostNavigation } from '../blog/PostNavigation';
import type { BlogPostMeta } from '../content/posts';

vi.mock('../features/trips/tripSummaries', () => ({
    getTripSummary: (id?: string) => id === 'coast' ? {
        hero: { src: '/hero-1600.webp', width: 1600, height: 1000,
            srcSet: '/hero-960.webp 960w, invalid, /hero-480.webp 480w' },
    } : id === 'mountains' ? { hero: { src: '/mountains.webp', width: 1200, height: 800 } } : undefined,
}));

const previous: BlogPostMeta = {
    slug: 'older-trip', title: 'Older trip', description: 'Coast trip', date: '2024-01-01',
    tags: [], format: 'trip', tripId: 'coast',
};
const next: BlogPostMeta = { slug: 'newer-post', title: 'Newer post', description: 'Writing', date: '2025-01-01', tags: [] };
const returnTo = '/posts?type=trips&tag=coast';

function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{JSON.stringify({ url: location.pathname + location.search, state: location.state })}</output>;
}

function renderNavigation(props: React.ComponentProps<typeof PostNavigation>) {
    return render(<MemoryRouter><PostNavigation {...props} /><LocationProbe /></MemoryRouter>);
}

describe('PostNavigation', () => {
    it('uses canonical collections, descriptive names, and the smallest available thumbnail', () => {
        renderNavigation({ previous, next, returnTo });
        const older = screen.getByRole('link', { name: 'Previous post Older trip' });
        expect(older).toHaveAttribute('href', '/trips/older-trip');
        expect(older).toHaveAttribute('rel', 'prev');
        expect(older.querySelector('img')).toHaveAttribute('src', '/hero-480.webp');
        expect(older.querySelector('img')).toHaveAttribute('alt', '');
        expect(older.querySelector('img')).toHaveAttribute('loading', 'lazy');
        const newer = screen.getByRole('link', { name: 'Next post Newer post' });
        expect(newer).toHaveAttribute('href', '/blog/newer-post');
        expect(newer).toHaveAttribute('rel', 'next');
        expect(newer.querySelector('img')).toBeNull();
        fireEvent.click(older);
        expect(JSON.parse(screen.getByTestId('location').textContent!)).toEqual({ url: '/trips/older-trip', state: { from: returnTo } });
    });

    it('retains the source image when no srcset is available', () => {
        renderNavigation({ next: { ...previous, tripId: 'mountains' }, returnTo });
        expect(screen.getByRole('link', { name: 'Next post Older trip' }).querySelector('img')).toHaveAttribute('src', '/mountains.webp');
    });

    it('keeps a return link for single-post collections and requests scroll restoration', () => {
        renderNavigation({ returnTo });
        expect(screen.getAllByRole('link')).toHaveLength(1);
        fireEvent.click(screen.getByRole('link', { name: 'Back to posts' }));
        expect(JSON.parse(screen.getByTestId('location').textContent!)).toEqual({ url: returnTo, state: { restoreScroll: true } });
    });
});
