import { describe, it, expect } from 'vitest';
import {
    getYearColor,
    getFrequencyColor,
    getElevationColor,
    getCountryColor,
    getVisitCountColor,
    getFlightCountColor,
} from '../features/flights/constants';

describe('getYearColor', () => {
    it('returns the mapped color for a known year', () => {
        expect(getYearColor(2024)).toBe('#4ade80');
        expect(getYearColor(2025)).toBe('#22d3ee');
    });

    it('returns fallback for unknown year', () => {
        expect(getYearColor(1990)).toBe('#a855f7');
    });
});

describe('getFrequencyColor', () => {
    it('returns very frequent color for high ratio', () => {
        expect(getFrequencyColor(80, 100)).toBe('#ef4444');
    });

    it('returns frequent color for mid-high ratio', () => {
        expect(getFrequencyColor(50, 100)).toBe('#f97316');
    });

    it('returns moderate color for mid ratio', () => {
        expect(getFrequencyColor(25, 100)).toBe('#facc15');
    });

    it('returns occasional color for low ratio', () => {
        expect(getFrequencyColor(5, 100)).toBe('#a855f7');
    });
});

describe('getElevationColor', () => {
    it('returns very high color for 8000+ ft', () => {
        expect(getElevationColor(8500)).toBe('rgba(220, 38, 38, 0.8)');
    });

    it('returns sea level color for low elevation', () => {
        expect(getElevationColor(50)).toBe('rgba(59, 130, 246, 0.8)');
    });
});

describe('getCountryColor', () => {
    it('returns deterministic color per country code', () => {
        const color = getCountryColor('US');
        expect(color).toMatch(/^hsla\(\d+, 70%, 55%, 0\.8\)$/);
        // Same input → same output
        expect(getCountryColor('US')).toBe(color);
    });

    it('different codes produce different colors', () => {
        expect(getCountryColor('US')).not.toBe(getCountryColor('JP'));
    });
});

describe('getVisitCountColor', () => {
    it('returns not-visited color for 0', () => {
        expect(getVisitCountColor(0)).toBe('rgba(100, 116, 139, 0.2)');
    });

    it('returns progressively darker green for more visits', () => {
        const c1 = getVisitCountColor(1);
        const c20 = getVisitCountColor(20);
        expect(c1).not.toBe(c20);
    });
});

describe('getFlightCountColor', () => {
    it('returns no-flights color for 0', () => {
        expect(getFlightCountColor(0)).toBe('rgba(100, 116, 139, 0.2)');
    });

    it('returns a higher-tier color for 50+ flights', () => {
        expect(getFlightCountColor(55)).toBe('rgba(234, 88, 12, 0.5)');
    });
});
