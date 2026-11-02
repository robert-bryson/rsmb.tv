import type { FlightProperties, FlightTypeFilter } from '../types';
import { flightMatchesType, getRouteKey, parseYear } from './index';

export interface FlightFilters {
    selectedYear?: number | null;
    selectedAirport?: string | null;
    selectedAirline?: string | null;
    selectedRoute?: string | null;
    selectedCountry?: string | null;
    selectedRegion?: string | null;
    selectedFlightType?: FlightTypeFilter | null;
}

export function flightMatchesFilters(flight: FlightProperties, filters: FlightFilters): boolean {
    return (filters.selectedYear == null || parseYear(flight.date) === filters.selectedYear)
        && (!filters.selectedAirport || flight.origin_code === filters.selectedAirport || flight.destination_code === filters.selectedAirport)
        && (!filters.selectedAirline || flight.airline === filters.selectedAirline)
        && (!filters.selectedRoute || getRouteKey(flight.origin_code, flight.destination_code) === filters.selectedRoute)
        && (!filters.selectedCountry || flight.origin_country === filters.selectedCountry || flight.destination_country === filters.selectedCountry)
        && (!filters.selectedRegion || flight.origin_region === filters.selectedRegion || flight.destination_region === filters.selectedRegion)
        && (!filters.selectedFlightType || flightMatchesType(flight, filters.selectedFlightType));
}
