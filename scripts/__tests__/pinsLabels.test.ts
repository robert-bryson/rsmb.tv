import type { Map as MapLibreMap } from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachRadiusLabels } from '../../src/features/pins/radiusLabels';
import type { RadiusLines, RadiusProperties } from '../../src/features/pins/radii';

function line(id: string, coordinates = [[-100, 0], [100, 0]], overrides: Partial<RadiusProperties> = {}): RadiusLines['features'][number] {
    return { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {
        id, pinId: id, level: 'state', name: `Pin ${id}`, label: '10.0 mi', distanceMeters: 16093,
        selected: false, minimumZoom: 6, ...overrides,
    } };
}
const data = (...features: RadiusLines['features']) => ({ type: 'FeatureCollection' as const, features });
const rect = (width = 800, height = 500, left = 0, top = 0) => ({ width, height, left, top, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} });
let frames: Map<number, FrameRequestCallback>;
const flush = () => { const pending = [...frames.values()]; frames.clear(); for (const frame of pending) frame(0); };

function fixture(width = 800, height = 500) {
    const parent = document.createElement('section');
    const container = document.createElement('div'), overlay = document.createElement('div');
    parent.append(container, overlay); document.body.append(parent);
    container.getBoundingClientRect = () => rect(width, height);
    let zoom = 6, center = 0;
    const listeners = new Map<string, Set<() => void>>();
    const map = {
        getContainer: () => container, getZoom: () => zoom, getCenter: () => ({ lng: center }),
        getBounds: () => ({ getWest: () => center - 90, getEast: () => center + 90, getSouth: () => -1000, getNorth: () => 1000 }),
        project: ([lng, lat]: number[]) => ({ x: width / 2 + (lng - center) * 2, y: height / 2 - lat * 2 }),
        unproject: ({ x, y }: { x: number; y: number }) => ({ lng: (x - width / 2) / 2 + center, lat: (height / 2 - y) / 2 }),
        on: (name: string, callback: () => void) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(callback); },
        off: (name: string, callback: () => void) => listeners.get(name)?.delete(callback),
    };
    const labels = attachRadiusLabels(map as unknown as MapLibreMap, overlay);
    return { parent, container, overlay, labels, listeners, map,
        move(nextZoom = zoom, nextCenter = center) { zoom = nextZoom; center = nextCenter; for (const callback of listeners.get('move') ?? []) callback(); } };
}
beforeEach(() => {
    frames = new Map(); let id = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe('radius badge layout', () => {
    it('hides occluded globe segments and restores them when their surface becomes visible', () => {
        const f = fixture();
        const unproject = vi.spyOn(f.map, 'unproject');
        unproject.mockReturnValue({ lng: 170, lat: 0 });
        f.labels.setData(data(line('back-side', [[-50, 0], [0, 0], [50, 0]], { selected: true })));
        flush();
        expect(f.overlay.children).toHaveLength(0);
        unproject.mockRestore();
        f.move(); flush();
        expect(f.overlay.children).toHaveLength(1);
        expect(f.overlay.firstElementChild).toHaveClass('is-selected');
        f.labels.dispose();
    });

    it('reveals labels by zoom, retains selected labels, and updates distance text', () => {
        const f = fixture();
        f.labels.setData(data(line('ordinary'), line('selected', [[-100, 50], [100, 50]], { selected: true, minimumZoom: 12 })));
        f.move(3); flush();
        expect(f.overlay.children).toHaveLength(1);
        expect(f.overlay.firstElementChild).toHaveClass('is-selected');
        f.move(6); flush(); expect(f.overlay.children).toHaveLength(2);
        f.labels.setData(data(line('ordinary', undefined, { label: '16.1 km' }))); flush();
        expect(f.overlay.children).toHaveLength(1);
        expect(f.overlay).toHaveTextContent('Pin ordinary: 16.1 km');
        expect(f.overlay.firstElementChild).toHaveAttribute('title', 'Pin ordinary: 16.1 km to the boundary');
        f.labels.dispose();
    });

    it('keeps labels inside the viewport and avoids toolbar, pin, and badge collisions', () => {
        const f = fixture();
        const obstacle = document.createElement('div'); obstacle.className = 'pins-map-toolbar';
        obstacle.getBoundingClientRect = () => rect(70, 50, 365, 225); f.parent.append(obstacle);
        f.labels.setData(data(line('selected', undefined, { selected: true }), line('same-line'),
            line('clipped', [[-300, 80], [0, 80]]), line('offscreen', [[-80, 1000], [80, 1000]])));
        flush();
        const badges = [...f.overlay.querySelectorAll<HTMLElement>('.pins-radius-label')];
        expect(badges.length).toBeGreaterThanOrEqual(2);
        expect(badges[0].dataset.pinRadiusLabel).toBe('selected');
        const boxes = badges.map(badge => ({ x: parseFloat(badge.style.left), y: parseFloat(badge.style.top), w: 65 }));
        for (const [index, box] of boxes.entries()) {
            expect(box.x - box.w / 2).toBeGreaterThanOrEqual(8);
            expect(box.x + box.w / 2).toBeLessThanOrEqual(792);
            expect(box.y - 12).toBeGreaterThanOrEqual(8);
            expect(box.y + 12).toBeLessThanOrEqual(492);
            expect(box.x + box.w / 2 > 361 && box.x - box.w / 2 < 439 && box.y + 12 > 221 && box.y - 12 < 279).toBe(false);
            for (const other of boxes.slice(index + 1)) expect(Math.abs(box.x - other.x) < 69 && Math.abs(box.y - other.y) < 28).toBe(false);
        }
        expect(f.overlay.querySelector('[data-pin-radius-label="offscreen"]')).toBeNull();
        f.labels.dispose();
    });

    it('wraps date-line radii to the visible world and removes labels after panning away', () => {
        const f = fixture();
        const lines = data(line('aleutian', [[179, 0], [181, 0]]));
        f.labels.setData(lines); f.move(8, -180); flush();
        expect(f.overlay.children).toHaveLength(1);
        expect(parseFloat((f.overlay.firstElementChild as HTMLElement).style.left)).toBeGreaterThan(350);
        // The same data reference must still respond to viewport changes.
        f.labels.setData(lines); f.move(8, 0); flush();
        expect(f.overlay.children).toHaveLength(0);
        f.labels.dispose();
    });

    it('hides labels when no collision-free placement exists', () => {
        const f = fixture(100, 60);
        f.labels.setData(data(line('crowded', [[0, 0], [1, 0]], { label: 'A very long distance label' })));
        flush(); expect(f.overlay.children).toHaveLength(0);
        f.labels.dispose();
    });

    it.each([[500, 20], [1600, 45]])('caps labels at width %i and cancels pending layout during disposal', (width, maximum) => {
        const f = fixture(width, 2400);
        const lines = Array.from({ length: 60 }, (_, index) => line(String(index), [[-70, 570 - index * 19], [70, 570 - index * 19]]));
        f.labels.setData(data(...lines)); flush();
        expect(f.overlay.children).toHaveLength(maximum);
        f.move(); f.move(); expect(frames.size).toBe(1);
        f.labels.dispose(); flush();
        expect(f.overlay.children).toHaveLength(0);
        expect(frames.size).toBe(0);
        expect([...f.listeners.values()].every(listeners => listeners.size === 0)).toBe(true);
    });
});
