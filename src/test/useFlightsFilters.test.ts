import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useFlightsFilters } from '../features/flights/hooks/useFlightsFilters';
import { DEFAULT_VIEW } from '../features/flights/constants';

function useFlightsFiltersWithLocation() {
    const filters = useFlightsFilters();
    const location = useLocation();
    return { ...filters, search: location.search };
}

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
        expect(result.current.selectedFlightType).toBeNull();
        expect(result.current.hasUrlFilters).toBe(false);
        expect(result.current.selectedGlobeView).toBeNull();
        expect(result.current.showStats).toBe(false);
        expect(result.current.filterOpen).toBe(false);
        expect(result.current.layersOpen).toBe(false);
        expect(result.current.activeLayerSection).toBe('none');
        expect(result.current.showHelp).toBe(false);
        expect(result.current.basemapId).toBe('night');
        expect(result.current.colorMode).toBe('default');
        expect(result.current.animationEnabled).toBe(true);
        expect(result.current.showFlightPaths).toBe(true);
        expect(result.current.globeRotationEnabled).toBe(false);
        expect(result.current.allAirportsVisible).toBe(false);
        expect(result.current.airportSymbolMode).toBe('visited');
        expect(result.current.usStatesVisible).toBe(false);
        expect(result.current.stateSymbolMode).toBe('visited');
        expect(result.current.isMetric).toBe(true);
    });

    it('reads camera, UI, layer, and display state from URL params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('lat=47.6062&lng=-122.3321&alt=1.234&stats=1&filters=true&layers=1&layerSection=basemap&help=1&basemap=positron&color=airline&anim=0&paths=false&rotation=1&allAirports=true&airportMode=country&usStates=1&stateMode=flightCount&units=imperial'),
        });

        expect(result.current.selectedGlobeView).toEqual({ lat: 47.6062, lng: -122.3321, altitude: 1.234 });
        expect(result.current.showStats).toBe(true);
        expect(result.current.filterOpen).toBe(true);
        expect(result.current.layersOpen).toBe(true);
        expect(result.current.activeLayerSection).toBe('basemap');
        expect(result.current.showHelp).toBe(true);
        expect(result.current.basemapId).toBe('positron');
        expect(result.current.colorMode).toBe('airline');
        expect(result.current.animationEnabled).toBe(false);
        expect(result.current.showFlightPaths).toBe(false);
        expect(result.current.globeRotationEnabled).toBe(true);
        expect(result.current.allAirportsVisible).toBe(true);
        expect(result.current.airportSymbolMode).toBe('country');
        expect(result.current.usStatesVisible).toBe(true);
        expect(result.current.stateSymbolMode).toBe('flightCount');
        expect(result.current.isMetric).toBe(false);
    });

    it('falls back for invalid camera, UI, layer, and display params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('lat=100&lng=-200&alt=999&layers=1&layerSection=unknown&basemap=moon&color=bogus&airportMode=bad&stateMode=bad&units=metric'),
        });

        expect(result.current.selectedGlobeView).toBeNull();
        expect(result.current.layersOpen).toBe(true);
        expect(result.current.activeLayerSection).toBe('none');
        expect(result.current.basemapId).toBe('night');
        expect(result.current.colorMode).toBe('default');
        expect(result.current.airportSymbolMode).toBe('visited');
        expect(result.current.stateSymbolMode).toBe('visited');
        expect(result.current.isMetric).toBe(true);
    });

    it('accepts only bounded shareable camera altitudes', () => {
        const accepted = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('lat=47&lng=-122&alt=5'),
        });
        const rejected = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('lat=47&lng=-122&alt=5.001'),
        });

        expect(accepted.result.current.selectedGlobeView).toEqual({ lat: 47, lng: -122, altitude: 5 });
        expect(rejected.result.current.selectedGlobeView).toBeNull();
    });

    it('reads year from URL params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('year=2024'),
        });
        expect(result.current.selectedYear).toBe(2024);
        expect(result.current.hasUrlFilters).toBe(true);
    });

    it('ignores invalid year params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('year=not-a-year'),
        });

        expect(result.current.selectedYear).toBeNull();
        expect(result.current.hasUrlFilters).toBe(false);
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

    it('reads valid flight type from URL params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('flightType=intercontinental'),
        });
        expect(result.current.selectedFlightType).toBe('intercontinental');
        expect(result.current.hasUrlFilters).toBe(true);
    });

    it('ignores invalid flight type params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('flightType=long-haul'),
        });
        expect(result.current.selectedFlightType).toBeNull();
        expect(result.current.hasUrlFilters).toBe(false);
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

    it('setSelectedYear updates URL and preserves airport selection', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('airport=LAX'),
        });

        act(() => result.current.setSelectedYear(2024));
        expect(result.current.selectedYear).toBe(2024);
        expect(result.current.selectedAirport).toBe('LAX');
    });

    it('setSelectedYear preserves route, country, region, and airline filters', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('route=JFK-LAX&country=US&region=US-CA&airline=United&flightType=domestic'),
        });

        act(() => result.current.setSelectedYear(2024));
        expect(result.current.selectedYear).toBe(2024);
        expect(result.current.selectedRoute).toBe('JFK-LAX');
        expect(result.current.selectedCountry).toBe('US');
        expect(result.current.selectedRegion).toBe('US-CA');
        expect(result.current.selectedAirline).toBe('United');
        expect(result.current.selectedFlightType).toBe('domestic');
    });

    it('setSelectedFlightType updates the URL param and clears other map focus selections', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('year=2024&airline=United&airport=SEA&route=SEA-YVR&country=US&region=US-WA'),
        });

        act(() => result.current.setSelectedFlightType('international'));
        expect(result.current.selectedFlightType).toBe('international');
        expect(result.current.selectedYear).toBe(2024);
        expect(result.current.selectedAirline).toBe('United');
        expect(result.current.selectedAirport).toBeNull();
        expect(result.current.selectedRoute).toBeNull();
        expect(result.current.selectedCountry).toBeNull();
        expect(result.current.selectedRegion).toBeNull();

        act(() => result.current.setSelectedFlightType(null));
        expect(result.current.selectedFlightType).toBeNull();
    });

    it('setSelectedYear(null) removes year param', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('year=2024'),
        });

        act(() => result.current.setSelectedYear(null));
        expect(result.current.selectedYear).toBeNull();
    });

    it('setSelectedYear removes the year param for invalid numbers', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('year=2024'),
        });

        act(() => result.current.setSelectedYear(Number.NaN));
        expect(result.current.selectedYear).toBeNull();
    });

    it('setSelectedAirport clears route, country, region, and flight type params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('route=JFK-LAX&country=CA&region=CA-BC&flightType=intercontinental'),
        });

        act(() => result.current.setSelectedAirport('SFO'));
        expect(result.current.selectedAirport).toBe('SFO');
        expect(result.current.selectedRoute).toBeNull();
        expect(result.current.selectedCountry).toBeNull();
        expect(result.current.selectedRegion).toBeNull();
        expect(result.current.selectedFlightType).toBeNull();
    });

    it('setSelectedRoute clears airport, country, region, and flight type params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('airport=LAX&country=CA&region=CA-BC&flightType=domestic'),
        });

        act(() => result.current.setSelectedRoute('SEA-YVR'));
        expect(result.current.selectedRoute).toBe('SEA-YVR');
        expect(result.current.selectedAirport).toBeNull();
        expect(result.current.selectedCountry).toBeNull();
        expect(result.current.selectedRegion).toBeNull();
        expect(result.current.selectedFlightType).toBeNull();
    });

    it('setSelectedCountry clears airport, route, region, and flight type', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('airport=LAX&route=JFK-LAX&region=CA&flightType=international'),
        });

        act(() => result.current.setSelectedCountry('US'));
        expect(result.current.selectedCountry).toBe('US');
        expect(result.current.selectedAirport).toBeNull();
        expect(result.current.selectedRoute).toBeNull();
        expect(result.current.selectedRegion).toBeNull();
        expect(result.current.selectedFlightType).toBeNull();
    });

    it('setSelectedRegion clears airport, route, country, and flight type', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('airport=LAX&route=JFK-LAX&country=US&flightType=intercontinental'),
        });

        act(() => result.current.setSelectedRegion('US-WA'));
        expect(result.current.selectedRegion).toBe('US-WA');
        expect(result.current.selectedAirport).toBeNull();
        expect(result.current.selectedRoute).toBeNull();
        expect(result.current.selectedCountry).toBeNull();
        expect(result.current.selectedFlightType).toBeNull();
    });

    it('setSelectedGlobeView writes rounded camera params', () => {
        const { result } = renderHook(() => useFlightsFiltersWithLocation(), { wrapper });

        act(() => result.current.setSelectedGlobeView({ lat: 47.60621, lng: -122.33207, altitude: 1.23456 }));
        expect(result.current.selectedGlobeView).toEqual({ lat: 47.6062, lng: -122.3321, altitude: 1.235 });
        expect(result.current.search).toContain('lat=47.6062');
        expect(result.current.search).toContain('lng=-122.3321');
        expect(result.current.search).toContain('alt=1.235');

        act(() => result.current.setSelectedGlobeView(null));
        expect(result.current.selectedGlobeView).toBeNull();
        expect(result.current.search).not.toContain('lat=');
        expect(result.current.search).not.toContain('lng=');
        expect(result.current.search).not.toContain('alt=');
    });

    it('setSelectedGlobeView clears camera params for the default view', () => {
        const { result } = renderHook(() => useFlightsFiltersWithLocation(), {
            wrapper: wrapperWithParams('lat=47&lng=-122&alt=1.1'),
        });

        act(() => result.current.setSelectedGlobeView(DEFAULT_VIEW));

        expect(result.current.selectedGlobeView).toBeNull();
        expect(result.current.search).not.toContain('lat=');
        expect(result.current.search).not.toContain('lng=');
        expect(result.current.search).not.toContain('alt=');
    });

    it('updates URL-backed panel and help state', () => {
        const { result } = renderHook(() => useFlightsFiltersWithLocation(), { wrapper });

        act(() => result.current.setShowStats(true));
        expect(result.current.showStats).toBe(true);
        expect(result.current.search).toContain('stats=1');

        act(() => result.current.setFilterOpen((open) => !open));
        expect(result.current.filterOpen).toBe(true);
        expect(result.current.search).toContain('filters=1');

        act(() => result.current.setActiveLayerSection('states'));
        expect(result.current.layersOpen).toBe(true);
        expect(result.current.activeLayerSection).toBe('states');
        expect(result.current.search).toContain('layers=1');
        expect(result.current.search).toContain('layerSection=states');

        act(() => result.current.setShowHelp(true));
        expect(result.current.showHelp).toBe(true);
        expect(result.current.search).toContain('help=1');

        act(() => result.current.setLayersOpen(false));
        expect(result.current.layersOpen).toBe(false);
        expect(result.current.activeLayerSection).toBe('none');
        expect(result.current.search).not.toContain('layerSection=');
    });

    it('composes multiple URL state updates in the same event', () => {
        const { result } = renderHook(() => useFlightsFiltersWithLocation(), {
            wrapper: wrapperWithParams('layers=1&layerSection=basemap&flightType=international'),
        });

        act(() => {
            result.current.setLayersOpen(false);
            result.current.setActiveLayerSection('none');
            result.current.setShowStats(true);
            result.current.setSelectedAirport('SEA');
            result.current.setSelectedGlobeView({ lat: 47.45, lng: -122.31, altitude: 0.75 });
        });

        expect(result.current.layersOpen).toBe(false);
        expect(result.current.activeLayerSection).toBe('none');
        expect(result.current.showStats).toBe(true);
        expect(result.current.selectedAirport).toBe('SEA');
        expect(result.current.selectedFlightType).toBeNull();
        expect(result.current.selectedGlobeView).toEqual({ lat: 47.45, lng: -122.31, altitude: 0.75 });
        expect(result.current.search).not.toContain('layers=');
        expect(result.current.search).not.toContain('layerSection=');
        expect(result.current.search).toContain('stats=1');
        expect(result.current.search).toContain('airport=SEA');
        expect(result.current.search).toContain('lat=47.45');
    });

    it('composes repeated functional boolean updates in the same event', () => {
        const { result } = renderHook(() => useFlightsFiltersWithLocation(), { wrapper });

        act(() => {
            result.current.setShowStats((open) => !open);
            result.current.setShowStats((open) => !open);
            result.current.setFilterOpen((open) => !open);
            result.current.setFilterOpen((open) => !open);
            result.current.setLayersOpen((open) => !open);
            result.current.setLayersOpen((open) => !open);
            result.current.setIsMetric((metric) => !metric);
            result.current.setIsMetric((metric) => !metric);
        });

        expect(result.current.showStats).toBe(false);
        expect(result.current.filterOpen).toBe(false);
        expect(result.current.layersOpen).toBe(false);
        expect(result.current.isMetric).toBe(true);
        expect(result.current.search).not.toContain('stats=');
        expect(result.current.search).not.toContain('filters=');
        expect(result.current.search).not.toContain('layers=');
        expect(result.current.search).not.toContain('units=');
    });

    it('updates URL-backed display and layer state', () => {
        const { result } = renderHook(() => useFlightsFiltersWithLocation(), { wrapper });

        act(() => result.current.setBasemapId('day'));
        expect(result.current.basemapId).toBe('day');

        act(() => result.current.setColorMode('frequency'));
        expect(result.current.colorMode).toBe('frequency');

        act(() => result.current.setAnimationEnabled(false));
        expect(result.current.animationEnabled).toBe(false);

        act(() => result.current.setShowFlightPaths(false));
        expect(result.current.showFlightPaths).toBe(false);

        act(() => result.current.setGlobeRotationEnabled(true));
        expect(result.current.globeRotationEnabled).toBe(true);

        act(() => result.current.setAllAirportsVisible(true));
        expect(result.current.allAirportsVisible).toBe(true);

        act(() => result.current.setAirportSymbolMode('elevation'));
        expect(result.current.airportSymbolMode).toBe('elevation');

        act(() => result.current.setUSStatesVisible(true));
        expect(result.current.usStatesVisible).toBe(true);

        act(() => result.current.setStateSymbolMode('visitCount'));
        expect(result.current.stateSymbolMode).toBe('visitCount');

        act(() => result.current.setIsMetric(false));
        expect(result.current.isMetric).toBe(false);
        expect(result.current.search).toContain('units=imperial');
    });

    it('clearAllFilters removes selection params and preserves app state params', () => {
        const { result } = renderHook(() => useFlightsFilters(), {
            wrapper: wrapperWithParams('year=2024&airport=LAX&airline=United&flightType=international&lat=47&lng=-122&alt=1.1&stats=1&basemap=day'),
        });

        act(() => result.current.clearAllFilters());
        expect(result.current.selectedYear).toBeNull();
        expect(result.current.selectedAirport).toBeNull();
        expect(result.current.selectedAirline).toBeNull();
        expect(result.current.selectedFlightType).toBeNull();
        expect(result.current.hasUrlFilters).toBe(false);
        expect(result.current.selectedGlobeView).toEqual({ lat: 47, lng: -122, altitude: 1.1 });
        expect(result.current.showStats).toBe(true);
        expect(result.current.basemapId).toBe('day');
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
