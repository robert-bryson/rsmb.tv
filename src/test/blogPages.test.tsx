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
        development: {
            published: false,
            rowNumber: 5,
            issues: ['Google Doc is unavailable'],
            contentAvailable: false,
            sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
            documentUrl: 'https://docs.google.com/document/d/doc_123/edit',
            driveFolderUrl: 'https://drive.google.com/drive/folders/folder_123',
        },
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
    getAllPosts: () => [...testPosts.slice(0, 3), ...testTrips, ...testPosts.slice(3)],
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

import { BlogPost } from '../pages/BlogPost';
import { Home } from '../pages/Home';
import { Posts } from '../pages/Posts';

function LocationProbe() {
    return <output data-testid="location">{useLocation().pathname}</output>;
}

describe('Posts page', () => {
    it('combines writing and trips in one chronological feed', () => {
        renderWithRouter(<Posts />, { route: '/posts' });

        expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
            'Mapping Boring Data',
            'Weather Records',
            'React Routing',
            'Coastal Loop',
            'Hidden Fourth Post',
        ]);
        expect(screen.getByRole('link', { name: /Coastal Loop/i })).toHaveAttribute('href', '/trips/coastal-loop');
        expect(screen.getByRole('link', { name: /Mapping Boring Data/i })).toHaveAttribute('href', '/blog/mapping-boring-data');
    });

    it('renders unique tags for the active type', () => {
        renderWithRouter(<Posts />, { route: '/posts?type=writing' });

        const tagNavigation = screen.getByRole('navigation', { name: 'Post tags' });
        expect(within(tagNavigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
            'All tags',
            'Data Viz',
            'Maps',
            'React',
            'Weather',
        ]);
    });

    it('filters visible posts from shareable type and tag query parameters', () => {
        renderWithRouter(<Posts />, { route: '/posts?type=writing&tag=Data+Viz' });

        expect(screen.getByRole('heading', { level: 2, name: 'Mapping Boring Data' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Weather Records' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 2, name: 'React Routing' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 2, name: 'Coastal Loop' })).not.toBeInTheDocument();

        const tagNavigation = screen.getByRole('navigation', { name: 'Post tags' });
        expect(within(tagNavigation).getByRole('link', { name: 'Data Viz' })).toHaveAttribute('aria-current', 'page');
        expect(within(tagNavigation).getByRole('link', { name: 'Data Viz' })).toHaveAttribute(
            'href',
            '/posts?type=writing&tag=Data+Viz',
        );
    });

    it('labels unpublished incomplete content in development', () => {
        renderWithRouter(<Posts />, { route: '/posts' });

        expect(screen.getByText('DEV · Draft · Incomplete')).toBeInTheDocument();
    });
});

describe('BlogPost tag navigation', () => {
    it('links post tags back to the filtered posts index', () => {
        renderWithRouter(
            <Routes>
                <Route path="/blog/:slug" element={<BlogPost collection="blog" />} />
            </Routes>,
            { route: '/blog/mapping-boring-data' },
        );

        const tagUrl = new URL(screen.getByRole('link', { name: 'Data Viz' }).getAttribute('href')!, 'https://rsmb.tv');
        expect(tagUrl.pathname).toBe('/posts');
        expect(tagUrl.searchParams.get('type')).toBe('writing');
        expect(tagUrl.searchParams.get('tag')).toBe('Data Viz');
    });

    it('links development metadata directly to its Google sources', () => {
        renderWithRouter(
            <Routes>
                <Route path="/blog/:slug" element={<BlogPost collection="blog" />} />
            </Routes>,
            { route: '/blog/hidden-fourth-post' },
        );

        expect(screen.getByRole('link', { name: 'Google Sheet' })).toHaveAttribute(
            'href',
            'https://docs.google.com/spreadsheets/d/sheet_123/edit',
        );
        expect(screen.getByRole('link', { name: 'Open document' })).toHaveAttribute(
            'href',
            'https://docs.google.com/document/d/doc_123/edit',
        );
        expect(screen.getByRole('link', { name: 'Open folder' })).toHaveAttribute(
            'href',
            'https://drive.google.com/drive/folders/folder_123',
        );
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
    it('shows recent posts after projects without flooding the front page', () => {
        renderWithRouter(<Home />);

        expect(screen.getByRole('heading', { level: 2, name: 'Projects' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Posts' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /View all posts/i })).toHaveAttribute('href', '/posts');
        expect(screen.getByRole('link', { name: /Mapping Boring Data/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Weather Records/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /React Routing/i })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Hidden Fourth Post/i })).not.toBeInTheDocument();
    });
});
