import { expect, test } from '@playwright/test';
import { atlas, atlasCamera, mockAtlasAssets, paintedRoute } from './atlasTestHelpers';

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); await mockAtlasAssets(page); });

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
    if (anchor.includes('right')) expect(label.x + label.width).toBeGreaterThan(map.x + map.width - 48);
    if (anchor.includes('left')) expect(label.x).toBeLessThan(map.x + 48);
    if (anchor.includes('top')) expect(label.y).toBeLessThanOrEqual(map.y + 84);
    if (anchor.includes('bottom')) expect(label.y + label.height).toBeGreaterThanOrEqual(map.y + map.height - 84);
    expect(label.x).toBeGreaterThanOrEqual(map.x + 8);
    expect(label.x + label.width).toBeLessThanOrEqual(map.x + map.width - 8);
    expect(label.y).toBeGreaterThanOrEqual(map.y + 8);
    expect(label.y + label.height).toBeLessThanOrEqual(map.y + map.height - 8);
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
    await expect(page.getByRole('tooltip')).toHaveClass(/maplibregl-popup-anchor-bottom(?:\s|$)/);
    const label = (await page.getByRole('tooltip').boundingBox())!;
    expect(label.x + label.width).toBeLessThan(map.x + map.width - 48);
});

test('an eastern track points upward when the map bearing places east at the top', async ({ page }) => {
    await page.goto(`${atlas}?camera=-140,46,6,90,0&panel=compact`);
    await expect(page.getByText('2/2 routes')).toBeVisible();
    await page.getByRole('button', { name: 'Show route: Coastal test trip' }).focus();
    await expect(page.getByRole('tooltip')).toHaveClass(/maplibregl-popup-anchor-top(?:\s|$)/);
});
