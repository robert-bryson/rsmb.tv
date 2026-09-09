import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithRouter } from './helpers/router';

const testPosts = vi.hoisted(() => [
    {
        slug: 'mapping-boring-data',
        title: 'Mapping Boring Data',
        date: '2026-04-20',
        description: 'A post about putting dull data on maps.',
        tags: ['Maps', 'Data Viz'],
    },
    {
        slug: 'weather-records',
        title: 'Weather Records',
        date: '2026-03-15',
        description: 'A post about records and climate normals.',
        tags: ['Weather', 'Data Viz'],
    },
    {
        slug: 'react-routing',
        title: 'React Routing',
        date: '2026-02-10',
        description: 'A post about client-side routing state.',
        tags: ['React'],
    },
    {
        slug: 'hidden-fourth-post',
        title: 'Hidden Fourth Post',
        date: '2026-01-01',
        description: 'This post should not be on the home page.',
        tags: ['React'],
    },
]);

const testTrips = vi.hoisted(() => [{
    slug: 'coastal-loop',
    title: 'Coastal Loop',
    date: '2026-01-15',
    description: 'A motorcycle trip along the coast.',
    tags: ['Motorcycles', 'Travel'],
    format: 'trip' as const,
    tripId: 'coastal-loop',
}]);

vi.mock('../content/posts', () => ({
    getAllPosts: () => [...testPosts, ...testTrips],
    getBlogPosts: () => testPosts,
    getTripPosts: () => testTrips,
    getPostBySlug: (slug: string) => {
        const post = [...testPosts, ...testTrips].find((candidate) => candidate.slug === slug);

        if (!post) {
            return undefined;
        }

        return { ...post, loadComponent: async () => ({ default: () => null }), Component: () => null };
    },
}));

vi.mock('../blog/MdxComponents', () => ({
    mdxComponents: {},
}));

import { Blog } from '../pages/Blog';
import { BlogPost } from '../pages/BlogPost';
import { Home } from '../pages/Home';
import { Trips } from '../pages/Trips';

function LocationProbe() {
    return <output data-testid="location">{useLocation().pathname}</output>;
}

describe('Blog page tag navigation', () => {
    it('renders unique tag links in the filter navigation', () => {
        renderWithRouter(<Blog />, { route: '/blog' });

        const tagNavigation = screen.getByRole('navigation', { name: 'Blog tags' });
        expect(within(tagNavigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
            'All',
            'Data Viz',
            'Maps',
            'React',
            'Weather',
        ]);
    });

    it('filters visible posts from the shareable tag query parameter', () => {
        renderWithRouter(<Blog />, { route: '/blog?tag=Data+Viz' });

        expect(screen.getByRole('heading', { level: 2, name: 'Mapping Boring Data' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Weather Records' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 2, name: 'React Routing' })).not.toBeInTheDocument();

        const tagNavigation = screen.getByRole('navigation', { name: 'Blog tags' });
        expect(within(tagNavigation).getByRole('link', { name: 'Data Viz' })).toHaveAttribute('aria-current', 'page');
    });
});

describe('Trips page', () => {
    it('lists trip stories separately from blog posts', () => {
        renderWithRouter(<Trips />, { route: '/trips' });

        expect(screen.getByRole('heading', { level: 1, name: 'Trips' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Coastal Loop' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 2, name: 'Mapping Boring Data' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Coastal Loop/i })).toHaveAttribute('href', '/trips/coastal-loop');
    });

    it('uses collection-local tag links', () => {
        renderWithRouter(<Trips />, { route: '/trips?tag=Motorcycles' });

        const navigation = screen.getByRole('navigation', { name: 'Trip tags' });
        expect(within(navigation).getByRole('link', { name: 'Motorcycles' })).toHaveAttribute(
            'href',
            '/trips?tag=Motorcycles',
        );
    });
});

describe('BlogPost tag navigation', () => {
    it('links post tags back to the filtered blog index', () => {
        renderWithRouter(
            <Routes>
                <Route path="/blog/:slug" element={<BlogPost collection="blog" />} />
            </Routes>,
            { route: '/blog/mapping-boring-data' },
        );

        const tagUrl = new URL(screen.getByRole('link', { name: 'Data Viz' }).getAttribute('href')!, 'https://rsmb.tv');
        expect(tagUrl.pathname).toBe('/blog');
        expect(tagUrl.searchParams.get('tag')).toBe('Data Viz');
    });

    it.each([
        ['/blog/coastal-loop', '/trips/coastal-loop'],
        ['/trips/mapping-boring-data', '/blog/mapping-boring-data'],
    ])('redirects %s to %s', (route, canonicalPath) => {
        renderWithRouter(
            <>
                <LocationProbe />
                <Routes>
                    <Route path="/blog/:slug" element={<BlogPost collection="blog" />} />
                    <Route path="/trips/:slug" element={<BlogPost collection="trips" />} />
                </Routes>
            </>,
            { route },
        );

        expect(screen.getByTestId('location')).toHaveTextContent(canonicalPath);
    });
});

describe('Home page writing hierarchy', () => {
    it('shows recent writing after projects without flooding the front page', () => {
        renderWithRouter(<Home />);

        expect(screen.getByRole('heading', { level: 2, name: 'Projects' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Writing' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Mapping Boring Data/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Weather Records/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /React Routing/i })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Hidden Fourth Post/i })).not.toBeInTheDocument();
    });
});
