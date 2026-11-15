import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Projects } from '../pages/Projects';
import { renderWithRouter } from './helpers/router';
import { trackAnalyticsEvent } from '../utils/analytics';
import { projects } from '../content/projects';
import { advanceSearchCommit } from './helpers/search';

vi.mock('../utils/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

vi.mock('../content/projects', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../content/projects')>();
    const common = {
        description: 'A synthetic project for date rendering tests.',
        tech: ['TypeScript'],
        applicationCategory: 'UtilitiesApplication',
        category: 'tools',
        year: 2024,
    };

    return {
        ...actual,
        projects: [
            { ...common, slug: 'updated', title: 'Updated project', lastUpdated: '2026-05-22' },
            { ...common, slug: 'launch-only', title: 'Launch project' },
            { ...common, slug: 'routes', title: 'Route explorer', category: 'maps', description: 'Scenic motorcycle roads.', tech: ['Python'], demoUrl: '/projects/routes/map', sourceUrl: 'https://github.com/example/routes' },
            { ...common, slug: 'library', title: 'Library', category: 'apps', description: 'Organize books.', demoUrl: 'https://example.org/library' },
        ],
    };
});

function LocationProbe() {
    const location = useLocation();
    const navigate = useNavigate();
    return <>
        <span data-testid="location">{location.pathname + location.search}</span>
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => navigate(1)}>Forward</button>
    </>;
}

