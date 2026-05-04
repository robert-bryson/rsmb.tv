import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { StatsPanel } from '../features/flights/components/StatsPanel';
import type { FlightStats } from '../features/flights/types';

/** Minimal FlightStats for rendering OverallStats without optional data. */
function makeStats(overrides: Partial<FlightStats> = {}): FlightStats {
    return {
        totalFlights: 320,
        totalAirports: 112,
        totalCountries: 42,
        totalAirlines: 18,
        totalDistance: 644076,
        years: [2006, 2024],
        busiestRoutes: [],
        busiestAirport: null,
        longestFlight: null,
        shortestFlight: null,
        internationalFlights: 80,
        intercontinentalFlights: 40,
        continentCounts: {},
        averageDistance: 2012,
        totalFlightTime: 820,
        uniqueRoutes: 200,
        mostVisitedCountry: null,
        firstFlight: null,
        lastFlight: null,
        selectedAirportInfo: null,
        airlineCounts: [],
        topCountries: [],
        topRegions: [],
        highestAirport: null,
        lowestAirport: null,
        ...overrides,
    };
}

function renderStatsPanel(overrides: Partial<ComponentProps<typeof StatsPanel>> = {}) {
    const props: ComponentProps<typeof StatsPanel> = {
        stats: makeStats(),
        isOpen: false,
        onToggle: vi.fn(),
        selectedYear: null,
        onClearAirport: vi.fn(),
        selectedAirline: null,
        onAirlineSelect: vi.fn(),
        onAirportClick: vi.fn(),
        onRouteClick: vi.fn(),
        onCountryClick: vi.fn(),
        onRegionClick: vi.fn(),
        validAirportCodes: new Set(),
        selectedRouteInfo: null,
        onClearRoute: vi.fn(),
        selectedCountryInfo: null,
        onClearCountry: vi.fn(),
        selectedRegionInfo: null,
        onClearRegion: vi.fn(),
        ...overrides,
    };
    return render(<StatsPanel {...props} />);
}

describe('StatsPanel', () => {
    describe('pull tab toggle button', () => {
        it('renders the pull tab regardless of open state', () => {
            renderStatsPanel({ isOpen: false });
            expect(screen.getByRole('button', { name: 'Show stats panel' })).toBeInTheDocument();
        });

        it('shows "Hide stats panel" label when open', () => {
            renderStatsPanel({ isOpen: true });
            expect(screen.getByRole('button', { name: 'Hide stats panel' })).toBeInTheDocument();
        });

        it('calls onToggle when pull tab is clicked', () => {
            const onToggle = vi.fn();
            renderStatsPanel({ isOpen: false, onToggle });
            fireEvent.click(screen.getByRole('button', { name: 'Show stats panel' }));
            expect(onToggle).toHaveBeenCalledOnce();
        });

        it('sets aria-expanded=false when closed', () => {
            renderStatsPanel({ isOpen: false });
            expect(screen.getByRole('button', { name: 'Show stats panel' })).toHaveAttribute(
                'aria-expanded',
                'false',
            );
        });

        it('sets aria-expanded=true when open', () => {
            renderStatsPanel({ isOpen: true });
            expect(screen.getByRole('button', { name: 'Hide stats panel' })).toHaveAttribute(
                'aria-expanded',
                'true',
            );
        });
    });

    describe('panel content', () => {
        it('shows overall flight statistics when open', () => {
            renderStatsPanel({ isOpen: true });
            expect(screen.getByText('Flight Statistics')).toBeInTheDocument();
        });

        it('renders panel content even when closed (always-mounted for animation)', () => {
            renderStatsPanel({ isOpen: false });
            // Content is rendered but marked inert/aria-hidden — still in the DOM
            expect(screen.getByText('Flight Statistics')).toBeInTheDocument();
        });

        it('marks panel content as aria-hidden when closed', () => {
            const { container } = renderStatsPanel({ isOpen: false });
            const panel = container.querySelector('[aria-hidden="true"]');
            expect(panel).toBeInTheDocument();
        });

        it('does not mark panel content as aria-hidden when open', () => {
            const { container } = renderStatsPanel({ isOpen: true });
            const panel = container.querySelector('.overflow-y-auto');
            expect(panel).not.toHaveAttribute('aria-hidden');
        });

        it('shows year filter label when selectedYear is set', () => {
            renderStatsPanel({ isOpen: true, selectedYear: 2024 });
            expect(screen.getByText('Filtered: 2024')).toBeInTheDocument();
        });

        it('shows airline filter label and clear button when selectedAirline is set', () => {
            const onAirlineSelect = vi.fn();
            renderStatsPanel({
                isOpen: true,
                selectedAirline: 'United',
                onAirlineSelect,
            });
            expect(screen.getByText(/Airline: United/)).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: '✕' }));
            expect(onAirlineSelect).toHaveBeenCalledWith(null);
        });
    });
});
