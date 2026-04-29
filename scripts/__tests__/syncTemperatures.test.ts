import { describe, expect, it } from 'vitest';
import {
    buildRecentRecords,
    filterBrokenRecordsForDates,
    mergeStationIndexes,
    parseBackfillDays,
    validateRecentRecords,
} from '../sync-temperatures.js';

function record(date: string, type: 'high' | 'low', tempF: number) {
    return { date, type, tempF };
}

describe('temperature sync recent-record helpers', () => {
    it('filters stale summaries to the requested dates only', () => {
        const recentRecords = {
            last7Days: [
                record('2026-04-27', 'high', 91),
                record('2026-04-26', 'low', 22),
                record('2026-03-01', 'high', 87),
            ],
        };

        expect(filterBrokenRecordsForDates(recentRecords, ['2026-04-27', '2026-04-26']))
            .toEqual([
                record('2026-04-27', 'high', 91),
                record('2026-04-26', 'low', 22),
            ]);
    });

    it('ignores malformed cached records while filtering previous summaries', () => {
        const expected = record('2026-04-27', 'high', 93);
        const recentRecords = {
            last7Days: [
                expected,
                null,
                { type: 'low', tempF: 25 },
                record('2026-04-20', 'low', 19),
            ],
        };

        expect(filterBrokenRecordsForDates(recentRecords, ['2026-04-27'])).toEqual([expected]);
        expect(filterBrokenRecordsForDates({}, ['2026-04-27'])).toEqual([]);
    });

    it('builds a bounded rolling recent-record window', () => {
        const recentRecords = buildRecentRecords(
            '2026-04-28',
            '2026-04-27',
            [
                record('2026-04-27', 'low', 25),
                record('2026-04-27', 'high', 93),
                record('2026-04-26', 'high', 88),
                record('2026-04-20', 'high', 99),
            ],
            ['2026-04-27', '2026-04-26'],
        );

        expect(recentRecords.asOf).toBe('2026-04-28');
        expect(recentRecords.yesterday.map(item => item.date)).toEqual(['2026-04-27', '2026-04-27']);
        expect(recentRecords.last7Days.map(item => item.date)).toEqual(['2026-04-27', '2026-04-26', '2026-04-27']);
    });

    it('rejects recent-record output outside the requested window', () => {
        expect(() => validateRecentRecords({
            asOf: '2026-04-28',
            yesterday: [],
            last7Days: [record('2026-04-20', 'high', 99)],
        }, ['2026-04-27'])).toThrow(/outside the requested window/);
    });

    it('rejects malformed or stale yesterday sections', () => {
        expect(() => validateRecentRecords({
            asOf: '2026-04-28',
            yesterday: [record('2026-04-26', 'high', 88)],
            last7Days: [],
        }, ['2026-04-27', '2026-04-26'])).toThrow(/yesterday includes dates other than 2026-04-27/);

        expect(() => validateRecentRecords({
            asOf: '2026-04-28',
            yesterday: [],
            last7Days: [null],
        }, ['2026-04-27'])).toThrow(/last7Days includes records without valid dates/);
    });
});

describe('temperature sync station index helpers', () => {
    it('merges valid stations into the previous catalog by uid', () => {
        const previous = new Map<string | number, { uid: number | string; name: string }>([
            [1, { uid: 1, name: 'Old One' }],
            [2, { uid: 2, name: 'Old Two' }],
            ['bad', { uid: 'bad', name: 'Corrupt Station' }],
        ]);
        const current = new Map<string | number, { uid: number | string; name: string } | null>([
            [2, { uid: 2, name: 'New Two' }],
            ['3', { uid: '3', name: 'New Three' }],
            [4, null],
        ]);

        const merged = mergeStationIndexes(previous, current);

        expect(merged.size).toBe(3);
        expect(merged.get(1)?.name).toBe('Old One');
        expect(merged.get(2)?.name).toBe('New Two');
        expect(merged.get(3)?.name).toBe('New Three');
        expect(merged.get(3)?.uid).toBe(3);
    });
});

describe('temperature sync CLI parsing', () => {
    it('uses the default backfill window unless explicitly overridden', () => {
        expect(parseBackfillDays(['node', 'scripts/sync-temperatures.js'])).toBe(7);
        expect(parseBackfillDays(['node', 'scripts/sync-temperatures.js', '--backfill-days', '30'])).toBe(30);
        expect(parseBackfillDays(['node', 'scripts/sync-temperatures.js', '--backfill-days=14', '--recent-only'])).toBe(14);
    });

    it('rejects missing, malformed, or excessive backfill windows', () => {
        expect(() => parseBackfillDays(['node', 'script', '--backfill-days', '--recent-only'])).toThrow(/Invalid --backfill-days/);
        expect(() => parseBackfillDays(['node', 'script', '--backfill-days=0'])).toThrow(/Invalid --backfill-days/);
        expect(() => parseBackfillDays(['node', 'script', '--backfill-days=367'])).toThrow(/Invalid --backfill-days/);
    });
});
