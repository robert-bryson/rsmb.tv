import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ComponentProps } from 'react';
import { BottomStatsBar } from '../features/flights/components/BottomStatsBar';

function renderBar(overrides: Partial<ComponentProps<typeof BottomStatsBar>> = {}) {
    const props: ComponentProps<typeof BottomStatsBar> = {
        totalFlights: 320,
        totalAirports: 112,
        totalDistance: 644076,
        selectedYear: null,
        selectedAirport: null,
        selectedAirline: null,
        ...overrides,
    };
    return render(<BottomStatsBar {...props} />);
}

describe('BottomStatsBar', () => {
    it('has a live status region for accessibility', () => {
        renderBar();
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('displays total flights count', () => {
        renderBar({ totalFlights: 320 });
        expect(screen.getByText('320')).toBeInTheDocument();
    });

    it('displays total airports count', () => {
        renderBar({ totalAirports: 112 });
        expect(screen.getByText('112')).toBeInTheDocument();
    });

    it('shows selected year when provided', () => {
        renderBar({ selectedYear: 2024 });
        expect(screen.getByText('2024')).toBeInTheDocument();
    });

    it('shows selected airport code when provided', () => {
        renderBar({ selectedAirport: 'SEA' });
        expect(screen.getByText('SEA')).toBeInTheDocument();
    });

    it('does not show year when none selected', () => {
        renderBar({ selectedYear: null });
        expect(screen.queryByText('2024')).not.toBeInTheDocument();
    });

    it('does not show airport code when none selected', () => {
        renderBar({ selectedAirport: null });
        expect(screen.queryByText('SEA')).not.toBeInTheDocument();
    });

    it('does not display "Press H for help"', () => {
        renderBar();
        expect(screen.queryByText(/Press H for help/i)).not.toBeInTheDocument();
    });
});
