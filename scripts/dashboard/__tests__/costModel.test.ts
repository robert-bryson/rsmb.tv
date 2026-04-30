import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
    buildRemainingForecastInput,
    calculateForecastTotal,
    COST_CACHE_FILE,
    COST_CACHE_VERSION,
    getCostWindows,
    parseForecastAmount,
    parseGroupedCosts,
    parseMonthlyTotals,
    readCostCache,
    writeCostCache,
} from '../costModel.js';

describe('getCostWindows', () => {
    it('uses calendar month starts on the last day of a long month', () => {
        const windows = getCostWindows(new Date('2026-04-30T15:24:22Z'));

        expect(windows.twoMonthsAgoStart).toBe('2026-02-01');
        expect(windows.lastMonthStart).toBe('2026-03-01');
        expect(windows.monthStart).toBe('2026-04-01');
        expect(windows.nextMonthStart).toBe('2026-05-01');
        expect(windows.twoMonthsAgoLabel).toBe('Feb 2026');
        expect(windows.lastMonthLabel).toBe('Mar 2026');
    });

    it('rolls back correctly across a year boundary (Jan 1)', () => {
        const windows = getCostWindows(new Date('2026-01-01T00:00:00Z'));

        expect(windows.twoMonthsAgoStart).toBe('2025-11-01');
        expect(windows.lastMonthStart).toBe('2025-12-01');
        expect(windows.monthStart).toBe('2026-01-01');
        expect(windows.nextMonthStart).toBe('2026-02-01');
        expect(windows.twoMonthsAgoLabel).toBe('Nov 2025');
        expect(windows.lastMonthLabel).toBe('Dec 2025');
    });
});

describe('buildRemainingForecastInput', () => {
    it('requests a daily forecast for the remaining days, not a monthly forecast', () => {
        const windows = getCostWindows(new Date('2026-04-30T15:24:22Z'));

        expect(buildRemainingForecastInput(windows)).toMatchObject({
            TimePeriod: { Start: '2026-04-30', End: '2026-05-01' },
            Granularity: 'DAILY',
            Metric: 'BLENDED_COST',
        });
    });

    it('returns a full-month forecast on the first of the month', () => {
        const windows = getCostWindows(new Date('2026-05-01T00:00:00Z'));

        expect(buildRemainingForecastInput(windows)).toMatchObject({
            TimePeriod: { Start: '2026-05-01', End: '2026-06-01' },
            Granularity: 'DAILY',
        });
    });
});

describe('calculateForecastTotal', () => {
    it('adds actual MTD cost to the daily remaining forecast', () => {
        expect(calculateForecastTotal(31.0971521523, 0.8425042723)).toBeCloseTo(31.9396564246);
    });

    it('returns the remaining forecast as-is when MTD is zero (first of month)', () => {
        expect(calculateForecastTotal(0, 5.42)).toBeCloseTo(5.42);
    });

    it('does not invent a final forecast when actuals or forecast are missing', () => {
        expect(calculateForecastTotal(null, 0.84)).toBeNull();
        expect(calculateForecastTotal(31.1, null)).toBeNull();
        expect(calculateForecastTotal(null, null)).toBeNull();
    });
});

