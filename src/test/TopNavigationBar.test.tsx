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
    it('temporarily hides the rsmb.tv home link', () => {
        renderTopNav();
        expect(screen.queryByRole('link', { name: /rsmb\.tv/i })).not.toBeInTheDocument();
    });

    it('temporarily hides the layer controls', () => {
        renderTopNav({ layerControls: <button>Layers</button> });
        expect(screen.queryByRole('button', { name: 'Layers' })).not.toBeInTheDocument();
    });

    it('does not show a "Back" label', () => {
        renderTopNav();
        expect(screen.queryByText(/^Back$/i)).not.toBeInTheDocument();
    });

    it('renders the Flight History heading', () => {
        renderTopNav();
        expect(screen.getByRole('heading', { level: 1, name: /Flight History/i })).toBeInTheDocument();
    });

    it('temporarily hides the filter panel when years are present', () => {
        renderTopNav({ years: [2024, 2023] });
        expect(screen.queryByRole('button', { name: /toggle filters/i })).not.toBeInTheDocument();
    });

    it('renders no filter button when years list is empty', () => {
        renderTopNav({ years: [] });
        expect(screen.queryByRole('button', { name: /toggle filters/i })).not.toBeInTheDocument();
    });
});
