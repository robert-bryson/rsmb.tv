import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Projects } from '../pages/Projects';
import { renderWithRouter } from './helpers/router';

vi.mock('../content/projects', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../content/projects')>();
    const common = {
        description: 'A synthetic project for date rendering tests.',
        tech: ['TypeScript'],
        applicationCategory: 'UtilitiesApplication',
        year: 2024,
    };

    return {
        ...actual,
        projects: [
            { ...common, slug: 'updated', title: 'Updated project', lastUpdated: '2026-05-22' },
            { ...common, slug: 'launch-only', title: 'Launch project' },
        ],
    };
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
