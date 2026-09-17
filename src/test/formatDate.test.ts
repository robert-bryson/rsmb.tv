import { describe, it, expect } from 'vitest';
import { formatDate, formatDateRange } from '../utils/formatDate';

describe('formatDate', () => {
    it('formats a standard ISO date', () => {
        expect(formatDate('2024-01-15')).toBe('January 15, 2024');
    });

    it('formats another valid date', () => {
        expect(formatDate('1999-12-31')).toBe('December 31, 1999');
    });

    it('accepts four-digit years below 100', () => {
        expect(formatDate('0099-01-15')).toBe('January 15, 99');
    });

    it('returns the original string for an invalid date', () => {
        expect(formatDate('not-a-date')).toBe('not-a-date');
        expect(formatDate('2024-02-30')).toBe('2024-02-30');
    });

    it('returns empty string for empty input', () => {
        expect(formatDate('')).toBe('');
    });

    it('handles leap year date', () => {
        expect(formatDate('2024-02-29')).toBe('February 29, 2024');
    });

    it('handles date at year boundary', () => {
        expect(formatDate('2024-12-31')).toBe('December 31, 2024');
        expect(formatDate('2024-01-01')).toBe('January 1, 2024');
    });
});

describe('formatDateRange', () => {
    it('compacts dates in the same month', () => {
        expect(formatDateRange('2024-02-17', '2024-02-20')).toBe('February 17–20, 2024');
    });

    it('compacts dates in different months of the same year', () => {
        expect(formatDateRange('2024-02-28', '2024-03-02')).toBe('February 28 – March 2, 2024');
    });

    it('formats a single date once', () => {
        expect(formatDateRange('2024-02-17', '2024-02-17')).toBe('February 17, 2024');
    });

    it('keeps years on cross-year ranges', () => {
        expect(formatDateRange('2023-12-30', '2024-01-02')).toBe('December 30, 2023 – January 2, 2024');
    });

    it('does not compact invalid or reversed ranges', () => {
        expect(formatDateRange('not-a-date', '2024-02-20')).toBe('not-a-date – February 20, 2024');
        expect(formatDateRange('2024-02-20', '2024-02-17')).toBe('February 20, 2024 – February 17, 2024');
    });
});
