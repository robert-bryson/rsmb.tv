import { expect, test } from '@playwright/test';

for (const width of [390, 1000]) {
    test(`subtitles keep paragraph semantics and secondary styling at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/tests/e2e/fixtures/post.html');
        const subtitle = page.getByText('(339mi. / 545km.)', { exact: true });
        const toc = page.getByRole('navigation', { name: 'Table of contents' });
        await expect(subtitle).toBeVisible();
        await expect(subtitle).toHaveJSProperty('tagName', 'P');
        await expect(subtitle).toHaveCSS('font-size', '15px');
        await expect(subtitle).toHaveCSS('font-weight', '400');
        await expect(subtitle).toHaveCSS('color', 'rgb(161, 161, 170)');
        await expect(subtitle).toHaveCSS('margin-top', '-8px');
        await expect(toc).not.toContainText('(339mi. / 545km.)');
        await expect(toc).not.toContainText('A motorcycle trip');
        await expect(toc).not.toContainText('Notes & details');
        if (width < 640) {
            await expect(toc.getByRole('button', { name: 'Expand' })).toHaveAttribute('aria-expanded', 'false');
            await toc.getByRole('button', { name: 'Expand' }).click();
        }
        await expect(toc.getByRole('link')).toHaveCount(4);
        await expect(page.getByRole('heading', { name: '(339mi. / 545km.)' })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
}

test('heading links use unique IDs and support reload and browser history', async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/post.html');
    const toc = page.getByRole('navigation', { name: 'Table of contents' });
    const stops = toc.getByRole('link', { name: 'First Stop', exact: true });
    await expect(stops).toHaveCount(2);
    await expect(stops.nth(0)).toHaveAttribute('href', '#first-stop');
    await expect(stops.nth(1)).toHaveAttribute('href', '#first-stop-1');
    await expect(toc.getByRole('link', { name: 'First Stop 1', exact: true })).toHaveAttribute('href', '#first-stop-1-1');

    await stops.nth(0).click();
    await expect(page).toHaveURL(/#first-stop$/);
    await stops.nth(1).click();
    await expect(page).toHaveURL(/#first-stop-1$/);
    await page.goBack();
    await expect(page).toHaveURL(/#first-stop$/);
    await page.goForward();
    await expect(page).toHaveURL(/#first-stop-1$/);
    await page.reload();
    await expect(page.locator('#first-stop-1')).toBeInViewport();
    await expect.poll(async () => Math.round((await page.locator('#first-stop-1').boundingBox())!.y)).toBe(96);
    await expect(page.getByRole('heading', { name: 'First Stop', exact: true }).nth(1)).toHaveAttribute('id', 'first-stop-1');
    const ids = await page.locator('[data-post-heading]').evaluateAll(nodes => nodes.map(node => node.id));
    expect(new Set(ids).size).toBe(ids.length);
});
