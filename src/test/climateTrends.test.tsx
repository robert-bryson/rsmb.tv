import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

// Mock the useClimateTrends hook before importing the component
vi.mock('../features/temperatures/hooks/useClimateTrends', () => ({
    useClimateTrends: vi.fn(),
}));

import { ClimateTrends } from '../features/temperatures/components/ClimateTrends';
import { useClimateTrends } from '../features/temperatures/hooks/useClimateTrends';

const mockUseClimateTrends = vi.mocked(useClimateTrends);

const mockTrends = {
    source: 'test',
    description: 'test data',
    totalHighs: 500,
    totalLows: 400,
    byDecade: [{ decade: 2020, label: '2020s', highs: 5, lows: 4, ratio: 1.25 }],
    byYear: [{ year: 2024, highs: 3, lows: 2 }],
    rollingRatio: [{ year: 2024, ratio: 1.1, highs10yr: 11, lows10yr: 10 }],
} as const;

function renderWithRouter(ui: React.ReactElement) {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function SearchState() {
    return <output data-testid="search-state">{useLocation().search}</output>;
}

describe('ClimateTrends component', () => {
    it('shows loading skeleton when loading', () => {
        mockUseClimateTrends.mockReturnValue({ trends: null, loading: true, error: null });
        const { container } = renderWithRouter(<ClimateTrends />);
        expect(container.querySelector('.animate-pulse')).not.toBeNull();
    });

    it('shows error message on failure', () => {
        mockUseClimateTrends.mockReturnValue({ trends: null, loading: false, error: 'Network error' });
        renderWithRouter(<ClimateTrends />);
        expect(screen.getByText('Failed to load climate trend data')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('renders heading and tabs when data is loaded', () => {
        mockUseClimateTrends.mockReturnValue({
            trends: mockTrends as never,
            loading: false,
            error: null,
        });
        renderWithRouter(<ClimateTrends />);
        expect(screen.getByText('Standing Record History')).toBeInTheDocument();
        expect(screen.getByText('900')).toBeInTheDocument();
        expect(screen.getByText('1.0%')).toBeInTheDocument();
        expect(screen.getByText(/set since 2000/i)).toBeInTheDocument();
        expect(screen.getByText('Record Age')).toBeInTheDocument();
        expect(screen.getByText('Year Set (5yr avg)')).toBeInTheDocument();
        expect(screen.getByText('High : Low Ratio')).toBeInTheDocument();
        expect(screen.getByText('Record Age Map')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Record Age' })).toHaveAttribute('aria-selected', 'true');
    });

    it('renders back link to map', () => {
        mockUseClimateTrends.mockReturnValue({
            trends: mockTrends as never,
            loading: false,
            error: null,
        });
        renderWithRouter(<ClimateTrends />);
        expect(screen.getByText('← Map')).toHaveAttribute('href', '/projects/temperature-records/map?view=freshness');
    });

    it('stores the selected trend tab in the URL', () => {
        mockUseClimateTrends.mockReturnValue({
            trends: mockTrends as never,
            loading: false,
            error: null,
        });
        renderWithRouter(<><ClimateTrends /><SearchState /></>);

        fireEvent.click(screen.getByRole('tab', { name: 'Year Set (5yr avg)' }));

        expect(screen.getByTestId('search-state')).toHaveTextContent('?tab=timeseries');
        expect(screen.getByRole('tab', { name: 'Year Set (5yr avg)' })).toHaveAttribute('aria-selected', 'true');
    });
});
