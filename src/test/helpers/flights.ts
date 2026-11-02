import type { AirportProperties, FlightProperties } from '../../features/flights/types';

export function makeFlight(overrides: Partial<FlightProperties> = {}): FlightProperties {
    return {
        id: 1, date: '1/1/2024', airline: 'Test', flightNumber: 'T101',
        origin_code: 'SEA', origin_name: 'Seattle', origin_municipality: 'SeaTac',
        origin_country: 'US', origin_countryName: 'United States',
        origin_region: 'US-WA', origin_regionName: 'Washington',
        origin_continent: 'NA', origin_continentName: 'North America',
        origin_lat: 47.45, origin_lon: -122.31,
        destination_code: 'LAX', destination_name: 'Los Angeles', destination_municipality: 'Los Angeles',
        destination_country: 'US', destination_countryName: 'United States',
        destination_region: 'US-CA', destination_regionName: 'California',
        destination_continent: 'NA', destination_continentName: 'North America',
        destination_lat: 33.94, destination_lon: -118.41,
        durationMinutes: 65, durationKind: 'actual-block', durationSource: 'manual',
        ...overrides,
    };
}

export function makeAirport(code: string, overrides: Partial<AirportProperties> = {}): AirportProperties {
    return {
        code, name: code, municipality: code,
        region: 'US-WA', regionName: 'Washington', country: 'US', countryName: 'United States',
        continent: 'NA', continentName: 'North America', elevationFt: 433, elevationM: 132,
        visitCount: 8, arrivalCount: 4, departureCount: 4, visitDates: ['1/1/2024'],
        ...overrides,
    };
}
