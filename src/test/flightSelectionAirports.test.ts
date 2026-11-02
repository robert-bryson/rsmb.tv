import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGlobeData } from '../features/flights/hooks/useFlightData';
import { useSelectionInfo } from '../features/flights/hooks/useSelectionInfo';
import type { FlightFilters } from '../features/flights/utils/flightFilters';
import { makeAirport, makeFlight } from './helpers/flights';

const flights = {
    type: 'FeatureCollection',
    features: [
        makeFlight(),
        makeFlight({ id: 2, airline: 'Other' }),
        makeFlight({ id: 3, airline: 'Other', destination_code: 'BFI', destination_name: 'Boeing Field', destination_region: 'US-WA', destination_lat: 47.53, destination_lon: -122.3 }),
        makeFlight({ id: 4, date: '1/1/2025', destination_code: 'YYZ', destination_name: 'Toronto Pearson', destination_country: 'CA', destination_countryName: 'Canada', destination_region: 'CA-ON', destination_lat: 43.67, destination_lon: -79.62 }),
    ].map(properties => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: [] } })),
};
const airports = {
    type: 'FeatureCollection',
    features: [
        makeAirport('SEA', { visitCount: 100 }),
        makeAirport('BFI', { visitCount: 100 }),
        makeAirport('LAX', { region: 'US-CA', visitCount: 100 }),
        makeAirport('YYZ', { country: 'CA', region: 'CA-ON', visitCount: 100 }),
    ].map(properties => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [0, 0] } })),
};

vi.mock('../features/flights/hooks/useGeoJsonData', () => ({
    useGeoJsonData: (file: string) => ({ data: file === 'flights.geojson' ? flights : airports, loading: false, error: null }),
}));

describe('selected geography airport lists', () => {
    it.each<[FlightFilters, [string, number][]]>([
        [{ selectedCountry: 'US', selectedAirline: 'Test' }, [['SEA', 2], ['LAX', 1]]],
        [{ selectedRegion: 'US-WA', selectedAirline: 'Test' }, [['SEA', 2]]],
        [{ selectedCountry: 'US', selectedAirline: 'Test', selectedYear: 2024 }, [['SEA', 1], ['LAX', 1]]],
        [{ selectedRegion: 'US-WA', selectedAirline: 'Test', selectedYear: 2024 }, [['SEA', 1]]],
        [{ selectedCountry: 'US', selectedFlightType: 'international' }, [['SEA', 1]]],
        [{ selectedRegion: 'US-WA', selectedFlightType: 'domestic' }, [['SEA', 3], ['BFI', 1]]],
        [{ selectedCountry: 'US' }, [['SEA', 4], ['LAX', 2], ['BFI', 1]]],
    ])('counts only endpoints of matching legs for %j', (filters, expected) => {
        const { result } = renderHook(() => {
            const globe = useGlobeData(filters);
            return useSelectionInfo({
                selectedRoute: null,
                selectedCountry: filters.selectedCountry ?? null,
                selectedRegion: filters.selectedRegion ?? null,
                selectedFlightType: filters.selectedFlightType,
                ...globe,
            });
        });
        const selection = result.current.selectedCountryInfo ?? result.current.selectedRegionInfo;
        expect(selection?.airports.map(airport => [airport.code, airport.visitCount])).toEqual(expected);
    });

    it('keeps an empty selection usable without showing airports or lifetime visits', () => {
        const { result, rerender } = renderHook(({ selectedAirline }) => {
            const globe = useGlobeData({ selectedCountry: 'US', selectedAirline });
            return useSelectionInfo({ selectedRoute: null, selectedCountry: 'US', selectedRegion: null, ...globe });
        }, { initialProps: { selectedAirline: 'Test' } });
        expect(result.current.selectedCountryInfo?.airports).toHaveLength(2);
        rerender({ selectedAirline: 'Missing' });
        expect(result.current.selectedCountryInfo).toMatchObject({ totalFlights: 0, airports: [], duration: { flightCount: 0 } });
        rerender({ selectedAirline: 'Other' });
        expect(result.current.selectedCountryInfo?.airports.map(airport => [airport.code, airport.visitCount]))
            .toEqual([['SEA', 2], ['LAX', 1], ['BFI', 1]]);
    });
});
