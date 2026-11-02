import { expect, test, type Page } from '@playwright/test';
import { atlas, atlasCamera, mockAtlasAssets } from './atlasTestHelpers';

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAtlasAssets(page);
});

test('single and double arrows reach each panel size with pointer and keyboard controls', async ({ page, isMobile }) => {
    await page.goto(`${atlas}?panel=collapsed`);
    const main = page.locator('main.atlas-explorer');
    const single = page.locator('#atlas-panel-toggle');
    const double = page.locator('.atlas-panel-arrow').nth(1);
    await expect(single).toHaveAccessibleName('Show trips');
    await expect(double).toHaveAccessibleName('Expand trip panel');
    const a = (await single.boundingBox())!;
    const b = (await double.boundingBox())!;
    expect(a.width).toBeGreaterThanOrEqual(44);
    expect(a.height).toBeGreaterThanOrEqual(44);
    expect(isMobile ? b.x : b.y).toBeCloseTo(isMobile ? a.x + a.width : a.y + a.height, 0);
    await double.click();
    await expect(main).toHaveAttribute('data-panel-state', 'expanded');
    await expect(single).toHaveAccessibleName('Use compact trip panel');
    await expect(double).toHaveAccessibleName('Collapse trip panel');
    await single.click();
    await expect(main).toHaveAttribute('data-panel-state', 'compact');
    await expect(single).toHaveAccessibleName('Collapse trip panel');
    await expect(double).toHaveAccessibleName('Expand trip panel');
    await single.press('Enter');
    await expect(main).toHaveAttribute('data-panel-state', 'collapsed');
    await single.press('Space');
    await expect(main).toHaveAttribute('data-panel-state', 'compact');
    await double.click();
    await expect(main).toHaveAttribute('data-panel-state', 'expanded');
    await double.press('Enter');
    await expect(main).toHaveAttribute('data-panel-state', 'collapsed');
    await expect(double).toBeFocused();
    await expect(page.getByRole('button', { name: /^(?:Coastal test trip|Daily map test trip)$/ })).toHaveCount(0);
    await double.press('Space');
    await expect(main).toHaveAttribute('data-panel-state', 'expanded');
});

async function panelSizes(page: Page, vertical: boolean) {
    const main = page.locator('main.atlas-explorer');
    const panel = page.locator('#atlas-trip-panel');
    const dimension = vertical ? 'height' : 'width';
    await expect(main).toHaveAttribute('data-panel-state', 'compact');
    const compact = (await panel.boundingBox())![dimension];
    await page.getByRole('button', { name: 'Expand trip panel' }).click();
    await expect(main).toHaveAttribute('data-panel-state', 'expanded');
    const expanded = (await panel.boundingBox())![dimension];
    await page.getByRole('button', { name: 'Collapse trip panel' }).click();
    await expect(main).toHaveAttribute('data-panel-state', 'collapsed');
    return { compact, expanded };
}

for (const arrow of ['single', 'double'] as const) {
    test(`dragging the ${arrow} arrow continuously visits all states in both directions without a release click`, async ({ page, isMobile }) => {
        await page.goto(`${atlas}?camera=-123,46,5,0,0&panel=compact`);
        const main = page.locator('main.atlas-explorer');
        await expect.poll(() => atlasCamera(page)).toBeDefined();
        const before = (await atlasCamera(page))!;
        const { compact, expanded } = await panelSizes(page, isMobile);
        const root = (await main.boundingBox())!;
        const handle = page.locator('.atlas-panel-arrow').nth(arrow === 'single' ? 0 : 1);
        const box = (await handle.boundingBox())!;
        const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        const move = async (size: number, state: string) => {
            await page.mouse.move(start.x + (isMobile ? 0 : size), start.y - (isMobile ? size : 0), { steps: 8 });
            await expect(main).toHaveAttribute('data-panel-state', state);
            await expect(main).toHaveAttribute('data-panel-dragging', '');
            const map = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
            // WebKit rounds injected pointer positions to integer CSS pixels.
            expect(Math.abs((isMobile ? root.height - map.height : map.x - root.x) - Math.min(expanded, size))).toBeLessThanOrEqual(1);
        };
        await move(compact * 0.75, 'compact');
        await move(expanded + 30, 'expanded');
        await move(compact, 'compact');
        await move(12, 'collapsed');
        await page.mouse.up();
        await expect(main).not.toHaveAttribute('data-panel-dragging');
        await expect(main).toHaveAttribute('data-panel-state', 'collapsed');
        await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe('collapsed');
        const after = (await atlasCamera(page))!;
        expect(after.center[0]).toBeCloseTo(before.center[0], 6);
        expect(after.center[1]).toBeCloseTo(before.center[1], 6);
        expect(after.zoom).toBeCloseTo(before.zoom, 6);
        await page.reload();
        await expect(main).toHaveAttribute('data-panel-state', 'collapsed');
    });
}

