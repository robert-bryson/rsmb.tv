import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { renderWithRouter } from './helpers/router';

const testPosts = vi.hoisted(() => [
    {
        slug: 'mapping-boring-data',
        title: 'Mapping Boring Data',
        date: '2026-04-20',
        description: 'A post about putting dull data on maps.',
        tags: ['Maps', 'Data Viz'],
        countries: [{ code: 'US', regions: ['Washington'] }],
    },
    {
        slug: 'weather-records',
        title: 'Weather Records',
        date: '2026-03-15',
        description: 'A post about records and climate normals.',
        tags: ['Weather', 'Data Viz'],
        countries: [{ code: 'CA', regions: ['Ontario'] }],
    },
    {
        slug: 'react-routing',
        title: 'React Routing',
        date: '2026-02-10',
        description: 'A post about client-side routing state.',
        tags: ['React'],
        countries: [{ code: 'US', regions: ['Washington', 'Oregon'] }],
    },
    {
        slug: 'hidden-fourth-post',
        title: 'Hidden Fourth Post',
        date: '2026-01-01',
        description: 'This post should not be on the home page.',
        tags: ['React'],
        countries: [{ code: 'US', regions: ['Idaho'] }, { code: 'JP', regions: [] }],
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
    date: '2026-04-01',
    description: 'A motorcycle trip along the coast.',
    tags: ['Motorcycles', 'Travel'],
    countries: [
        { code: 'US', regions: ['Washington', 'Oregon', 'Idaho', 'California'] },
        { code: 'CA', regions: ['British Columbia', 'Alberta', 'Quebec', 'Ontario'] },
    ],
    format: 'trip' as const,
    tripId: 'ocean-shores-2024',
}]);

