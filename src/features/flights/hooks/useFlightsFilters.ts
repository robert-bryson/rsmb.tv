import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Manages URL-based filter state for the flights globe.
 * All filter values are derived from search params so they're shareable via URL.
 */
export function useFlightsFilters() {
    const [searchParams, setSearchParams] = useSearchParams();

    const selectedYear = searchParams.get('year') ? Number(searchParams.get('year')) : null;
    const selectedAirport = searchParams.get('airport') || null;
    const selectedAirline = searchParams.get('airline') || null;
    const selectedRoute = searchParams.get('route') || null;
    const selectedCountry = searchParams.get('country') || null;
    const selectedRegion = searchParams.get('region') || null;

    const hasUrlFilters = selectedYear !== null || selectedAirport !== null || selectedAirline !== null || selectedRoute !== null || selectedCountry !== null || selectedRegion !== null;

    const setSelectedYear = useCallback((year: number | null) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            if (year === null) {
                newParams.delete('year');
            } else {
                newParams.set('year', String(year));
            }
            newParams.delete('airport');
            return newParams;
        });
    }, [setSearchParams]);

    const setSelectedAirport = useCallback((airport: string | null) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            if (airport === null) {
                newParams.delete('airport');
            } else {
                newParams.set('airport', airport);
            }
            newParams.delete('route');
            return newParams;
        });
    }, [setSearchParams]);

    const setSelectedAirline = useCallback((airline: string | null) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            if (airline === null) {
                newParams.delete('airline');
            } else {
                newParams.set('airline', airline);
            }
            return newParams;
        });
    }, [setSearchParams]);

    const setSelectedRoute = useCallback((route: string | null) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            if (route === null) {
                newParams.delete('route');
            } else {
                newParams.set('route', route);
            }
            newParams.delete('airport');
            return newParams;
        });
    }, [setSearchParams]);

    const setSelectedCountry = useCallback((country: string | null) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            if (country === null) {
                newParams.delete('country');
            } else {
                newParams.set('country', country);
            }
            newParams.delete('airport');
            newParams.delete('route');
            newParams.delete('region');
            return newParams;
        });
    }, [setSearchParams]);

    const setSelectedRegion = useCallback((region: string | null) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            if (region === null) {
                newParams.delete('region');
            } else {
                newParams.set('region', region);
            }
            newParams.delete('airport');
            newParams.delete('route');
            newParams.delete('country');
            return newParams;
        });
    }, [setSearchParams]);

    const clearAllFilters = useCallback(() => {
        setSearchParams(new URLSearchParams());
    }, [setSearchParams]);

    // Parse selected route into origin/destination codes
    const selectedRouteAirports = useMemo(() => {
        if (!selectedRoute) return null;
        const parts = selectedRoute.split('-');
        if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
        return { origin: parts[0], destination: parts[1] };
    }, [selectedRoute]);

    return {
        selectedYear,
        selectedAirport,
        selectedAirline,
        selectedRoute,
        selectedCountry,
        selectedRegion,
        hasUrlFilters,
        selectedRouteAirports,
        setSelectedYear,
        setSelectedAirport,
        setSelectedAirline,
        setSelectedRoute,
        setSelectedCountry,
        setSelectedRegion,
        clearAllFilters,
    };
}
