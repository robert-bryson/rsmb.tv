import { expect, test } from '@playwright/test';
import { atlas, atlasCamera, mockAtlasAssets } from './atlasTestHelpers';

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAtlasAssets(page);
});

test('card locations fit two lines, bold countries, and expand without selecting or moving the map', async ({ page, isMobile }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${atlas}?trip=coastal-test`);
    await expect.poll(() => new URL(page.url()).searchParams.get('camera')).toBeTruthy();
    const card = page.locator('[data-trip-id="coastal-test"]');
    const locations = card.locator('.atlas-locations');
    const before = page.url();
    await expect(page.getByRole('button', { name: /Show route/i })).toHaveCount(0);
    await expect(locations.getByRole('button', { name: 'Explore United States', exact: true })).toHaveCSS('font-weight', '700');
    await expect(locations.getByRole('button', { name: 'Explore Texas, United States', exact: true })).toHaveCount(0);
    const height = await locations.getByRole('button', { name: /^Explore/ }).evaluateAll(links => {
        const boxes = links.map(link => link.getBoundingClientRect());
        return Math.max(...boxes.map(box => box.bottom)) - Math.min(...boxes.map(box => box.top));
    });
    expect(height).toBeLessThanOrEqual(48.5);
    if (!isMobile) {
        const washington = locations.getByRole('button', { name: 'Explore Washington, United States', exact: true });
        const color = await washington.evaluate(element => getComputedStyle(element).color);
        await washington.hover();
        await expect(washington).not.toHaveCSS('color', color);
    }
    await locations.getByRole('button', { name: 'See all', exact: true }).click();
    await expect(locations.getByRole('button', { name: 'Explore Texas, United States', exact: true })).toBeVisible();
    await expect(locations.getByRole('button', { name: 'Explore Canada', exact: true })).toHaveCSS('font-weight', '700');
    await expect(page).toHaveURL(before);
    await expect(card).toHaveAttribute('data-selected', 'true');
    await locations.getByRole('button', { name: 'See less', exact: true }).click();
    await expect(locations.getByRole('button', { name: 'Explore Texas, United States', exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(before);
});

test('location clicks replace geographic filters and frame the place instead of the complete matching journey', async ({ page }) => {
    await page.goto(`${atlas}?trip=coastal-test&view=selected&sort=miles-asc`);
    await expect.poll(() => new URL(page.url()).searchParams.get('camera')).toBeTruthy();
    const card = page.locator('[data-trip-id="coastal-test"]');
    await card.getByRole('button', { name: 'Explore Washington, United States', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('region')).toBe('US/washington');
    await expect.poll(() => new URL(page.url()).searchParams.has('trip')).toBe(false);
    expect(new URL(page.url()).searchParams.has('view')).toBe(false);
    expect(new URL(page.url()).searchParams.get('sort')).toBe('miles-asc');
    await expect(page.locator('[data-trip-id]')).toHaveCount(1);
    await expect.poll(async () => (await atlasCamera(page))?.center[0]).toBeGreaterThan(-122);
    const region = (await atlasCamera(page))!;
    await card.getByRole('button', { name: 'Explore United States', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('country')).toBe('US');
    expect(new URL(page.url()).searchParams.has('region')).toBe(false);
    await expect.poll(async () => (await atlasCamera(page))?.zoom).toBeLessThan(region.zoom);
    await expect(page.getByRole('button', { name: /^Filters/ })).toBeFocused();
});

test('table locations support keyboard filtering and retain the result presentation', async ({ page }) => {
    await page.goto(`${atlas}?panel=expanded&results=table&country=CA`);
    const row = page.locator('[data-trip-id="coastal-test"]');
    await row.getByRole('button', { name: 'Explore Washington, United States', exact: true }).press('Enter');
    await expect.poll(() => new URL(page.url()).searchParams.get('region')).toBe('US/washington');
    expect(new URL(page.url()).searchParams.has('country')).toBe(false);
    await expect(page.getByRole('radio', { name: 'Table', exact: true })).toBeChecked();
    await expect(page.getByRole('button', { name: /^Filters/ })).toBeFocused();
});
