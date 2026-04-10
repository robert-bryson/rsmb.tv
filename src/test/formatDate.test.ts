import { describe, it, expect } from 'vitest';
import { formatDate } from '../utils/formatDate';

describe('formatDate', () => {
    it('formats a standard ISO date', () => {
        expect(formatDate('2024-01-15')).toBe('January 15, 2024');
    });

    it('formats another valid date', () => {
        expect(formatDate('1999-12-31')).toBe('December 31, 1999');
    });

    it('returns the original string for an invalid date', () => {
        expect(formatDate('not-a-date')).toBe('not-a-date');
    });

    it('returns empty string for empty input', () => {
        expect(formatDate('')).toBe('');
    });
});
