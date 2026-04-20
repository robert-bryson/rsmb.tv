import { describe, it, expect } from 'vitest';
import { parseDateString, sortDatesDescending } from '../features/flights/utils';

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
