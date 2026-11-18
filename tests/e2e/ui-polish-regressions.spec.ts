import { expect, test } from '@playwright/test';
import { auditAssets } from './fixtures/audit-assets';

test.use({ reducedMotion: 'reduce' });
test.beforeEach(async ({ page }) => { await auditAssets(page); });

test('tornado intensity buttons fit inside a narrow phone panel', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/projects/tornado-tracks/map');
    await page.getByRole('button', { name: 'Filters & details', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Tornado controls and details' });
    await expect(panel.getByRole('button', { name: 'EF5', exact: true })).toBeVisible();
    const overflow = await panel.evaluate(element => element.scrollWidth - element.clientWidth);
    expect(overflow, 'The EF buttons must wrap instead of creating a horizontal scroll area').toBe(0);
});

test('tornado playback controls remain reachable with enlarged text', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/projects/tornado-tracks/map');
    await expect(page.getByRole('button', { name: '10yr', exact: true })).toBeVisible();
    await page.locator('html').evaluate(element => { element.style.fontSize = '200%'; });
    for (const name of ['Prev', 'Play', 'Next', '1yr', '10yr']) {
        const bounds = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width, `${name} must fit inside the viewport`).toBeLessThanOrEqual(320);
    }
});
