import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { atlas, atlasCamera, mockAtlasAssets, paintedRoute } from './atlasTestHelpers';
import { tripAtlasColor } from '../../src/features/trips/atlas/tripAtlasView';

async function routeAtPixels(page: import('@playwright/test').Page, points: (width: number, height: number) => number[][]) {
    await page.route('**/test-trip/route.geojson', async route => {
        const box = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
        const world = 512 * 2 ** 7;
        const centerY = (1 - Math.log(Math.tan(Math.PI / 4 + 46 * Math.PI / 360)) / Math.PI) / 2;
        const coordinates = points(box.width, box.height).map(([x, y]) => [
            -123 + (x - box.width / 2) * 360 / world,
            Math.atan(Math.sinh(Math.PI * (1 - 2 * (centerY + (y - box.height / 2) / world)))) * 180 / Math.PI,
        ]);
        await route.fulfill({ json: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } } });
    });
}

async function highlightedPixelsUnderLabel(page: import('@playwright/test').Page) {
    const canvas = page.locator('[data-testid="trip-atlas-map"] canvas');
    const box = (await canvas.boundingBox())!;
    const label = (await page.getByRole('tooltip').locator('.maplibregl-popup-content').boundingBox())!;
    const png = await canvas.screenshot({ style: '.trip-day-popup { opacity: 0 !important; }' });
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const scaleX = info.width / box.width;
    const scaleY = info.height / box.height;
    const color = tripAtlasColor('coastal-test').slice(1).match(/../g)!.map(channel => parseInt(channel, 16));
    let count = 0;
    for (let y = Math.max(0, Math.floor((label.y - box.y - 6) * scaleY)); y < Math.min(info.height, (label.y + label.height - box.y + 6) * scaleY); y++) {
        for (let x = Math.max(0, Math.floor((label.x - box.x - 6) * scaleX)); x < Math.min(info.width, (label.x + label.width - box.x + 6) * scaleX); x++) {
            const offset = (y * info.width + x) * info.channels;
            if (color.every((channel, index) => Math.abs(data[offset + index] - channel) < 12)) count++;
        }
    }
    return count;
}

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); await mockAtlasAssets(page); });

test('a visible route popup avoids the actual map toolbar', async ({ page }) => {
    await routeAtPixels(page, (width) => [[width - 20, 20], [width - 20, 40]]);
    await page.goto(`${atlas}?camera=-123,46,7,0,0&panel=compact`);
    await expect(page.getByText('2/2 routes')).toBeVisible();
    await page.getByRole('button', { name: 'Show route: Coastal test trip' }).focus();
    const popup = page.getByRole('tooltip');
    await expect(popup).toBeVisible();
    const label = (await popup.boundingBox())!;
    for (const name of ['Zoom in', 'Zoom out', 'Enter fullscreen', 'Share map', 'Collapse trip panel']) {
        const control = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
        const overlap = Math.max(0, Math.min(label.x + label.width, control.x + control.width) - Math.max(label.x, control.x))
            * Math.max(0, Math.min(label.y + label.height, control.y + control.height) - Math.max(label.y, control.y));
        expect(overlap).toBe(0);
    }
});

test('a visible route popup chooses a side that leaves the highlighted track uncovered', async ({ page }) => {
    await routeAtPixels(page, (width, height) => [[width / 2 - 40, height / 2], [width / 2 + 40, height / 2],
        [width / 2 + 40, height / 2 - 100], [width / 2 - 40, height / 2 - 100], [width / 2 - 40, height / 2]]);
    await page.goto(`${atlas}?camera=-123,46,7,0,0&panel=compact`);
    await expect(page.getByText('2/2 routes')).toBeVisible();
    await page.getByRole('button', { name: 'Show route: Coastal test trip' }).focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    expect(await highlightedPixelsUnderLabel(page)).toBe(0);
});

test('route feedback moves when UI appears or grows, and returns after a full obstruction closes', async ({ page }) => {
    await routeAtPixels(page, (width, height) => [[20, height / 2], [width - 20, height / 2]]);
    await page.goto(`${atlas}?camera=-123,46,7,0,0&panel=compact`);
    await expect(page.getByText('2/2 routes')).toBeVisible();
    const button = page.getByRole('button', { name: 'Show route: Coastal test trip' });
    await button.focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    const before = await atlasCamera(page);
    await page.getByTestId('atlas-map-viewport').evaluate(viewport => {
        const label = document.querySelector('[role="tooltip"]')!.getBoundingClientRect();
        const map = viewport.getBoundingClientRect();
        const obstacle = document.createElement('div');
        obstacle.id = 'tooltip-test-obstacle';
        obstacle.dataset.atlasMapObstacle = '';
        Object.assign(obstacle.style, { position: 'absolute', left: `${label.left + label.width / 2 - map.left - 20}px`, top: `${label.top - map.top - 4}px`, width: '40px', height: `${label.height + 8}px`, background: 'black' });
        viewport.append(obstacle);
    });
    const overlap = () => page.evaluate(() => {
        const label = document.querySelector('[role="tooltip"]')?.getBoundingClientRect();
        const ui = document.querySelector('#tooltip-test-obstacle')!.getBoundingClientRect();
        return label ? Math.max(0, Math.min(label.right, ui.right) - Math.max(label.left, ui.left))
            * Math.max(0, Math.min(label.bottom, ui.bottom) - Math.max(label.top, ui.top)) : -1;
    });
    await expect.poll(overlap).toBe(0);
    await page.locator('#tooltip-test-obstacle').evaluate(obstacle => {
        const label = document.querySelector('[role="tooltip"]')!.getBoundingClientRect();
        const box = obstacle.getBoundingClientRect();
        Object.assign((obstacle as HTMLElement).style, { height: `${Math.max(box.bottom, label.bottom) - box.top + 8}px` });
    });
    await expect.poll(overlap).toBe(0);
    await page.locator('#tooltip-test-obstacle').evaluate(obstacle => {
        Object.assign((obstacle as HTMLElement).style, { inset: '0', width: '100%', height: '100%' });
    });
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(page.getByTestId('trip-atlas-map')).toHaveAttribute('data-highlighted-trip', 'coastal-test');
    await page.locator('#tooltip-test-obstacle').evaluate(obstacle => obstacle.remove());
    await expect(page.getByRole('tooltip')).toBeVisible();
    await expect(button).toBeFocused();
    expect(await atlasCamera(page)).toEqual(before);
});

