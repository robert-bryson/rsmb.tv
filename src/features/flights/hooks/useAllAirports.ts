import { useMemo } from 'react';
import type {
    AllAirportsCollection,
    GlobeAllAirportPoint,
    AirportSymbolMode,
} from '../types';
import {
    ALL_AIRPORTS_POINT_SIZE,
    CONTINENT_COLORS,
    VISITED_COLOR,
    UNVISITED_COLOR,
    getElevationColor,
    getCountryColor,
} from '../constants';
import { useGeoJsonData } from './useGeoJsonData';

/**
 * Hook to fetch all airports data.
 */
export function useAllAirports(options: { enabled?: boolean } = {}) {
    return useGeoJsonData<AllAirportsCollection>('allAirports.geojson', options);
}

interface AllAirportsLayerOptions {
    visible: boolean;
    symbolMode: AirportSymbolMode;
    visitedAirportCodes?: Set<string>;
}

/**
 * Hook to transform all airports data into globe-ready points.
 */
export function useAllAirportsLayer(
    airportsData: AllAirportsCollection | null,
    options: AllAirportsLayerOptions
): GlobeAllAirportPoint[] {
    const { visible, symbolMode, visitedAirportCodes } = options;

    return useMemo(() => {
        if (!visible || !airportsData) return [];

        return airportsData.features.map((feature) => {
            const props = feature.properties;
            const [lng, lat] = feature.geometry.coordinates;

            // Determine if visited (use provided set or the data's visited flag)
            const isVisited = visitedAirportCodes
                ? visitedAirportCodes.has(props.code)
                : props.visited;

            // Calculate color based on symbol mode
            let color: string;
            switch (symbolMode) {
                case 'visited':
                    color = isVisited ? VISITED_COLOR : UNVISITED_COLOR;
                    break;
                case 'continent':
                    color = CONTINENT_COLORS[props.continent] || CONTINENT_COLORS.default;
                    break;
                case 'country':
                    color = getCountryColor(props.country);
                    break;
                case 'elevation':
                    color = getElevationColor(props.elevationFt);
                    break;
                default:
                    color = UNVISITED_COLOR;
            }

            // Make visited airports slightly larger
            const size = isVisited
                ? ALL_AIRPORTS_POINT_SIZE * 1.5
                : ALL_AIRPORTS_POINT_SIZE;

            return {
                lat,
                lng,
                size,
                color,
                label: props.code,
                airport: props,
            };
        });
    }, [airportsData, visible, symbolMode, visitedAirportCodes]);
}
