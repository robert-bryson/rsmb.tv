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
  selectedAirport?: string | null;
  selectedAirline?: string | null;
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
  const { selectedYear = null, colorMode = 'default', selectedAirport = null, selectedAirline = null } = options;
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

  // Compute overall statistics - NOW FILTERED BY SELECTED YEAR, SELECTED AIRPORT, AND SELECTED AIRLINE
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
        selectedAirportInfo: null,
        airlineCounts: [],
        topCountries: [],
        topRegions: [],
        highestAirport: null,
        lowestAirport: null,
      };
    }

    // Compute airline counts from all flights (for the clickable buttons, before other filters)
    const allAirlineCounts: Record<string, number> = {};
    flights.features.forEach(f => {
      const airline = f.properties.airline;
      if (airline) {
        allAirlineCounts[airline] = (allAirlineCounts[airline] || 0) + 1;
      }
    });
    const airlineCounts = Object.entries(allAirlineCounts)
      .map(([airline, count]) => ({ airline, count }))
      .sort((a, b) => b.count - a.count);

    // Filter flights by selected year first
    let filteredFlights = selectedYear === null 
      ? flights.features 
      : flights.features.filter(f => parseYear(f.properties.date) === selectedYear);
    
    // Further filter by selected airport if one is selected
    const airportFilteredFlights = selectedAirport
      ? filteredFlights.filter(f => 
          f.properties.origin_code === selectedAirport || 
          f.properties.destination_code === selectedAirport
        )
      : filteredFlights;
    
    // Further filter by selected airline if one is selected
    const airlineFilteredFlights = selectedAirline
      ? airportFilteredFlights.filter(f => f.properties.airline === selectedAirline)
      : airportFilteredFlights;
    
    // Use fully-filtered flights for stats
    filteredFlights = airlineFilteredFlights;

    const years = new Set<number>();
    const countries = new Set<string>();
    const airlines = new Set<string>();
    const uniqueRouteKeys = new Set<string>();
    const continentCounts: Record<string, number> = {};
    const countryVisitCounts: Record<string, number> = {};
    const countryDepartureCounts: Record<string, number> = {};
    const countryArrivalCounts: Record<string, number> = {};
    const countryNames: Record<string, string> = {};
    const regionVisitCounts: Record<string, number> = {};
    const regionNames: Record<string, string> = {};
    const regionCountries: Record<string, string> = {};
    const airportVisitCounts: Record<string, number> = {};
    const airportDepartureCounts: Record<string, number> = {};
    const airportArrivalCounts: Record<string, number> = {};
    
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
      
      // Count country visits (with names for display)
      countryVisitCounts[props.origin_country] = (countryVisitCounts[props.origin_country] || 0) + 1;
      countryVisitCounts[props.destination_country] = (countryVisitCounts[props.destination_country] || 0) + 1;
      countryDepartureCounts[props.origin_country] = (countryDepartureCounts[props.origin_country] || 0) + 1;
      countryArrivalCounts[props.destination_country] = (countryArrivalCounts[props.destination_country] || 0) + 1;
      // Store country names for lookup
      countryNames[props.origin_country] = props.origin_countryName;
      countryNames[props.destination_country] = props.destination_countryName;
      
      // Count region visits (with names for display)
      regionVisitCounts[props.origin_region] = (regionVisitCounts[props.origin_region] || 0) + 1;
      regionVisitCounts[props.destination_region] = (regionVisitCounts[props.destination_region] || 0) + 1;
      // Store region names and countries for lookup
      regionNames[props.origin_region] = props.origin_regionName;
      regionNames[props.destination_region] = props.destination_regionName;
      regionCountries[props.origin_region] = props.origin_countryName;
      regionCountries[props.destination_region] = props.destination_countryName;
      
      // Count airport visits for filtered data
      airportVisitCounts[props.origin_code] = (airportVisitCounts[props.origin_code] || 0) + 1;
      airportVisitCounts[props.destination_code] = (airportVisitCounts[props.destination_code] || 0) + 1;
      airportDepartureCounts[props.origin_code] = (airportDepartureCounts[props.origin_code] || 0) + 1;
      airportArrivalCounts[props.destination_code] = (airportArrivalCounts[props.destination_code] || 0) + 1;
      
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
    let busiestAirport: { code: string; count: number; departures: number; arrivals: number } | null = null;
    Object.entries(airportVisitCounts).forEach(([code, count]) => {
      if (!busiestAirport || count > busiestAirport.count) {
        busiestAirport = { 
          code, 
          count,
          departures: airportDepartureCounts[code] || 0,
          arrivals: airportArrivalCounts[code] || 0,
        };
      }
    });

    // Find most visited country
    let mostVisitedCountry: { country: string; count: number; departures: number; arrivals: number } | null = null;
    Object.entries(countryVisitCounts).forEach(([country, count]) => {
      if (!mostVisitedCountry || count > mostVisitedCountry.count) {
        mostVisitedCountry = { 
          country, 
          count,
          departures: countryDepartureCounts[country] || 0,
          arrivals: countryArrivalCounts[country] || 0,
        };
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

    // Calculate selected airport info if an airport is selected
    let selectedAirportInfo: FlightStats['selectedAirportInfo'] = null;
    if (selectedAirport) {
      const airportFeature = airports.features.find(a => a.properties.code === selectedAirport);
      if (airportFeature) {
        const ap = airportFeature.properties;
        
        // Count arrivals and departures to/from this airport in the filtered flights
        const arrivals = filteredFlights.filter(f => f.properties.destination_code === selectedAirport);
        const departures = filteredFlights.filter(f => f.properties.origin_code === selectedAirport);
        
        // Find first and last visits
        const sortedByDate = [...filteredFlights].sort((a, b) => 
          parseDateForSort(a.properties.date).getTime() - parseDateForSort(b.properties.date).getTime()
        );
        const firstVisitFlight = sortedByDate[0];
        const lastVisitFlight = sortedByDate[sortedByDate.length - 1];
        
        // Get first visit info (was it arrival or departure?)
        let firstVisit: { date: string; from: string } | null = null;
        if (firstVisitFlight) {
          const isArrival = firstVisitFlight.properties.destination_code === selectedAirport;
          firstVisit = {
            date: firstVisitFlight.properties.date,
            from: isArrival 
              ? `from ${firstVisitFlight.properties.origin_code}` 
              : `to ${firstVisitFlight.properties.destination_code}`,
          };
        }
        
        // Get last visit info
        let lastVisit: { date: string; to: string } | null = null;
        if (lastVisitFlight) {
          const isArrival = lastVisitFlight.properties.destination_code === selectedAirport;
          lastVisit = {
            date: lastVisitFlight.properties.date,
            to: isArrival 
              ? `from ${lastVisitFlight.properties.origin_code}` 
              : `to ${lastVisitFlight.properties.destination_code}`,
          };
        }
        
        // Count connected airports and countries
        const connectedSet = new Set<string>();
        const connectedCountriesSet = new Set<string>();
        const destinationCounts: Record<string, number> = {};
        const originCounts: Record<string, number> = {};
        const airlinesSet = new Set<string>();
        
        filteredFlights.forEach(f => {
          const props = f.properties;
          airlinesSet.add(props.airline);
          
          if (props.origin_code === selectedAirport) {
            connectedSet.add(props.destination_code);
            connectedCountriesSet.add(props.destination_country);
            destinationCounts[props.destination_code] = (destinationCounts[props.destination_code] || 0) + 1;
          }
          if (props.destination_code === selectedAirport) {
            connectedSet.add(props.origin_code);
            connectedCountriesSet.add(props.origin_country);
            originCounts[props.origin_code] = (originCounts[props.origin_code] || 0) + 1;
          }
        });
        
        // Top destinations and origins
        const topDestinations = Object.entries(destinationCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([code, count]) => ({ code, count }));
        
        const topOrigins = Object.entries(originCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([code, count]) => ({ code, count }));
        
        selectedAirportInfo = {
          code: ap.code,
          name: ap.name,
          municipality: ap.municipality,
          region: ap.region,
          regionName: ap.regionName,
          country: ap.country,
          countryName: ap.countryName,
          continent: ap.continent,
          continentName: ap.continentName,
          elevationFt: ap.elevationFt,
          elevationM: ap.elevationM,
          totalVisits: filteredFlights.length,
          arrivals: arrivals.length,
          departures: departures.length,
          firstVisit,
          lastVisit,
          connectedAirports: connectedSet.size,
          connectedCountries: Array.from(connectedCountriesSet),
          topDestinations,
          topOrigins,
          airlines: Array.from(airlinesSet).filter(a => a), // Filter out empty airline names
        };
      }
    }

    // Calculate top countries
    const topCountries = Object.entries(countryVisitCounts)
      .map(([code, count]) => ({
        code,
        name: countryNames[code] || code,
        count,
        departures: countryDepartureCounts[code] || 0,
        arrivals: countryArrivalCounts[code] || 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate top regions
    const topRegions = Object.entries(regionVisitCounts)
      .map(([code, count]) => ({
        code,
        name: regionNames[code] || code,
        country: regionCountries[code] || '',
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Find highest and lowest airports from visited airports
    let highestAirport: { code: string; name: string; elevationFt: number; elevationM: number } | null = null;
    let lowestAirport: { code: string; name: string; elevationFt: number; elevationM: number } | null = null;
    
    // Get airports that were visited in filtered flights
    airports.features.forEach(ap => {
      const props = ap.properties;
      if (!filteredAirportCodes.has(props.code)) return;
      
      if (!highestAirport || props.elevationFt > highestAirport.elevationFt) {
        highestAirport = {
          code: props.code,
          name: props.name,
          elevationFt: props.elevationFt,
          elevationM: props.elevationM,
        };
      }
      if (!lowestAirport || props.elevationFt < lowestAirport.elevationFt) {
        lowestAirport = {
          code: props.code,
          name: props.name,
          elevationFt: props.elevationFt,
          elevationM: props.elevationM,
        };
      }
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
      selectedAirportInfo,
      airlineCounts,
      topCountries,
      topRegions,
      highestAirport,
      lowestAirport,
    };
  }, [flights, airports, selectedYear, selectedAirport, selectedAirline]);

  // Max route count for frequency coloring
  const maxRouteCount = useMemo(() => {
    if (routeStats.size === 0) return 1;
    return Math.max(...Array.from(routeStats.values()).map(r => r.count));
  }, [routeStats]);

  const arcsData = useMemo<GlobeArc[]>(() => {
    if (!flights) return [];
    
    // First, group flights by route to calculate index within each route
    const flightsByRoute = new Map<string, typeof flights.features>();
    flights.features.forEach((f) => {
      const routeKey = getRouteKey(f.properties.origin_code, f.properties.destination_code);
      if (!flightsByRoute.has(routeKey)) {
        flightsByRoute.set(routeKey, []);
      }
      flightsByRoute.get(routeKey)!.push(f);
    });
    
    // Track which index we're at for each route as we process flights
    const routeIndexTracker = new Map<string, number>();
    
    return flights.features
      .map((f) => {
        const props = f.properties;
        const year = parseYear(props.date);
        const routeKey = getRouteKey(props.origin_code, props.destination_code);
        const routeCount = routeStats.get(routeKey)?.count || 1;
        
        // Calculate the index of this flight within its route for staggered animation
        const currentIndex = routeIndexTracker.get(routeKey) || 0;
        routeIndexTracker.set(routeKey, currentIndex + 1);
        // Initial gap spreads dots evenly along the route: 0/N, 1/N, 2/N, etc.
        const dashInitialGap = routeCount > 1 ? currentIndex / routeCount : 0;
        
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
          default: {
            // Gradient from purple to white, with opacity based on frequency
            const baseOpacity = 0.5 + Math.min(routeCount / maxRouteCount, 1) * 0.4;
            color = [`rgba(180, 150, 255, ${baseOpacity})`, `rgba(255, 255, 255, ${baseOpacity})`];
          }
        }
        
        // Stroke width using square root scaling for better visual hierarchy
        // Routes flown once: thin (0.3), busiest routes: thicker (up to 1.5)
        const normalizedCount = routeCount / maxRouteCount;
        const sqrtScale = Math.sqrt(normalizedCount);
        const minStroke = 0.3;
        const maxStroke = 1.5;
        const stroke = minStroke + sqrtScale * (maxStroke - minStroke);
        
        // Calculate distance for animation speed (constant speed across all routes)
        const distance = calculateDistance(
          props.origin_lat, props.origin_lon,
          props.destination_lat, props.destination_lon
        );
        // Base speed: ~1000km takes 3 seconds, so animation time scales with distance
        const animateTime = Math.max(2000, (distance / 1000) * 3000);
        
        // Check if this arc connects to the selected airport
        const isConnected = selectedAirport && (
          props.origin_code === selectedAirport || props.destination_code === selectedAirport
        );
        
        // Modify color based on selection
        let finalColor = color;
        let finalStroke = stroke;
        if (selectedAirport) {
          if (isConnected) {
            finalColor = ['rgba(0, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.9)'];
            finalStroke = stroke * 1.5;
          } else {
            // Dim non-connected arcs but keep them visible
            finalColor = typeof color === 'string' 
              ? color.replace(/[\d.]+\)$/, '0.15)')
              : [`rgba(180, 150, 255, 0.15)`, `rgba(255, 255, 255, 0.15)`];
            finalStroke = stroke * 0.7;
          }
        }
        
        return {
          startLat: props.origin_lat,
          startLng: props.origin_lon,
          endLat: props.destination_lat,
          endLng: props.destination_lon,
          color: finalColor,
          stroke: finalStroke,
          animateTime,
          dashLength: 0.01,
          dashGap: 0.99,
          dashInitialGap,
          label: `${props.origin_code} → ${props.destination_code}`,
          flight: props,
          year,
          routeKey,
          routeCount,
        };
      })
      .filter((arc) => {
        // Filter by year
        if (selectedYear !== null && arc.year !== selectedYear) return false;
        // Filter by airline
        if (selectedAirline !== null && arc.flight.airline !== selectedAirline) return false;
        return true;
      });
  }, [flights, selectedYear, colorMode, routeStats, maxRouteCount, selectedAirport, selectedAirline]);

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
    
    // Find max visit count for scaling
    const maxVisits = Math.max(...airports.features.map(a => a.properties.visitCount), 1);
    
    // Get set of connected airport codes when an airport is selected
    const connectedAirports = new Set<string>();
    if (selectedAirport) {
      connectedAirports.add(selectedAirport);
      arcsData.forEach((arc) => {
        if (arc.flight.origin_code === selectedAirport) {
          connectedAirports.add(arc.flight.destination_code);
        } else if (arc.flight.destination_code === selectedAirport) {
          connectedAirports.add(arc.flight.origin_code);
        }
      });
    }
    
    return airports.features
      .filter((a) => selectedYear === null || filteredAirportCodes.has(a.properties.code))
      .map((a) => {
        const props = a.properties;
        const [lng, lat] = a.geometry.coordinates;
        
        // Use square root scaling for proportional symbols (standard cartographic practice)
        // This prevents high-traffic airports from dominating while keeping small ones visible
        const normalizedVisits = props.visitCount / maxVisits;
        const sqrtScale = Math.sqrt(normalizedVisits);
        
        // Size range: 0.15 (min) to 0.6 (max) - ensures visibility at all levels
        const minSize = 0.15;
        const maxSize = 0.6;
        let size = minSize + sqrtScale * (maxSize - minSize);
        
        // Color intensity based on visits - busier airports are brighter/more saturated
        // Using purple-to-gold gradient matching the app's aesthetic
        const hue = 45 - sqrtScale * 15; // Gold (45) to warm yellow (30) for busiest
        const saturation = 70 + sqrtScale * 30; // 70% to 100% saturation
        const lightness = 50 + sqrtScale * 15; // 50% to 65% lightness
        let color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        // Highlight selected airport and connected airports
        if (selectedAirport) {
          if (props.code === selectedAirport) {
            // Selected airport: bright cyan, larger
            color = 'hsl(180, 100%, 60%)';
            size = Math.max(size * 1.5, 0.5);
          } else if (connectedAirports.has(props.code)) {
            // Connected airports: cyan tint
            color = 'hsl(180, 80%, 55%)';
            size = size * 1.2;
          } else {
            // Dim non-connected airports
            color = `hsl(${hue}, ${saturation * 0.3}%, ${lightness * 0.5}%)`;
            size = size * 0.7;
          }
        }
        
        return {
          lat,
          lng,
          size,
          color,
          label: props.code,
          airport: props,
        };
      });
  }, [airports, selectedYear, filteredAirportCodes, selectedAirport, arcsData]);

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

  // Create static arcs for background route lines (one per unique route) with tooltip info
  // Using arcs instead of paths so they follow the same elevated curve as animated dots
  const staticArcsData = useMemo(() => {
    if (!flights) return [];
    
    // Group by route to collect all flights on that route
    const routeArcs = new Map<string, { 
      startLat: number;
      startLng: number;
      endLat: number;
      endLng: number;
      stroke: number; 
      routeCount: number;
      flights: typeof arcsData[0]['flight'][];
    }>();
    
    arcsData.forEach((arc) => {
      if (!routeArcs.has(arc.routeKey)) {
        routeArcs.set(arc.routeKey, {
          startLat: arc.startLat,
          startLng: arc.startLng,
          endLat: arc.endLat,
          endLng: arc.endLng,
          stroke: arc.stroke * 0.8, // Slightly thinner than animated arcs
          routeCount: arc.routeCount,
          flights: [],
        });
      }
      routeArcs.get(arc.routeKey)!.flights.push(arc.flight);
    });
    
    return Array.from(routeArcs.entries()).map(([routeKey, route]) => {
      // Check if this route connects to the selected airport
      const isConnected = selectedAirport && route.flights.some(
        f => f.origin_code === selectedAirport || f.destination_code === selectedAirport
      );
      
      // Calculate stroke: boost for connected routes, or keep base stroke
      // When no airport selected, use a minimum stroke of 0.8 for better hover hit area
      let stroke = route.stroke;
      if (selectedAirport) {
        stroke = isConnected ? route.stroke * 1.5 : route.stroke;
      } else {
        // Ensure minimum stroke width for hover detectability
        stroke = Math.max(0.8, route.stroke);
      }
      
      return {
        startLat: route.startLat,
        startLng: route.startLng,
        endLat: route.endLat,
        endLng: route.endLng,
        // Highlight connected routes in bright cyan, dim unconnected when airport selected
        color: selectedAirport 
          ? (isConnected ? 'rgba(0, 255, 255, 0.7)' : 'rgba(140, 120, 200, 0.15)')
          : 'rgba(140, 120, 200, 0.6)',
        stroke,
        routeKey,
        routeCount: route.routeCount,
        flights: route.flights,
        isConnected: !!isConnected,
      };
    });
  }, [flights, arcsData, selectedAirport]);

  return {
    arcsData,
    staticArcsData,
    pointsData,
    labelsData,
    flightStats,
    routeStats,
    loading: airportsLoading || flightsLoading,
    error: airportsError || flightsError,
  };
}
