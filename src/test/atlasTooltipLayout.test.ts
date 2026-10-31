import { describe, expect, it } from 'vitest';
import { layoutAtlasTooltip, type AtlasTooltipLayout } from '../features/trips/atlas/atlasTooltipLayout';
import type { TooltipSegment } from '../features/trips/atlas/atlasTooltipGeometry';
import { atlasTooltipPlacement } from '../features/trips/atlas/atlasTooltipPlacement';

const base = { point: { x: 300, y: 200 } };
const layout: AtlasTooltipLayout = { size: { width: 180, height: 50 }, obstacles: [] };
const horizontal: TooltipSegment[] = [[{ x: 20, y: 200 }, { x: 580, y: 200 }]];

describe('measured Atlas tooltip layout', () => {
    it('puts the label below a loop when the space above the anchor contains the highlighted route', () => {
        const segments: TooltipSegment[] = [
            [{ x: 260, y: 200 }, { x: 340, y: 200 }], [{ x: 340, y: 200 }, { x: 340, y: 100 }],
            [{ x: 340, y: 100 }, { x: 260, y: 100 }], [{ x: 260, y: 100 }, { x: 260, y: 200 }],
        ];
        expect(layoutAtlasTooltip(base, segments, 600, 400, layout)).toEqual({ ...base, anchor: 'top', offset: 12 });
    });

    it('flips away from UI instead of rendering under it', () => {
        const obstacles = [{ left: 180, top: 120, right: 420, bottom: 190 }];
        expect(layoutAtlasTooltip(base, horizontal, 600, 400, { ...layout, obstacles })?.anchor).toBe('top');
    });

    it('uses the pointer location as a preference while retaining an anchor on the real track', () => {
        const placement = layoutAtlasTooltip(base, horizontal, 600, 400, { ...layout, preferred: { x: 450, y: 203 } });
        expect(placement?.point).toEqual({ x: 450, y: 200 });
    });

    it('moves along the track to find space and avoids pointing into an obstruction', () => {
        const obstacles = [{ left: 250, top: 80, right: 350, bottom: 320 }];
        const placement = layoutAtlasTooltip(base, horizontal, 600, 400, { ...layout, obstacles });
        expect(placement?.point.y).toBe(200);
        expect(Math.abs(placement!.point.x - 300)).toBeGreaterThan(50);
    });

    it('retains the previous side when both sides are equally clear', () => {
        expect(layoutAtlasTooltip(base, horizontal, 600, 400, { ...layout, previous: { ...base, anchor: 'top' } })?.anchor).toBe('top');
    });

    it('covers less track even when every possible label position covers part of a dense route', () => {
        const segments: TooltipSegment[] = Array.from({ length: 51 }, (_, index) => [{ x: index * 12, y: 0 }, { x: index * 12, y: 400 }]);
        const placement = layoutAtlasTooltip(base, segments, 600, 400, { ...layout, previous: { ...base, anchor: 'bottom' } });
        // Including casing clearance, centered above/below positions cover 17 lines; the side covers 16.
        expect(placement).toEqual({ ...base, anchor: 'left', offset: 12 });
    });

    it('allows a larger pointer gap to keep a short track and UI clear', () => {
        const segments: TooltipSegment[] = [[{ x: 300, y: 62 }, { x: 300, y: 65 }]];
        const obstacles = [{ left: 0, top: 0, right: 600, bottom: 80 }];
        const placement = layoutAtlasTooltip({ point: segments[0][0] }, segments, 600, 400, { ...layout, obstacles });
        expect(placement?.anchor).toBe('top');
        expect(placement?.offset).toBeGreaterThan(12);
    });

    it('slides an off-screen direction clear of a toolbar without changing the pointer direction', () => {
        const point = { x: 588, y: 20 };
        const obstacles = [{ left: 460, top: 12, right: 588, bottom: 56 }];
        const placement = layoutAtlasTooltip({ point, anchor: 'right' }, [], 600, 400, { ...layout, obstacles });
        expect(placement?.anchor).toBe('right');
        expect(placement!.point.y).toBeGreaterThan(point.y);
    });

    it('keeps a corner direction inside a short phone viewport and clear of bottom UI', () => {
        const placement = layoutAtlasTooltip({ point: { x: 378, y: 168 }, anchor: 'bottom-right' }, [], 390, 180,
            { ...layout, obstacles: [{ left: 150, top: 136, right: 390, bottom: 180 }] });
        expect(placement?.anchor).toBe('bottom-right');
        expect(placement!.point.y).toBeLessThan(136);
    });

    it('keeps a corner label near the track direction when attribution covers its original anchor', () => {
        const placement = layoutAtlasTooltip({ point: { x: 908, y: 708 }, anchor: 'bottom-right' }, [], 920, 720,
            { ...layout, obstacles: [{ left: 676, top: 704, right: 920, bottom: 720 }, { left: 0, top: 328, right: 44, bottom: 392 }] });
        expect(placement?.anchor).toBe('bottom-right');
        expect(placement!.point.y).toBeGreaterThan(680);
        expect(placement!.point.y).toBeLessThan(698);
    });

    it('omits the label if the UI leaves no room for its full bounds', () => {
        const obstacles = [{ left: 0, top: 0, right: 600, bottom: 400 }];
        expect(layoutAtlasTooltip(base, horizontal, 600, 400, { ...layout, obstacles })).toBeUndefined();
        expect(layoutAtlasTooltip(base, horizontal, 100, 40, layout)).toBeUndefined();
    });

    it('rejects absent directions and invalid measured dimensions', () => {
        expect(layoutAtlasTooltip(base, [], 600, 400, layout)).toBeUndefined();
        for (const width of [0, -1, Infinity, NaN]) {
            expect(layoutAtlasTooltip(base, horizontal, 600, 400, { ...layout, size: { width, height: 50 } })).toBeUndefined();
        }
    });

    it('passes projected, clipped tracks into collision avoidance without joining their gaps', () => {
        const placement = atlasTooltipPlacement({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [
            [[-30, 200], [630, 200]], [[100, 100], [100, 120]],
        ] } }, { width: 600, height: 400, project: ([x, y]) => ({ x, y }), popup: { ...layout, obstacles: [{ left: 180, top: 120, right: 420, bottom: 190 }] } });
        expect(placement?.anchor).toBe('top');
        expect(placement?.point).toEqual(base.point);
    });
});
