import { expect, test } from '@playwright/test';
import { atlas, atlasCamera as camera, expectAtlasUrl, mockAtlasAssets, openList, paintedRoute } from './atlasTestHelpers';

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); await mockAtlasAssets(page); });

test('three drawer states reserve map space, retain the camera, and leave only an accessible arrow when collapsed', async ({ page }) => {
    await page.goto(`${atlas}?trip=coastal-test`);
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    const before = (await camera(page))!;
    const main = page.locator('main.atlas-explorer');
    await expect(main).toHaveAttribute('data-panel-state', 'compact');
    await page.getByRole('button', { name: 'Expand trip panel' }).click();
    await expect(main).toHaveAttribute('data-panel-state', 'expanded');
    const panel = (await page.locator('#atlas-trip-panel').boundingBox())!;
    const map = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
    const root = (await main.boundingBox())!;
    if (root.width >= 768) {
        expect(panel.width).toBeCloseTo(root.width / 2, 0);
        expect(map.x).toBeCloseTo(panel.x + panel.width, 0);
        expect(map.width).toBeCloseTo(root.width / 2, 0);
    } else {
        expect(map.y + map.height).toBeCloseTo(panel.y, 0);
        expect(map.height).toBeGreaterThan(root.height * 0.3);
    }
    await expect.poll(async () => {
        const after = (await camera(page))!;
        return Math.max(...after.center.map((value, index) => Math.abs(value - before.center[index])), Math.abs(after.zoom - before.zoom));
    }).toBeLessThan(0.000001);
    await page.getByRole('button', { name: 'Use compact trip panel' }).click();
    await page.getByRole('button', { name: 'Show route: Coastal test trip' }).focus();
    await page.getByRole('button', { name: 'Collapse trip panel' }).click();
    const handle = page.getByRole('button', { name: 'Show trips' });
    await expect(page.locator('#atlas-panel-toggle')).toBeFocused();
    await expect(page.getByRole('button', { name: /^Show route:/ })).toHaveCount(0);
    const handleBox = (await handle.boundingBox())!;
    expect(handleBox.width).toBeGreaterThanOrEqual(44);
    expect(handleBox.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('atlas-map-viewport')).toHaveCSS('width', `${root.width}px`);
    await handle.press('Enter');
    await expect(main).toHaveAttribute('data-panel-state', 'compact');
    await expect(page.locator('#atlas-panel-toggle')).toBeFocused();
});

test('selected-only is absent until selection and disappears when selection clears', async ({ page }) => {
    await page.goto(atlas);
    await expect(page.getByRole('button', { name: 'Show only selected trip' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Show route: Coastal test trip' }).click();
    await expect(page.getByRole('button', { name: 'Show only selected trip' })).toBeVisible();
    await page.getByRole('button', { name: 'Zoom to all trips' }).click();
    await expect(page.getByRole('button', { name: 'Show only selected trip' })).toHaveCount(0);
});

test('filter drafts and invalid ranges leave applied results intact, while valid inclusive ranges update cards and routes together', async ({ page }) => {
    await page.goto(atlas);
    await expect(page.getByText('2/2 routes')).toBeVisible();
    await expect.poll(() => camera(page)).toBeDefined();
    const before = (await camera(page))!;
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByLabel('Minimum days').fill('3');
    await page.getByLabel('Maximum days').fill('2');
    await expect(page.locator('[data-trip-id]')).toHaveCount(2);
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('alert')).toContainText('maximum must be at least the minimum');
    await expectAtlasUrl(page);
    await page.getByLabel('Minimum days').fill('2');
    await page.getByLabel('Minimum miles').fill('240');
    await page.getByLabel('Maximum miles').fill('240');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('[data-trip-id]')).toHaveCount(1);
    await expect(page.locator('[data-trip-id="coastal-test"]')).toBeVisible();
    await expect(page.getByText('1/1 routes')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Filters/ })).toBeFocused();
    await expect.poll(async () => (await camera(page))!.zoom).toBeCloseTo(before.zoom, 6);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.locator('[data-trip-id]')).toHaveCount(2);
    await expect(page.getByText('2/2 routes')).toBeVisible();
});

