import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    it('renders the site navigation and keeps Projects clickable', () => {
        renderLayout();

        expect(screen.getByRole('link', { name: 'rsmb' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
        expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
        expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
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
        expect(screen.getByRole('link', { name: 'Record Highs' })).toHaveClass('text-violet-300');
    });

    it('omits header and footer chrome for fullscreen map pages', () => {
        renderLayout('/projects/flights/map');

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument();
        expect(screen.getByText('Page content')).toBeInTheDocument();
    });
});
