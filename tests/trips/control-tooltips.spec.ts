import { expect, test, type Locator, type Page } from '@playwright/test';
import { atlas, mockAtlasAssets } from './atlasTestHelpers';

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAtlasAssets(page);
});

async function hint(page: Page, control: Locator, text: RegExp) {
    await control.evaluate(element => (element as HTMLElement).blur());
    await control.focus();
    const tooltip = page.getByTestId('atlas-control-tooltip');
    await expect(tooltip).toContainText(text);
    await expect(control).toHaveAccessibleDescription(text);
    const box = (await tooltip.boundingBox())!;
    const root = (await page.locator('main.atlas-explorer').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(root.x);
    expect(box.y).toBeGreaterThanOrEqual(root.y);
    expect(box.x + box.width).toBeLessThanOrEqual(root.x + root.width);
    expect(box.y + box.height).toBeLessThanOrEqual(root.y + root.height);
}

test('Atlas icons explain their actions on focus, including current state and fullscreen', async ({ page }) => {
    await page.goto(`${atlas}?panel=expanded&results=table&trip=coastal-test&view=selected&milesMin=240`);
    await expect(page.getByText('1/1 routes')).toBeVisible();
    const iconHints: [string, RegExp][] = [
        ['Share map', /selected trip, filters, and view/],
        ['Sort trips', /Current order:/],
        ['Filters (2 active)', /year, riding days, distance, or location.*2 active filters/],
        ['Show only selected trip', /Show all matching trips again/],
        ['Reset filters', /Keep the selected trip and sort order/],
        ['Customize table columns', /change their order, or restore defaults/],
        ['Zoom in', /Zoom in on the map/],
        ['Zoom out', /see a wider area/],
        ['Enter fullscreen', /map and trip browser to fill the screen/],
    ];
    for (const [name, text] of iconHints) await hint(page, page.getByRole('button', { name, exact: true }), text);
    const missing = await page.locator('main.atlas-explorer button').evaluateAll(buttons => buttons
        .filter(button => button.querySelector('svg, .maplibregl-ctrl-icon') && button.getBoundingClientRect().width > 0)
        .filter(button => !button.getAttribute('data-atlas-tooltip'))
        .map(button => button.getAttribute('aria-label')));
    expect(missing).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('atlas-control-tooltip')).toHaveCount(0);
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).press('Enter');
    const exit = page.getByRole('button', { name: 'Exit fullscreen', exact: true });
    await expect(exit).toBeVisible();
    await hint(page, exit, /Exit fullscreen and return to the page layout/);
    await exit.press('Enter');
});

test('sorting and column drag handles explain their next action without blocking editors', async ({ page }) => {
    await page.goto(`${atlas}?panel=expanded&results=table`);
    const miles = page.getByRole('columnheader', { name: 'Miles' }).getByRole('button');
    await hint(page, miles, /miles.*shortest first/i);
    await miles.press('Enter');
    await expect(page.getByRole('columnheader', { name: 'Miles' })).toHaveAttribute('aria-sort', 'ascending');
    await hint(page, miles, /miles.*longest first/i);
    const customize = page.getByRole('button', { name: 'Customize table columns', exact: true });
    await customize.click();
    const editor = page.getByRole('dialog', { name: 'Table columns', exact: true });
    await expect(editor).toBeVisible();
    await expect(page.getByTestId('atlas-control-tooltip')).toHaveCount(0);
    await editor.getByRole('img', { name: 'Trip column is pinned', exact: true }).hover();
    await expect(page.getByTestId('atlas-control-tooltip')).toContainText('Trip names stay pinned as the first column.');
    await hint(page, editor.getByRole('button', { name: 'Reorder Motorcycle column', exact: true }), /Drag to reorder Motorcycle.*Space.*Escape cancels/);
    await hint(page, editor.getByRole('button', { name: 'Reset columns', exact: true }), /original order/);
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    await expect(page.getByTestId('atlas-control-tooltip')).toHaveCount(0);
});

test('browser Back updates the visible and accessible hint on a focused sort control', async ({ page }) => {
    await page.goto(`${atlas}?panel=expanded&results=table`);
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByLabel('Trip year').selectOption({ label: '2024' });
    await page.getByRole('button', { name: 'Apply filters' }).click();
    const sort = page.getByRole('button', { name: 'Sort trips', exact: true });
    await sort.click();
    await page.getByRole('radio', { name: 'Miles · shortest first', exact: true }).click();
    await page.mouse.move(0, 0);
    await hint(page, sort, /Current order: Miles · shortest first/);
    await page.goBack();
    await expect(sort).toBeFocused();
    await expect(page.getByTestId('atlas-control-tooltip')).toContainText('Current order: Trip date · newest first');
    await expect(sort).toHaveAccessibleDescription(/Current order: Trip date · newest first/);
});

test('collapsed drawer hints stay on screen and disappear when dragging starts', async ({ page, isMobile }) => {
    await page.goto(`${atlas}?panel=collapsed`);
    const handle = page.locator('#atlas-panel-toggle');
    await hint(page, handle, /Open the compact trip list.*Drag this tab to resize/);
    const box = (await handle.boundingBox())!;
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(page.getByTestId('atlas-control-tooltip')).toHaveCount(0);
    await page.mouse.move(start.x + (isMobile ? 0 : 220), start.y - (isMobile ? 220 : 0), { steps: 6 });
    await expect(page.getByTestId('atlas-control-tooltip')).toHaveCount(0);
    await page.mouse.up();
});

test('touching sort controls does not leave a tooltip over the choices', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Uses real tap input on a phone project.');
    await page.goto(`${atlas}?panel=expanded`);
    await page.getByRole('button', { name: 'Sort trips', exact: true }).tap();
    const choices = page.getByRole('group', { name: 'Sort trips', exact: true });
    await expect(choices).toBeVisible();
    await expect(page.getByTestId('atlas-control-tooltip')).toHaveCount(0);
    await choices.getByRole('radio', { name: 'Trip date · oldest first', exact: true }).tap();
    await expect(choices).toHaveCount(0);
    await expect(page.getByTestId('atlas-control-tooltip')).toHaveCount(0);
});
