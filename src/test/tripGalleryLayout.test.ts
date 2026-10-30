import { describe, expect, it } from 'vitest';
import { layoutTripGallery, TRIP_GALLERY_GAP, type TripGalleryPlacement } from '../features/trips/tripGalleryLayout';

const dimensions = (ratios: number[]) => ratios.map(ratio => ({ width: ratio * 1000, height: 1000 }));
const length = (value: { fraction: number; pixels: number }, width = 1152) => value.fraction * width + value.pixels;

function assertGeometry(ratios: number[], placements: TripGalleryPlacement[], width: number) {
    const rows = Math.max(...placements.map(tile => tile.row + tile.rowSpan - 1));
    const rowHeights: number[] = [];
    for (let row = 1; row <= rows; row++) {
        const tiles = placements.flatMap((tile, index) => tile.row <= row && tile.row + tile.rowSpan > row ? [{ ...tile, index }] : []);
        expect(tiles.length).toBeGreaterThan(0);
        let edge = 0;
        for (const tile of tiles) {
            expect(length(tile.offset, width)).toBeCloseTo(edge, 6);
            expect(length(tile.width, width)).toBeGreaterThan(0);
            edge += length(tile.width, width) + TRIP_GALLERY_GAP;
            if (tile.rowSpan === 1) {
                const height = length(tile.width, width) / ratios[tile.index];
                if (rowHeights[row]) expect(height).toBeCloseTo(rowHeights[row], 6);
                rowHeights[row] = height;
            }
        }
        expect(edge - TRIP_GALLERY_GAP).toBeCloseTo(width, 6);
    }
    placements.forEach((tile, index) => {
        if (tile.rowSpan !== 2) return;
        expect(length(tile.width, width) / ratios[index])
            .toBeCloseTo(rowHeights[tile.row] + TRIP_GALLERY_GAP + rowHeights[tile.row + 1], 6);
    });
}

describe('adaptive trip gallery geometry', () => {
    it.each([false, true])('fills a two-photo row with equal heights and proportional widths (wide=%s)', wide => {
        const ratios = [0.75, 4 / 3];
        const layout = layoutTripGallery(dimensions(ratios), wide);
        expect(layout.map(tile => tile.row)).toEqual([1, 1]);
        expect(length(layout[0].width) / length(layout[1].width)).toBeCloseTo(ratios[0] / ratios[1]);
        assertGeometry(ratios, layout, wide ? 1152 : 358);
    });

    it('uses a leading portrait beside two rows when that improves the proportions', () => {
        const ratios = [2 / 3, 1.5, 1.5, 4 / 3, 1.5];
        const layout = layoutTripGallery(dimensions(ratios), true);
        expect(layout[0]).toMatchObject({ row: 1, rowSpan: 2 });
        expect(new Set(layout.slice(1).map(tile => tile.row)).size).toBe(2);
        for (const width of [608, 900, 1152]) assertGeometry(ratios, layout, width);
        expect(layoutTripGallery(dimensions(ratios), false).every(tile => tile.rowSpan === 1)).toBe(true);
    });

    it('keeps a six-photo portrait group within two rows instead of choosing a taller partial collage', () => {
        const ratios = [2 / 3, 1.5, 1.5, 1.5, 1.5, 1.5];
        const layout = layoutTripGallery(dimensions(ratios), true);
        expect(layout[0]).toMatchObject({ row: 1, rowSpan: 2 });
        expect(Math.max(...layout.map(tile => tile.row + tile.rowSpan - 1))).toBe(2);
        expect(length(layout[0].width)).toBeGreaterThan(300);
        assertGeometry(ratios, layout, 1152);
    });

    it('gives panoramas their own row without distorting neighbors', () => {
        const ratios = [1.5, 5.73, 2 / 3, 1.5];
        const layout = layoutTripGallery(dimensions(ratios), true);
        expect(layout[1].width).toEqual({ fraction: 1, pixels: 0 });
        expect(layout.filter(tile => tile.row === layout[1].row)).toHaveLength(1);
        assertGeometry(ratios, layout, 1152);
    });

    it.each([false, true])('retains every photo with filled rows across varied counts and ratios (wide=%s)', wide => {
        const sample = [0.67, 1.5, 1.33, 1.5, 1.33, 1.5, 0.75, 1.33, 5.73, 0.2, 1, 1.5];
        expect(layoutTripGallery([], wide)).toEqual([]);
        for (let count = 1; count <= 85; count++) {
            const ratios = Array.from({ length: count }, (_, index) => sample[index % sample.length]);
            const layout = layoutTripGallery(dimensions(ratios), wide);
            expect(layout).toHaveLength(count);
            expect(layout.map(tile => tile.row)).toEqual(layout.map(tile => tile.row).sort((a, b) => a - b));
            assertGeometry(ratios, layout, wide ? 1152 : 288);
        }
    });
});
