import type { FeatureCollection, Feature, Point, LineString, Polygon, MultiPolygon } from 'geojson';

// All airports (full dataset) properties
export interface AllAirportProperties {
  code: string;
  name: string;
  municipality: string;
  region: string;
  regionName: string;
  country: string;
  countryName: string;
  continent: string;
  continentName: string;
  elevationFt: number;
  elevationM: number;
  visited: boolean;
}

// Metadata for all airports collection
export interface AllAirportsMetadata {
  totalAirports: number;
  visitedCount: number;
  unvisitedCount: number;
  continents: string[];
  countries: string[];
  generatedAt: string;
}

export type AllAirportFeature = Feature<Point, AllAirportProperties>;
export type AllAirportsCollection = FeatureCollection<Point, AllAirportProperties> & {
  metadata?: AllAirportsMetadata;
};

// Symbolization modes for all airports layer
export type AirportSymbolMode = 'visited' | 'continent' | 'country' | 'elevation';

// All airports layer configuration
export interface AllAirportsLayerConfig {
  visible: boolean;
  symbolMode: AirportSymbolMode;
  showLabels: boolean;
  opacity: number;
}

// Visited airports properties (with visit statistics)
export interface AirportProperties {
  code: string;
  name: string;
  municipality: string;
  region: string;
  regionName: string;
  country: string;
  countryName: string;
  continent: string;
  continentName: string;
  elevationFt: number;
  elevationM: number;
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
  origin_regionName: string;
  origin_country: string;
  origin_countryName: string;
  origin_continent: string;
  origin_continentName: string;
  origin_lon: number;
  origin_lat: number;
  destination_code: string;
  destination_name: string;
  destination_municipality: string;
  destination_region: string;
  destination_regionName: string;
  destination_country: string;
  destination_countryName: string;
  destination_continent: string;
  destination_continentName: string;
  destination_lon: number;
  destination_lat: number;
}

// Metadata pre-computed at build time
export interface FlightsMetadata {
  totalFlights: number;
  years: number[];
  minYear: number;
  maxYear: number;
  internationalFlights: number;
  intercontinentalFlights: number;
  domesticFlights: number;
  generatedAt: string;
}

export type AirportFeature = Feature<Point, AirportProperties>;
export type FlightFeature = Feature<LineString, FlightProperties>;
export type AirportsCollection = FeatureCollection<Point, AirportProperties>;
export type FlightsCollection = FeatureCollection<LineString, FlightProperties> & {
  metadata?: FlightsMetadata;
};

// Route statistics for frequency analysis
export interface RouteStats {
  routeKey: string; // "LAX-JFK" sorted alphabetically
  origin: string;
  destination: string;
  count: number;
  years: number[];
  dates: string[];
}

// Selected airport info for filtered stats
export interface SelectedAirportInfo {
  code: string;
  name: string;
  municipality: string;
  region: string;
  regionName: string;
  country: string;
  countryName: string;
  continent: string;
  continentName: string;
  elevationFt: number;
  elevationM: number;
  totalVisits: number;
  arrivals: number;
  departures: number;
  firstVisit: { date: string; from: string; direction: 'arrival' | 'departure' } | null;
  lastVisit: { date: string; to: string; direction: 'arrival' | 'departure' } | null;
  connectedAirports: number;
  connectedCountries: string[];
  topDestinations: { code: string; count: number }[];
  topOrigins: { code: string; count: number }[];
  airlines: string[];
}

// Selected route info for stats panel
export interface SelectedRouteInfo {
  routeKey: string;
  originCode: string;
  originName: string;
  originMunicipality: string;
  originCountry: string;
  originCountryName: string;
  originRegion: string;
  originRegionName: string;
  originContinentName: string;
  destinationCode: string;
  destinationName: string;
  destinationMunicipality: string;
  destinationCountry: string;
  destinationCountryName: string;
  destinationRegion: string;
  destinationRegionName: string;
  destinationContinentName: string;
  totalFlights: number;
  airlines: string[];
  years: number[];
  dates: string[];
  distanceKm: number;
  isInternational: boolean;
  isIntercontinental: boolean;
}

