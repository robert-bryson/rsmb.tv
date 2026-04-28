import { describe, expect, it } from 'vitest';
import {
    maxScaleForFilter,
    minScaleForFilter,
    scaleFilterBounds,
} from '../features/tornadoes/constants';
import type { TornadoScaleFilter } from '../features/tornadoes/types';

// ---------------------------------------------------------------------------
// scaleFilterBounds
// ---------------------------------------------------------------------------

describe('scaleFilterBounds', () => {
    it("'all' passes every valid scale including unknown (-1)", () => {
        const { min, max } = scaleFilterBounds('all');
        expect(min).toBe(-1);
        expect(max).toBe(5);
        // Any scale from -1..5 must be within [min, max]
        for (const scale of [-1, 0, 1, 2, 3, 4, 5]) {
            expect(scale >= min && scale <= max).toBe(true);
        }
    });

    it.each([
        ['ef0', 0, 0],
        ['ef1', 1, 1],
        ['ef2', 2, 2],
        ['ef3', 3, 3],
        ['ef4', 4, 4],
        ['ef5', 5, 5],
    ] as [TornadoScaleFilter, number, number][])(
        "'%s' returns an exact single-value range [%i, %i]",
        (filter, expectedMin, expectedMax) => {
            const { min, max } = scaleFilterBounds(filter);
            expect(min).toBe(expectedMin);
            expect(max).toBe(expectedMax);
            expect(min).toBe(max);
        },
    );

    it.each([
        ['ef1plus', 1, 5],
        ['ef2plus', 2, 5],
        ['ef3plus', 3, 5],
    ] as [TornadoScaleFilter, number, number][])(
        "'%s' returns a half-open range starting at %i",
        (filter, expectedMin, expectedMax) => {
            const { min, max } = scaleFilterBounds(filter);
            expect(min).toBe(expectedMin);
            expect(max).toBe(expectedMax);
        },
    );

    it('exact filters exclude scales outside their range', () => {
        const { min, max } = scaleFilterBounds('ef2');
        expect(1 >= min && 1 <= max).toBe(false); // EF1 excluded
        expect(3 >= min && 3 <= max).toBe(false); // EF3 excluded
        expect(2 >= min && 2 <= max).toBe(true);  // EF2 passes
    });

    it('ef2plus filter excludes EF0/EF1 but includes EF2-5', () => {
        const { min, max } = scaleFilterBounds('ef2plus');
        for (const scale of [0, 1]) {
            expect(scale >= min && scale <= max).toBe(false);
        }
        for (const scale of [2, 3, 4, 5]) {
            expect(scale >= min && scale <= max).toBe(true);
        }
    });

    it('ef2plus filter excludes unknown scale (-1)', () => {
        const { min, max } = scaleFilterBounds('ef2plus');
        expect(-1 >= min && -1 <= max).toBe(false);
    });

    it("'all' filter includes unknown scale (-1)", () => {
        const { min, max } = scaleFilterBounds('all');
        expect(-1 >= min && -1 <= max).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// minScaleForFilter (thin wrapper — verify delegation to scaleFilterBounds)
// ---------------------------------------------------------------------------

describe('minScaleForFilter', () => {
    it('returns the same min as scaleFilterBounds for every filter', () => {
        const filters: TornadoScaleFilter[] = [
            'all', 'ef0', 'ef1', 'ef2', 'ef3', 'ef4', 'ef5',
            'ef1plus', 'ef2plus', 'ef3plus',
        ];
        for (const filter of filters) {
            expect(minScaleForFilter(filter)).toBe(scaleFilterBounds(filter).min);
        }
    });
});

// ---------------------------------------------------------------------------
// maxScaleForFilter (thin wrapper — verify delegation to scaleFilterBounds)
// ---------------------------------------------------------------------------

describe('maxScaleForFilter', () => {
    it('returns the same max as scaleFilterBounds for every filter', () => {
        const filters: TornadoScaleFilter[] = [
            'all', 'ef0', 'ef1', 'ef2', 'ef3', 'ef4', 'ef5',
            'ef1plus', 'ef2plus', 'ef3plus',
        ];
        for (const filter of filters) {
            expect(maxScaleForFilter(filter)).toBe(scaleFilterBounds(filter).max);
        }
    });
});
