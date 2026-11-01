import { expect, test } from '@playwright/test';
import { atlas, mockAtlasAssets } from './atlasTestHelpers';

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAtlasAssets(page);
});

test('trip cards scroll below the complete toolbar without showing through its edges', async ({ page }) => {
    await page.goto(`${atlas}?panel=compact`);
    const list = page.locator('#atlas-trip-list');
    await expect(page.locator('[data-trip-id]')).toHaveCount(2);
    await list.evaluate(element => { element.scrollTop = 200; });
    const tools = (await page.locator('.atlas-browser-tools').boundingBox())!;
    const results = (await list.boundingBox())!;
    expect(tools.y + tools.height).toBeLessThanOrEqual(results.y);
    const filter = page.getByRole('button', { name: /^Filters/ });
    const before = (await filter.boundingBox())!;
    await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect((await filter.boundingBox())!.y).toBeCloseTo(before.y, 0);
    await expect(filter).toBeInViewport();
});

test('header icons sort trips and reveal filters from a scrolled list', async ({ page }) => {
    await page.goto(`${atlas}?panel=compact`);
    const header = page.locator('#atlas-trip-panel header');
    const controls = header.getByRole('group', { name: 'Trip browsing controls' });
    const sort = controls.getByRole('button', { name: 'Sort trips' });
    const filters = controls.getByRole('button', { name: 'Filters', exact: true });
    await expect(controls).toBeVisible();
    for (const control of [sort, filters]) {
        const box = (await control.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(filters).toHaveText('');
    await sort.press('Enter');
    await expect(page.getByRole('radio', { name: 'Trip date · newest first', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(sort).toHaveAttribute('aria-expanded', 'false');
    await expect(sort).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('sort')).toBe('oldest');
    await page.locator('#atlas-trip-list').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await filters.click();
    await expect(filters).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('From date')).toBeInViewport();
    await page.getByLabel('Minimum miles').fill('240');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    const active = controls.getByRole('button', { name: 'Filters (1 active)', exact: true });
    await expect(active).toHaveAttribute('aria-expanded', 'false');
    await expect(active).toHaveText('1');
    await expect(active).toBeFocused();
    await expect(page.getByRole('form', { name: 'Filter trips' })).toHaveCount(0);
    await expect(page.locator('[data-trip-id]')).toHaveCount(1);
});

test('sort choices fit a narrow sheet, scroll to every option, and dismiss on Escape or an outside click', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`${atlas}?panel=compact`);
    const sort = page.getByRole('button', { name: 'Sort trips', exact: true });
    await sort.click();
    const choices = page.getByRole('group', { name: 'Sort trips', exact: true });
    await expect(choices).toBeVisible();
    const menu = (await choices.boundingBox())!;
    const panel = (await page.locator('#atlas-trip-panel').boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(panel.x);
    expect(menu.y + menu.height).toBeLessThanOrEqual(panel.y + panel.height);
    await choices.getByRole('radio', { name: 'Trip title · Z–A', exact: true }).click();
    await expect(sort).toHaveAttribute('data-atlas-tooltip', /Current order: Trip title · Z–A/);
    await expect(sort).toBeFocused();
    await sort.click();
    await page.keyboard.press('Escape');
    await expect(sort).toHaveAttribute('aria-expanded', 'false');
    await expect(sort).toBeFocused();
    await sort.click();
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await expect(sort).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('form', { name: 'Filter trips' })).toBeVisible();
});

test('expanded view icons select one layout and explain each view on keyboard focus', async ({ page, browserName }) => {
    await page.goto(`${atlas}?panel=expanded`);
    const views = page.getByRole('group', { name: 'Trip results view', exact: true });
    const cards = views.getByRole('radio', { name: 'Cards', exact: true });
    const table = views.getByRole('radio', { name: 'Table', exact: true });
    await expect(cards).toBeChecked();
    await expect(table).not.toBeChecked();
    expect((await views.boundingBox())!.width).toBeLessThanOrEqual(100);
    for (const view of [cards, table]) {
        const box = (await view.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await table.focus();
    await expect(table).toHaveAccessibleDescription(/Compare dates, riding days, mileage, and locations/);
    await expect(page.getByRole('tooltip')).toContainText('Select column headings to sort.');
    await expect(page.getByRole('tooltip')).toBeInViewport();
    await table.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await table.press('Space');
    await expect(table).toBeChecked();
    await expect(cards).not.toBeChecked();
    await expect(page.getByRole('table')).toBeVisible();
    await table.press('ArrowRight');
    await expect(cards).toBeChecked();
    await expect(table).not.toBeChecked();
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(cards).toHaveAccessibleDescription(/Browse trip photos, descriptions, and highlights/);
    await expect(page.getByRole('tooltip')).toContainText('Browse trip photos');
    await cards.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    await expect(page.getByTestId('atlas-control-tooltip')).toContainText('Choose how trips are ordered.');
});