// Selected country info for stats panel
export interface SelectedCountryInfo {
  code: string;
  name: string;
  continent: string;
  continentName: string;
  totalFlights: number;
  departures: number;
  arrivals: number;
  airports: { code: string; name: string; visitCount: number }[];
  airlines: string[];
  years: number[];
  topRoutes: { origin: string; destination: string; count: number }[];
  connectedCountries: { code: string; name: string; count: number }[];
}

// Selected region info for stats panel
export interface SelectedRegionInfo {
  code: string;
  name: string;
  country: string;
  countryName: string;
  totalFlights: number;
  departures: number;
  arrivals: number;
  airports: { code: string; name: string; visitCount: number }[];
  airlines: string[];
  years: number[];
  topRoutes: { origin: string; destination: string; count: number }[];
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
  busiestAirport: { code: string; count: number; departures: number; arrivals: number } | null;
  longestFlight: { route: string; distance: number } | null;
  shortestFlight: { route: string; distance: number } | null;
  internationalFlights: number;
  intercontinentalFlights: number;
  continentCounts: Record<string, number>;
  averageDistance: number;
  totalFlightTime: number; // estimated hours
  uniqueRoutes: number;
  mostVisitedCountry: { country: string; count: number; departures: number; arrivals: number } | null;
  firstFlight: { route: string; date: string } | null;
  lastFlight: { route: string; date: string } | null;
  selectedAirportInfo: SelectedAirportInfo | null;
  airlineCounts: { airline: string; count: number }[];
  topCountries: { code: string; name: string; count: number; departures: number; arrivals: number }[];
  topRegions: { code: string; name: string; country: string; count: number }[];
  highestAirport: { code: string; name: string; elevationFt: number; elevationM: number } | null;
  lowestAirport: { code: string; name: string; elevationFt: number; elevationM: number } | null;
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
  animateTime: number;
  dashLength: number;
  dashGap: number;
  dashInitialGap: number;
  label: string;
  flight: FlightProperties;
  year: number;
  routeKey: string;
  routeCount: number;
}

export interface GlobeStaticArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  stroke: number;
  routeKey: string;
  routeCount: number;
  flights: FlightProperties[];
  isConnected: boolean;
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

// Globe point for all airports layer
export interface GlobeAllAirportPoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
  airport: AllAirportProperties;
}

// ========================================
// US States Layer Types
// ========================================

// US State properties from GeoJSON
export interface USStateProperties {
  code: string; // e.g., "US-CA"
  name: string; // e.g., "California"
  abbr: string; // e.g., "CA"
}

// Computed state statistics (derived from flight data)
export interface USStateStats {
  code: string;
  name: string;
  abbr: string;
  visited: boolean;
  airportCount: number; // airports visited in this state
  totalAirports: number; // total airports in state (from allAirports)
  flightCount: number; // total flights to/from this state
  firstVisitDate: string | null;
  lastVisitDate: string | null;
  airlines: string[];
}

// US States collection from GeoJSON
export interface USStatesMetadata {
  totalStates: number;
  generatedAt: string;
}

export type USStateFeature = Feature<Polygon | MultiPolygon, USStateProperties>;
export type USStatesCollection = FeatureCollection<Polygon | MultiPolygon, USStateProperties> & {
  metadata?: USStatesMetadata;
};

// State symbolization modes
export type StateSymbolMode = 'visited' | 'visitCount' | 'flightCount';

// Basemap options
export type BasemapId = 'night' | 'blue-marble' | 'day' | 'dark' | 'positron' | 'voyager';

// Globe polygon for state layer
export interface GlobeStatePolygon {
  geometry: Polygon | MultiPolygon;
  properties: USStateProperties;
  stats: USStateStats;
  color: string;
}
