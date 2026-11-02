import { expect, test } from '@playwright/test';
import { atlas, atlasCamera, mockAtlasAssets, paintedRoute } from './atlasTestHelpers';

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); await mockAtlasAssets(page); });

test('selection, panel, presentation, pan, and zoom produce a shareable view in a fresh tab without adding history entries', async ({ page, context }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (url: string) => {
            (window as unknown as { copiedAtlasUrl: string }).copiedAtlasUrl = url;
        } } });
    });
    await page.goto(`${atlas}?country=CA&sort=miles-desc`);
    await expect.poll(() => new URL(page.url()).searchParams.get('camera')).toBeTruthy();
    const historyLength = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: 'Coastal test trip' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('trip')).toBe('coastal-test');
    await expect.poll(() => new URL(page.url()).searchParams.get('camera')).toBeTruthy();
    await page.getByRole('button', { name: 'Expand trip panel' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe('expanded');
    await page.getByRole('radio', { name: 'Table', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Table', exact: true })).toBeChecked();
    await expect.poll(() => new URL(page.url()).searchParams.get('results')).toBe('table');
    await page.getByRole('button', { name: 'Collapse trip panel' }).click();
    await expect(page.locator('main.atlas-explorer')).toHaveAttribute('data-panel-state', 'collapsed');
    await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe('collapsed');
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    const beforePan = new URL(page.url()).searchParams.get('camera');
    const canvas = (await page.locator('[data-testid="trip-atlas-map"] canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width / 2 + 60, canvas.y + canvas.height / 2 + 30, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => new URL(page.url()).searchParams.get('camera')).not.toBe(beforePan);
    const beforeZoom = new URL(page.url()).searchParams.get('camera');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('camera')).not.toBe(beforeZoom);
    await page.getByRole('button', { name: 'Share map' }).click();
    await expect(page.getByRole('status')).toContainText('Link copied');
    const copied = await page.evaluate(() => (window as unknown as { copiedAtlasUrl: string }).copiedAtlasUrl);
    expect(copied).toBe(page.url());
    expect(new URL(copied).searchParams.get('country')).toBe('CA');
    expect(new URL(copied).searchParams.get('sort')).toBe('miles-desc');
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    const before = (await atlasCamera(page))!;
    const fresh = await context.newPage();
    await mockAtlasAssets(fresh);
    await fresh.goto(copied);
    await expect(fresh.locator('main.atlas-explorer')).toHaveAttribute('data-panel-state', 'collapsed');
    await expect(fresh.locator('main.atlas-explorer')).toHaveAttribute('data-results-view', 'table');
    await expect(fresh.getByTestId('trip-atlas-map')).toHaveAttribute('data-selected-trip', 'coastal-test');
    await expect.poll(async () => (await paintedRoute(fresh, 'coastal-test')).count).toBeGreaterThan(30);
    const after = (await atlasCamera(fresh))!;
    expect(after.center[0]).toBeCloseTo(before.center[0], 5);
    expect(after.center[1]).toBeCloseTo(before.center[1], 5);
    expect(after.zoom).toBeCloseTo(before.zoom, 3);
    await fresh.getByRole('button', { name: 'Show trips' }).click();
    await expect.poll(() => new URL(fresh.url()).searchParams.get('panel')).toBe('compact');
    await fresh.getByRole('button', { name: 'Expand trip panel' }).click();
    await expect(fresh.getByRole('radio', { name: 'Table', exact: true })).toBeChecked();
    await expect(fresh.locator('[data-trip-id]')).toHaveCount(1);
    await fresh.close();
});

test('browser Back restores the camera and panel from before an applied filter', async ({ page }) => {
    await page.goto(`${atlas}?panel=expanded&camera=-122,46,5.5,22,30`);
    await expect(page.getByText('2/2 routes')).toBeVisible();
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByLabel('Distance', { exact: true }).selectOption({ label: 'Up to 500 miles' });
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('milesMax')).toBe('500');
    await page.getByRole('button', { name: 'Collapse trip panel' }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('camera')).not.toBe('-122,46,5.5,22,30');
    await page.goBack();
    await expect(page.locator('main.atlas-explorer')).toHaveAttribute('data-panel-state', 'expanded');
    await expect.poll(() => new URL(page.url()).searchParams.has('milesMax')).toBe(false);
    await expect.poll(async () => {
        const camera = await atlasCamera(page);
        return camera && { center: camera.center.map(value => Number(value.toFixed(6))), zoom: Number(camera.zoom.toFixed(4)),
            bearing: Number(camera.bearing.toFixed(2)), pitch: Number(camera.pitch.toFixed(2)) };
    }).toEqual({ center: [-122, 46], zoom: 5.5, bearing: 22, pitch: 30 });
    await expect(page.getByText('2/2 routes')).toBeVisible();
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('camera')?.split(',')[2]).toBe('4.5');
});

test('manual sharing remains usable without native sharing or clipboard permission', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    });
    await page.goto(`${atlas}?trip=coastal-test&panel=collapsed`);
    await expect.poll(() => new URL(page.url()).searchParams.get('camera')).toBeTruthy();
    const share = page.getByRole('button', { name: 'Share map' });
    await share.click();
    const input = page.getByRole('textbox', { name: 'Copy this map link' });
    await expect(input).toHaveValue(page.url());
    await expect(input).toBeFocused();
    await input.press('Escape');
    await expect(input).toHaveCount(0);
    await expect(share).toBeFocused();
});

test('map and panel controls share surfaces, focus styling, and touch sizes without overlapping at 320 pixels', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(`${atlas}?trip=coastal-test`);
    const filter = page.getByRole('button', { name: /^Filters/ });
    const share = page.getByRole('button', { name: 'Share map' });
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
    const style = await filter.evaluate(element => {
        const computed = getComputedStyle(element);
        return { background: computed.backgroundColor, radius: computed.borderRadius };
    });
    await expect(share).toHaveCSS('background-color', style.background);
    await expect(share).toHaveCSS('border-radius', style.radius);
    const group = page.locator('.maplibregl-ctrl-group').first();
    await expect(group).toHaveCSS('background-color', style.background);
    await expect(group).toHaveCSS('border-radius', style.radius);
    const boxes = [];
    for (const name of ['Zoom to all trips', 'Zoom in', 'Zoom out', 'Enter fullscreen', 'Share map']) {
        const button = page.getByRole('button', { name, exact: true });
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(await button.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        })).toBe(true);
        for (const other of boxes) expect(Math.max(0, Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x))
            * Math.max(0, Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y))).toBe(0);
        boxes.push(box);
    }
    await share.focus();
    await expect(share).toHaveCSS('outline-style', 'solid');
});
