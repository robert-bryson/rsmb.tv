import { useMemo } from 'react';
import type {
    USStatesCollection,
    USStateStats,
    GlobeStatePolygon,
    StateSymbolMode,
    AllAirportsCollection,
    FlightsCollection,
} from '../types';
import {
    STATE_VISITED_COLOR,
    STATE_UNVISITED_COLOR,
    getVisitCountColor,
    getFlightCountColor,
} from '../constants';
import { useGeoJsonData } from './useGeoJsonData';

/**
 * Hook to fetch US states GeoJSON data.
 */
export function useUSStates() {
    return useGeoJsonData<USStatesCollection>('usStates.geojson');
}

interface USStatesLayerOptions {
    visible: boolean;
    symbolMode: StateSymbolMode;
}

// Parse date string like "6/15/2008" to sortable format
function parseDate(dateStr: string): Date {
    const parts = dateStr.split('/');
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
}

/**
 * Compute statistics for each US state based on airport and flight data.
 */
export function useUSStateStats(
    statesData: USStatesCollection | null,
    allAirportsData: AllAirportsCollection | null,
    flightsData: FlightsCollection | null
): Map<string, USStateStats> {
    return useMemo(() => {
        const stats = new Map<string, USStateStats>();

        if (!statesData) return stats;

        // Initialize stats for all states
        statesData.features.forEach((feature) => {
            const { code, name, abbr } = feature.properties;
            stats.set(code, {
                code,
                name,
                abbr,
                visited: false,
                airportCount: 0,
                totalAirports: 0,
                flightCount: 0,
                firstVisitDate: null,
                lastVisitDate: null,
                airlines: [],
            });
        });

        // Count total airports per state
        if (allAirportsData) {
            allAirportsData.features.forEach((airport) => {
                const stateCode = airport.properties.region; // e.g., "US-CA"
                const state = stats.get(stateCode);
                if (state) {
                    state.totalAirports++;
                }
            });
        }

        // Process flights to compute visited airports and flight counts
        if (flightsData) {
            const visitedAirportsByState = new Map<string, Set<string>>();
            const flightDatesByState = new Map<string, Date[]>();
            const airlinesByState = new Map<string, Set<string>>();

            flightsData.features.forEach((flight) => {
                const props = flight.properties;
                const flightDate = parseDate(props.date);

                // Process origin
                const originState = props.origin_region; // e.g., "US-CA"
                if (stats.has(originState)) {
                    const state = stats.get(originState)!;
                    state.flightCount++;

                    if (!visitedAirportsByState.has(originState)) {
                        visitedAirportsByState.set(originState, new Set());
                    }
                    visitedAirportsByState.get(originState)!.add(props.origin_code);

                    if (!flightDatesByState.has(originState)) {
                        flightDatesByState.set(originState, []);
                    }
                    flightDatesByState.get(originState)!.push(flightDate);

                    if (!airlinesByState.has(originState)) {
                        airlinesByState.set(originState, new Set());
                    }
                    if (props.airline) {
                        airlinesByState.get(originState)!.add(props.airline);
                    }
                }

                // Process destination
                const destState = props.destination_region;
                if (stats.has(destState)) {
                    const state = stats.get(destState)!;
                    state.flightCount++;

                    if (!visitedAirportsByState.has(destState)) {
                        visitedAirportsByState.set(destState, new Set());
                    }
                    visitedAirportsByState.get(destState)!.add(props.destination_code);

                    if (!flightDatesByState.has(destState)) {
                        flightDatesByState.set(destState, []);
                    }
                    flightDatesByState.get(destState)!.push(flightDate);

                    if (!airlinesByState.has(destState)) {
                        airlinesByState.set(destState, new Set());
                    }
                    if (props.airline) {
                        airlinesByState.get(destState)!.add(props.airline);
                    }
                }
            });

            // Update stats with computed values
            stats.forEach((state, stateCode) => {
                const visitedAirports = visitedAirportsByState.get(stateCode);
                if (visitedAirports && visitedAirports.size > 0) {
                    state.visited = true;
                    state.airportCount = visitedAirports.size;
                }

                const dates = flightDatesByState.get(stateCode);
                if (dates && dates.length > 0) {
                    dates.sort((a, b) => a.getTime() - b.getTime());
                    state.firstVisitDate = dates[0].toLocaleDateString();
                    state.lastVisitDate = dates[dates.length - 1].toLocaleDateString();
                }

                const airlines = airlinesByState.get(stateCode);
                if (airlines) {
                    state.airlines = Array.from(airlines);
                }
            });
        }

        return stats;
    }, [statesData, allAirportsData, flightsData]);
}

/**
 * Hook to transform US states data into globe-ready polygons.
 */
export function useUSStatesLayer(
    statesData: USStatesCollection | null,
    stateStats: Map<string, USStateStats>,
    options: USStatesLayerOptions
): GlobeStatePolygon[] {
    const { visible, symbolMode } = options;

    return useMemo(() => {
        if (!visible || !statesData) return [];

        return statesData.features.map((feature) => {
            const props = feature.properties;
            const stats = stateStats.get(props.code) || {
                code: props.code,
                name: props.name,
                abbr: props.abbr,
                visited: false,
                airportCount: 0,
                totalAirports: 0,
                flightCount: 0,
                firstVisitDate: null,
                lastVisitDate: null,
                airlines: [],
            };

            // Calculate color based on symbol mode
            let color: string;
            switch (symbolMode) {
                case 'visited':
                    color = stats.visited ? STATE_VISITED_COLOR : STATE_UNVISITED_COLOR;
                    break;
                case 'visitCount':
                    color = getVisitCountColor(stats.airportCount);
                    break;
                case 'flightCount':
                    color = getFlightCountColor(stats.flightCount);
                    break;
                default:
                    color = STATE_UNVISITED_COLOR;
            }

            return {
                geometry: feature.geometry,
                properties: props,
                stats,
                color,
            };
        });
    }, [statesData, stateStats, visible, symbolMode]);
}
