import { expect, test } from '@playwright/test';

test('flight statistics opens by default and an explicit closed link stays closed', async ({ page }) => {
    await page.goto('/projects/flights/map?paths=0');
    const panel = page.getByTestId('stats-panel-content');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await page.getByRole('button', { name: 'Hide stats panel' }).click();
    await expect(panel).toHaveAttribute('data-state', 'closed');
    await page.reload();
    await expect(panel).toHaveAttribute('data-state', 'closed');
    await page.getByRole('button', { name: 'Show stats panel' }).click();
    await expect(panel).toHaveAttribute('data-state', 'open');
});

for (const width of [320, 390, 768, 1280]) {
    test(`filters and layers stay accessible without overlap at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await page.goto('/projects/flights/map?paths=0&stats=0');
        const filtersToggle = page.getByRole('button', { name: 'Toggle filters' });
        const layersToggle = page.getByRole('button', { name: 'Toggle layer options' });
        await filtersToggle.click();
        const filters = page.getByRole('dialog', { name: 'Filters' });
        await expect(filters).toBeVisible();
        const filterBounds = (await filters.boundingBox())!;
        const layersBounds = (await layersToggle.boundingBox())!;
        const intersects = filterBounds.x < layersBounds.x + layersBounds.width
            && filterBounds.x + filterBounds.width > layersBounds.x
            && filterBounds.y < layersBounds.y + layersBounds.height
            && filterBounds.y + filterBounds.height > layersBounds.y;
        expect(intersects, 'Layers button must not cover the Filters dialog').toBe(false);

        await layersToggle.click();
        await expect(layersToggle).toHaveAttribute('aria-expanded', 'true');
        await expect(filters).toHaveCount(0);
        await expect(filtersToggle).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByText('US States', { exact: true })).toBeVisible();
        const layerBounds = (await page.getByRole('region', { name: 'Map layers' }).boundingBox())!;
        expect(layerBounds.x).toBeGreaterThanOrEqual(0);
        expect(layerBounds.x + layerBounds.width).toBeLessThanOrEqual(width);
        expect(layerBounds.y).toBeGreaterThanOrEqual(layersBounds.y + layersBounds.height);
        expect(layerBounds.y + layerBounds.height).toBeLessThanOrEqual(720);
        await filtersToggle.click();
        await expect(layersToggle).toHaveAttribute('aria-expanded', 'false');
        await expect(filters).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
}
