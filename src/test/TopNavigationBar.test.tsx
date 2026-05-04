import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TopNavigationBar } from '../features/flights/components/TopNavigationBar';

function renderTopNav(overrides: Partial<ComponentProps<typeof TopNavigationBar>> = {}) {
    const props: ComponentProps<typeof TopNavigationBar> = {
        years: [2024, 2023],
        selectedYear: null,
        onYearChange: vi.fn(),
        flightCount: 320,
        airports: [],
        onAirportSelect: vi.fn(),
        ...overrides,
    };
    return render(
        <MemoryRouter>
            <TopNavigationBar {...props} />
        </MemoryRouter>,
    );
}

describe('TopNavigationBar', () => {
    it('renders the rsmb.tv home link', () => {
        renderTopNav();
        // accessible name is the text content of both child spans joined
        const link = screen.getByRole('link', { name: /rsmb\.tv/i });
        expect(link).toBeInTheDocument();
    });

    it('home link navigates to /', () => {
        renderTopNav();
        expect(screen.getByRole('link', { name: /rsmb\.tv/i })).toHaveAttribute('href', '/');
    });

    it('does not show a "Back" label', () => {
        renderTopNav();
        expect(screen.queryByText(/^Back$/i)).not.toBeInTheDocument();
    });

    it('renders the Flight History heading', () => {
        renderTopNav();
        expect(screen.getByRole('heading', { level: 1, name: /Flight History/i })).toBeInTheDocument();
    });

    it('renders filter panel when years are present', () => {
        renderTopNav({ years: [2024, 2023] });
        // FilterPanel toggle button should be present
        expect(screen.getByRole('button', { name: /toggle filters/i })).toBeInTheDocument();
    });

    it('renders no filter button when years list is empty', () => {
        renderTopNav({ years: [] });
        expect(screen.queryByRole('button', { name: /toggle filters/i })).not.toBeInTheDocument();
    });
});
