import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

test('search match review: native summary keeps its keyboard order', async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/search-match.html?case=summary');
    await page.getByRole('link', { name: 'Find passage', exact: true }).click();
    const summary = page.locator('summary');
    await expect(summary).toBeFocused();
    await expect(summary).not.toHaveAttribute('tabindex');
    expect(await summary.evaluate(node => node.tabIndex)).toBe(0);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Next control' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(summary).toBeFocused();
});

test('search match review: transparent text cannot win over a visible passage', async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/search-match.html?case=transparent');
    await page.getByRole('link', { name: 'Find passage', exact: true }).click();
    await expect(page.locator('[data-site-search-match]')).toHaveAttribute('id', 'match');
});

for (const mode of ['code', 'nested']) test(`search match review: the passage is revealed inside ${mode} scroll areas`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 600 });
    await page.goto(`/tests/e2e/fixtures/search-match.html?case=${mode}`);
    await page.getByRole('link', { name: 'Find passage', exact: true }).click();
    await expect(page.locator('[data-site-search-match]')).toBeFocused();
    await expect.poll(() => page.locator('#scroller').evaluate(node => {
        const range = CSS.highlights.get('site-search-result')?.values().next().value as Range | undefined;
        if (!range) return false;
        const target = range.getBoundingClientRect();
        const area = node.getBoundingClientRect();
        return target.left >= area.left && target.right <= area.right && target.top >= area.top && target.bottom <= area.bottom;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('search match review: large text remains visible on a short screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 240 });
    await page.goto('/tests/e2e/fixtures/search-match.html?case=short');
    await page.addStyleTag({ content: 'html { font-size:32px; }' });
    await page.getByRole('link', { name: 'Find passage', exact: true }).click();
    await expect(page.locator('[data-site-search-match]')).toBeFocused();
    await expect.poll(() => page.locator('#match').evaluate(node => {
        const range = CSS.highlights.get('site-search-result')?.values().next().value as Range | undefined;
        const bounds = range?.getBoundingClientRect() ?? node.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= innerHeight;
    })).toBe(true);
});