for (const [anchor, lng, lat] of [
    ['right', -140, 46], ['left', -105, 46], ['top', -123, 30], ['bottom', -123, 62],
    ['top-right', -140, 30], ['top-left', -105, 30], ['bottom-right', -140, 62], ['bottom-left', -105, 62],
] as const) test(`an off-screen route popup stays at the ${anchor} edge and points toward its track`, async ({ page }) => {
    await page.goto(`${atlas}?camera=${lng},${lat},6,0,0&panel=compact`);
    await expect(page.getByText('2/2 routes')).toBeVisible();
    await expect.poll(() => atlasCamera(page)).toBeDefined();
    const before = await atlasCamera(page);
    await page.locator('[data-trip-id="coastal-test"]').getByRole('heading').hover();
    const popup = page.getByRole('tooltip');
    await expect(popup).toContainText('Coastal test trip');
    await expect(popup).toHaveClass(new RegExp(`maplibregl-popup-anchor-${anchor}(?:\\s|$)`));
    const map = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
    const label = (await popup.boundingBox())!;
    if (anchor.includes('right')) expect(label.x + label.width).toBeGreaterThan(map.x + map.width - 84);
    if (anchor.includes('left')) expect(label.x).toBeLessThan(map.x + 84);
    if (anchor.includes('top')) expect(label.y).toBeLessThanOrEqual(map.y + 84);
    if (anchor.includes('bottom')) expect(label.y + label.height).toBeGreaterThanOrEqual(map.y + map.height - 84);
    expect(label.x).toBeGreaterThanOrEqual(map.x + 8);
    expect(label.x + label.width).toBeLessThanOrEqual(map.x + map.width - 8);
    expect(label.y).toBeGreaterThanOrEqual(map.y + 8);
    expect(label.y + label.height).toBeLessThanOrEqual(map.y + map.height - 8);
    expect(await page.getByRole('tooltip').evaluate(element => {
        const label = element.getBoundingClientRect();
        return [...document.querySelectorAll('.atlas-panel-handle, .maplibregl-control-container .maplibregl-ctrl, [data-atlas-map-obstacle]')].some(node => {
            const ui = node.getBoundingClientRect();
            return ui.width > 1 && ui.height > 1 && label.left < ui.right && label.right > ui.left && label.top < ui.bottom && label.bottom > ui.top;
        });
    })).toBe(false);
    expect(await atlasCamera(page)).toEqual(before);
});

test('card hover anchors to a visible track segment instead of an off-screen route midpoint', async ({ page }) => {
    await page.route('**/test-trip/route.geojson', route => route.fulfill({ json: {
        type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [
            [[-142, 47.2], [-138, 47.2]], [[-124, 45], [-123, 46], [-122, 47], [-121, 48]],
        ] },
    } }));
    await page.goto(`${atlas}?camera=-140,46,6,0,0&panel=compact`);
    await expect(page.getByText('2/2 routes')).toBeVisible();
    await page.locator('[data-trip-id="coastal-test"]').getByRole('heading').hover();
    const popup = page.getByRole('tooltip');
    await expect(popup).toBeVisible();
    const map = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
    const label = (await popup.boundingBox())!;
    expect(label.y + label.height).toBeLessThan(map.y + map.height / 2 - 40);
});

test('card feedback follows zooming from an off-screen direction onto visible route geometry without losing focus', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Mouse-wheel feedback requires a desktop pointer; phone projects check all edges and map rotation.');
    await page.goto(`${atlas}?camera=-140,46,6,0,0&panel=compact`);
    await expect(page.getByText('2/2 routes')).toBeVisible();
    const button = page.getByRole('button', { name: 'Show route: Coastal test trip' });
    await button.focus();
    await expect(page.getByRole('tooltip')).toHaveClass(/maplibregl-popup-anchor-right(?:\s|$)/);
    const map = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
    await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
    for (let step = 0; step < 4; step++) {
        const zoom = (await atlasCamera(page))!.zoom;
        await page.mouse.wheel(0, 600);
        await expect.poll(async () => (await atlasCamera(page))!.zoom).toBeLessThan(zoom - 0.5);
    }
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    await expect(button).toBeFocused();
    await expect(page.getByRole('tooltip')).toBeVisible();
    const label = (await page.getByRole('tooltip').boundingBox())!;
    expect(label.x + label.width).toBeLessThan(map.x + map.width - 48);
});

test('an eastern track points upward when the map bearing places east at the top', async ({ page }) => {
    await page.goto(`${atlas}?camera=-140,46,6,90,0&panel=compact`);
    await expect(page.getByText('2/2 routes')).toBeVisible();
    await page.getByRole('button', { name: 'Show route: Coastal test trip' }).focus();
    await expect(page.getByRole('tooltip')).toHaveClass(/maplibregl-popup-anchor-top(?:\s|$)/);
});