test('releasing a partial drag snaps to compact and Escape restores the starting state', async ({ page, isMobile }) => {
    await page.goto(`${atlas}?panel=compact`);
    const main = page.locator('main.atlas-explorer');
    const { compact } = await panelSizes(page, isMobile);
    const handle = page.locator('#atlas-panel-toggle');
    const box = (await handle.boundingBox())!;
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + (isMobile ? 0 : compact * 0.7), start.y - (isMobile ? compact * 0.7 : 0), { steps: 8 });
    await page.mouse.up();
    await expect(main).toHaveAttribute('data-panel-state', 'compact');
    const panel = (await page.locator('#atlas-trip-panel').boundingBox())!;
    expect(isMobile ? panel.height : panel.width).toBeCloseTo(compact, 0);
    const current = (await handle.boundingBox())!;
    await page.mouse.move(current.x + current.width / 2, current.y + current.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y, { steps: 8 });
    await expect(main).toHaveAttribute('data-panel-state', 'collapsed');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(main).toHaveAttribute('data-panel-state', 'compact');
    await expect(main).not.toHaveAttribute('data-panel-dragging');
    await handle.click();
    await expect(main).toHaveAttribute('data-panel-state', 'collapsed');
});

test('resizing across the phone breakpoint cancels a drag and restores usable panel controls', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${atlas}?panel=compact`);
    const main = page.locator('main.atlas-explorer');
    const handle = page.locator('#atlas-panel-toggle');
    const start = (await handle.boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 400, start.y + start.height / 2, { steps: 8 });
    await expect(main).toHaveAttribute('data-panel-state', 'expanded');
    await expect(main).toHaveAttribute('data-panel-dragging', '');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(main).not.toHaveAttribute('data-panel-dragging');
    await expect(main).toHaveAttribute('data-panel-state', 'compact');
    const sheet = (await page.locator('#atlas-trip-panel').boundingBox())!;
    expect(sheet.height).toBeLessThan((await main.boundingBox())!.height / 2);
    await page.mouse.up();
    await handle.click();
    await expect(main).toHaveAttribute('data-panel-state', 'collapsed');
    await handle.click();
    await expect(main).toHaveAttribute('data-panel-state', 'compact');
});

test('touch dragging resizes the phone sheet and pointer cancellation restores its initial state', async ({ page, isMobile, browserName }) => {
    test.skip(!isMobile || browserName !== 'chromium', 'Uses Chromium touch input on a phone viewport.');
    await page.goto(`${atlas}?panel=compact`);
    const main = page.locator('main.atlas-explorer');
    const { compact, expanded } = await panelSizes(page, true);
    const touch = await page.context().newCDPSession(page);
    const startDrag = async () => {
        const box = (await page.locator('#atlas-panel-toggle').boundingBox())!;
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        return point;
    };
    const start = await startDrag();
    for (let step = 1; step <= 8; step++) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - expanded * step / 8 }] });
    }
    await expect(main).toHaveAttribute('data-panel-state', 'expanded');
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(main).not.toHaveAttribute('data-panel-dragging');
    await expect(main).toHaveAttribute('data-panel-state', 'expanded');
    await page.getByRole('button', { name: 'Collapse trip panel' }).tap();
    await expect(main).toHaveAttribute('data-panel-state', 'collapsed');
    const next = await startDrag();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: next.x, y: next.y - compact }] });
    await expect(main).toHaveAttribute('data-panel-state', 'compact');
    await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(main).toHaveAttribute('data-panel-state', 'collapsed');
    await expect(main).not.toHaveAttribute('data-panel-dragging');
    await touch.detach();
});