describe('project discovery', () => {
    it('restores shared filters and retains the query in category links', () => {
        renderWithRouter(<Projects />, { route: '/projects?category=maps&q=python' });
        expect(screen.getByRole('searchbox', { name: 'Search projects' })).toHaveValue('python');
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
        expect(screen.getByRole('heading', { name: 'Route explorer' })).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('1 of 4 projects');
        const categories = screen.getByRole('navigation', { name: 'Project categories' });
        expect(within(categories).getByRole('link', { name: 'Maps & data' })).toHaveAttribute('aria-current', 'page');
        expect(within(categories).getByRole('link', { name: 'Command line' })).toHaveAttribute('href', '/projects?category=tools&q=python');
    });

    it('updates search immediately without adding a history entry for each keystroke', () => {
        renderWithRouter(<><Projects /><LocationProbe /></>, { route: '/projects' });
        const search = screen.getByRole('searchbox');
        fireEvent.change(search, { target: { value: 'motorcycle python' } });
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
        advanceSearchCommit();
        expect(screen.getByTestId('location')).toHaveTextContent('/projects?q=motorcycle+python');
        fireEvent.click(screen.getByRole('link', { name: 'Command line' }));
        expect(screen.getByText('No projects match these filters.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getByTestId('location')).toHaveTextContent('/projects?q=motorcycle+python');
        expect(search).toHaveValue('motorcycle python');
        expect(screen.getByRole('heading', { name: 'Route explorer' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
        expect(screen.getByText('No projects match these filters.')).toBeInTheDocument();
    });

    it('clears the query while retaining the category, then clears every filter with focus', () => {
        renderWithRouter(<><Projects /><LocationProbe /></>, { route: '/projects?category=maps&q=missing' });
        const search = screen.getByRole('searchbox');
        expect(screen.getByRole('status')).toHaveTextContent('0 of 4 projects');
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
        advanceSearchCommit();
        expect(search).toHaveValue('');
        expect(search).toHaveFocus();
        expect(screen.getByTestId('location')).toHaveTextContent('/projects?category=maps');
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
        expect(screen.getByTestId('location').textContent).toBe('/projects');
        expect(search).toHaveFocus();
        expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4);
    });

    it('recovers gracefully from unknown categories', () => {
        renderWithRouter(<Projects />, { route: '/projects?category=constructor' });
        expect(screen.getByRole('link', { name: 'All projects' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('status')).toHaveTextContent('4 projects');
    });

    it('opens internal maps directly and records their destination', () => {
        renderWithRouter(<Routes>
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/routes/map" element={<h1>Map destination</h1>} />
        </Routes>, { route: '/projects' });
        const map = screen.getByRole('link', { name: 'Open map: Route explorer' });
        expect(map).toHaveAttribute('href', '/projects/routes/map');
        expect(map).not.toHaveAttribute('target');
        expect(map.querySelector('a')).toBeNull();
        fireEvent.click(map);
        expect(screen.getByRole('heading', { name: 'Map destination' })).toBeInTheDocument();
        expect(trackAnalyticsEvent).toHaveBeenCalledWith('project-link-click', { project: 'routes', destination: 'demo', placement: 'projects' });
        expect(trackAnalyticsEvent).toHaveBeenCalledTimes(1);
    });

    it('provides independent external demo and source actions', () => {
        renderWithRouter(<Projects />, { route: '/projects' });
        const demo = screen.getByRole('link', { name: 'Live demo: Library (opens in a new tab)' });
        const source = screen.getByRole('link', { name: 'Source: Route explorer (opens in a new tab)' });
        expect(demo).toHaveAttribute('href', 'https://example.org/library');
        expect(source).toHaveAttribute('href', 'https://github.com/example/routes');
        for (const action of [demo, source]) {
            expect(action).toHaveAttribute('target', '_blank');
            expect(action).toHaveAttribute('rel', 'noopener noreferrer');
            expect(action.parentElement?.closest('a')).toBeNull();
        }
        fireEvent.click(source);
        expect(trackAnalyticsEvent).toHaveBeenCalledWith('project-link-click', { project: 'routes', destination: 'source', placement: 'projects' });
        expect(trackAnalyticsEvent).toHaveBeenCalledTimes(1);
    });
});

describe('project directory review regressions', () => {
    it('opens project details and records one details event', () => {
        renderWithRouter(<Routes>
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/routes" element={<h1>Project details</h1>} />
        </Routes>, { route: '/projects' });
        fireEvent.click(screen.getByRole('heading', { name: 'Route explorer' }).closest('a')!);
        expect(screen.getByRole('heading', { name: 'Project details' })).toBeInTheDocument();
        expect(trackAnalyticsEvent).toHaveBeenCalledWith('project-link-click', { project: 'routes', destination: 'details', placement: 'projects' });
        expect(trackAnalyticsEvent).toHaveBeenCalledTimes(1);
    });

    it('shows category counts for the current query', () => {
        renderWithRouter(<Projects />, { route: '/projects?q=python' });
        const categories = screen.getByRole('navigation', { name: 'Project categories' });
        expect(within(within(categories).getByRole('link', { name: 'All projects' })).getByText('1')).toBeInTheDocument();
        expect(within(within(categories).getByRole('link', { name: 'Command line' })).getByText('0')).toBeInTheDocument();
        expect(within(within(categories).getByRole('link', { name: 'Web apps' })).getByText('0')).toBeInTheDocument();
        expect(within(categories).getByRole('link', { name: 'Maps & data' })).toHaveAccessibleDescription('1 matching project');
        expect(within(categories).getByRole('link', { name: 'Command line' })).toHaveAccessibleDescription('0 matching projects');
    });

    it('distinguishes an empty directory from a query without matches', () => {
        const saved = projects.splice(0);
        try {
            renderWithRouter(<Projects />, { route: '/projects' });
            expect(screen.getByText('No projects yet.')).toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveTextContent('0 projects');
            expect(screen.queryByText('No projects match these filters.')).not.toBeInTheDocument();
        } finally {
            projects.push(...saved);
        }
    });

    it('uses a singular total for a one-project directory and an unmatched search', () => {
        const saved = projects.splice(1);
        try {
            renderWithRouter(<Projects />, { route: '/projects' });
            expect(screen.getByRole('status')).toHaveTextContent(/^1 project$/);
            fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } });
            expect(screen.getByRole('status')).toHaveTextContent(/^0 of 1 project$/);
        } finally {
            projects.push(...saved);
        }
    });
});

describe('project card dates', () => {
    it('shows the feature month and preserves the exact update date', () => {
        renderWithRouter(<Projects />, { route: '/projects' });

        const card = screen.getByRole('link', { name: /Updated project/i });
        expect(card).toHaveAttribute('href', '/projects/updated');
        const date = within(card).getByRole('time');
        expect(date).toHaveTextContent('May 2026');
        expect(date.parentElement).toHaveTextContent('Updated May 2026');
        expect(date).toHaveAttribute('datetime', '2026-05-22');
    });

    it('shows the launch year when no feature date is supplied', () => {
        renderWithRouter(<Projects />, { route: '/projects' });

        const card = screen.getByRole('link', { name: /Launch project/i });
        expect(within(card).getByText('2024')).toBeInTheDocument();
        expect(within(card).queryByRole('time')).not.toBeInTheDocument();
        expect(within(card).queryByText(/Updated/)).not.toBeInTheDocument();
    });
});
