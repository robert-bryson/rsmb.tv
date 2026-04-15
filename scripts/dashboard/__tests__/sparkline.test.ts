import { describe, it, expect } from 'vitest';
import { sparkline } from '../sparkline.js';

describe('sparkline', () => {
    it('returns empty string for empty array', () => {
        expect(sparkline([])).toBe('');
    });

    it('returns single block for single value', () => {
        const result = sparkline([5]);
        expect(result).toHaveLength(1);
        // Single value: range is 0, so (v-min)/range*7 = 0, block index 0
        expect(result).toBe('▁');
    });

    it('returns full range for two extreme values', () => {
        const result = sparkline([0, 100]);
        expect(result).toBe('▁█');
    });

    it('respects width parameter', () => {
        const values = Array.from({ length: 50 }, (_, i) => i);
        const result = sparkline(values, 10);
        expect(result).toHaveLength(10);
    });

    it('uses last N values when data exceeds width', () => {
        // values 0..29, width 5 → uses [25,26,27,28,29]
        const values = Array.from({ length: 30 }, (_, i) => i);
        const result = sparkline(values, 5);
        expect(result).toHaveLength(5);
    });

    it('handles all identical values', () => {
        const result = sparkline([42, 42, 42, 42]);
        // range is 0, falls back to 1, all values get (0/1)*7 = 0 → block 0
        expect(result).toBe('▁▁▁▁');
    });

    it('produces ascending blocks for linear data', () => {
        const values = [0, 1, 2, 3, 4, 5, 6, 7];
        const result = sparkline(values);
        expect(result).toBe('▁▂▃▄▅▆▇█');
    });

    it('defaults to width 20', () => {
        const values = Array.from({ length: 20 }, (_, i) => i);
        const result = sparkline(values);
        expect(result).toHaveLength(20);
    });
});
