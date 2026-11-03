import { describe, expect, it } from 'vitest';
import type { FlightProperties } from '../features/flights/types';
import { parseFlightDuration } from '../features/flights/utils/durationInput';
import { flightDurationCoverage, flightDurationLabel, formatFlightDays, formatFlightDuration, formatFlightDurationAccessible, formatFlightHours, resolveFlightDuration, summarizeFlightDurations } from '../features/flights/utils/flightDuration';
import { flightMatchesFilters } from '../features/flights/utils/flightFilters';
import { parseFlightDate } from '../features/flights/utils/flightDateInput';
import { renderHook } from '@testing-library/react';
import { useUSStateStats } from '../features/flights/hooks/useUSStates';

const leg = (overrides: Partial<FlightProperties> = {}): FlightProperties => ({
    id: 1, date: '1/1/2024', airline: 'Test', origin_code: 'SEA', destination_code: 'LAX',
    origin_country: 'US', destination_country: 'US', origin_region: 'US-WA', destination_region: 'US-CA',
    origin_continent: 'NA', destination_continent: 'NA', origin_lat: 47.45, origin_lon: -122.31, destination_lat: 33.94, destination_lon: -118.41,
    ...overrides,
} as FlightProperties);

describe('flight duration input', () => {
    it('accepts absent optional columns and normalizes elapsed minutes', () => {
        expect(parseFlightDuration({})).toEqual({ durationMinutes: null, durationKind: null, durationSource: null });
        expect(parseFlightDuration({ durationMinutes: ' 165 ', durationKind: 'actual-block', durationSource: ' manual ' }))
            .toEqual({ durationMinutes: 165, durationKind: 'actual-block', durationSource: 'manual' });
    });
    it.each(['0', '-1', '2.45', '02:45', '165 minutes', 'Infinity', '1e2', '9007199254740992'])('rejects ambiguous or invalid minutes: %s', durationMinutes => {
        expect(() => parseFlightDuration({ durationMinutes, durationKind: 'actual-block', durationSource: 'manual' })).toThrow('durationMinutes');
    });
    it('requires the timing basis and source, including orphan provenance', () => {
        expect(() => parseFlightDuration({ durationMinutes: 165, durationSource: 'manual' })).toThrow('durationKind');
        expect(() => parseFlightDuration({ durationMinutes: 165, durationKind: 'actual-block' })).toThrow('durationSource');
        expect(() => parseFlightDuration({ durationSource: 'manual' })).toThrow('durationMinutes');
    });
});

