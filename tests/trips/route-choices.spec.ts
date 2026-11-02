import { expect, test } from '@playwright/test';
import { atlas, mockAtlasAssets, paintedRoute } from './atlasTestHelpers';

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAtlasAssets(page);
});

for (const viewport of [{ width: 568, height: 280 }, { width: 768, height: 320 }]) {
    test(`shared-road choices remain reachable in an expanded ${viewport.width}×${viewport.height} view`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(`${atlas}?panel=expanded`);
        await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
        const canvas = page.getByTestId('trip-atlas-map').locator('canvas');
        const choices = page.getByRole('group', { name: 'Trips sharing this road' });
        for (const [id, title] of [['daily-test', 'Daily map test trip'], ['coastal-test', 'Coastal test trip']]) {
            await canvas.click({ position: (await paintedRoute(page)).point });
            await expect(choices).toBeVisible();
            const map = (await canvas.boundingBox())!;
            const box = (await choices.boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(map.x);
            expect(box.y).toBeGreaterThanOrEqual(map.y);
            expect(box.x + box.width).toBeLessThanOrEqual(map.x + map.width);
            expect(box.y + box.height).toBeLessThanOrEqual(map.y + map.height);
            const choice = choices.getByRole('button', { name: title, exact: true });
            await choice.scrollIntoViewIfNeeded();
            expect(await choice.evaluate(element => {
                const rect = element.getBoundingClientRect();
                return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
            })).toBe(true);
            await choice.click();
            await expect(choices).toHaveCount(0);
            await expect(page.getByTestId('trip-atlas-map')).toHaveAttribute('data-selected-trip', id);
        }
    });
}
