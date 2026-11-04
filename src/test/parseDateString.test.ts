import { describe, it, expect } from 'vitest';
import { formatFlightYear, formatFlightYears, parseDateString, sortDatesDescending } from '../features/flights/utils';

describe('formatFlightYear', () => {
    it.each([
        ['5/14/2022', '2022'], ['2025-12-31', '2025'], ['2024-01-01', '2024'],
        ['', 'Unknown year'], ['invalid <date>', 'Unknown year'], [undefined, 'Unknown year'],
        [null, 'Unknown year'], ['2/29/2023', 'Unknown year'], ['2024-13-01', 'Unknown year'],
        ['1/1/2024<script>', 'Unknown year'], ['1/1/2024/extra', 'Unknown year'],
        ['12/31/0000', 'Unknown year'], ['2024-02-29', '2024'],
    ])('formats %s without exposing the original date', (date, expected) => {
        expect(formatFlightYear(date)).toBe(expected);
    });
});

describe('formatFlightYears', () => {
    it('puts unavailable years after valid years and removes duplicates', () => {
        expect(formatFlightYears(['invalid', '1/1/2024', '2025-02-28', '2024-12-31', 'invalid'], 3))
            .toBe('2025, 2024, Unknown year');
    });

    it('shows an unavailable year for an empty set of dates', () => {
        expect(formatFlightYears([], 3)).toBe('Unknown year');
    });
});

describe('parseDateString', () => {
    it('parses M/D/YYYY format', () => {
        const d = parseDateString('6/15/2024');
        expect(d.getFullYear()).toBe(2024);
        expect(d.getMonth()).toBe(5); // zero-indexed
        expect(d.getDate()).toBe(15);
    });

    it('parses MM/DD/YYYY format', () => {
        const d = parseDateString('12/31/2020');
        expect(d.getFullYear()).toBe(2020);
        expect(d.getMonth()).toBe(11);
        expect(d.getDate()).toBe(31);
    });

    it('parses single-digit month and day', () => {
        const d = parseDateString('1/1/2000');
        expect(d.getFullYear()).toBe(2000);
        expect(d.getMonth()).toBe(0);
        expect(d.getDate()).toBe(1);
    });

    it('correctly parses zero-padded months (no octal issue)', () => {
        // This verifies parseInt uses radix 10 — "08" and "09" must not be treated as octal
        const d = parseDateString('08/09/2020');
        expect(d.getMonth()).toBe(7); // August, zero-indexed
        expect(d.getDate()).toBe(9);
    });
});

describe('sortDatesDescending', () => {
    it('sorts dates newest first', () => {
        const dates = ['1/1/2020', '6/15/2024', '3/10/2022'];
        expect(sortDatesDescending(dates)).toEqual([
            '6/15/2024',
            '3/10/2022',
            '1/1/2020',
        ]);
    });

    it('handles same-year dates', () => {
        const dates = ['1/5/2024', '12/1/2024', '6/15/2024'];
        expect(sortDatesDescending(dates)).toEqual([
            '12/1/2024',
            '6/15/2024',
            '1/5/2024',
        ]);
    });

    it('does not mutate the original array', () => {
        const dates = ['1/1/2020', '6/15/2024'];
        const original = [...dates];
        sortDatesDescending(dates);
        expect(dates).toEqual(original);
    });

    it('handles empty array', () => {
        expect(sortDatesDescending([])).toEqual([]);
    });

    it('handles single element', () => {
        expect(sortDatesDescending(['5/5/2023'])).toEqual(['5/5/2023']);
    });
});
