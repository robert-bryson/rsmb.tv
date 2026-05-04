import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
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

vi.mock('../content/posts', () => ({
    getAllPosts: () => testPosts,
    getPostBySlug: (slug: string) => {
        const post = testPosts.find((candidate) => candidate.slug === slug);

        if (!post) {
            return undefined;
        }

        return { ...post, Component: () => null };
    },
}));

vi.mock('../blog/MdxComponents', () => ({
    mdxComponents: {},
}));

import { Blog } from '../pages/Blog';
import { BlogPost } from '../pages/BlogPost';
import { Home } from '../pages/Home';

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

describe('BlogPost tag navigation', () => {
    it('links post tags back to the filtered blog index', () => {
        renderWithRouter(
            <Routes>
                <Route path="/blog/:slug" element={<BlogPost />} />
            </Routes>,
            { route: '/blog/mapping-boring-data' },
        );

        const tagUrl = new URL(screen.getByRole('link', { name: 'Data Viz' }).getAttribute('href')!, 'https://rsmb.tv');
        expect(tagUrl.pathname).toBe('/blog');
        expect(tagUrl.searchParams.get('tag')).toBe('Data Viz');
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
