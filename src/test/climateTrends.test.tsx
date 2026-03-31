import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock the useClimateTrends hook before importing the component
vi.mock('../features/temperatures/hooks/useClimateTrends', () => ({
    useClimateTrends: vi.fn(),
}));

import { ClimateTrends } from '../features/temperatures/components/ClimateTrends';
import { useClimateTrends } from '../features/temperatures/hooks/useClimateTrends';

const mockUseClimateTrends = vi.mocked(useClimateTrends);

function renderWithRouter(ui: React.ReactElement) {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
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
            trends: {
                totalHighs: 500,
                totalLows: 400,
                byDecade: [],
                byYear: [],
                rollingRatio: [],
            } as never,
            loading: false,
            error: null,
        });
        renderWithRouter(<ClimateTrends />);
        expect(screen.getByText('Climate Trends')).toBeInTheDocument();
        expect(screen.getByText('Record Age')).toBeInTheDocument();
        expect(screen.getByText('Frequency')).toBeInTheDocument();
        expect(screen.getByText('H:L Ratio')).toBeInTheDocument();
        expect(screen.getByText('Freshness Map')).toBeInTheDocument();
    });

    it('renders back link to map', () => {
        mockUseClimateTrends.mockReturnValue({
            trends: {
                totalHighs: 500,
                totalLows: 400,
                byDecade: [],
                byYear: [],
                rollingRatio: [],
            } as never,
            loading: false,
            error: null,
        });
        renderWithRouter(<ClimateTrends />);
        expect(screen.getByText('← Map')).toHaveAttribute('href', '/projects/temperature-records');
    });
});
