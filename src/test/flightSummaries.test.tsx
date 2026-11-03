import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGlobeData } from '../features/flights/hooks/useFlightData';
import { useSelectionInfo } from '../features/flights/hooks/useSelectionInfo';
import type { AirportsCollection, FlightsCollection } from '../features/flights/types';
import type { FlightFilters } from '../features/flights/utils/flightFilters';
import { buildArcLabelHtml } from '../features/flights/utils/tooltipHtml';
import { makeAirport, makeFlight } from './helpers/flights';

const legs = [
    makeFlight(),
    makeFlight({ id: 2, origin_code: 'LAX', destination_code: 'SEA', origin_region: 'US-CA', destination_region: 'US-WA', durationMinutes: 80, durationKind: 'scheduled-block' }),
    makeFlight({ id: 3, airline: 'Other', durationMinutes: 100 }),
    makeFlight({ id: 4, date: '1/1/2025', durationMinutes: 125 }),
    makeFlight({ id: 5, destination_code: 'BFI', destination_region: 'US-WA', durationMinutes: 45 }),
    makeFlight({ id: 6, origin_code: 'LAX', origin_region: 'US-CA', destination_code: 'YYZ', destination_country: 'CA', destination_countryName: 'Canada', destination_region: 'CA-ON', durationMinutes: 240 }),
    makeFlight({ id: 7, destination_code: 'LHR', destination_country: 'GB', destination_countryName: 'United Kingdom', destination_region: 'GB-ENG', destination_continent: 'EU', durationMinutes: 540 }),
];
const flights: FlightsCollection = {
    type: 'FeatureCollection',
    features: legs.map(properties => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: [] } })),
};
const airports: AirportsCollection = {
    type: 'FeatureCollection',
    features: [
        makeAirport('SEA'), makeAirport('BFI'), makeAirport('LAX', { region: 'US-CA' }),
        makeAirport('YYZ', { country: 'CA', countryName: 'Canada', region: 'CA-ON' }),
        makeAirport('LHR', { country: 'GB', countryName: 'United Kingdom', region: 'GB-ENG', continent: 'EU' }),
    ].map(properties => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [0, 0] } })),
};

vi.mock('../features/flights/hooks/useGeoJsonData', () => ({
    useGeoJsonData: (file: string) => ({ data: file === 'flights.geojson' ? flights : airports, loading: false, error: null }),
}));

describe('flight summary membership', () => {
    it.each<[FlightFilters, number[], number]>([
        [{}, [1, 2, 3, 4, 5, 6, 7], 1195],
        [{ selectedYear: 2024, selectedAirline: 'Test' }, [1, 2, 5, 6, 7], 970],
        [{ selectedRoute: 'LAX-SEA', selectedYear: 2024, selectedAirline: 'Test' }, [1, 2], 145],
        [{ selectedAirport: 'LAX', selectedYear: 2024, selectedAirline: 'Test' }, [1, 2, 6], 385],
        [{ selectedCountry: 'CA' }, [6], 240],
        [{ selectedRegion: 'US-WA', selectedYear: 2024, selectedAirline: 'Test' }, [1, 2, 5, 7], 730],
        [{ selectedFlightType: 'international', selectedAirport: 'LAX' }, [6], 240],
        [{ selectedFlightType: 'intercontinental' }, [7], 540],
        [{ selectedFlightType: 'domestic', selectedCountry: 'CA' }, [], 0],
    ])('summarizes the exact matching legs for %j', (filters, ids, minutes) => {
        const { result } = renderHook(() => {
            const globe = useGlobeData(filters);
            const selection = useSelectionInfo({
                selectedRoute: filters.selectedRoute ?? null,
                selectedCountry: filters.selectedCountry ?? null,
                selectedRegion: filters.selectedRegion ?? null,
                selectedAirport: filters.selectedAirport,
                selectedFlightType: filters.selectedFlightType,
                staticArcsData: globe.staticArcsData,
                pointsData: globe.pointsData,
            });
            return { ...globe, ...selection };
        });
        const value = result.current;
        expect(value.matchingFlights.map(f => f.properties.id)).toEqual(ids);
        expect(value.flightStats.totalFlights).toBe(ids.length);
        const matchingMinutes = legs.filter(leg => ids.includes(leg.id)).map(leg => leg.durationMinutes!);
        expect(value.flightStats.duration).toMatchObject({
            flightCount: ids.length, totalMinutes: minutes,
            longest: ids.length ? { minutes: Math.max(...matchingMinutes) } : null,
            shortest: ids.length ? { minutes: Math.min(...matchingMinutes) } : null,
        });
        for (const summary of [value.selectedRouteInfo, value.selectedCountryInfo, value.selectedRegionInfo]) {
            if (summary) {
                expect(summary.totalFlights).toBe(ids.length);
                expect(summary.duration).toEqual(value.flightStats.duration);
            }
        }
        if (filters.selectedAirport) expect(value.flightStats.selectedAirportInfo?.duration).toEqual(value.flightStats.duration);
    });

    it('keeps tooltip counts, duration coverage, and same-date leg identities together after filtering', () => {
        const { result, rerender } = renderHook(({ selectedYear }) => {
            const globe = useGlobeData({ selectedYear, selectedAirline: 'Test' });
            const selection = useSelectionInfo({ selectedRoute: 'LAX-SEA', selectedCountry: null, selectedRegion: null, ...globe });
            return { ...globe, ...selection };
        }, { initialProps: { selectedYear: 2024 } });
        const route = result.current.staticArcsData.find(arc => arc.routeKey === 'LAX-SEA')!;
        expect(route.routeCount).toBe(2);
        expect(route.flights.map(f => f.id)).toEqual([1, 2]);
        expect(result.current.selectedRouteInfo?.flights?.map(f => [f.id, f.origin_code, f.durationMinutes])).toEqual([[1, 'SEA', 65], [2, 'LAX', 80]]);
        const tooltip = buildArcLabelHtml({ ...route, isStatic: true }, null);
        expect(tooltip).toContain('2 flights');
        expect(tooltip).toContain('1 actual · 1 scheduled · 0 estimated');
        rerender({ selectedYear: 2025 });
        expect(result.current.staticArcsData[0].routeCount).toBe(1);
        expect(result.current.selectedRouteInfo?.duration?.totalMinutes).toBe(125);
    });
});
