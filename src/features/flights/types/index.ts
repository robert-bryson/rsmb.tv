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
