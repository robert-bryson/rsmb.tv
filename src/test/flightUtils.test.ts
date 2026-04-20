import { describe, it, expect } from 'vitest';
import { calculateDistance, parseYear, getRouteKey, hexToRgba } from '../features/flights/utils';

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
