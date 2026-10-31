export interface TooltipPoint { x: number; y: number }
export interface TooltipRect { left: number; top: number; right: number; bottom: number }
export type TooltipSegment = [TooltipPoint, TooltipPoint];

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const distanceSquared = (a: TooltipPoint, b: TooltipPoint) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const interpolate = (a: TooltipPoint, b: TooltipPoint, t: number): TooltipPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const expandRect = (box: TooltipRect, gap: number): TooltipRect => ({ left: box.left - gap, top: box.top - gap, right: box.right + gap, bottom: box.bottom + gap });
export const overlaps = (a: TooltipRect, b: TooltipRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
export const containsPoint = (box: TooltipRect, point: TooltipPoint) => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;

export function nearestOnSegment(point: TooltipPoint, a: TooltipPoint, b: TooltipPoint): TooltipPoint {
    const length = distanceSquared(a, b);
    return interpolate(a, b, length ? clamp(((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length, 0, 1) : 0);
}

export function clipSegment(a: TooltipPoint, b: TooltipPoint, box: TooltipRect): TooltipSegment | undefined {
    let from = 0;
    let to = 1;
    for (const [origin, delta, min, max] of [[a.x, b.x - a.x, box.left, box.right], [a.y, b.y - a.y, box.top, box.bottom]]) {
        if (!delta) { if (origin < min || origin > max) return; }
        else {
            const first = (min - origin) / delta;
            const last = (max - origin) / delta;
            from = Math.max(from, Math.min(first, last));
            to = Math.min(to, Math.max(first, last));
            if (from > to) return;
        }
    }
    return [interpolate(a, b, from), interpolate(a, b, to)];
}
