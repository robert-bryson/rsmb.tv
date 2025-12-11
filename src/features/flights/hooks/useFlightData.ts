import { useEffect, useState, useMemo } from 'react';
import type {
  AirportsCollection,
  FlightsCollection,
  GlobeArc,
  GlobePoint,
  GlobeLabel,
  RouteStats,
  FlightStats,
  ColorMode,
} from '../types';

interface UseFlightDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

// Parse date string like "6/15/2008" to year
function parseYear(dateStr: string): number {
  const parts = dateStr.split('/');
  return parseInt(parts[2], 10);
}

// Create route key (alphabetically sorted for consistency)
function getRouteKey(origin: string, destination: string): string {
  return [origin, destination].sort().join('-');
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Color scales for different modes
const YEAR_COLORS: Record<number, string> = {
  2008: '#3b82f6', 2009: '#6366f1', 2010: '#8b5cf6', 2011: '#a855f7',
  2012: '#c026d3', 2013: '#d946ef', 2014: '#e879f9', 2015: '#f472b6',
  2016: '#fb7185', 2017: '#f43f5e', 2018: '#ef4444', 2019: '#f97316',
  2020: '#fb923c', 2021: '#fbbf24', 2022: '#facc15', 2023: '#a3e635',
  2024: '#4ade80', 2025: '#22d3ee',
};

function getYearColor(year: number): string {
  return YEAR_COLORS[year] || '#a855f7';
}

function getFrequencyColor(count: number, maxCount: number): string {
  const ratio = count / maxCount;
  if (ratio > 0.7) return '#ef4444'; // red - very frequent
  if (ratio > 0.4) return '#f97316'; // orange - frequent
  if (ratio > 0.2) return '#facc15'; // yellow - moderate
  return '#a855f7'; // purple - occasional
}

export function useAirports(): UseFlightDataResult<AirportsCollection> {
  const [data, setData] = useState<AirportsCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/flights/visitedAirports.geojson`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading visitedAirports.geojson', err);
        setError(err);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}

export function useFlights(): UseFlightDataResult<FlightsCollection> {
  const [data, setData] = useState<FlightsCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/flights/flights.geojson`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading flights.geojson', err);
        setError(err);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}

interface UseGlobeDataOptions {
  selectedYear?: number | null;
  colorMode?: ColorMode;
}

// Estimate flight time based on distance (rough average speed of 800 km/h + 1 hour for takeoff/landing)
function estimateFlightTime(distanceKm: number): number {
  return distanceKm / 800 + 1;
}

// Parse date string to comparable format for sorting
function parseDateForSort(dateStr: string): Date {
  const parts = dateStr.split('/');
  return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
}

// Transform GeoJSON data to react-globe.gl format with filtering and stats
export function useGlobeData(options: UseGlobeDataOptions = {}) {
  const { selectedYear = null, colorMode = 'default' } = options;
  const { data: airports, loading: airportsLoading, error: airportsError } = useAirports();
  const { data: flights, loading: flightsLoading, error: flightsError } = useFlights();

  // Compute route statistics (for all flights, used for coloring)
  const routeStats = useMemo<Map<string, RouteStats>>(() => {
    if (!flights) return new Map();
    
    const stats = new Map<string, RouteStats>();
    
    flights.features.forEach((f) => {
      const props = f.properties;
      const routeKey = getRouteKey(props.origin_code, props.destination_code);
      const year = parseYear(props.date);
      
      if (!stats.has(routeKey)) {
        stats.set(routeKey, {
          routeKey,
          origin: props.origin_code,
          destination: props.destination_code,
          count: 0,
          years: [],
          dates: [],
        });
      }
      
      const route = stats.get(routeKey)!;
      route.count++;
      if (!route.years.includes(year)) {
        route.years.push(year);
      }
      route.dates.push(props.date);
    });
    
    return stats;
  }, [flights]);

  // Compute overall statistics - NOW FILTERED BY SELECTED YEAR
  const flightStats = useMemo<FlightStats>(() => {
    if (!flights || !airports) {
      return {
        totalFlights: 0,
        totalAirports: 0,
        totalCountries: 0,
        totalAirlines: 0,
        totalDistance: 0,
        years: [],
        busiestRoutes: [],
        busiestAirport: null,
        longestFlight: null,
        shortestFlight: null,
        internationalFlights: 0,
        intercontinentalFlights: 0,
        continentCounts: {},
        averageDistance: 0,
        totalFlightTime: 0,
        uniqueRoutes: 0,
        mostVisitedCountry: null,
        firstFlight: null,
        lastFlight: null,
      };
    }

    // Filter flights by selected year
    const filteredFlights = selectedYear === null 
      ? flights.features 
      : flights.features.filter(f => parseYear(f.properties.date) === selectedYear);

    const years = new Set<number>();
    const countries = new Set<string>();
    const airlines = new Set<string>();
    const uniqueRouteKeys = new Set<string>();
    const continentCounts: Record<string, number> = {};
    const countryVisitCounts: Record<string, number> = {};
    const airportVisitCounts: Record<string, number> = {};
    
    let totalDistance = 0;
    let totalFlightTime = 0;
    let internationalFlights = 0;
    let intercontinentalFlights = 0;
    let longestFlight: { route: string; distance: number } | null = null;
    let shortestFlight: { route: string; distance: number } | null = null;
    let firstFlight: { route: string; date: string; dateObj: Date } | null = null;
    let lastFlight: { route: string; date: string; dateObj: Date } | null = null;

    filteredFlights.forEach((f) => {
      const props = f.properties;
      const year = parseYear(props.date);
      years.add(year);
      countries.add(props.origin_country);
      countries.add(props.destination_country);
      airlines.add(props.airline);
      uniqueRouteKeys.add(getRouteKey(props.origin_code, props.destination_code));
      
      // Count continent visits
      continentCounts[props.origin_continent] = (continentCounts[props.origin_continent] || 0) + 1;
      continentCounts[props.destination_continent] = (continentCounts[props.destination_continent] || 0) + 1;
      
      // Count country visits
      countryVisitCounts[props.origin_country] = (countryVisitCounts[props.origin_country] || 0) + 1;
      countryVisitCounts[props.destination_country] = (countryVisitCounts[props.destination_country] || 0) + 1;
      
      // Count airport visits for filtered data
      airportVisitCounts[props.origin_code] = (airportVisitCounts[props.origin_code] || 0) + 1;
      airportVisitCounts[props.destination_code] = (airportVisitCounts[props.destination_code] || 0) + 1;
      
      // International flight check
      if (props.origin_country !== props.destination_country) {
        internationalFlights++;
      }
      
      // Intercontinental flight check
      if (props.origin_continent !== props.destination_continent) {
        intercontinentalFlights++;
      }
      
      const distance = calculateDistance(
        props.origin_lat, props.origin_lon,
        props.destination_lat, props.destination_lon
      );
      totalDistance += distance;
      totalFlightTime += estimateFlightTime(distance);
      
      // Track longest flight
      if (!longestFlight || distance > longestFlight.distance) {
        longestFlight = {
          route: `${props.origin_code} → ${props.destination_code}`,
          distance,
        };
      }
      
      // Track shortest flight (minimum 50km to exclude data errors)
      if (distance > 50 && (!shortestFlight || distance < shortestFlight.distance)) {
        shortestFlight = {
          route: `${props.origin_code} → ${props.destination_code}`,
          distance,
        };
      }
      
      // Track first and last flights
      const dateObj = parseDateForSort(props.date);
      if (!firstFlight || dateObj < firstFlight.dateObj) {
        firstFlight = {
          route: `${props.origin_code} → ${props.destination_code}`,
          date: props.date,
          dateObj,
        };
      }
      if (!lastFlight || dateObj > lastFlight.dateObj) {
        lastFlight = {
          route: `${props.origin_code} → ${props.destination_code}`,
          date: props.date,
          dateObj,
        };
      }
    });

    // Get busiest routes (filtered by year)
    const filteredRouteStats = new Map<string, RouteStats>();
    filteredFlights.forEach((f) => {
      const props = f.properties;
      const routeKey = getRouteKey(props.origin_code, props.destination_code);
      const year = parseYear(props.date);
      
      if (!filteredRouteStats.has(routeKey)) {
        filteredRouteStats.set(routeKey, {
          routeKey,
          origin: props.origin_code,
          destination: props.destination_code,
          count: 0,
          years: [],
          dates: [],
        });
      }
      
      const route = filteredRouteStats.get(routeKey)!;
      route.count++;
      if (!route.years.includes(year)) {
        route.years.push(year);
      }
      route.dates.push(props.date);
    });
    
    const busiestRoutes = Array.from(filteredRouteStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Find busiest airport from filtered flights
    let busiestAirport: { code: string; count: number } | null = null;
    Object.entries(airportVisitCounts).forEach(([code, count]) => {
      if (!busiestAirport || count > busiestAirport.count) {
        busiestAirport = { code, count };
      }
    });

    // Find most visited country
    let mostVisitedCountry: { country: string; count: number } | null = null;
    Object.entries(countryVisitCounts).forEach(([country, count]) => {
      if (!mostVisitedCountry || count > mostVisitedCountry.count) {
        mostVisitedCountry = { country, count };
      }
    });

    // Get all years for the filter (always from all flights, not filtered)
    const allYears = new Set<number>();
    flights.features.forEach(f => allYears.add(parseYear(f.properties.date)));

    // Count filtered airports
    const filteredAirportCodes = new Set<string>();
    filteredFlights.forEach(f => {
      filteredAirportCodes.add(f.properties.origin_code);
      filteredAirportCodes.add(f.properties.destination_code);
    });

    return {
      totalFlights: filteredFlights.length,
      totalAirports: filteredAirportCodes.size,
      totalCountries: countries.size,
      totalAirlines: airlines.size,
      totalDistance: Math.round(totalDistance),
      years: Array.from(allYears).sort(),
      busiestRoutes,
      busiestAirport,
      longestFlight,
      shortestFlight,
      internationalFlights,
      intercontinentalFlights,
      continentCounts,
      averageDistance: filteredFlights.length > 0 ? Math.round(totalDistance / filteredFlights.length) : 0,
      totalFlightTime: Math.round(totalFlightTime),
      uniqueRoutes: uniqueRouteKeys.size,
      mostVisitedCountry,
      firstFlight: firstFlight as { route: string; date: string } | null,
      lastFlight: lastFlight as { route: string; date: string } | null,
    };
  }, [flights, airports, selectedYear]);

  // Max route count for frequency coloring
  const maxRouteCount = useMemo(() => {
    if (routeStats.size === 0) return 1;
    return Math.max(...Array.from(routeStats.values()).map(r => r.count));
  }, [routeStats]);

  const arcsData = useMemo<GlobeArc[]>(() => {
    if (!flights) return [];
    
    return flights.features
      .map((f) => {
        const props = f.properties;
        const year = parseYear(props.date);
        const routeKey = getRouteKey(props.origin_code, props.destination_code);
        const routeCount = routeStats.get(routeKey)?.count || 1;
        
        // Determine color based on mode
        let color: string | [string, string];
        switch (colorMode) {
          case 'year':
            color = getYearColor(year);
            break;
          case 'frequency':
            color = getFrequencyColor(routeCount, maxRouteCount);
            break;
          case 'airline': {
            // Simple hash for airline color
            const hash = props.airline.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            color = `hsl(${hash % 360}, 70%, 60%)`;
            break;
          }
          default:
            color = ['rgba(180, 150, 255, 0.6)', 'rgba(255, 255, 255, 0.6)'];
        }
        
        // Stroke width based on route frequency
        const stroke = 0.3 + Math.min(routeCount * 0.15, 1.2);
        
        return {
          startLat: props.origin_lat,
          startLng: props.origin_lon,
          endLat: props.destination_lat,
          endLng: props.destination_lon,
          color,
          stroke,
          label: `${props.origin_code} → ${props.destination_code}`,
          flight: props,
          year,
          routeKey,
          routeCount,
        };
      })
      .filter((arc) => selectedYear === null || arc.year === selectedYear);
  }, [flights, selectedYear, colorMode, routeStats, maxRouteCount]);

  // Filter airports based on selected year
  const filteredAirportCodes = useMemo<Set<string>>(() => {
    if (selectedYear === null) return new Set();
    
    const codes = new Set<string>();
    arcsData.forEach((arc) => {
      codes.add(arc.flight.origin_code);
      codes.add(arc.flight.destination_code);
    });
    return codes;
  }, [arcsData, selectedYear]);

  const pointsData = useMemo<GlobePoint[]>(() => {
    if (!airports) return [];
    
    return airports.features
      .filter((a) => selectedYear === null || filteredAirportCodes.has(a.properties.code))
      .map((a) => {
        const props = a.properties;
        const [lng, lat] = a.geometry.coordinates;
        return {
          lat,
          lng,
          size: Math.min(0.4, 0.15 + props.visitCount * 0.05),
          color: '#ffd700',
          label: props.code,
          airport: props,
        };
      });
  }, [airports, selectedYear, filteredAirportCodes]);

  const labelsData = useMemo<GlobeLabel[]>(() => {
    if (!airports) return [];
    
    return airports.features
      .filter((a) => selectedYear === null || filteredAirportCodes.has(a.properties.code))
      .map((a) => {
        const props = a.properties;
        const [lng, lat] = a.geometry.coordinates;
        return {
          lat,
          lng,
          text: props.code,
          color: 'rgba(255, 255, 255, 0.9)',
          size: 0.4,
        };
      });
  }, [airports, selectedYear, filteredAirportCodes]);

  return {
    arcsData,
    pointsData,
    labelsData,
    flightStats,
    routeStats,
    loading: airportsLoading || flightsLoading,
    error: airportsError || flightsError,
  };
}