vi.mock('../content/posts', () => ({
    getAllPosts: () => [testPosts[0], ...testTrips, ...testPosts.slice(1)],
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
import * as postRegistry from '../content/posts';
import * as tripManifests from '../features/trips/tripManifests';

function LocationProbe() {
    return <output data-testid="location">{useLocation().pathname}</output>;
}

describe('Posts page', () => {
    it('filter review regressions: keeps a visible topic selectable when it matches a country name', () => {
        const topicPost = { ...testPosts[0], tags: ['Japan'], countries: [] };
        const posts = vi.spyOn(postRegistry, 'getAllPosts');
        posts.mockReturnValue([topicPost, testPosts[3]]);
        try {
            renderWithRouter(<Posts />, { route: '/posts?type=writing&tag=Japan' });
            expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Mapping Boring Data']);
            expect(within(screen.getByRole('navigation', { name: 'Post tags' })).getByRole('link', { name: 'Japan' }))
                .toHaveAttribute('aria-current', 'page');
        } finally {
            posts.mockRestore();
        }
    });

    it('filter review regressions: accepts region names and lowercase country codes from shared URLs', () => {
        renderWithRouter(<Posts />, { route: '/posts?country=ca&region=British+Columbia' });
        expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Coastal Loop']);
        expect(within(screen.getByRole('group', { name: 'Canada' })).getByRole('link', { name: /British Columbia/ }))
            .toHaveAttribute('aria-current', 'page');
    });

    it('combines writing and trips in one chronological feed', () => {
        renderWithRouter(<Posts />, { route: '/posts' });

        expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
            'Mapping Boring Data',
            'Coastal Loop',
            'Weather Records',
            'React Routing',
            'Hidden Fourth Post',
        ]);
        const tripLink = screen.getByRole('link', { name: /Coastal Loop/i });
        expect(tripLink).toHaveAttribute('href', '/trips/coastal-loop');
        expect(tripLink.querySelector('img')).toBeInTheDocument();
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

    it('groups regions by country and sorts them by matching post count', () => {
        renderWithRouter(<Posts />, { route: '/posts' });
        const regions = within(screen.getByRole('navigation', { name: 'Post regions' }));
        const us = within(regions.getByRole('group', { name: 'United States' }));
        expect(us.getAllByRole('link').map(link => link.textContent)).toEqual(['United States', 'Washington3', 'Idaho2', 'Oregon2', 'California1']);
        expect(us.getByLabelText('3 posts')).toBeInTheDocument();
        expect(regions.getByRole('group', { name: 'Canada' })).toBeInTheDocument();
        expect(regions.getByRole('group', { name: 'Japan' })).toHaveTextContent('1 post');
    });

    it('combines topical and regional filters and preserves the other category when clearing one', () => {
        renderWithRouter(<Posts />, { route: '/posts?tag=Data+Viz&country=US&region=washington' });
        expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Mapping Boring Data']);
        const tags = within(screen.getByRole('navigation', { name: 'Post tags' }));
        const regions = within(screen.getByRole('navigation', { name: 'Post regions' }));
        expect(tags.getByRole('link', { name: 'All tags' })).toHaveAttribute('href', '/posts?country=US&region=washington');
        expect(regions.getByRole('link', { name: 'All regions' })).toHaveAttribute('href', '/posts?tag=Data+Viz');
        expect(regions.getByRole('link', { name: /Washington/ })).toHaveAttribute('aria-current', 'page');
    });

    it('marks a selected region from a shared URL', () => {
        renderWithRouter(<Posts />, { route: '/posts?type=trips&country=US&region=california' });
        const regions = within(screen.getByRole('navigation', { name: 'Post regions' }));
        expect(regions.getByRole('link', { name: /California/ })).toHaveAttribute('aria-current', 'page');
        expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Coastal Loop']);
    });

    it.each([
        ['us', ['Mapping Boring Data', 'Coastal Loop', 'React Routing', 'Hidden Fourth Post']],
        ['british-columbia', ['Coastal Loop']],
        ['canada', ['Coastal Loop', 'Weather Records']],
    ])('keeps historic geographic tag links working for %s', (tag, titles) => {
        renderWithRouter(<Posts />, { route: `/posts?tag=${tag}` });
        expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(titles);
        expect(screen.getByRole('navigation', { name: 'Post regions' })).toBeInTheDocument();
    });

    it('shows an empty state for incompatible filters', () => {
        renderWithRouter(<Posts />, { route: '/posts?tag=Maps&country=CA' });
        expect(screen.getByText('No posts match these filters.')).toBeInTheDocument();
    });
});

describe('BlogPost tag navigation', () => {
    it('filter review regressions: preserves return filters after a manifest fails to load', async () => {
        const load = vi.spyOn(tripManifests, 'loadTripManifest').mockRejectedValueOnce(new Error('Manifest unavailable'));
        const from = '/posts?type=trips&country=US&region=washington';
        try {
            render(<MemoryRouter initialEntries={[{ pathname: '/trips/coastal-loop', state: { from } }]}>
                <Routes><Route path="/trips/:slug" element={<BlogPost collection="trips" />} /></Routes>
            </MemoryRouter>);
            expect(await screen.findByRole('heading', { name: 'Trip not configured' })).toBeInTheDocument();
            expect(screen.getByRole('link', { name: /Back to posts/ })).toHaveAttribute('href', from);
        } finally {
            load.mockRestore();
        }
    });

    it('selects immediate older and newer posts within the writing collection', () => {
        renderWithRouter(<Routes><Route path="/blog/:slug" element={<BlogPost collection="blog" />} /></Routes>, { route: '/blog/weather-records' });
        const navigation = within(screen.getByRole('navigation', { name: 'Post navigation' }));
        expect(navigation.getByRole('link', { name: /Previous post React Routing/ })).toHaveAttribute('href', '/blog/react-routing');
        expect(navigation.getByRole('link', { name: /Next post Mapping Boring Data/ })).toHaveAttribute('href', '/blog/mapping-boring-data');
        expect(navigation.queryByRole('link', { name: /Coastal Loop/ })).not.toBeInTheDocument();
    });

    it('preserves fragments, search parameters, and return filters on canonical redirects', () => {
        function Probe() {
            const location = useLocation();
            return <output data-testid="redirect">{JSON.stringify(location)}</output>;
        }
        const state = { from: '/posts?type=writing&tag=Maps' };
        render(<MemoryRouter initialEntries={[{ pathname: '/trips/mapping-boring-data', search: '?source=link', hash: '#section', state }]}>
            <Probe />
            <Routes>
                <Route path="/trips/:slug" element={<BlogPost collection="trips" />} />
                <Route path="/blog/:slug" element={<BlogPost collection="blog" />} />
            </Routes>
        </MemoryRouter>);
        expect(JSON.parse(screen.getByTestId('redirect').textContent!)).toMatchObject({ pathname: '/blog/mapping-boring-data', search: '?source=link', hash: '#section', state });
        expect(screen.getByRole('link', { name: 'Back to posts' })).toHaveAttribute('href', state.from);
    });

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
    it('shows the latest writing and trips after selected projects without flooding the front page', () => {
        renderWithRouter(<Home />);

        expect(screen.getByRole('heading', { level: 2, name: 'Selected projects' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Latest' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /All posts/i })).toHaveAttribute('href', '/posts');
        expect(screen.getByRole('link', { name: /Mapping Boring Data/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Coastal Loop/i })).toHaveAttribute('href', '/trips/coastal-loop');
        expect(screen.getByRole('link', { name: /Weather Records/i })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /React Routing/i })).not.toBeInTheDocument();
        expect(screen.getAllByText('Writing')).toHaveLength(2);
        expect(screen.getByText('Trip report')).toBeInTheDocument();
        expect(screen.getByText('April 1, 2026').closest('time')).toHaveAttribute('datetime', '2026-04-01');
        expect(screen.queryByRole('link', { name: /Hidden Fourth Post/i })).not.toBeInTheDocument();
    });
});
