import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { projects } from '../content/projects';

function renderLayout(route = '/') {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Layout>
                <p>Page content</p>
            </Layout>
        </MemoryRouter>
    );
}

describe('Layout', () => {
    afterEach(() => {
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
        vi.restoreAllMocks();
    });

    it('renders the site navigation and keeps Projects clickable', () => {
        renderLayout();

        expect(screen.getByRole('link', { name: 'rsmb' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
        expect(screen.getByRole('link', { name: 'Trips' })).toHaveAttribute('href', '/trips');
        expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
        expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
        expect(screen.getByText('Page content')).toBeInTheDocument();
    });

    it('renders direct project links in a hover and focus-visible flyout', () => {
        renderLayout('/projects');

        const projectPages = screen.getByRole('list', { name: 'Project pages' });
        expect(projectPages.parentElement).toHaveClass(
            'pt-2',
            'group-hover:visible',
            'group-focus-within:visible'
        );

        for (const project of projects) {
            expect(within(projectPages).getByRole('link', { name: project.title })).toHaveAttribute(
                'href',
                `/projects/${project.slug}`
            );
        }
    });

    it('marks nested project routes active in both nav levels', () => {
        renderLayout('/projects/temperature-records/trends');

        expect(screen.getByRole('link', { name: 'Projects' })).toHaveClass('text-violet-400');
        expect(screen.getByRole('link', { name: 'U.S. Temperature Records' })).toHaveClass('text-violet-300');
    });

    it('reveals the header when scrolling up and provides a scroll-to-top control', async () => {
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
        renderLayout('/blog');
        const header = screen.getByRole('banner');

        act(() => {
            Object.defineProperty(window, 'scrollY', { configurable: true, value: 600 });
            fireEvent.scroll(window);
        });

        await waitFor(() => expect(header).toHaveClass('-translate-y-full'));
        const scrollTopButton = screen.getByRole('button', { name: 'Scroll to top' });

        act(() => {
            Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
            fireEvent.scroll(window);
        });

        await waitFor(() => expect(header).toHaveClass('translate-y-0'));
        fireEvent.click(scrollTopButton);
        expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('omits header and footer chrome for fullscreen map pages', () => {
        renderLayout('/projects/flights/map');

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument();
        expect(screen.getByText('Page content')).toBeInTheDocument();
    });
});