describe('duration resolution and aggregation', () => {
    it('keeps antipodal distance estimates finite despite floating-point rounding', () => {
        const duration = resolveFlightDuration(leg({ origin_lat: -89.91999999999996, origin_lon: 0, destination_lat: 89.91999999999996, destination_lon: 180 }));
        expect(duration.minutes).toBeGreaterThan(1500);
        expect(duration.minutes).toBeLessThan(1600);
    });

    it.each([
        [45, '45 minutes'], [60, '1 hour'], [61, '1 hour 1 minute'],
        [125, '2 hours 5 minutes'], [null, 'Flight time unavailable'], [NaN, 'Flight time unavailable'],
    ] as const)('expands %s minutes for assistive technology', (minutes, label) => {
        expect(formatFlightDurationAccessible(minutes)).toBe(label);
    });

    it('uses recorded block minutes even without coordinates and retains scheduled provenance', () => {
        expect(resolveFlightDuration(leg({ origin_lat: NaN, durationMinutes: 165, durationKind: 'actual-block', durationSource: 'manual' })))
            .toMatchObject({ minutes: 165, kind: 'actual-block', source: 'manual' });
        expect(resolveFlightDuration(leg({ durationMinutes: 180, durationKind: 'scheduled-block', durationSource: 'itinerary' })))
            .toMatchObject({ minutes: 180, kind: 'scheduled-block' });
    });
    it('keeps unclassified input separate from estimates and rejects malformed cached inputs', () => {
        const estimate = resolveFlightDuration(leg()).minutes;
        expect(resolveFlightDuration(leg({ durationMinutes: 40, durationKind: 'unclassified', durationSource: 'old-log' })))
            .toMatchObject({ minutes: estimate, kind: 'estimated-block', reportedMinutes: 40 });
        expect(resolveFlightDuration(leg({ durationMinutes: -40, durationKind: 'actual-block', durationSource: 'bad' })).kind).toBe('estimated-block');
        expect(resolveFlightDuration(leg({ origin_lat: 91 })).minutes).toBeNull();
    });
    it('counts each matching leg once, sums minutes, and reports mixed coverage', () => {
        const summary = summarizeFlightDurations([
            leg({ durationMinutes: 65, durationKind: 'actual-block', durationSource: 'manual', destination_region: 'US-WA' }),
            leg({ durationMinutes: 80, durationKind: 'scheduled-block', durationSource: 'itinerary' }),
            leg(), leg({ origin_lon: Infinity }),
        ]);
        expect(summary).toMatchObject({ flightCount: 4, actualMinutes: 65, actualCount: 1, scheduledMinutes: 80, scheduledCount: 1, estimatedCount: 1, unavailableCount: 1 });
        expect(summary.totalMinutes).toBe(145 + resolveFlightDuration(leg()).minutes!);
        expect(summary.shortest).toEqual({ minutes: 65, kind: 'actual-block' });
        expect(summary.longest).toEqual({ minutes: resolveFlightDuration(leg()).minutes, kind: 'estimated-block' });
        expect(flightDurationCoverage(summary)).toBe('1 actual · 1 scheduled · 1 estimated · 1 unavailable');
        expect(flightDurationLabel(summary)).toBe('Est. flight time');
        expect(formatFlightHours(summarizeFlightDurations([]))).toBe('Unavailable');
        expect(formatFlightDays(summarizeFlightDurations([]))).toBe('Unavailable');
        expect(summarizeFlightDurations([])).toMatchObject({ longest: null, shortest: null });
        expect(summarizeFlightDurations([leg({ origin_lon: Infinity })])).toMatchObject({ longest: null, shortest: null });
    });
    it.each([
        [70044, '48d 15h'], [1440, '1d 0h'], [1439, '1d 0h'],
        [165, '3h'], [45, '45m'],
    ] as const)('formats %s total minutes as %s while retaining precise hours', (minutes, expected) => {
        const summary = summarizeFlightDurations([leg({ durationMinutes: minutes, durationKind: 'actual-block', durationSource: 'manual' })]);
        expect(formatFlightDays(summary)).toBe(expected);
        expect(summary.totalMinutes).toBe(minutes);
        if (minutes === 70044) expect(formatFlightHours(summary)).toBe('1,167.4 h');
    });
    it('formats individual durations and aggregate hours without changing canonical minutes', () => {
        expect(formatFlightDuration(45)).toBe('45m');
        expect(formatFlightDuration(60)).toBe('1h');
        expect(formatFlightDuration(65)).toBe('1h 05m');
        expect(formatFlightDuration(165)).toBe('2h 45m');
        const summary = summarizeFlightDurations([leg({ durationMinutes: 165, durationKind: 'actual-block', durationSource: 'manual' })]);
        expect(formatFlightHours(summary)).toBe('2.8 h');
        expect(flightDurationLabel(summary)).toBe('Flight time');
        expect(summary.totalMinutes).toBe(165);
    });
    it('uses all active selection dimensions for summary membership', () => {
        const flights = [leg(), leg({ id: 2, date: '1/1/2025' }), leg({ id: 3, airline: 'Other' })];
        const filters = { selectedYear: 2024, selectedAirline: 'Test', selectedRoute: 'LAX-SEA', selectedCountry: 'US', selectedRegion: 'US-WA', selectedAirport: 'SEA', selectedFlightType: 'domestic' as const };
        expect(flights.filter(flight => flightMatchesFilters(flight, filters))).toEqual([flights[0]]);
        expect(flightMatchesFilters(flights[0], { ...filters, selectedFlightType: 'international' })).toBe(false);
    });
    it('counts a same-state flight once in both state flight count and elapsed time', () => {
        const { result } = renderHook(() => useUSStateStats({
            type: 'FeatureCollection', features: [{ type: 'Feature', properties: { code: 'US-WA', name: 'Washington', abbr: 'WA' }, geometry: { type: 'Polygon', coordinates: [] } }],
        }, null, {
            type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: leg({ destination_region: 'US-WA', durationMinutes: 90, durationKind: 'actual-block', durationSource: 'manual' }) }],
        }));
        expect(result.current.get('US-WA')).toMatchObject({ flightCount: 1, duration: { actualCount: 1, totalMinutes: 90 } });
    });
    it('validates calendar dates without rolling invalid days into another month', () => {
        expect(parseFlightDate('2024-02-29')).toMatchObject({ year: 2024, canonical: '2/29/2024' });
        expect(() => parseFlightDate('2/29/2023')).toThrow('calendar date');
        expect(() => parseFlightDate('2/30/2024')).toThrow('calendar date');
        expect(() => parseFlightDate('2024-02-29T12:00:00Z')).toThrow();
    });
});
