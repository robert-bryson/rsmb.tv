import type { FeatureCollection, Feature, Point, LineString } from 'geojson';

export interface AirportProperties {
  code: string;
  name: string;
  municipality: string;
  region: string;
  country: string;
  continent: string;
  visitCount: number;
  arrivalCount: number;
  departureCount: number;
  visitDates: string[];
}

export interface FlightProperties {
  id: number;
  date: string;
  airline: string;
  origin_code: string;
  origin_name: string;
  origin_municipality: string;
  origin_region: string;
  origin_country: string;
  origin_continent: string;
  origin_lon: number;
  origin_lat: number;
  destination_code: string;
  destination_name: string;
  destination_municipality: string;
  destination_region: string;
  destination_country: string;
  destination_continent: string;
  destination_lon: number;
  destination_lat: number;
}

export type AirportFeature = Feature<Point, AirportProperties>;
export type FlightFeature = Feature<LineString, FlightProperties>;
export type AirportsCollection = FeatureCollection<Point, AirportProperties>;
export type FlightsCollection = FeatureCollection<LineString, FlightProperties>;

// Route statistics for frequency analysis
export interface RouteStats {
  routeKey: string; // "LAX-JFK" sorted alphabetically
  origin: string;
  destination: string;
  count: number;
  years: number[];
  dates: string[];
}

// Overall flight statistics
export interface FlightStats {
  totalFlights: number;
  totalAirports: number;
  totalCountries: number;
  totalAirlines: number;
  totalDistance: number; // in km
  years: number[];
  busiestRoutes: RouteStats[];
  busiestAirport: { code: string; count: number } | null;
  longestFlight: { route: string; distance: number } | null;
}

// Color mode options
export type ColorMode = 'year' | 'frequency' | 'airline' | 'default';

// react-globe.gl data types
export interface GlobeArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string | [string, string];
  stroke: number;
  label: string;
  flight: FlightProperties;
  year: number;
  routeKey: string;
  routeCount: number;
}

export interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
  airport: AirportProperties;
}

export interface GlobeLabel {
  lat: number;
  lng: number;
  text: string;
  color: string;
  size: number;
}
