import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lazy, type ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
import * as tripSummaries from '../features/trips/tripSummaries';
import * as analytics from '../utils/analytics';

function LocationProbe() {
    return <output data-testid="location">{useLocation().pathname}</output>;
}

function postFilterNavigation(name: 'Post tags' | 'Post regions') {
    const button = screen.getByRole('button', { name: 'Filters' });
    if (button.getAttribute('aria-expanded') === 'false') fireEvent.click(button);
    return screen.getByRole('navigation', { name });
}

describe('Posts page', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

    function SearchLocationProbe() {
        const location = useLocation();
        const navigate = useNavigate();
        return <>
            <span data-testid="search-location">{location.pathname + location.search}</span>
            <span data-testid="search-state">{JSON.stringify(location.state)}</span>
            <button onClick={() => navigate(-1)}>Browser back</button>
            <button onClick={() => navigate(1)}>Browser forward</button>
            <button onClick={() => navigate('/posts?q=weather', { replace: true })}>Replace search externally</button>
        </>;
    }

    it('supports legacy keyword links without a second page search field', () => {
        renderWithRouter(<><Posts /><SearchLocationProbe /></>, { route: '/posts?q=weather+normals' });
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
        expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Weather Records']);
        expect(screen.getByTestId('search-location')).toHaveTextContent('/posts?q=weather+normals');
        expect(screen.getByRole('status')).toHaveTextContent('1 of 5 posts matching “weather normals”');
    });

    it('hides tag and region filters until requested and keeps the dropdown open while combining selections', () => {
        renderWithRouter(<><Posts /><SearchLocationProbe /></>, { route: '/posts' });
        const button = screen.getByRole('button', { name: 'Filters' });
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('navigation', { name: 'Post tags' })).not.toBeInTheDocument();
        expect(screen.queryByRole('navigation', { name: 'Post regions' })).not.toBeInTheDocument();
        fireEvent.click(button);
        fireEvent.click(within(screen.getByRole('navigation', { name: 'Post tags' })).getByRole('link', { name: 'Maps' }));
        expect(button).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(within(screen.getByRole('navigation', { name: 'Post regions' })).getByRole('link', { name: 'United States' }));
        expect(button).toHaveAccessibleDescription('2 active filters');
        expect(screen.getByTestId('search-location')).toHaveTextContent('/posts?tag=Maps&country=US');
        fireEvent.click(within(screen.getByRole('navigation', { name: 'Post type' })).getByRole('link', { name: 'Writing' }));
        expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('preserves unrelated navigation state when filters are cleared', () => {
        render(<MemoryRouter initialEntries={[{
            pathname: '/posts', search: '?q=maps', state: { readerContext: { source: 'saved-list' }, restoreScroll: true },
        }]}><Posts /><SearchLocationProbe /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
        expect(JSON.parse(screen.getByTestId('search-state').textContent!)).toEqual({
            readerContext: { source: 'saved-list' },
            __rsmbSearchOwner: { owner: expect.any(String), revision: 1, search: '', navigation: 'PUSH' },
        });
    });

    it.each([null, 'legacy-state', ['legacy-state']])('accepts non-object navigation state %j', state => {
        render(<MemoryRouter initialEntries={[{ pathname: '/posts', search: '?q=maps', state }]}><Posts /><SearchLocationProbe /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
        expect(screen.getByTestId('search-location').textContent).toBe('/posts');
    });

    it('updates legacy query filters after external navigation to the same page', () => {
        renderWithRouter(<><Posts /><SearchLocationProbe /></>, { route: '/posts?q=maps' });
        fireEvent.click(screen.getByRole('button', { name: 'Replace search externally' }));
        expect(screen.getByRole('status')).toHaveTextContent('matching “weather”');
        expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Weather Records']);
    });

    it('keeps the unpublished empty-library state distinct from a search with no matches', () => {
        const posts = vi.spyOn(postRegistry, 'getAllPosts').mockReturnValue([]);
        try {
            renderWithRouter(<Posts />, { route: '/posts' });
            expect(screen.getByText('No posts yet.')).toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveTextContent('0 posts');
            expect(screen.queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument();
        } finally {
            posts.mockRestore();
        }
    });

    it('debounces filter telemetry and sends only the bounded result count', () => {
        vi.useFakeTimers();
        const track = vi.spyOn(analytics, 'trackAnalyticsEvent').mockImplementation(() => {});
        const view = renderWithRouter(<Posts />, { route: '/posts' });
        try {
            fireEvent.click(within(postFilterNavigation('Post tags')).getByRole('link', { name: 'Maps' }));
            act(() => { vi.advanceTimersByTime(200); });
            fireEvent.click(within(postFilterNavigation('Post tags')).getByRole('link', { name: 'Weather' }));
            act(() => { vi.advanceTimersByTime(299); });
            expect(track).not.toHaveBeenCalled();
            act(() => { vi.advanceTimersByTime(1); });
            expect(track.mock.calls).toEqual([['filters-applied', { feature: 'posts', resultBucket: '1' }]]);
            fireEvent.click(within(postFilterNavigation('Post tags')).getByRole('link', { name: 'React' }));
            view.unmount();
            act(() => { vi.advanceTimersByTime(1000); });
            expect(track).toHaveBeenCalledOnce();
        } finally {
            view.unmount();
            vi.useRealTimers();
            track.mockRestore();
        }
    });

    it('combines shared keyword searches with existing filters and retains the query in filter links', () => {
        renderWithRouter(<Posts />, { route: '/posts?type=writing&tag=Data+Viz&country=US&region=washington&q=maps' });
        expect(screen.getByRole('status')).toHaveTextContent('matching “maps”');
        expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Mapping Boring Data']);
        expect(within(postFilterNavigation('Post tags')).getByRole('link', { name: 'All tags' }))
            .toHaveAttribute('href', '/posts?type=writing&country=US&region=washington&q=maps');
        expect(within(postFilterNavigation('Post regions')).getByRole('link', { name: 'All regions' }))
            .toHaveAttribute('href', '/posts?type=writing&tag=Data+Viz&q=maps');
        expect(within(screen.getByRole('navigation', { name: 'Post type' })).getByRole('link', { name: 'Trips' }))
            .toHaveAttribute('href', '/posts?type=trips&q=maps');
    });

    it('recovers from empty results by clearing every filter', () => {
        renderWithRouter(<><Posts /><SearchLocationProbe /></>, { route: '/posts?type=writing&tag=Maps&country=CA&q=missing' });
        expect(screen.getByRole('status')).toHaveTextContent('0 of 5 posts');
        fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
        expect(screen.getByRole('heading', { level: 1, name: 'Posts' })).toHaveFocus();
        expect(screen.getByTestId('search-location').textContent).toBe('/posts');
        expect(screen.getByRole('status')).toHaveTextContent('5 posts');
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5);
        expect(screen.queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument();
    });

    it('restores legacy queries on Back and Forward through filter navigation', () => {
        render(<MemoryRouter initialEntries={['/about', '/posts?country=US&q=maps']}>
            <Posts /><SearchLocationProbe />
        </MemoryRouter>);
        fireEvent.click(within(postFilterNavigation('Post tags')).getByRole('link', { name: 'Maps' }));
        expect(screen.getByTestId('search-location')).toHaveTextContent('/posts?tag=Maps&country=US&q=maps');
        fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
        expect(screen.getByTestId('search-location')).toHaveTextContent('/posts?country=US&q=maps');
        expect(screen.getByRole('status')).toHaveTextContent('matching “maps”');
        fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
        expect(screen.getByTestId('search-location').textContent).toBe('/about');
        fireEvent.click(screen.getByRole('button', { name: 'Browser forward' }));
        expect(screen.getByRole('status')).toHaveTextContent('matching “maps”');
    });

    it('keeps the exact search when returning from an article', () => {
        const from = '/posts?type=writing&tag=Data+Viz&q=maps';
        render(<MemoryRouter initialEntries={[from]}>
            <Routes>
                <Route path="/posts" element={<Posts />} />
                <Route path="/blog/:slug" element={<BlogPost collection="blog" />} />
            </Routes>
            <SearchLocationProbe />
        </MemoryRouter>);
        fireEvent.click(screen.getByRole('link', { name: /Mapping Boring Data/ }));
        fireEvent.click(screen.getByRole('link', { name: 'Back to posts' }));
        expect(screen.getByTestId('search-location').textContent).toBe(from);
        expect(screen.getByRole('status')).toHaveTextContent('matching “maps”');
        expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Mapping Boring Data']);
    });

    it('filter review regressions: keeps a visible topic selectable when it matches a country name', () => {
        const topicPost = { ...testPosts[0], tags: ['Japan'], countries: [] };
        const posts = vi.spyOn(postRegistry, 'getAllPosts');
        posts.mockReturnValue([topicPost, testPosts[3]]);
        try {
            renderWithRouter(<Posts />, { route: '/posts?type=writing&tag=Japan' });
            expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Mapping Boring Data']);
            expect(within(postFilterNavigation('Post tags')).getByRole('link', { name: 'Japan' }))
                .toHaveAttribute('aria-current', 'page');
        } finally {
            posts.mockRestore();
        }
    });

    it('filter review regressions: accepts region names and lowercase country codes from shared URLs', () => {
        renderWithRouter(<Posts />, { route: '/posts?country=ca&region=British+Columbia' });
        postFilterNavigation('Post regions');
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

    it.each([
        { name: 'tagged trip', tags: ['motorcycle'], distanceMiles: 450, ridingDays: 3, expected: 'motorcycle · 450 miles · 3 riding days' },
        { name: 'untagged trip', tags: ['coast'], distanceMiles: 1450, ridingDays: 3, expected: '1,450 miles · 3 riding days' },
        { name: 'distance only', tags: ['motorcycle'], distanceMiles: 450, ridingDays: undefined, expected: 'motorcycle · 450 miles' },
        { name: 'riding days only', tags: ['motorcycle'], distanceMiles: undefined, ridingDays: 3, expected: 'motorcycle · 3 riding days' },
        { name: 'no trip summary', tags: ['motorcycle'], distanceMiles: undefined, ridingDays: undefined, expected: 'motorcycle' },
    ])('shows trip listing details for $name without extra separators', ({ tags, distanceMiles, ridingDays, expected }) => {
        const posts = vi.spyOn(postRegistry, 'getAllPosts').mockReturnValue([{ ...testTrips[0], tags }]);
        const summary = vi.spyOn(tripSummaries, 'getTripSummary').mockReturnValue(
            distanceMiles === undefined && ridingDays === undefined ? undefined : {
                id: testTrips[0].tripId,
                dates: { start: '2026-04-01', end: '2026-04-03' },
                hero: { id: 'hero', src: '/hero.webp', alt: '', width: 1600, height: 1000 },
                route: { geoJson: '/route.geojson' },
                distanceMiles,
                ridingDays,
            },
        );
        try {
            renderWithRouter(<Posts />, { route: '/posts' });
            const tripLink = screen.getByRole('link', { name: /Coastal Loop/i });
            const details = within(tripLink).getByText(expected, { exact: true });
            expect(details.tagName).toBe('P');
            expect(tripLink).toHaveAttribute('href', '/trips/coastal-loop');
            expect(tripLink.querySelectorAll('a')).toHaveLength(0);
        } finally {
            summary.mockRestore();
            posts.mockRestore();
        }
    });

    it('keeps motorcycle tags out of writing post details', () => {
        const posts = vi.spyOn(postRegistry, 'getAllPosts').mockReturnValue([{ ...testPosts[0], tags: ['motorcycle'] }]);
        try {
            renderWithRouter(<Posts />, { route: '/posts' });
            const postLink = screen.getByRole('link', { name: /Mapping Boring Data/i });
            expect(within(postLink).queryByText('motorcycle')).not.toBeInTheDocument();
        } finally {
            posts.mockRestore();
        }
    });

    it('renders unique tags for the active type', () => {
        renderWithRouter(<Posts />, { route: '/posts?type=writing' });

        const tagNavigation = postFilterNavigation('Post tags');
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

        const tagNavigation = postFilterNavigation('Post tags');
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
        const regions = within(postFilterNavigation('Post regions'));
        const us = within(regions.getByRole('group', { name: 'United States' }));
        expect(us.getAllByRole('link').map(link => link.textContent)).toEqual(['United States', 'Washington3', 'Idaho2', 'Oregon2', 'California1']);
        expect(us.getByLabelText('3 posts')).toBeInTheDocument();
        expect(regions.getByRole('group', { name: 'Canada' })).toBeInTheDocument();
        expect(regions.getByRole('group', { name: 'Japan' })).toHaveTextContent('1 post');
    });

    it('combines topical and regional filters and preserves the other category when clearing one', () => {
        renderWithRouter(<Posts />, { route: '/posts?tag=Data+Viz&country=US&region=washington' });
        expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Mapping Boring Data']);
        const tags = within(postFilterNavigation('Post tags'));
        const regions = within(postFilterNavigation('Post regions'));
        expect(tags.getByRole('link', { name: 'All tags' })).toHaveAttribute('href', '/posts?country=US&region=washington');
        expect(regions.getByRole('link', { name: 'All regions' })).toHaveAttribute('href', '/posts?tag=Data+Viz');
        expect(regions.getByRole('link', { name: /Washington/ })).toHaveAttribute('aria-current', 'page');
    });

    it('marks a selected region from a shared URL', () => {
        renderWithRouter(<Posts />, { route: '/posts?type=trips&country=US&region=california' });
        const regions = within(postFilterNavigation('Post regions'));
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
        expect(postFilterNavigation('Post regions')).toBeInTheDocument();
    });

    it('shows an empty state for incompatible filters', () => {
        renderWithRouter(<Posts />, { route: '/posts?tag=Maps&country=CA' });
        expect(screen.getByText('No posts match these filters.')).toBeInTheDocument();
    });
});

describe('BlogPost tag navigation', () => {
    it('marks the lazy body as pending until its text is available for search landing', async () => {
        let resolve!: (module: { default: () => ReactNode }) => void;
        const loadComponent = () => new Promise<{ default: () => ReactNode }>(done => { resolve = done; });
        const Component = lazy(loadComponent);
        const getPost = vi.spyOn(postRegistry, 'getPostBySlug').mockReturnValue({ ...testPosts[0], loadComponent, Component });
        try {
            renderWithRouter(<Routes><Route path="/blog/:slug" element={<BlogPost collection="blog" />} /></Routes>, { route: '/blog/mapping-boring-data' });
            expect(screen.getByText('Loading post...')).toHaveAttribute('data-search-pending');
            await act(async () => { resolve({ default: () => <p>The article body is ready.</p> }); });
            expect(screen.getByText('The article body is ready.')).toBeInTheDocument();
            expect(document.querySelector('[data-search-pending]')).toBeNull();
        } finally { getPost.mockRestore(); }
    });

    it('preserves the originating atlas visit through series links and the article return', async () => {
        const parts = testPosts.slice(0, 2).map((post, index) => ({
            ...post, series: { id: 'journey', title: 'Journey reports', order: index + 1 },
        }));
        const allPosts = vi.spyOn(postRegistry, 'getAllPosts').mockReturnValue(parts);
        const loadComponent = async () => ({ default: () => null });
        const Component = lazy(loadComponent);
        const getPost = vi.spyOn(postRegistry, 'getPostBySlug').mockImplementation(slug => {
            const post = parts.find(part => part.slug === slug);
            return post && { ...post, loadComponent, Component };
        });
        function ReturnProbe() {
            return <output data-testid="return-state">{JSON.stringify(useLocation().state)}</output>;
        }
        try {
            render(<MemoryRouter initialEntries={[{
                pathname: '/blog/mapping-boring-data',
                state: { from: '/projects/adv-atlas/map?trip=coast', returnKey: 'original-visit' },
            }]}>
                <Routes>
                    <Route path="/blog/:slug" element={<BlogPost collection="blog" />} />
                    <Route path="/projects/adv-atlas/map" element={<ReturnProbe />} />
                </Routes>
            </MemoryRouter>);
            fireEvent.click(within(await screen.findByRole('navigation', { name: 'Journey reports' })).getByRole('link', { name: 'Weather Records' }));
            fireEvent.click(screen.getAllByRole('link', { name: /Back to map/ })[0]);
            expect(JSON.parse(screen.getByTestId('return-state').textContent!)).toEqual({ restoreScroll: true, returnKey: 'original-visit' });
        } finally {
            allPosts.mockRestore();
            getPost.mockRestore();
        }
    });

    it('filter review regressions: preserves return filters after a manifest fails to load', async () => {
        const load = vi.spyOn(tripManifests, 'loadTripManifest').mockRejectedValueOnce(new Error('Manifest unavailable'));
        const from = '/posts?type=trips&country=US&region=washington';
        try {
            render(<MemoryRouter initialEntries={[{ pathname: '/trips/coastal-loop', state: { from } }]}>
                <Routes><Route path="/trips/:slug" element={<BlogPost collection="trips" />} /></Routes>
            </MemoryRouter>);
            expect(screen.getByText('Loading trip…').closest('[data-search-pending]')).not.toBeNull();
            expect(await screen.findByRole('heading', { name: 'Trip not configured' })).toBeInTheDocument();
            expect(document.querySelector('[data-search-pending]')).toBeNull();
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
