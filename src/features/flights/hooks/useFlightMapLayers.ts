import { useMemo } from 'react';
import { useAllAirports, useAllAirportsLayer } from './useAllAirports';
import { useUSStates, useUSStateStats, useUSStatesLayer } from './useUSStates';
import { flightMatchesType, getFlightTypeColor } from '../utils';
import { ALL_AIRPORTS_POINT_SIZE, LABEL_MIN_VISITS } from '../constants';
import type { useGlobeData } from './useFlightData';
import type { useFlightsFilters } from './useFlightsFilters';
import type { FlightsCollection, GlobeAllAirportPoint, GlobePoint } from '../types';

type LayerOptions = Pick<ReturnType<typeof useFlightsFilters>,
  'selectedAirport' | 'selectedCountry' | 'selectedRegion' | 'selectedFlightType' |
  'allAirportsVisible' | 'airportSymbolMode' | 'usStatesVisible' | 'stateSymbolMode' |
  'layersOpen' | 'activeLayerSection'> &
  Pick<ReturnType<typeof useGlobeData>, 'pointsData' | 'staticArcsData' | 'matchingFlights'> & {
    flightsData: FlightsCollection | null;
  };

/** Loads optional geography only when needed and builds airport and state layers. */
export function useFlightMapLayers({
  selectedAirport, selectedCountry, selectedRegion, selectedFlightType,
  allAirportsVisible, airportSymbolMode, usStatesVisible, stateSymbolMode,
  layersOpen, activeLayerSection, pointsData, staticArcsData, matchingFlights, flightsData,
}: LayerOptions) {
  const flightTypeSelection = useMemo(() => {
    if (!selectedFlightType) return null;

    const routeKeys = new Set<string>();
    const airportCodes = new Set<string>();

    staticArcsData.forEach(arc => {
      const matchingFlights = arc.flights.filter(flight => flightMatchesType(flight, selectedFlightType));
      if (matchingFlights.length === 0) return;

      routeKeys.add(arc.routeKey);
      matchingFlights.forEach(flight => {
        airportCodes.add(flight.origin_code);
        airportCodes.add(flight.destination_code);
      });
    });

    return {
      routeKeys,
      airportCodes,
      color: getFlightTypeColor(selectedFlightType),
    };
  }, [selectedFlightType, staticArcsData]);

  // Create a set of valid airport codes for clickable validation
  const validAirportCodes = useMemo(() => {
    return new Set(pointsData.map(p => p.airport.code));
  }, [pointsData]);

  // Map of airport code -> name for tooltips in StatsPanel
  const airportNames = useMemo(() => {
    const map = new Map<string, string>();
    pointsData.forEach(p => map.set(p.airport.code, p.airport.name));
    return map;
  }, [pointsData]);

  // Optional layer data: defer larger payloads until a visible layer or focused
  // country/region selection actually needs them.
  const shouldLoadAllAirports = allAirportsVisible
    || selectedCountry !== null
    || selectedRegion !== null
    || usStatesVisible
    || (layersOpen && activeLayerSection === 'airports');
  const shouldLoadUSStates = usStatesVisible || (layersOpen && activeLayerSection === 'states');

  const { data: allAirportsData, loading: allAirportsLoading } = useAllAirports({ enabled: shouldLoadAllAirports });
  const allAirportsPoints = useAllAirportsLayer(allAirportsData, {
    visible: allAirportsVisible,
    symbolMode: airportSymbolMode,
    visitedAirportCodes: validAirportCodes,
  });

  // US States layer data
  const { data: usStatesData, loading: usStatesLoading } = useUSStates({ enabled: shouldLoadUSStates });
  const stateFlightsData = useMemo(() => flightsData ? { ...flightsData, features: matchingFlights } : null, [flightsData, matchingFlights]);
  const usStateStats = useUSStateStats(usStatesData, allAirportsData, stateFlightsData);
  const usStatesPolygons = useUSStatesLayer(usStatesData, usStateStats, {
    visible: usStatesVisible,
    symbolMode: stateSymbolMode,
  });

  const matchesFocusedArea = useMemo(() => {
    if (selectedCountry) return (airport: Pick<GlobePoint['airport'], 'country' | 'region'>) => airport.country === selectedCountry;
    if (selectedRegion) return (airport: Pick<GlobePoint['airport'], 'country' | 'region'>) => airport.region === selectedRegion;
    return null;
  }, [selectedCountry, selectedRegion]);

  // Labels and point meshes share the same focused airport set.
  const focusedUnvisited = useMemo<GlobeAllAirportPoint[]>(() => {
    if (!matchesFocusedArea || !allAirportsData) return [];
    return allAirportsData.features
      .filter(feature => matchesFocusedArea(feature.properties) && !validAirportCodes.has(feature.properties.code))
      .map(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        return {
          lat, lng, size: ALL_AIRPORTS_POINT_SIZE, color: 'rgba(100, 116, 139, 0.5)',
          label: feature.properties.code, airport: feature.properties,
        };
      });
  }, [matchesFocusedArea, allAirportsData, validAirportCodes]);

  // Combined points: all airports (rendered below) + visited airports (rendered on top)
  // When an airport is selected, only label it and its connected airports
  // When a country/region is selected, only label airports in that country/region
  // Otherwise, label high-traffic airports for legibility
  const labeledAirports = useMemo<(GlobePoint | GlobeAllAirportPoint)[]>(() => {
    if (selectedAirport) {
      const connectedCodes = new Set<string>([selectedAirport]);
      staticArcsData.forEach(arc => {
        if (arc.flights.some(f => f.origin_code === selectedAirport || f.destination_code === selectedAirport)) {
          arc.flights.forEach(f => {
            connectedCodes.add(f.origin_code);
            connectedCodes.add(f.destination_code);
          });
        }
      });
      return pointsData.filter(p => connectedCodes.has(p.airport.code));
    }
    if (matchesFocusedArea) {
      return [...pointsData.filter(point => matchesFocusedArea(point.airport)), ...focusedUnvisited];
    }
    if (flightTypeSelection) {
      return pointsData.filter(p => flightTypeSelection.airportCodes.has(p.airport.code));
    }
    return pointsData.filter(p => p.airport.visitCount >= LABEL_MIN_VISITS);
  }, [pointsData, selectedAirport, staticArcsData, matchesFocusedArea, focusedUnvisited, flightTypeSelection]);

  const combinedPointsData = useMemo(() => {
    if (!allAirportsVisible && focusedUnvisited.length === 0) return pointsData;

    // Include all-airports layer points when visible
    const globalUnvisited = allAirportsVisible
      ? allAirportsPoints.filter(p => !validAirportCodes.has(p.airport.code))
      : [];

    // Merge: country/region unvisited may overlap with global unvisited, dedupe
    const addedCodes = new Set(globalUnvisited.map(p => p.airport.code));
    const extraCountryRegion = focusedUnvisited.filter(p => !addedCodes.has(p.airport.code));

    // Tag points with their type for styling
    type CombinedPoint = (GlobePoint | GlobeAllAirportPoint) & { isAllAirports?: boolean; isCountryRegionUnvisited?: boolean };
    const taggedGlobal: CombinedPoint[] = globalUnvisited.map(p => ({
      ...p,
      isAllAirports: true,
    }));
    const taggedCountryRegion: CombinedPoint[] = extraCountryRegion.map(p => ({
      ...p,
      isAllAirports: true,
      isCountryRegionUnvisited: true,
    }));
    const taggedVisited: CombinedPoint[] = pointsData.map(p => ({
      ...p,
      isAllAirports: false,
    }));

    // All airports rendered first (below), visited airports on top
    return [...taggedGlobal, ...taggedCountryRegion, ...taggedVisited];
  }, [pointsData, allAirportsPoints, allAirportsVisible, focusedUnvisited, validAirportCodes]);

  return {
    flightTypeSelection, validAirportCodes, airportNames,
    allAirportsData, allAirportsLoading, usStatesLoading, usStateStats,
    labeledAirports, combinedPointsData, usStatesPolygons,
  };
}