describe('Cost Explorer parsers', () => {
    it('parses grouped blended service costs', () => {
        const costs = parseGroupedCosts({
            ResultsByTime: [
                {
                    Groups: [
                        { Keys: ['AWS WAF'], Metrics: { BlendedCost: { Amount: '9.53' } } },
                        { Keys: ['Tiny'], Metrics: { BlendedCost: { Amount: '0.0004' } } },
                    ],
                },
            ],
        });

        expect(costs).toEqual({ services: { 'AWS WAF': 9.53 }, total: 9.53 });
    });

    it('accumulates service costs across multiple time periods', () => {
        const costs = parseGroupedCosts({
            ResultsByTime: [
                { Groups: [{ Keys: ['Amazon S3'], Metrics: { BlendedCost: { Amount: '5.00' } } }] },
                { Groups: [{ Keys: ['Amazon S3'], Metrics: { BlendedCost: { Amount: '3.00' } } }] },
            ],
        });

        expect(costs).toEqual({ services: { 'Amazon S3': 8.0 }, total: 8.0 });
    });

    it('returns an empty result when given null', () => {
        expect(parseGroupedCosts(null)).toEqual({ services: {}, total: 0 });
    });

    it('parses previous-month and current-month totals by period start', () => {
        const totals = parseMonthlyTotals({
            ResultsByTime: [
                {
                    TimePeriod: { Start: '2026-03-01', End: '2026-04-01' },
                    Total: { BlendedCost: { Amount: '20.81' } },
                },
                {
                    TimePeriod: { Start: '2026-04-01', End: '2026-04-30' },
                    Total: { BlendedCost: { Amount: '31.10' } },
                },
            ],
        }, '2026-04-01');

        expect(totals).toEqual({ lastMonth: 20.81, mtdAmount: 31.1 });
    });

    it('returns null for both fields when given null', () => {
        expect(parseMonthlyTotals(null, '2026-04-01')).toEqual({ lastMonth: null, mtdAmount: null });
    });

    it('returns null for lastMonth when only the current period is present', () => {
        const totals = parseMonthlyTotals({
            ResultsByTime: [
                {
                    TimePeriod: { Start: '2026-04-01', End: '2026-04-30' },
                    Total: { BlendedCost: { Amount: '31.10' } },
                },
            ],
        }, '2026-04-01');

        expect(totals).toEqual({ lastMonth: null, mtdAmount: 31.1 });
    });

    it('parses forecast totals defensively', () => {
        expect(parseForecastAmount({ Total: { Amount: '0.8425', Unit: 'USD' } })).toBe(0.8425);
        expect(parseForecastAmount({ Total: { Amount: 'not-a-number' } })).toBeNull();
        expect(parseForecastAmount(null)).toBeNull();
    });
});

describe('readCostCache', () => {
    const validData = {
        lastMonth: 20.81,
        lastMonthLabel: 'Mar',
        mtdAmount: 31.1,
        forecastAmount: 31.94,
        forecastRemainingAmount: 0.84,
    };

    function writeCache(content: string): void {
        mkdirSync(dirname(COST_CACHE_FILE), { recursive: true });
        writeFileSync(COST_CACHE_FILE, content, 'utf-8');
    }

    afterEach(() => {
        if (existsSync(COST_CACHE_FILE)) rmSync(COST_CACHE_FILE);
    });

    it('returns cached data when version and date both match', () => {
        writeCache(JSON.stringify({ version: COST_CACHE_VERSION, date: '2026-04-30', data: validData }));

        expect(readCostCache(new Date('2026-04-30T10:00:00Z'))).toEqual(validData);
    });

    it('returns null when the cache file does not exist', () => {
        expect(readCostCache(new Date('2026-04-30T10:00:00Z'))).toBeNull();
    });

    it('returns null when the cached date is stale', () => {
        writeCache(JSON.stringify({ version: COST_CACHE_VERSION, date: '2026-04-29', data: validData }));

        expect(readCostCache(new Date('2026-04-30T10:00:00Z'))).toBeNull();
    });

    it('returns null when the cache version is outdated', () => {
        writeCache(JSON.stringify({ version: COST_CACHE_VERSION - 1, date: '2026-04-30', data: validData }));

        expect(readCostCache(new Date('2026-04-30T10:00:00Z'))).toBeNull();
    });

    it('returns null when the cache file contains invalid JSON', () => {
        writeCache('not valid json{{{');

        expect(readCostCache(new Date('2026-04-30T10:00:00Z'))).toBeNull();
    });
});

describe('writeCostCache', () => {
    const validData = {
        lastMonth: 20.81,
        lastMonthLabel: 'Mar',
        mtdAmount: 31.1,
        forecastAmount: 31.94,
        forecastRemainingAmount: 0.84,
    };

    afterEach(() => {
        if (existsSync(COST_CACHE_FILE)) rmSync(COST_CACHE_FILE);
    });

    it('writes the correct version, date, and data to the cache file', () => {
        writeCostCache(validData, new Date('2026-04-30T10:00:00Z'));

        const written = JSON.parse(readFileSync(COST_CACHE_FILE, 'utf-8'));
        expect(written).toEqual({ version: COST_CACHE_VERSION, date: '2026-04-30', data: validData });
    });

    it('does not throw when called twice on the same day', () => {
        expect(() => {
            writeCostCache(validData, new Date('2026-04-30T10:00:00Z'));
            writeCostCache(validData, new Date('2026-04-30T12:00:00Z'));
        }).not.toThrow();
    });
});
