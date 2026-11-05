import { makeAirport, makeFlight } from '../../../src/test/helpers/flights';
import type { AllAirportsCollection, AirportsCollection, FlightProperties, FlightsCollection } from '../../../src/features/flights/types';

const endpoints = {
    SEA: { ...makeAirport('SEA', { name: 'Seattle', municipality: 'SeaTac' }), lat: 47.45, lon: -122.31 },
    LAX: { ...makeAirport('LAX', { region: 'US-CA', regionName: 'California' }), lat: 33.94, lon: -118.41 },
    PDX: { ...makeAirport('PDX', { region: 'US-OR', regionName: 'Oregon' }), lat: 45.59, lon: -122.60 },
    YVR: {
        ...makeAirport('YVR', { country: 'CA', countryName: 'Canada', region: 'CA-BC', regionName: 'British Columbia' }),
        lat: 49.19, lon: -123.18,
    },
    YYZ: {
        ...makeAirport('YYZ', { country: 'CA', countryName: 'Canada', region: 'CA-ON', regionName: 'Ontario' }),
        lat: 43.68, lon: -79.63,
    },
    LHR: {
        ...makeAirport('LHR', {
            country: 'GB', countryName: 'United Kingdom', region: 'GB-ENG', regionName: 'England',
            continent: 'EU', continentName: 'Europe',
        }),
        lat: 51.47, lon: -0.45,
    },
};

// Flight properties and airport geometry must describe the same endpoints.
function makeLeg(originCode: keyof typeof endpoints, destinationCode: keyof typeof endpoints, overrides: Partial<FlightProperties>) {
    const origin = endpoints[originCode];
    const destination = endpoints[destinationCode];
    return makeFlight({
        origin_code: origin.code, origin_name: origin.name, origin_municipality: origin.municipality,
        origin_region: origin.region, origin_regionName: origin.regionName,
        origin_country: origin.country, origin_countryName: origin.countryName,
        origin_continent: origin.continent, origin_continentName: origin.continentName,
        origin_lat: origin.lat, origin_lon: origin.lon,
        destination_code: destination.code, destination_name: destination.name, destination_municipality: destination.municipality,
        destination_region: destination.region, destination_regionName: destination.regionName,
        destination_country: destination.country, destination_countryName: destination.countryName,
        destination_continent: destination.continent, destination_continentName: destination.continentName,
        destination_lat: destination.lat, destination_lon: destination.lon,
        ...overrides,
    });
}

const legs = [
    makeLeg('SEA', 'LAX', { durationMinutes: 165 }),
    makeLeg('LAX', 'SEA', {
        id: 2, date: '1/2/2024', flightNumber: 'T102',
        durationMinutes: 180, durationKind: 'scheduled-block', durationSource: 'itinerary',
    }),
    makeLeg('SEA', 'LAX', { id: 3, date: '1/1/2025', durationMinutes: null, durationKind: null, durationSource: null }),
    // These legs distinguish geography, flight type, and airline filters.
    makeLeg('SEA', 'PDX', { id: 4, flightNumber: 'T104', durationMinutes: 168 }),
    makeLeg('YVR', 'YYZ', { id: 5, flightNumber: 'T105', durationMinutes: 174 }),
    makeLeg('YYZ', 'LHR', { id: 6, flightNumber: 'T106', durationMinutes: 177 }),
    makeLeg('SEA', 'LAX', { id: 7, airline: 'Other', flightNumber: 'O107', durationMinutes: 240 }),
];

export const flights: FlightsCollection = {
    type: 'FeatureCollection',
    features: legs.map(properties => ({
        type: 'Feature', properties,
        geometry: { type: 'LineString', coordinates: [
            [properties.origin_lon, properties.origin_lat],
            [properties.destination_lon, properties.destination_lat],
        ] },
    })),
};

export const airports: AirportsCollection = {
    type: 'FeatureCollection',
    features: Object.values(endpoints).map(({ lat, lon, ...properties }) => ({
        type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lon, lat] },
    })),
};

export const allAirports: AllAirportsCollection = {
    ...airports,
    features: airports.features.map(feature => ({
        ...feature, properties: { ...feature.properties, visited: true },
    })),
};
