import { useMemo } from 'react';
import { summarizeFlightDurations } from '../utils/flightDuration';
import type {
    USStatesCollection,
    USStateStats,
    GlobeStatePolygon,
    StateSymbolMode,
    AllAirportsCollection,
    FlightsCollection,
    FlightProperties,
} from '../types';
import {
    STATE_VISITED_COLOR,
    STATE_UNVISITED_COLOR,
    getVisitCountColor,
    getFlightCountColor,
} from '../constants';
import { parseDateString } from '../utils';
import { useGeoJsonData } from './useGeoJsonData';

export function useUSStates(options: { enabled?: boolean } = {}) {
    return useGeoJsonData<USStatesCollection>('usStates.geojson', options);
}

interface USStatesLayerOptions {
    visible: boolean;
    symbolMode: StateSymbolMode;
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
            const flightsByState = new Map<string, FlightProperties[]>();

            for (const { properties: flight } of flightsData.features) {
                const endpoints = [
                    [flight.origin_region, flight.origin_code],
                    [flight.destination_region, flight.destination_code],
                ] as const;
                for (const [stateCode, airportCode] of endpoints) {
                    if (!stats.has(stateCode)) continue;
                    const visited = visitedAirportsByState.get(stateCode) ?? new Set<string>();
                    visited.add(airportCode);
                    visitedAirportsByState.set(stateCode, visited);
                }
                // A same-state leg contributes one duration and date, but both airports.
                for (const stateCode of new Set(endpoints.map(([code]) => code))) {
                    if (!stats.has(stateCode)) continue;
                    const legs = flightsByState.get(stateCode) ?? [];
                    legs.push(flight);
                    flightsByState.set(stateCode, legs);
                }
            }

            // Update stats with computed values
            stats.forEach((state, stateCode) => {
                const legs = flightsByState.get(stateCode) ?? [];
                state.flightCount = legs.length;
                state.duration = summarizeFlightDurations(legs);
                const visitedAirports = visitedAirportsByState.get(stateCode);
                if (visitedAirports && visitedAirports.size > 0) {
                    state.visited = true;
                    state.airportCount = visitedAirports.size;
                }

                const dates = legs.map(flight => flight.date);
                if (dates.length > 0) {
                    dates.sort((a, b) => parseDateString(a).getTime() - parseDateString(b).getTime());
                    state.firstVisitDate = dates[0];
                    state.lastVisitDate = dates[dates.length - 1];
                }

                state.airlines = [...new Set(legs.map(flight => flight.airline).filter(Boolean))];
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
