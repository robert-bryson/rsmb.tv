import type { PositionAnchor } from 'maplibre-gl';
import { clipSegment, containsPoint, distanceSquared, expandRect, nearestOnSegment, overlaps, type TooltipPoint, type TooltipRect, type TooltipSegment } from './atlasTooltipGeometry';

export interface AtlasTooltipPlacement { point: TooltipPoint; anchor?: PositionAnchor; offset?: number }
export interface AtlasTooltipLayout {
    size: { width: number; height: number };
    obstacles: TooltipRect[];
    preferred?: TooltipPoint;
    previous?: AtlasTooltipPlacement;
}

const anchors: PositionAnchor[] = ['bottom', 'top', 'left', 'right', 'bottom-left', 'bottom-right', 'top-left', 'top-right'];
const offsets = [12, 28, 44];
// Native popup positions are rounded to device pixels. Reserve a small rounding allowance.
const margin = 10;

/** MapLibre's native 10px pointer contributes to the outer box, but not the label body. */
function tooltipBoxes(point: TooltipPoint, anchor: PositionAnchor, offset: number, size: AtlasTooltipLayout['size']) {
    const side = anchor === 'left' || anchor === 'right';
    const width = size.width + (side ? 10 : 0);
    const height = size.height + (side ? 0 : 10);
    const diagonal = Math.round(offset / Math.SQRT2);
    const dx = anchor.includes('left') ? (side ? offset : diagonal) : anchor.includes('right') ? -(side ? offset : diagonal) : 0;
    const dy = anchor.includes('top') ? (anchor === 'top' ? offset : diagonal) : anchor.includes('bottom') ? -(anchor === 'bottom' ? offset : diagonal) : 0;
    const left = point.x + dx - (anchor.includes('right') ? width : anchor.includes('left') ? 0 : width / 2);
    const top = point.y + dy - (anchor.includes('bottom') ? height : anchor.includes('top') ? 0 : height / 2);
    const outer = { left, top, right: left + width, bottom: top + height };
    const body = { left: left + (anchor === 'left' ? 10 : 0), top: top + (anchor.includes('top') ? 10 : 0), right: left + width - (anchor === 'right' ? 10 : 0), bottom: top + height - (anchor.includes('bottom') ? 10 : 0) };
    return { outer, body };
}

// Index projected segments once per layout. Long tracks must not require a full scan for every candidate.
function routeCoverage(segments: TooltipSegment[]) {
    const cell = 96;
    const buckets = new Map<string, number[]>();
    const cells = (box: TooltipRect, visit: (key: string) => void) => {
        for (let x = Math.floor(box.left / cell); x <= Math.floor(box.right / cell); x++) {
            for (let y = Math.floor(box.top / cell); y <= Math.floor(box.bottom / cell); y++) visit(`${x}:${y}`);
        }
    };
    segments.forEach(([a, b], index) => {
        cells({ left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) }, key => {
            const bucket = buckets.get(key);
            if (bucket) bucket.push(index); else buckets.set(key, [index]);
        });
    });
    return (box: TooltipRect, limit: number) => {
        const indices = new Set<number>();
        cells(box, key => buckets.get(key)?.forEach(index => indices.add(index)));
        let covered = 0;
        for (const index of indices) {
            const clipped = clipSegment(...segments[index], box);
            if (clipped) covered += Math.sqrt(distanceSquared(...clipped));
            if (covered > limit + 0.01) return Infinity;
        }
        return covered;
    };
}

function visibleTargets(segments: TooltipSegment[], width: number, height: number, preferred: TooltipPoint, previous?: TooltipPoint) {
    const references = [preferred, ...(previous ? [previous] : [])];
    for (const x of [0.2, 0.5, 0.8]) for (const y of [0.2, 0.5, 0.8]) references.push({ x: width * x, y: height * y });
    const targets: TooltipPoint[] = [];
    for (const reference of references) {
        let closest: TooltipPoint | undefined;
        let distance = Infinity;
        for (const segment of segments) {
            const point = nearestOnSegment(reference, ...segment);
            const next = distanceSquared(reference, point);
            if (next < distance) { closest = point; distance = next; }
        }
        if (closest && !targets.some(point => distanceSquared(point, closest) < 1)) targets.push(closest);
    }
    return targets;
}

/** Slide a directional label along the edge, or inward, while retaining its pointer direction. */
function edgeTargets(base: AtlasTooltipPlacement, anchor: PositionAnchor, offset: number, size: AtlasTooltipLayout['size'], width: number, height: number, obstacles: TooltipRect[]) {
    const { outer } = tooltipBoxes(base.point, anchor, offset, size);
    const xs = [0, margin - outer.left, width - margin - outer.right];
    const ys = [0, margin - outer.top, height - margin - outer.bottom];
    for (const obstacle of obstacles) {
        xs.push(obstacle.left - outer.right - 1, obstacle.right - outer.left + 1);
        ys.push(obstacle.top - outer.bottom - 1, obstacle.bottom - outer.top + 1);
        xs.push(obstacle.left - base.point.x - 1, obstacle.right - base.point.x + 1);
        ys.push(obstacle.top - base.point.y - 1, obstacle.bottom - base.point.y + 1);
    }
    return xs.flatMap(dx => ys.map(dy => ({ x: base.point.x + dx, y: base.point.y + dy })));
}

/** UI clearance is mandatory. Route clearance takes priority over proximity and preferred side. */
export function layoutAtlasTooltip(base: AtlasTooltipPlacement, segments: TooltipSegment[], width: number, height: number, layout: AtlasTooltipLayout): AtlasTooltipPlacement | undefined {
    const { size, previous } = layout;
    if (!(size.width > 0 && size.height > 0 && Number.isFinite(size.width) && Number.isFinite(size.height))) return;
    if (!segments.length && !base.anchor) return;
    const obstacles = layout.obstacles.map(box => expandRect(box, 6));
    const preferred = layout.preferred ?? { x: width / 2, y: height / 2 };
    const targets = segments.length ? visibleTargets(segments, width, height, preferred, previous?.point) : [];
    const coverage = routeCoverage(segments);
    let best: { placement: AtlasTooltipPlacement; occluded: number; covered: number; preference: number } | undefined;
    for (const anchor of segments.length ? anchors : [base.anchor!]) {
        for (const offset of offsets) {
            const points = segments.length ? targets : edgeTargets(base, anchor, offset, size, width, height, obstacles);
            for (const point of points) {
                if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) continue;
                const { outer, body } = tooltipBoxes(point, anchor, offset, size);
                if (outer.left < margin || outer.top < margin || outer.right > width - margin || outer.bottom > height - margin || obstacles.some(box => overlaps(outer, box))) continue;
                const occluded = obstacles.some(box => containsPoint(box, point)) ? 1 : 0;
                const preference = Math.sqrt(distanceSquared(point, segments.length ? preferred : base.point)) + offset - 12
                    + (previous?.anchor && anchor !== previous.anchor ? 8 : 0);
                if (best && (occluded > best.occluded || (occluded === best.occluded && best.covered === 0 && preference >= best.preference))) continue;
                // Include the highlighted line's casing in the clearance, not just its centerline.
                const covered = coverage(expandRect(body, 6), best && occluded === best.occluded ? best.covered : Infinity);
                if (!best || occluded < best.occluded || covered < best.covered - 0.01 || (Math.abs(covered - best.covered) <= 0.01 && preference < best.preference)) {
                    best = { placement: { point, anchor, offset }, occluded, covered, preference };
                }
            }
        }
    }
    return best?.placement;
}
