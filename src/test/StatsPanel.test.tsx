import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { StatsPanel } from '../features/flights/components/StatsPanel';
import type { FlightStats, SelectedRouteInfo } from '../features/flights/types';

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

function createStatsPanelProps(
    overrides: Partial<ComponentProps<typeof StatsPanel>> = {},
): ComponentProps<typeof StatsPanel> {
    return {
        stats: makeStats(),
        isOpen: false,
        onToggle: vi.fn(),
        selectedYear: null,
        onClearAirport: vi.fn(),
        selectedAirline: null,
        onAirlineSelect: vi.fn(),
        selectedFlightType: null,
        onFlightTypeSelect: vi.fn(),
        onAirportClick: vi.fn(),
        onRouteClick: vi.fn(),
        onCountryClick: vi.fn(),
        onRegionClick: vi.fn(),
        validAirportCodes: new Set(),
        airportNames: new Map(),
        selectedRouteInfo: null,
        onClearRoute: vi.fn(),
        selectedCountryInfo: null,
        onClearCountry: vi.fn(),
        selectedRegionInfo: null,
        onClearRegion: vi.fn(),
        isMetric: true,
        ...overrides,
    };
}

function renderStatsPanel(overrides: Partial<ComponentProps<typeof StatsPanel>> = {}) {
    return render(<StatsPanel {...createStatsPanelProps(overrides)} />);
}

function makeSelectedRouteInfo(): SelectedRouteInfo {
    return {
        routeKey: 'LAX-SEA',
        originCode: 'SEA',
        originName: 'Seattle-Tacoma International Airport',
        originMunicipality: 'Seattle',
        originCountry: 'US',
        originCountryName: 'United States',
        originRegion: 'US-WA',
        originRegionName: 'Washington',
        originContinentName: 'North America',
        destinationCode: 'LAX',
        destinationName: 'Los Angeles International Airport',
        destinationMunicipality: 'Los Angeles',
        destinationCountry: 'US',
        destinationCountryName: 'United States',
        destinationRegion: 'US-CA',
        destinationRegionName: 'California',
        destinationContinentName: 'North America',
        totalFlights: 16,
        airlines: ['Alaska Airlines'],
        years: [2023, 2024],
        dates: Array.from({ length: 16 }, (_, index) => `1/${16 - index}/2024`),
        distanceKm: 1545,
        isInternational: false,
        isIntercontinental: false,
    };
}

