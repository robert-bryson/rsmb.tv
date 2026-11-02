import { expect, test, type Page } from '@playwright/test';
import { atlas, atlasCamera, mockAtlasAssets, paintedRoute } from './atlasTestHelpers';

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAtlasAssets(page);
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    });
});

async function expectMapControls(page: Page) {
    const map = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
    for (const name of ['Zoom to all trips', 'Zoom in', 'Zoom out', 'Enter fullscreen', 'Share map']) {
        const control = page.getByRole('button', { name, exact: true });
        const box = (await control.boundingBox())!;
        expect(box.width, name).toBeGreaterThanOrEqual(44);
        expect(box.height, name).toBeGreaterThanOrEqual(44);
        expect(box.x, name).toBeGreaterThanOrEqual(map.x);
        expect(box.y, name).toBeGreaterThanOrEqual(map.y);
        expect(box.x + box.width, name).toBeLessThanOrEqual(map.x + map.width);
        expect(box.y + box.height, name).toBeLessThanOrEqual(map.y + map.height);
        expect(await control.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return [0.1, 0.5, 0.9].every(x => [0.1, 0.5, 0.9].every(y =>
                element.contains(document.elementFromPoint(rect.x + rect.width * x, rect.y + rect.height * y))));
        }), `${name} must remain clickable across its target`).toBe(true);
    }
}

for (const viewport of [
    { width: 667, height: 375 }, { width: 320, height: 568 },
    { width: 568, height: 320 }, { width: 568, height: 280 },
]) {
    test(`expanded selected links fit routes and expose map controls at ${viewport.width}×${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const fitWarnings: string[] = [];
        page.on('console', message => { if (message.text().includes('Map cannot fit')) fitWarnings.push(message.text()); });
        await page.goto(`${atlas}?trip=coastal-test&panel=expanded`);
        await expect.poll(() => new URL(page.url()).searchParams.get('camera')).toBeTruthy();
        await expect.poll(() => atlasCamera(page)).toBeDefined();
        const route = await paintedRoute(page, 'coastal-test');
        expect(route.count).toBeGreaterThan(30);
        const map = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
        expect(route.cssBounds[0]).toBeGreaterThan(0);
        expect(route.cssBounds[1]).toBeGreaterThan(0);
        expect(route.cssBounds[2]).toBeLessThan(map.width);
        expect(route.cssBounds[3]).toBeLessThan(map.height);
        expect(fitWarnings).toEqual([]);
        await expectMapControls(page);
        await page.getByRole('button', { name: 'Share map', exact: true }).click();
        await expect(page.getByRole('textbox', { name: 'Copy this map link' })).toHaveValue(page.url());
        await page.getByRole('button', { name: 'Close', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Share map', exact: true })).toBeFocused();
    });
}

test('expanding and rotating a short phone keeps its camera and map controls usable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${atlas}?trip=coastal-test`);
    await expect.poll(() => atlasCamera(page)).toBeDefined();
    const before = (await atlasCamera(page))!;
    await page.getByRole('button', { name: 'Expand trip panel' }).click();
    await expect(page.locator('main.atlas-explorer')).toHaveAttribute('data-panel-state', 'expanded');
    await page.setViewportSize({ width: 667, height: 375 });
    await expectMapControls(page);
    const after = (await atlasCamera(page))!;
    expect(after).toEqual(before);
    await page.getByRole('button', { name: 'Zoom to all trips', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has('trip')).toBe(false);
    await expect.poll(() => new URL(page.url()).searchParams.get('camera')).not.toBeNull();
    await expect.poll(async () => (await paintedRoute(page)).count).toBeGreaterThan(30);
});

test('column settings remain usable above a short phone sheet and inside fullscreen', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 280 });
    await page.goto(`${atlas}?panel=expanded&results=table&trip=coastal-test&view=selected&milesMin=240`);
    await expect.poll(() => atlasCamera(page)).toBeDefined();
    // Phone projects exercise the atlas's fullscreen fallback as well as desktop native fullscreen.
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Customize table columns', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Table columns', exact: true });
    await expect(editor).toBeVisible();
    expect((await editor.getByRole('list').boundingBox())!.height).toBeGreaterThanOrEqual(88);
    expect(await editor.evaluate(element => element.closest('.atlas-explorer') !== null)).toBe(true);
    await editor.getByRole('checkbox', { name: 'Show Motorcycle column', exact: true }).uncheck();
    await editor.getByRole('button', { name: 'Reset columns', exact: true }).click();
    await expect(editor.getByRole('checkbox', { name: 'Show Motorcycle column', exact: true })).toBeChecked();
    await editor.getByRole('button', { name: 'Close column settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Customize table columns', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enter fullscreen', exact: true })).toBeVisible();
});

test('tabbing past the column editor closes it before focus reaches map controls', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 568, height: 280 });
    await page.goto(`${atlas}?panel=expanded&results=table&trip=coastal-test`);
    await expect.poll(() => atlasCamera(page)).toBeDefined();
    await page.getByRole('button', { name: 'Customize table columns', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Table columns', exact: true });
    await editor.getByRole('button', { name: 'Reset columns', exact: true }).focus();
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
    await expect(editor).toHaveCount(0);
    await expectMapControls(page);
});

test('resizing a focused column editor returns focus to its trigger', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 280 });
    await page.goto(`${atlas}?panel=expanded&results=table`);
    const trigger = page.getByRole('button', { name: 'Customize table columns', exact: true });
    await trigger.click();
    await expect(page.getByRole('checkbox', { name: 'Show Motorcycle column', exact: true })).toBeFocused();
    await page.setViewportSize({ width: 667, height: 375 });
    await expect(page.getByRole('dialog', { name: 'Table columns', exact: true })).toHaveCount(0);
    await expect(trigger).toBeFocused();
});

test('pointer edits and reset retain the column editor when clicked controls do not take focus', async ({ page }) => {
    await page.goto(`${atlas}?panel=expanded&results=table`);
    const trigger = page.getByRole('button', { name: 'Customize table columns', exact: true });
    await trigger.click();
    const editor = page.getByRole('dialog', { name: 'Table columns', exact: true });
    const motorcycle = editor.getByRole('checkbox', { name: 'Show Motorcycle column', exact: true });
    await expect(motorcycle).toBeFocused();
    await motorcycle.click();
    await expect(editor).toBeVisible();
    await expect(motorcycle).not.toBeChecked();
    await editor.getByRole('button', { name: 'Reset columns', exact: true }).click();
    await expect(editor).toBeVisible();
    await expect(motorcycle).toBeChecked();
    await editor.getByRole('button', { name: 'Close column settings', exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(trigger).toBeFocused();
});
