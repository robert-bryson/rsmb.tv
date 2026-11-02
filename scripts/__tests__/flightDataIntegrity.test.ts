import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCSV, runQAQC, toCSV } from '../sync-flights.js';

describe('flight data integrity', () => {
    afterEach(() => vi.useRealTimers());

    it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])('preserves an unknown airline named %s as text', airline => {
        const result = runQAQC([
            ['date', 'airline', 'origin', 'destination'],
            ['1/1/2024', airline, 'SEA', 'LAX'],
        ]);
        expect(result.errors).toEqual([]);
        expect(result.rows[1][1]).toBe(airline);
        expect(parseCSV(toCSV(result.rows))[1][1]).toBe(airline);
    });

    it.each([
        ['2/30/2024', 'calendar date'],
        ['1/1/1989', 'Year too old'],
        ['11/3/2027', 'more than one year in the future'],
        ['2024-02-29T12:00:00Z', 'date must be'],
    ])('rejects an invalid departure date %s before publication', (date, error) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-02T12:00:00Z'));
        const result = runQAQC([['date', 'airline', 'origin', 'destination'], [date, 'Test', 'SEA', 'LAX']]);
        expect(result.errors).toContainEqual(expect.stringContaining(error));
    });

    it.each(['', 'SE', 'SEA!', 'SEATT'])('rejects invalid airport syntax %s', origin => {
        const result = runQAQC([['date', 'airline', 'origin', 'destination'], ['1/1/2024', 'Test', origin, origin]]);
        expect(result.errors).toContainEqual(expect.stringContaining('Origin -'));
        expect(result.errors).toContainEqual(expect.stringContaining('Destination -'));
    });

    it('rejects a route whose normalized endpoints are identical', () => {
        const result = runQAQC([['date', 'airline', 'origin', 'destination'], ['1/1/2024', 'Test', ' sea ', 'SEA']]);
        expect(result.errors).toContain('Row 2: Origin and destination are the same (SEA)');
    });

    it('reports suspicious durations, blank airlines, and duplicate routes without dropping their evidence', () => {
        const rows = [
            ['date', 'airline', 'origin', 'destination', 'durationMinutes', 'durationKind', 'durationSource'],
            ['2024-01-01', '', 'sea', 'lax', '1500', 'scheduled-block', 'itinerary'],
            ['1/1/2024', 'Test', 'SEA', 'LAX', '', '', ''],
        ];
        const result = runQAQC(rows);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual(expect.arrayContaining([
            expect.stringContaining('Duration exceeds 24 hours'),
            expect.stringContaining('Empty airline name'),
            expect.stringContaining('Possible duplicate of row 2'),
        ]));
        expect(result.rows[1]).toEqual(['1/1/2024', '', 'SEA', 'LAX', '1500', 'scheduled-block', 'itinerary']);
        expect(parseCSV(toCSV(result.rows))).toEqual(result.rows);
    });
});
