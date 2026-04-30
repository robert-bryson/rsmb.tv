import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAllAirportsLayer } from '../features/flights/hooks/useAllAirports';
import {
    VISITED_COLOR,
    UNVISITED_COLOR,
    CONTINENT_COLORS,
    ALL_AIRPORTS_POINT_SIZE,
} from '../features/flights/constants';
import type { AllAirportsCollection } from '../features/flights/types';

function makeAirport(overrides: Partial<{
    code: string;
    continent: string;
    country: string;
    elevationFt: number;
    visited: boolean;
}> = {}) {
    return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [-118.4085, 33.9416] },
        properties: {
            code: overrides.code ?? 'LAX',
            name: 'Los Angeles',
            municipality: 'Los Angeles',
            region: 'US-CA',
            regionName: 'California',
            country: overrides.country ?? 'US',
            countryName: 'United States',
            continent: overrides.continent ?? 'NA',
            continentName: 'North America',
            elevationFt: overrides.elevationFt ?? 128,
            elevationM: 39,
            visited: overrides.visited ?? true,
        },
    };
}

function makeCollection(...airports: ReturnType<typeof makeAirport>[]): AllAirportsCollection {
    return {
        type: 'FeatureCollection',
        features: airports,
    };
}

describe('useAllAirportsLayer', () => {
    it('returns empty array when not visible', () => {
        const { result } = renderHook(() =>
            useAllAirportsLayer(makeCollection(makeAirport()), {
                visible: false,
                symbolMode: 'visited',
            })
        );
        expect(result.current).toHaveLength(0);
    });

    it('returns empty array when data is null', () => {
        const { result } = renderHook(() =>
            useAllAirportsLayer(null, { visible: true, symbolMode: 'visited' })
        );
        expect(result.current).toHaveLength(0);
    });

    it('maps coordinates correctly (GeoJSON [lng, lat] to {lat, lng})', () => {
        const { result } = renderHook(() =>
            useAllAirportsLayer(makeCollection(makeAirport()), {
                visible: true,
                symbolMode: 'visited',
            })
        );
        const point = result.current[0];
        expect(point.lat).toBeCloseTo(33.9416);
        expect(point.lng).toBeCloseTo(-118.4085);
    });

    describe('symbolMode: visited', () => {
        it('colors visited airport with VISITED_COLOR when data flag is true', () => {
            const { result } = renderHook(() =>
                useAllAirportsLayer(makeCollection(makeAirport({ visited: true })), {
                    visible: true,
                    symbolMode: 'visited',
                })
            );
            expect(result.current[0].color).toBe(VISITED_COLOR);
        });

        it('colors unvisited airport with UNVISITED_COLOR', () => {
            const { result } = renderHook(() =>
                useAllAirportsLayer(makeCollection(makeAirport({ visited: false })), {
                    visible: true,
                    symbolMode: 'visited',
                })
            );
            expect(result.current[0].color).toBe(UNVISITED_COLOR);
        });

        it('overrides visited flag with visitedAirportCodes when provided', () => {
            const { result } = renderHook(() =>
                useAllAirportsLayer(
                    makeCollection(makeAirport({ code: 'LAX', visited: false })),
                    { visible: true, symbolMode: 'visited', visitedAirportCodes: new Set(['LAX']) }
                )
            );
            expect(result.current[0].color).toBe(VISITED_COLOR);
        });

        it('marks as unvisited when code is not in visitedAirportCodes set', () => {
            const { result } = renderHook(() =>
                useAllAirportsLayer(
                    makeCollection(makeAirport({ code: 'SFO', visited: true })),
                    { visible: true, symbolMode: 'visited', visitedAirportCodes: new Set(['LAX']) }
                )
            );
            expect(result.current[0].color).toBe(UNVISITED_COLOR);
        });
    });

    describe('symbolMode: continent', () => {
        it('uses continent color for a known continent code', () => {
            const { result } = renderHook(() =>
                useAllAirportsLayer(makeCollection(makeAirport({ continent: 'EU' })), {
                    visible: true,
                    symbolMode: 'continent',
                })
            );
            expect(result.current[0].color).toBe(CONTINENT_COLORS['EU']);
        });

        it('falls back to default color for unknown continent', () => {
            const { result } = renderHook(() =>
                useAllAirportsLayer(makeCollection(makeAirport({ continent: 'XX' })), {
                    visible: true,
                    symbolMode: 'continent',
                })
            );
            expect(result.current[0].color).toBe(CONTINENT_COLORS['default']);
        });
    });

    describe('symbolMode: country', () => {
        it('returns an hsla color string', () => {
            const { result } = renderHook(() =>
                useAllAirportsLayer(makeCollection(makeAirport({ country: 'US' })), {
                    visible: true,
                    symbolMode: 'country',
                })
            );
            expect(result.current[0].color).toMatch(/^hsla\(/);
        });

        it('returns the same color for the same country code', () => {
            const data = makeCollection(
                makeAirport({ code: 'LAX', country: 'US' }),
                makeAirport({ code: 'JFK', country: 'US' }),
            );
            const { result } = renderHook(() =>
                useAllAirportsLayer(data, { visible: true, symbolMode: 'country' })
            );
            expect(result.current[0].color).toBe(result.current[1].color);
        });
    });

    describe('symbolMode: elevation', () => {
        it('returns a red color for very high elevation (8000+ ft)', () => {
            const { result } = renderHook(() =>
                useAllAirportsLayer(makeCollection(makeAirport({ elevationFt: 9000 })), {
                    visible: true,
                    symbolMode: 'elevation',
                })
            );
            // ELEVATION_COLORS.VERY_HIGH is red-600
            expect(result.current[0].color).toContain('220, 38, 38');
        });

        it('returns a blue color for sea-level elevation', () => {
            const { result } = renderHook(() =>
                useAllAirportsLayer(makeCollection(makeAirport({ elevationFt: 10 })), {
                    visible: true,
                    symbolMode: 'elevation',
                })
            );
            // ELEVATION_COLORS.SEA_LEVEL is blue-500
            expect(result.current[0].color).toContain('59, 130, 246');
        });
    });

    describe('size scaling', () => {
        it('visited airports are 1.5x larger than base size', () => {
            const { result } = renderHook(() =>
                useAllAirportsLayer(
                    makeCollection(makeAirport({ visited: true })),
                    { visible: true, symbolMode: 'visited' }
                )
            );
            expect(result.current[0].size).toBeCloseTo(ALL_AIRPORTS_POINT_SIZE * 1.5);
        });

        it('unvisited airports use the base size', () => {
            const { result } = renderHook(() =>
                useAllAirportsLayer(
                    makeCollection(makeAirport({ visited: false })),
                    { visible: true, symbolMode: 'visited' }
                )
            );
            expect(result.current[0].size).toBe(ALL_AIRPORTS_POINT_SIZE);
        });
    });

    it('sets label to airport code', () => {
        const { result } = renderHook(() =>
            useAllAirportsLayer(makeCollection(makeAirport({ code: 'ORD' })), {
                visible: true,
                symbolMode: 'visited',
            })
        );
        expect(result.current[0].label).toBe('ORD');
    });

    it('includes all airports in the output', () => {
        const data = makeCollection(
            makeAirport({ code: 'LAX' }),
            makeAirport({ code: 'JFK' }),
            makeAirport({ code: 'ORD' }),
        );
        const { result } = renderHook(() =>
            useAllAirportsLayer(data, { visible: true, symbolMode: 'visited' })
        );
        expect(result.current).toHaveLength(3);
    });
});
