import { describe, expect, it } from 'vitest';
import type {
    AllAirportProperties,
    AirportProperties,
    FlightProperties,
    GlobeAllAirportPoint,
    GlobePoint,
    GlobeStatePolygon,
    GlobeStaticArc,
} from '../features/flights/types';
import { buildArcLabelHtml, buildPointLabelHtml, buildStatePolygonLabelHtml } from '../features/flights/utils/tooltipHtml';

const flight: FlightProperties = {
    id: 1,
    date: '2024-01-02',
    airline: 'Air & <Script>',
    origin_code: 'S<E',
    origin_name: 'Seattle <Tacoma>',
    origin_municipality: 'SeaTac',
    origin_region: 'US-WA',
    origin_regionName: 'Washington',
    origin_country: 'US',
    origin_countryName: 'United States',
    origin_continent: 'NA',
    origin_continentName: 'North America',
    origin_lon: -122.3088,
    origin_lat: 47.4502,
    destination_code: 'LAX',
    destination_name: 'Los Angeles "International"',
    destination_municipality: 'Los Angeles',
    destination_region: 'US-CA',
    destination_regionName: 'California',
    destination_country: 'US',
    destination_countryName: 'United States',
    destination_continent: 'NA',
    destination_continentName: 'North America',
    destination_lon: -118.4085,
    destination_lat: 33.9416,
};

const visitedAirport: AirportProperties = {
    code: 'S<E',
    name: 'Seattle <Tacoma>',
    municipality: 'SeaTac & Tukwila',
    region: 'US-WA',
    regionName: 'Washington',
    country: 'US',
    countryName: 'United "States"',
    continent: 'NA',
    continentName: 'North America',
    elevationFt: 433,
    elevationM: 132,
    visitCount: 3,
    arrivalCount: 1,
    departureCount: 2,
    visitDates: ['2024-01-02'],
};

const unvisitedAirport: AllAirportProperties = {
    code: 'B&D',
    name: 'Bad <Name>',
    municipality: 'Nowhere <Else>',
    region: 'US-CA',
    regionName: 'California',
    country: 'US',
    countryName: 'United & States',
    continent: 'NA',
    continentName: 'North <America>',
    elevationFt: 128,
    elevationM: 39,
    visited: false,
};

describe('tooltipHtml', () => {
    it('returns no arc label for animated arcs', () => {
        const arc: GlobeStaticArc & { isStatic?: boolean } = {
            startLat: 47.4502,
            startLng: -122.3088,
            endLat: 33.9416,
            endLng: -118.4085,
            color: 'purple',
            stroke: 1,
            routeKey: 'LAX-SEA',
            routeCount: 1,
            flights: [flight],
            isConnected: false,
            isStatic: false,
        };

        expect(buildArcLabelHtml(arc, null)).toBe('');
    });

    it('escapes route labels and selected-route details', () => {
        const arc: GlobeStaticArc & { isStatic?: boolean } = {
            startLat: 47.4502,
            startLng: -122.3088,
            endLat: 33.9416,
            endLng: -118.4085,
            color: 'purple',
            stroke: 1,
            routeKey: 'LAX-SEA',
            routeCount: 1,
            flights: [flight],
            isConnected: false,
            isStatic: true,
        };

        const html = buildArcLabelHtml(arc, 'LAX-SEA');

        expect(html).toContain('S&lt;E');
        expect(html).toContain('Seattle &lt;Tacoma&gt;');
        expect(html).toContain('Los Angeles &quot;International&quot;');
        expect(html).toContain('Air &amp; &lt;Script&gt;');
        expect(html).not.toContain('<Script>');
    });

    it('escapes visited and unvisited airport labels', () => {
        const visitedPoint: GlobePoint = {
            lat: 47.4502,
            lng: -122.3088,
            size: 0.5,
            color: 'gold',
            label: 'S<E',
            airport: visitedAirport,
        };
        const unvisitedPoint: GlobeAllAirportPoint & { isAllAirports: true } = {
            lat: 33.9416,
            lng: -118.4085,
            size: 0.2,
            color: 'gray',
            label: 'B&D',
            airport: unvisitedAirport,
            isAllAirports: true,
        };

        expect(buildPointLabelHtml(visitedPoint, true)).toContain('United &quot;States&quot;');

        const unvisitedHtml = buildPointLabelHtml(unvisitedPoint, false);
        expect(unvisitedHtml).toContain('B&amp;D');
        expect(unvisitedHtml).toContain('Bad &lt;Name&gt;');
        expect(unvisitedHtml).toContain('North &lt;America&gt;');
    });

    it('escapes state polygon labels', () => {
        const polygon: GlobeStatePolygon = {
            geometry: { type: 'Polygon', coordinates: [] },
            properties: { code: 'US-WA', name: 'Washington', abbr: 'WA' },
            stats: {
                code: 'US-WA',
                name: 'Wash <script>',
                abbr: 'W&A',
                visited: true,
                airportCount: 1,
                totalAirports: 2,
                flightCount: 3,
                firstVisitDate: '2024-01-02 <bad>',
                lastVisitDate: '2024-01-02',
                airlines: ['Airline'],
            },
            color: 'blue',
        };

        const html = buildStatePolygonLabelHtml(polygon);

        expect(html).toContain('Wash &lt;script&gt;');
        expect(html).toContain('W&amp;A');
        expect(html).toContain('2024-01-02 &lt;bad&gt;');
        expect(html).not.toContain('Wash <script>');
    });
});