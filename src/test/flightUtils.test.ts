import { describe, it, expect } from 'vitest';
import { calculateDistance, flightMatchesType, formatDistance, formatElevation, parseYear, getRouteKey, hexToRgba } from '../features/flights/utils';
import type { FlightProperties } from '../features/flights/types';

describe('parseYear', () => {
    it('parses M/D/YYYY format', () => {
        expect(parseYear('6/15/2008')).toBe(2008);
    });

    it('parses MM/DD/YYYY format', () => {
        expect(parseYear('12/31/2024')).toBe(2024);
    });

    it('parses single-digit month and day', () => {
        expect(parseYear('1/1/2020')).toBe(2020);
    });

    it('parses ISO dates', () => {
        expect(parseYear('2024-01-02')).toBe(2024);
    });

    it('returns NaN for empty string', () => {
        expect(parseYear('')).toBeNaN();
    });

    it('returns NaN for malformed date', () => {
        expect(parseYear('not-a-date')).toBeNaN();
    });
});

describe('getRouteKey', () => {
    it('sorts airports alphabetically', () => {
        expect(getRouteKey('LAX', 'JFK')).toBe('JFK-LAX');
    });

    it('is consistent regardless of argument order', () => {
        expect(getRouteKey('LAX', 'JFK')).toBe(getRouteKey('JFK', 'LAX'));
    });

    it('handles identical airports', () => {
        expect(getRouteKey('SFO', 'SFO')).toBe('SFO-SFO');
    });

    it('handles already-sorted airports', () => {
        expect(getRouteKey('ATL', 'ORD')).toBe('ATL-ORD');
    });
});

describe('hexToRgba', () => {
    it('converts black with full opacity', () => {
        expect(hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
    });

    it('converts white with half opacity', () => {
        expect(hexToRgba('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    });

    it('converts a color with partial opacity', () => {
        expect(hexToRgba('#ff8000', 0.75)).toBe('rgba(255, 128, 0, 0.75)');
    });

    it('handles zero opacity', () => {
        expect(hexToRgba('#4ade80', 0)).toBe('rgba(74, 222, 128, 0)');
    });
});

describe('calculateDistance', () => {
    it('returns 0 for same point', () => {
        expect(calculateDistance(40, -74, 40, -74)).toBe(0);
    });

    it('calculates roughly correct distance for known route (JFK to LAX ~3983 km)', () => {
        const distance = calculateDistance(40.6413, -73.7781, 33.9416, -118.4085);
        expect(distance).toBeGreaterThan(3900);
        expect(distance).toBeLessThan(4100);
    });

    it('calculates antipodal distance close to half circumference', () => {
        // North pole to south pole ≈ 20015 km
        const distance = calculateDistance(90, 0, -90, 0);
        expect(distance).toBeGreaterThan(20000);
        expect(distance).toBeLessThan(20100);
    });

    it('returns NaN when given NaN inputs', () => {
        expect(calculateDistance(NaN, -74, 40, -74)).toBeNaN();
    });
});

describe('formatDistance', () => {
    it('formats kilometers when metric units are enabled', () => {
        expect(formatDistance(100, true)).toBe('100 km');
    });

    it('formats miles when metric units are disabled', () => {
        expect(formatDistance(100, false)).toBe('62 mi');
    });
});

describe('formatElevation', () => {
    it('formats meters when metric units are enabled', () => {
        expect(formatElevation(433, 132, true)).toBe('132 m');
    });

    it('formats feet when metric units are disabled', () => {
        expect(formatElevation(433, 132, false)).toBe('433 ft');
    });
});

describe('flightMatchesType', () => {
    const baseFlight = {
        origin_country: 'US',
        destination_country: 'US',
        origin_continent: 'NA',
        destination_continent: 'NA',
    } as FlightProperties;

    it('matches domestic flights within one country', () => {
        expect(flightMatchesType(baseFlight, 'domestic')).toBe(true);
        expect(flightMatchesType(baseFlight, 'international')).toBe(false);
    });

    it('matches international flights across countries', () => {
        const flight = { ...baseFlight, destination_country: 'CA' };

        expect(flightMatchesType(flight, 'international')).toBe(true);
        expect(flightMatchesType(flight, 'intercontinental')).toBe(false);
    });

    it('matches intercontinental flights across continents', () => {
        const flight = {
            ...baseFlight,
            destination_country: 'GB',
            destination_continent: 'EU',
        };

        expect(flightMatchesType(flight, 'intercontinental')).toBe(true);
        expect(flightMatchesType(flight, 'international')).toBe(true);
    });
});
