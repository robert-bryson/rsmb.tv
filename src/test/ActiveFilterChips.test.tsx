import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActiveFilterChips } from '../features/flights/components/ActiveFilterChips';

function renderChips(overrides = {}) {
    const props = {
        selectedYear: null,
        selectedAirport: null,
        selectedAirline: null,
        selectedRoute: null,
        selectedCountry: null,
        selectedRegion: null,
        onClearYear: vi.fn(),
        onClearAirport: vi.fn(),
        onClearAirline: vi.fn(),
        onClearRoute: vi.fn(),
        onClearCountry: vi.fn(),
        onClearRegion: vi.fn(),
        ...overrides,
    };

    return { ...render(<ActiveFilterChips {...props} />), props };
}

describe('ActiveFilterChips', () => {
    it('renders nothing when no filters are active', () => {
        renderChips();

        expect(screen.queryByLabelText('Active flight filters')).not.toBeInTheDocument();
    });

    it('renders active filters as removable chips', () => {
        renderChips({ selectedYear: 2024, selectedAirport: 'SEA', selectedAirline: 'United' });

        expect(screen.getByText('2024')).toBeInTheDocument();
        expect(screen.getByText('SEA')).toBeInTheDocument();
        expect(screen.getByText('United')).toBeInTheDocument();
    });

    it('calls the matching clear handler', () => {
        const onClearYear = vi.fn();
        renderChips({ selectedYear: 2024, onClearYear });

        fireEvent.click(screen.getByRole('button', { name: 'Clear year filter' }));

        expect(onClearYear).toHaveBeenCalledOnce();
    });
});
