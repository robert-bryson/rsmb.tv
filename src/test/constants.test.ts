import { describe, it, expect } from 'vitest';
import {
    getYearColor,
    getFrequencyColor,
    getElevationColor,
    getCountryColor,
    getVisitCountColor,
    getFlightCountColor,
    BASEMAPS,
    DEFAULT_BASEMAP_ID,
    getBasemap,
    isValidBasemapId,
} from '../features/flights/constants';
import type { BasemapId } from '../features/flights/types';

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

    it('returns occasional color when maxCount is 0 (no division by zero)', () => {
        expect(getFrequencyColor(0, 0)).toBe('#a855f7');
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

describe('BASEMAPS', () => {
    it('contains at least one basemap', () => {
        expect(BASEMAPS.length).toBeGreaterThan(0);
    });

    it('has unique IDs', () => {
        const ids = BASEMAPS.map(b => b.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('uses only local image paths (no external URLs)', () => {
        for (const basemap of BASEMAPS) {
            expect(basemap.image).not.toMatch(/^https?:\/\//);
            expect(basemap.image).toContain('basemaps/');
            if (basemap.bump) {
                expect(basemap.bump).not.toMatch(/^https?:\/\//);
                expect(basemap.bump).toContain('basemaps/');
            }
        }
    });

    it('does not use rgba for atmosphere colors (THREE.Color ignores alpha)', () => {
        for (const basemap of BASEMAPS) {
            expect(basemap.atmosphere).not.toMatch(/rgba\(/);
        }
    });

    it('each basemap has required properties', () => {
        for (const basemap of BASEMAPS) {
            expect(basemap.id).toBeTruthy();
            expect(basemap.label).toBeTruthy();
            expect(basemap.image).toBeTruthy();
            expect(typeof basemap.atmosphere).toBe('string');
            expect(typeof basemap.bg).toBe('string');
        }
    });
});

describe('DEFAULT_BASEMAP_ID', () => {
    it('refers to an existing basemap', () => {
        expect(BASEMAPS.some(b => b.id === DEFAULT_BASEMAP_ID)).toBe(true);
    });
});

describe('isValidBasemapId', () => {
    it('returns true for all defined basemap IDs', () => {
        for (const basemap of BASEMAPS) {
            expect(isValidBasemapId(basemap.id)).toBe(true);
        }
    });

    it('returns false for unknown strings', () => {
        expect(isValidBasemapId('nonexistent')).toBe(false);
        expect(isValidBasemapId('')).toBe(false);
    });

    it('returns false for non-string values', () => {
        expect(isValidBasemapId(null)).toBe(false);
        expect(isValidBasemapId(undefined)).toBe(false);
        expect(isValidBasemapId(42)).toBe(false);
    });
});

describe('getBasemap', () => {
    it('returns the correct basemap for a valid ID', () => {
        const night = getBasemap('night');
        expect(night.id).toBe('night');
        expect(night.label).toBe('Night');
    });

    it('returns each basemap by its ID', () => {
        for (const basemap of BASEMAPS) {
            expect(getBasemap(basemap.id)).toBe(basemap);
        }
    });

    it('returns the first basemap as fallback for invalid IDs', () => {
        const fallback = getBasemap('nonexistent');
        expect(fallback).toBe(BASEMAPS[0]);
    });

    it('returns the first basemap for empty string', () => {
        expect(getBasemap('')).toBe(BASEMAPS[0]);
    });

    it('works with the DEFAULT_BASEMAP_ID', () => {
        const basemap = getBasemap(DEFAULT_BASEMAP_ID);
        expect(basemap.id).toBe(DEFAULT_BASEMAP_ID);
    });

    it('type-narrowed ID matches BasemapId union', () => {
        const validIds: BasemapId[] = ['night', 'blue-marble', 'day', 'dark', 'positron', 'voyager'];
        for (const id of validIds) {
            const basemap = getBasemap(id);
            expect(basemap.id).toBe(id);
        }
    });
});