test('table sorting shares card order, retains unknown facts, and survives compact mode and report reloads', async ({ page }) => {
    await page.goto(atlas);
    await page.getByRole('button', { name: 'Expand trip panel' }).click();
    await page.getByRole('radio', { name: 'Table', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Table', exact: true })).toBeChecked();
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.locator('caption')).toBeInViewport();
    const caption = (await table.locator('caption').boundingBox())!;
    const tools = (await page.locator('.atlas-browser-tools').boundingBox())!;
    expect(caption.y).toBeGreaterThanOrEqual(tools.y + tools.height);
    await table.getByRole('button', { name: 'Miles', exact: true }).click();
    await expect(table.getByRole('columnheader', { name: 'Miles' })).toHaveAttribute('aria-sort', 'ascending');
    await expect(table.locator('[data-trip-id]').first()).toHaveAttribute('data-trip-id', 'coastal-test');
    await table.getByRole('button', { name: 'Miles', exact: true }).click();
    await expect(table.getByRole('columnheader', { name: 'Miles' })).toHaveAttribute('aria-sort', 'descending');
    await expect(table.locator('[data-trip-id]').last()).toHaveAttribute('data-trip-id', 'daily-test');
    await expect(table.locator('[data-trip-id="daily-test"]')).toContainText('Not recorded');
    await page.getByRole('button', { name: 'Use compact trip panel' }).click();
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.locator('[data-trip-id]').first()).toHaveAttribute('data-trip-id', 'coastal-test');
    await page.getByRole('button', { name: 'Expand trip panel' }).click();
    await expect(page.getByRole('radio', { name: 'Table', exact: true })).toBeChecked();
    await expect(table.locator('caption')).toBeInViewport();
    expect((await table.locator('caption').boundingBox())!.y).toBeGreaterThanOrEqual((await page.locator('.atlas-browser-tools').boundingBox())!.y + tools.height);
    await table.locator('[data-trip-id="coastal-test"]').getByRole('link', { name: /Read trip report/ }).click();
    await page.reload();
    await page.getByRole('link', { name: /Back to map/ }).first().click();
    await expect(page.locator('main.atlas-explorer')).toHaveAttribute('data-panel-state', 'expanded');
    await expect(page.getByRole('radio', { name: 'Table', exact: true })).toBeChecked();
    await expect(page.getByRole('combobox', { name: 'Sort trips' })).toHaveValue('miles-desc');
});

test('country and region choices apply as alternatives and replace redundant country-wide choices', async ({ page }) => {
    await page.goto(atlas);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByRole('checkbox', { name: 'Any region in Canada', exact: true }).check();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/country=CA/);
    await expect(page.locator('[data-trip-id]')).toHaveCount(1);
    await page.getByRole('button', { name: /^Filters/ }).click();
    const canada = page.getByRole('group', { name: 'Canada', exact: true });
    await canada.getByRole('button', { name: 'States and provinces' }).click();
    await canada.getByRole('checkbox', { name: 'British Columbia', exact: true }).check();
    await expect(canada.getByRole('checkbox', { name: 'Any region in Canada', exact: true })).not.toBeChecked();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/region=CA%2Fbritish-columbia/);
    expect(new URL(page.url()).searchParams.has('country')).toBe(false);
    await expect(page.locator('[data-trip-id]')).toHaveCount(1);
});

test('shared browse URLs and Back restore results, while a selection excluded by filters stays explicit', async ({ page }) => {
    await page.goto(`${atlas}?trip=daily-test&country=CA&sort=miles-asc`);
    await expect(page.getByText('Selected trip is outside these filters.')).toBeVisible();
    await expect(page.locator('[data-trip-id]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Show only selected trip' }).click();
    await expect(page.locator('[data-trip-id]')).toHaveCount(0);
    await expect(page.getByText('No trips match these filters.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.locator('[data-trip-id]')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Show only selected trip' })).toHaveAttribute('aria-pressed', 'false');
    await page.goBack();
    await expect(page.locator('[data-trip-id]')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Sort trips' })).toHaveValue('miles-asc');
});

test('phone filters reflow and table scrolling remains inside the drawer', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(atlas);
    await openList(page);
    await page.getByRole('button', { name: 'Expand trip panel' }).click();
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByLabel('Maximum miles').fill('1000');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.getByRole('radio', { name: 'Table', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Table', exact: true })).toBeChecked();
    const region = page.getByRole('region', { name: 'Trip comparison table' });
    await expect(region).toBeVisible();
    expect(await region.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await region.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const map = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
    const panel = (await page.locator('#atlas-trip-panel').boundingBox())!;
    expect(map.y + map.height).toBeCloseTo(panel.y, 0);
});

test('a late excluded route cannot return to filtered results or shared-road choices', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/test-trip/daily-route.geojson', async route => {
        await gate;
        await route.fulfill({ json: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-122, 47], [-123, 46], [-124, 45]] } } });
    });
    try {
        await page.goto(atlas);
        await page.getByRole('button', { name: /^Filters/ }).click();
        await page.getByLabel('Minimum miles').fill('240');
        await page.getByRole('button', { name: 'Apply filters' }).click();
        await expect(page.getByText('1/1 routes')).toBeVisible();
        release();
        await page.getByRole('button', { name: 'Fit results', exact: true }).click();
        await page.getByRole('button', { name: 'Collapse trip panel' }).click();
        await expect.poll(async () => (await paintedRoute(page)).count).toBeGreaterThan(30);
        const point = (await paintedRoute(page)).point;
        await page.getByTestId('trip-atlas-map').locator('canvas').click({ position: point });
        await expect(page).toHaveURL(/trip=coastal-test/);
        await expect(page.getByRole('group', { name: 'Trips sharing this road' })).toHaveCount(0);
        await expect(page.locator('[data-trip-id]')).toHaveCount(1);
        await expect(page.locator('[data-trip-id="daily-test"]')).toHaveCount(0);
    } finally { release(); }
});
