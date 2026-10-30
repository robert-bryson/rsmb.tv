import { expect, test, type Page } from '@playwright/test';

async function siteHoverColor(page: Page) {
    return page.evaluate(() => {
        // Let each engine normalize the token rather than assume decimal precision.
        const sample = document.createElement('span');
        sample.style.color = 'var(--color-violet-400)';
        document.body.append(sample);
        const color = getComputedStyle(sample).color;
        sample.remove();
        return color;
    });
}

test('article links and imported text use the site purple on hover', async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/post.html');
    const siteLink = page.getByRole('link', { name: 'Site link', exact: true });
    await siteLink.hover();
    const hoverColor = await siteHoverColor(page);
    await expect(siteLink).toHaveCSS('color', hoverColor);

    for (const name of ['Plain article link', 'Imported article link']) {
        const link = page.getByRole('link', { name, exact: true });
        const restingColor = await link.evaluate(node => getComputedStyle(node).color);
        await link.hover();
        await expect(link).toHaveCSS('color', hoverColor);
        await expect(link.locator('..')).toHaveCSS('text-decoration-line', 'underline');
        if (name === 'Imported article link') {
            await expect(link.locator('span')).toHaveCSS('color', hoverColor);
        }
        await siteLink.hover();
        await expect(link).toHaveCSS('color', restingColor);
    }
});

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
            await expect(toc.getByRole('button', { name: 'Collapse' })).toHaveAttribute('aria-expanded', 'true');
            await expect(toc.getByRole('link').first()).toBeVisible();
            await toc.getByRole('button', { name: 'Collapse' }).click();
            await expect(toc.getByRole('link').first()).toBeHidden();
            await toc.getByRole('button', { name: 'Expand' }).click();
        }
        await expect(toc.getByRole('link')).toHaveCount(4);
        await expect(toc.getByRole('link').first()).toBeVisible();
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

test('heading titles are permalinks with pointer and keyboard feedback', async ({ page, browserName }) => {
    await page.goto('/tests/e2e/fixtures/post.html');
    const heading = page.getByRole('heading', { name: 'First Stop', exact: true }).first();
    const permalink = heading.getByRole('link', { name: 'Link to First Stop', exact: true });
    const title = permalink.getByText('First Stop', { exact: true });
    const initialColor = await permalink.evaluate(node => getComputedStyle(node).color);
    const hoverColor = await siteHoverColor(page);
    // Safari on macOS includes links in traversal when Option is held.
    const tab = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';

    await title.hover();
    await expect(permalink).toHaveCSS('color', hoverColor);
    await title.click();
    await expect(page).toHaveURL(/#first-stop$/);

    await page.getByRole('link', { name: 'First Stop 1', exact: true }).click();
    await expect(page).toHaveURL(/#first-stop-1-1$/);
    await page.mouse.move(0, 0);
    await heading.getByRole('link', { name: 'Back to table of contents' }).focus();
    await page.keyboard.press(`Shift+${tab}`);
    await expect(permalink).toBeFocused();
    await expect(permalink).toHaveCSS('outline-style', 'solid');
    await expect(permalink).toHaveCSS('color', hoverColor);
    await page.keyboard.press(tab);
    await expect(heading.getByRole('link', { name: 'Back to table of contents' })).toBeFocused();
    await expect(permalink).toHaveCSS('color', initialColor);
    await page.keyboard.press(`Shift+${tab}`);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#first-stop$/);
});
