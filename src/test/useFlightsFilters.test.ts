import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useFlightsFilters } from '../features/flights/hooks/useFlightsFilters';

function wrapper({ children }: { children: ReactNode }) {
    return MemoryRouter({ initialEntries: ['/map'], children });
}

function wrapperWithParams(params: string) {
    return ({ children }: { children: ReactNode }) =>
        MemoryRouter({ initialEntries: [`/map?${params}`], children });
}

describe('useFlightsFilters', () => {
    it('starts with all filters null', () => {
        const { result } = renderHook(() => useFlightsFilters(), { wrapper });
        expect(result.current.selectedYear).toBeNull();
        expect(result.current.selectedAirport).toBeNull();
        expect(result.current.selectedAirline).toBeNull();
        expect(result.current.selectedRoute).toBeNull();
        expect(result.current.selectedCountry).toBeNull();
        expect(result.current.selectedRegion).toBeNull();
        expect(result.current.hasUrlFilters).toBe(false);
    });

    it('reads year from URL params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('year=2024'),
        });
        expect(result.current.selectedYear).toBe(2024);
        expect(result.current.hasUrlFilters).toBe(true);
    });

    it('reads airport from URL params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('airport=LAX'),
        });
        expect(result.current.selectedAirport).toBe('LAX');
    });

    it('reads airline from URL params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('airline=United'),
        });
        expect(result.current.selectedAirline).toBe('United');
    });

    it('parses selectedRouteAirports from route param', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('route=JFK-LAX'),
        });
        expect(result.current.selectedRoute).toBe('JFK-LAX');
        expect(result.current.selectedRouteAirports).toEqual({ origin: 'JFK', destination: 'LAX' });
    });

    it('returns null for selectedRouteAirports when no route', () => {
        const { result } = renderHook(() => useFlightsFilters(), { wrapper });
        expect(result.current.selectedRouteAirports).toBeNull();
    });

    it('setSelectedYear updates URL and clears airport', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('airport=LAX'),
        });

        act(() => result.current.setSelectedYear(2024));
        expect(result.current.selectedYear).toBe(2024);
        expect(result.current.selectedAirport).toBeNull();
    });

    it('setSelectedYear(null) removes year param', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('year=2024'),
        });

        act(() => result.current.setSelectedYear(null));
        expect(result.current.selectedYear).toBeNull();
    });

    it('setSelectedAirport clears route, country, and region params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('route=JFK-LAX&country=CA&region=CA-BC'),
        });

        act(() => result.current.setSelectedAirport('SFO'));
        expect(result.current.selectedAirport).toBe('SFO');
        expect(result.current.selectedRoute).toBeNull();
        expect(result.current.selectedCountry).toBeNull();
        expect(result.current.selectedRegion).toBeNull();
    });

    it('setSelectedRoute clears airport, country, and region params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('airport=LAX&country=CA&region=CA-BC'),
        });

        act(() => result.current.setSelectedRoute('SEA-YVR'));
        expect(result.current.selectedRoute).toBe('SEA-YVR');
        expect(result.current.selectedAirport).toBeNull();
        expect(result.current.selectedCountry).toBeNull();
        expect(result.current.selectedRegion).toBeNull();
    });

    it('setSelectedCountry clears airport, route, and region', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('airport=LAX&route=JFK-LAX&region=CA'),
        });

        act(() => result.current.setSelectedCountry('US'));
        expect(result.current.selectedCountry).toBe('US');
        expect(result.current.selectedAirport).toBeNull();
        expect(result.current.selectedRoute).toBeNull();
        expect(result.current.selectedRegion).toBeNull();
    });

    it('clearAllFilters removes all params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('year=2024&airport=LAX&airline=United'),
        });

        act(() => result.current.clearAllFilters());
        expect(result.current.selectedYear).toBeNull();
        expect(result.current.selectedAirport).toBeNull();
        expect(result.current.selectedAirline).toBeNull();
        expect(result.current.hasUrlFilters).toBe(false);
    });

    it('returns null for malformed route param (no hyphen)', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('route=LAX'),
        });
        expect(result.current.selectedRoute).toBe('LAX');
        expect(result.current.selectedRouteAirports).toBeNull();
    });

    it('returns null for route param with too many segments', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('route=A-B-C'),
        });
        expect(result.current.selectedRouteAirports).toBeNull();
    });
});
