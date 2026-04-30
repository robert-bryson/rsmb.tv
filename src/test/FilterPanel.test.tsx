import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { FilterPanel } from '../features/flights/components/FilterPanel';
import type { GlobePoint } from '../features/flights/types';

function makeAirportPoint(code = 'LAX'): GlobePoint {
    return {
        lat: 33.9416,
        lng: -118.4085,
        size: 1,
        color: '#ffffff',
        label: code,
        airport: {
            code,
            name: 'Los Angeles International Airport',
            municipality: 'Los Angeles',
            region: 'US-CA',
            regionName: 'California',
            country: 'US',
            countryName: 'United States',
            continent: 'NA',
            continentName: 'North America',
            elevationFt: 128,
            elevationM: 39,
            visitCount: 2,
            arrivalCount: 1,
            departureCount: 1,
            visitDates: ['2024-01-01'],
        },
    };
}

function renderFilterPanel(overrides: Partial<ComponentProps<typeof FilterPanel>> = {}) {
    const props: ComponentProps<typeof FilterPanel> = {
        years: [2024, 2023],
        selectedYear: null,
        onYearChange: vi.fn(),
        flightCount: 2,
        airports: [],
        onAirportSelect: vi.fn(),
        ...overrides,
    };

    return render(<FilterPanel {...props} />);
}

describe('FilterPanel', () => {
    it('opens and closes itself when uncontrolled', () => {
        renderFilterPanel();
        const toggle = screen.getByRole('button', { name: /toggle filters/i });

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('dialog', { name: /filters/i })).not.toBeInTheDocument();

        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('dialog', { name: /filters/i })).toBeInTheDocument();

        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('dialog', { name: /filters/i })).not.toBeInTheDocument();
    });

    it('uses controlled open state and reports toggle requests', () => {
        const onOpenChange = vi.fn();
        const { rerender } = renderFilterPanel({ isOpen: false, onOpenChange });
        const toggle = screen.getByRole('button', { name: /toggle filters/i });

        fireEvent.click(toggle);

        expect(onOpenChange).toHaveBeenCalledWith(true);
        expect(screen.queryByRole('dialog', { name: /filters/i })).not.toBeInTheDocument();

        rerender(
            <FilterPanel
                years={[2024, 2023]}
                selectedYear={null}
                onYearChange={vi.fn()}
                flightCount={2}
                airports={[]}
                onAirportSelect={vi.fn()}
                isOpen
                onOpenChange={onOpenChange}
            />
        );

        expect(screen.getByRole('dialog', { name: /filters/i })).toBeInTheDocument();
    });

    it('requests close after selecting an airport in controlled mode', () => {
        const onAirportSelect = vi.fn();
        const onOpenChange = vi.fn();
        renderFilterPanel({
            isOpen: true,
            onOpenChange,
            airports: [makeAirportPoint()],
            onAirportSelect,
        });

        fireEvent.change(screen.getByPlaceholderText(/search by code/i), {
            target: { value: 'LAX' },
        });
        fireEvent.click(screen.getByText('LAX'));

        expect(onAirportSelect).toHaveBeenCalledWith('LAX');
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