describe('StatsPanel', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });

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
            const { getByTestId } = renderStatsPanel({ isOpen: false });
            expect(getByTestId('stats-panel-content')).toHaveAttribute('aria-hidden', 'true');
        });

        it('does not mark panel content as aria-hidden when open', () => {
            const { getByTestId } = renderStatsPanel({ isOpen: true });
            expect(getByTestId('stats-panel-content')).not.toHaveAttribute('aria-hidden');
        });

        it('exposes the closed state used to hide the scrollbar', () => {
            const { getByTestId } = renderStatsPanel({ isOpen: false });
            expect(getByTestId('stats-panel-content')).toHaveAttribute('data-state', 'closed');
        });

        it('updates the scrollbar state when the panel opens', () => {
            const { getByTestId, rerender } = renderStatsPanel({ isOpen: false });

            rerender(<StatsPanel {...createStatsPanelProps({ isOpen: true })} />);

            expect(getByTestId('stats-panel-content')).toHaveClass('flights-stats-panel');
            expect(getByTestId('stats-panel-content')).toHaveAttribute('data-state', 'open');
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
            fireEvent.click(screen.getByRole('button', { name: 'Clear airline filter' }));
            expect(onAirlineSelect).toHaveBeenCalledWith(null);
        });

        it('selects a flight type from the Flight Types section', () => {
            const onFlightTypeSelect = vi.fn();
            renderStatsPanel({ isOpen: true, onFlightTypeSelect });

            fireEvent.click(screen.getByRole('button', { name: 'Show intercontinental flights' }));

            expect(onFlightTypeSelect).toHaveBeenCalledWith('intercontinental');
        });

        it('clears the active flight type when its selected stat is clicked again', () => {
            const onFlightTypeSelect = vi.fn();
            renderStatsPanel({
                isOpen: true,
                selectedFlightType: 'intercontinental',
                onFlightTypeSelect,
            });

            const button = screen.getByRole('button', { name: 'Clear intercontinental flight type filter' });
            expect(button).toHaveAttribute('aria-pressed', 'true');

            fireEvent.click(button);

            expect(onFlightTypeSelect).toHaveBeenCalledWith(null);
        });

        it('clears the active flight type from its filter label', () => {
            const onFlightTypeSelect = vi.fn();
            renderStatsPanel({
                isOpen: true,
                selectedFlightType: 'domestic',
                onFlightTypeSelect,
            });

            fireEvent.click(screen.getByRole('button', { name: 'Clear flight type filter' }));

            expect(onFlightTypeSelect).toHaveBeenCalledWith(null);
        });

        it('formats overall distance stats with the selected unit system', () => {
            renderStatsPanel({
                isOpen: true,
                isMetric: false,
                stats: makeStats({ totalDistance: 100, averageDistance: 10 }),
            });

            expect(screen.getByText('62 mi')).toHaveAttribute('title', '100 km');
            expect(screen.getByText('6 mi')).toHaveAttribute('title', '10 km');
        });

        it('shows miles on hover for metric distance stats', () => {
            renderStatsPanel({
                isOpen: true,
                stats: makeStats({ totalDistance: 100, averageDistance: 10 }),
            });

            expect(screen.getByText('100 km')).toHaveAttribute('title', '62 mi');
            expect(screen.getByText('10 km')).toHaveAttribute('title', '6 mi');
        });

        it('presents long route histories incrementally as styled flight entries', () => {
            renderStatsPanel({
                isOpen: true,
                selectedRouteInfo: makeSelectedRouteInfo(),
                validAirportCodes: new Set(['SEA', 'LAX']),
            });

            fireEvent.click(screen.getByRole('button', { name: /All Flights \(16\)/ }));

            expect(screen.getByText('Latest')).toBeInTheDocument();
            expect(screen.getByText('8 more')).toBeInTheDocument();
            expect(screen.queryByText('1/8/2024')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Show 8 more' }));

            expect(screen.getByText('1/8/2024')).toBeInTheDocument();
            expect(screen.getByText('First')).toBeInTheDocument();
        });

        it('opens sections with closed defaults when Expand All is selected', () => {
            renderStatsPanel({
                isOpen: true,
                selectedRouteInfo: makeSelectedRouteInfo(),
                validAirportCodes: new Set(['SEA', 'LAX']),
            });

            expect(screen.queryByText('Latest')).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: '▼ Collapse All' }));
            fireEvent.click(screen.getByRole('button', { name: '▶ Expand All' }));

            expect(screen.getByText('Latest')).toBeInTheDocument();
        });

        it('adds airport-name tooltips to route airport code links', () => {
            renderStatsPanel({
                isOpen: true,
                validAirportCodes: new Set(['SEA', 'YVR']),
                airportNames: new Map([
                    ['SEA', 'Seattle-Tacoma International Airport'],
                    ['YVR', 'Vancouver International Airport'],
                ]),
                stats: makeStats({
                    busiestRoutes: [{
                        routeKey: 'SEA-YVR',
                        origin: 'SEA',
                        destination: 'YVR',
                        count: 2,
                        years: [2024],
                        dates: ['1/1/2024'],
                    }],
                }),
            });

            expect(screen.getByRole('button', { name: 'SEA' })).toHaveAttribute(
                'title',
                'Seattle-Tacoma International Airport',
            );
            expect(screen.getByRole('button', { name: 'YVR' })).toHaveAttribute(
                'title',
                'Vancouver International Airport',
            );
        });

        it('clears airport selection without invoking the panel toggle', () => {
            const onClearAirport = vi.fn();
            const onToggle = vi.fn();

            renderStatsPanel({
                isOpen: true,
                onClearAirport,
                onToggle,
                stats: makeStats({
                    selectedAirportInfo: {
                        code: 'SEA',
                        name: 'Seattle-Tacoma International Airport',
                        municipality: 'Seattle',
                        region: 'US-WA',
                        regionName: 'Washington',
                        country: 'US',
                        countryName: 'United States',
                        continent: 'NA',
                        continentName: 'North America',
                        elevationFt: 433,
                        elevationM: 132,
                        totalVisits: 5,
                        arrivals: 2,
                        departures: 3,
                        firstVisit: null,
                        lastVisit: null,
                        connectedAirports: 2,
                        connectedCountries: [],
                        topDestinations: [],
                        topOrigins: [],
                        airlines: [],
                    },
                }),
            });

            fireEvent.click(screen.getByRole('button', { name: '✕ Clear' }));

            expect(onClearAirport).toHaveBeenCalledOnce();
            expect(onToggle).not.toHaveBeenCalled();
        });

        it('stops resize mode when pointercancel fires', async () => {
            renderStatsPanel({ isOpen: true });

            const resizeHandle = screen.getByRole('separator', { name: 'Resize stats panel' });
            fireEvent.pointerDown(resizeHandle, {
                pointerType: 'mouse',
                button: 0,
                clientX: 320,
            });

            await waitFor(() => {
                expect(document.body.style.cursor).toBe('col-resize');
            });

            fireEvent(window, new PointerEvent('pointercancel'));

            await waitFor(() => {
                expect(document.body.style.cursor).toBe('');
                expect(document.body.style.userSelect).toBe('');
            });
        });

        it('supports keyboard resizing and exposes its current width', () => {
            const { container } = renderStatsPanel({ isOpen: true });
            const resizeHandle = screen.getByRole('separator', { name: 'Resize stats panel' });

            expect(resizeHandle).toHaveAttribute('aria-valuemin', '272');
            expect(resizeHandle).toHaveAttribute('aria-valuemax', '520');
            expect(resizeHandle).toHaveAttribute('aria-valuenow', '320');

            fireEvent.keyDown(resizeHandle, { key: 'ArrowRight' });

            expect(resizeHandle).toHaveAttribute('aria-valuenow', '328');
            expect(container.firstElementChild).toHaveStyle({ width: '328px' });

            fireEvent.keyDown(resizeHandle, { key: 'Home' });
            expect(resizeHandle).toHaveAttribute('aria-valuenow', '272');

            fireEvent.keyDown(resizeHandle, { key: 'ArrowLeft' });
            expect(resizeHandle).toHaveAttribute('aria-valuenow', '272');

            fireEvent.keyDown(resizeHandle, { key: 'End' });
            expect(resizeHandle).toHaveAttribute('aria-valuenow', '520');

            fireEvent.keyDown(resizeHandle, { key: 'ArrowRight' });
            expect(resizeHandle).toHaveAttribute('aria-valuenow', '520');
            expect(localStorage.getItem('flights-stats-panel-width')).toBe('520');
        });

        it('removes the resize handle from keyboard navigation when closed', () => {
            const { container } = renderStatsPanel({ isOpen: false });

            const resizeHandle = container.querySelector('[role="separator"]');
            expect(resizeHandle).toHaveAttribute('aria-label', 'Resize stats panel');
            expect(resizeHandle).toHaveAttribute('aria-hidden', 'true');
            expect(resizeHandle).toHaveAttribute('tabindex', '-1');
        });

        it.each([
            ['a nonnumeric value', JSON.stringify('invalid'), '320px', '320'],
            ['null', 'null', '320px', '320'],
            ['a value below the minimum', '100', '272px', '272'],
            ['a value above the maximum', '1000', '520px', '520'],
        ])('repairs %s in persisted panel width', async (_case, storedValue, expectedWidth, expectedStoredValue) => {
            localStorage.setItem('flights-stats-panel-width', storedValue);
            const { container } = renderStatsPanel({ isOpen: true });

            expect(container.firstElementChild).toHaveStyle({ width: expectedWidth });
            await waitFor(() => {
                expect(localStorage.getItem('flights-stats-panel-width')).toBe(expectedStoredValue);
            });
        });
    });
});
