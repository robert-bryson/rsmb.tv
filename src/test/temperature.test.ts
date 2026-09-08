import { describe, it, expect } from 'vitest';
import { buildTemperaturePath, fDeltaToCDelta, fToC, formatComparisonPeriod, formatTemp, formatTempDelta, getRecentObservationDate, weightedMedianRecordYear } from '../features/temperatures/utils/temperature';

describe('fToC', () => {
    it('converts 32°F to 0°C', () => {
        expect(fToC(32)).toBeCloseTo(0);
    });

    it('converts 212°F to 100°C', () => {
        expect(fToC(212)).toBeCloseTo(100);
    });

    it('converts -40°F to -40°C', () => {
        expect(fToC(-40)).toBeCloseTo(-40);
    });

    it('converts 72°F to 22.2°C', () => {
        expect(fToC(72)).toBeCloseTo(22.222, 2);
    });

    it('converts 0°F to -17.8°C', () => {
        expect(fToC(0)).toBeCloseTo(-17.778, 2);
    });
});

describe('formatTemp', () => {
    it('formats Fahrenheit', () => {
        expect(formatTemp(72, false)).toBe('72°F');
    });

    it('formats Celsius', () => {
        expect(formatTemp(32, true)).toBe('0.0°C');
    });

    it('formats 212°F as Celsius', () => {
        expect(formatTemp(212, true)).toBe('100.0°C');
    });

    it('formats negative temps in Celsius', () => {
        expect(formatTemp(-40, true)).toBe('-40.0°C');
    });

    it('shows one decimal place in Celsius', () => {
        expect(formatTemp(72, true)).toBe('22.2°C');
    });
});

describe('fDeltaToCDelta', () => {
    it('converts a Fahrenheit range without applying the 32°F absolute offset', () => {
        expect(fDeltaToCDelta(18)).toBeCloseTo(10);
    });

    it('preserves the sign of departures from normal', () => {
        expect(fDeltaToCDelta(-9)).toBeCloseTo(-5);
    });
});

describe('formatTempDelta', () => {
    it('formats Fahrenheit temperature differences', () => {
        expect(formatTempDelta(12, false)).toBe('12.0°F');
    });

    it('formats Celsius temperature differences without an absolute-temperature offset', () => {
        expect(formatTempDelta(18, true)).toBe('10.0°C');
    });
});

describe('formatComparisonPeriod', () => {
    it('labels the custom average through the prior year', () => {
        expect(formatComparisonPeriod('2026-09-02')).toBe('1950–2025 avg');
    });

    it('falls back for malformed dates', () => {
        expect(formatComparisonPeriod('unknown')).toBe('historical avg');
        expect(formatComparisonPeriod('2026-not-a-date')).toBe('historical avg');
    });
});

describe('buildTemperaturePath', () => {
    it('starts a new segment after missing observations', () => {
        const path = buildTemperaturePath([70, null, 72], temperature => temperature, 100);

        expect(path).toBe('M0.0,70.0 M100.0,72.0');
    });

    describe('getRecentObservationDate', () => {
        it('uses a legacy payload record date before the generation date', () => {
            expect(getRecentObservationDate({
                asOf: '2026-04-28',
                yesterday: [{ date: '2026-04-27' }],
            })).toBe('2026-04-27');
        });

        it('derives yesterday when a zero-event payload has no date list', () => {
            expect(getRecentObservationDate({
                asOf: '2026-04-28',
                yesterday: [],
            })).toBe('2026-04-27');
        });
    });

    describe('weightedMedianRecordYear', () => {
        it('averages the two middle record years for an even record count', () => {
            expect(weightedMedianRecordYear([
                { year: 1900, highs: 1, lows: 0 },
                { year: 2024, highs: 0, lows: 1 },
            ])).toBe(1962);
        });

        it('returns null when no standing records exist', () => {
            expect(weightedMedianRecordYear([{ year: 2024, highs: 0, lows: 0 }])).toBeNull();
        });
    });
});
