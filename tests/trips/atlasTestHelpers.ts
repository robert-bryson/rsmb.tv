import { expect, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';
import { tripAtlasColor } from '../../src/features/trips/atlas/tripAtlasView';

type CameraSnapshot = { center: number[]; zoom: number; bearing: number; pitch: number };

export const atlas = '/projects/adv-atlas/map';

/** Compare browse state exactly while allowing the new shareable viewport fields. */
export async function expectAtlasUrl(page: Page, query: Record<string, string> = {}) {
    await expect.poll(() => {
        const url = new URL(page.url());
        return { path: url.pathname, query: Object.fromEntries([...url.searchParams].filter(([key]) => !['camera', 'panel', 'results'].includes(key))) };
    }).toEqual({ path: atlas, query });
}
export const geometry = {
    type: 'FeatureCollection', features: [{
        type: 'Feature', id: 0, properties: { trackId: 'morning' },
        geometry: { type: 'MultiLineString', coordinates: [[[-122, 47], [-123, 46], [-124, 45]], [[-124.2, 45.1], [-124.3, 45.3]]] },
    }],
};

export async function mockAtlasAssets(page: Page) {
    const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#777' } }).png().toBuffer();
    await page.route('https://basemaps.cartocdn.com/**', route => route.fulfill({ contentType: 'image/png', body: tile }));
    await page.route('**/test-trip/**', route => route.request().url().endsWith('.geojson')
        ? route.fulfill({ json: geometry })
        : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="100%" height="100%" fill="#405b6b"/></svg>' }));
}

export async function openList(page: Page) {
    const toggle = page.locator('#atlas-panel-toggle');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
}

/** Measure each target and its obstacles in the same browser task. */
export async function expectAtlasMapControls(page: Page) {
    for (const name of ['Zoom to all trips', 'Zoom in', 'Zoom out', 'Enter fullscreen', 'Share map']) {
        const control = page.getByRole('button', { name, exact: true });
        const layout = await control.evaluate(element => {
            const viewport = element.closest('[data-testid="atlas-map-viewport"]');
            const panel = document.getElementById('atlas-trip-panel');
            if (!viewport || !panel) throw new Error('Atlas controls require a map viewport and trip panel.');
            const box = element.getBoundingClientRect();
            const map = viewport.getBoundingClientRect();
            const drawer = panel.getBoundingClientRect();
            const intersectionWidth = Math.max(0, Math.min(box.right, drawer.right) - Math.max(box.left, drawer.left));
            const intersectionHeight = Math.max(0, Math.min(box.bottom, drawer.bottom) - Math.max(box.top, drawer.top));
            return {
                width: box.width, height: box.height,
                insets: [box.left - map.left, box.top - map.top, map.right - box.right, map.bottom - box.bottom],
                panelOverlap: intersectionWidth * intersectionHeight,
                uncovered: [0.1, 0.5, 0.9].every(x => [0.1, 0.5, 0.9].every(y =>
                    element.contains(document.elementFromPoint(box.x + box.width * x, box.y + box.height * y)))),
            };
        });
        expect(layout.width, `${name} target width`).toBeGreaterThanOrEqual(44);
        expect(layout.height, `${name} target height`).toBeGreaterThanOrEqual(44);
        for (const inset of layout.insets) expect(inset, `${name} must stay inside the map`).toBeGreaterThanOrEqual(0);
        expect(layout.panelOverlap, `${name} must clear the trip panel`).toBe(0);
        expect(layout.uncovered, `${name} must remain clickable across its target`).toBe(true);
    }
}

/** Capture the departure position after the browser makes the link's click target visible. */
export async function followReport(page: Page, report: Locator) {
    await page.evaluate(() => {
        document.addEventListener('click', () => {
            (window as unknown as { atlasDepartureScroll?: number }).atlasDepartureScroll = document.getElementById('atlas-trip-list')?.scrollTop;
        }, { capture: true, once: true });
    });
    await report.click();
    const scroll = await page.evaluate(() => {
        const state = window as unknown as { atlasDepartureScroll?: number };
        const value = state.atlasDepartureScroll;
        delete state.atlasDepartureScroll;
        return value;
    });
    if (scroll === undefined) throw new Error('The report click did not capture its atlas departure position.');
    return scroll;
}

export async function atlasCamera(page: Page) {
    // History replacement can precede React's session listener committing the new key.
    let camera: CameraSnapshot | undefined;
    await expect.poll(async () => {
        camera = await page.evaluate(() => {
            window.dispatchEvent(new Event('pagehide'));
            const sessions = JSON.parse(sessionStorage.getItem('rsmb:adv-atlas:sessions:v1') ?? '[]') as [string, { camera?: CameraSnapshot }][];
            return sessions.find(([key]) => key === window.history.state.key)?.[1].camera;
        });
        return camera;
    }, { message: 'The current atlas history entry has a camera snapshot' }).toBeDefined();
    return camera!;
}

export async function paintedRoute(page: Page, id?: string, tolerance = 12, aim: 'center' | 'north' = 'center') {
    const { screenshot, box } = await captureAtlasCanvas(page);
    const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const hex = id ? tripAtlasColor(id).slice(1) : '';
    const color = id ? [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16)) : undefined;
    let count = 0;
    let point = { x: 0, y: 0 };
    let nearest = Infinity;
    const bounds = [info.width, info.height, 0, 0];
    for (let index = 0; index < data.length; index += info.channels) {
        const matches = color ? color.every((channel, offset) => Math.abs(data[index + offset] - channel) < tolerance)
            : Math.max(data[index], data[index + 1], data[index + 2]) - Math.min(data[index], data[index + 1], data[index + 2]) > 60;
        if (!matches) continue;
        const pixel = index / info.channels;
        const x = pixel % info.width;
        const y = Math.floor(pixel / info.width);
        count++;
        bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
        const distance = aim === 'north' ? y * info.width + Math.abs(x - info.width / 2) : (x - info.width / 2) ** 2 + (y - info.height / 2) ** 2;
        if (distance < nearest) { nearest = distance; point = { x, y }; }
    }
    const scaleX = box.width / info.width;
    const scaleY = box.height / info.height;
    return { count, point: { x: point.x * scaleX, y: point.y * scaleY }, bounds,
        cssBounds: bounds.map((value, index) => value * (index % 2 ? scaleY : scaleX)) };
}

/** A panel transition can resize the canvas between a screenshot and its DOM measurement. */
async function captureAtlasCanvas(page: Page) {
    const canvas = page.locator('[data-testid="trip-atlas-map"] canvas');
    let capture: { screenshot: Buffer; box: { x: number; y: number; width: number; height: number } } | undefined;
    await expect.poll(async () => {
        const before = await canvas.boundingBox();
        if (!before || !await canvas.evaluate(element => {
            const parent = element.closest<HTMLElement>('[data-testid="trip-atlas-map"]');
            const rect = element.getBoundingClientRect();
            return parent && Math.abs(rect.width - parent.clientWidth) < 1 && Math.abs(rect.height - parent.clientHeight) < 1;
        })) return false;
        const screenshot = await canvas.screenshot({ style: `
            header, aside, .atlas-panel-handle, [data-atlas-map-obstacle], .atlas-trip-endpoint,
            .maplibregl-control-container, .maplibregl-popup {
                transition: none !important;
                opacity: 0 !important;
            }
        ` });
        const after = await canvas.boundingBox();
        if (!after || before.x !== after.x || before.y !== after.y || before.width !== after.width || before.height !== after.height) return false;
        capture = { screenshot, box: after };
        return true;
    }).toBe(true);
    return capture!;
}
