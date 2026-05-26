import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
        selectedCountry: null,
        selectedRegion: null,
        selectedFlightType: null,
        isMetric: true,
        onToggleUnits: vi.fn(),
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

    it('shows selected airline when provided', () => {
        renderBar({ selectedAirline: 'United' });
        expect(screen.getByText('United')).toBeInTheDocument();
    });

    it('does not show airline when none selected', () => {
        renderBar({ selectedAirline: null });
        expect(screen.queryByText('United')).not.toBeInTheDocument();
    });

    it('shows selected country and region labels when provided', () => {
        renderBar({ selectedCountry: 'Canada', selectedRegion: 'Washington' });
        expect(screen.getByText('Canada')).toBeInTheDocument();
        expect(screen.getByText('Washington')).toBeInTheDocument();
    });

    it('shows selected flight type when provided', () => {
        renderBar({ selectedFlightType: 'intercontinental' });
        expect(screen.getByText('Intercontinental')).toBeInTheDocument();
    });

    it('renders metric distance as a unit-toggle button', () => {
        renderBar({ totalDistance: 100, isMetric: true });
        const button = screen.getByRole('button', { name: 'Switch to imperial units' });

        expect(button).toHaveTextContent('100 km');
        expect(button).not.toHaveClass('hidden');
    });

    it('renders imperial distance when metric units are disabled', () => {
        renderBar({ totalDistance: 100, isMetric: false });

        expect(screen.getByRole('button', { name: 'Switch to metric units' })).toHaveTextContent('62 mi');
    });

    it('calls onToggleUnits when the distance button is clicked', () => {
        const onToggleUnits = vi.fn();
        renderBar({ totalDistance: 100, onToggleUnits });

        fireEvent.click(screen.getByRole('button', { name: 'Switch to imperial units' }));

        expect(onToggleUnits).toHaveBeenCalledOnce();
    });
});
