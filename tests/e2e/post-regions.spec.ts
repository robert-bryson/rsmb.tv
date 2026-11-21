import { expect, test } from '@playwright/test';

// This fixture supplies long labels and enough options to exercise the dropdown's scroll area.
test('country and region filters stay available across phone and desktop widths', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tests/e2e/fixtures/post-regions.html');
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const us = page.getByRole('group', { name: 'United States' });
    const country = us.getByRole('link', { name: 'United States', exact: true });
    const region = us.getByRole('link', { name: /Washington/ });
    expect(await country.evaluate(node => getComputedStyle(node).backgroundColor))
        .toBe(await region.evaluate(node => getComputedStyle(node).backgroundColor));
    await country.click();
    await expect(country).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('region-url')).toHaveText('/posts?country=US');
    for (const width of [1280, 800, 500, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(us.getByRole('link')).toHaveCount(9);
        await expect(us.getByRole('button')).toHaveCount(0);
        const panel = (await page.getByRole('region', { name: 'Post filters' }).boundingBox())!;
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.width).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
    await us.getByRole('link', { name: /Alaska/ }).click();
    await expect(page.getByTestId('region-url')).toHaveText('/posts?country=US&region=alaska');
});

test('long country and region names wrap inside phone layouts', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/tests/e2e/fixtures/post-regions.html');
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const region = page.getByRole('link', { name: /Región del Libertador General Bernardo O’Higgins/ });
    const country = page.getByRole('link', { name: 'South Georgia & South Sandwich Islands', exact: true });
    for (const link of [region, country]) {
        await expect(link).toBeVisible();
        expect(await link.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(await link.evaluate(node => node.clientWidth));
    }
    await country.focus();
    await expect(country).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('a shared region selection stays visible after reopening and resizing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/tests/e2e/fixtures/post-regions.html?country=US&region=alaska');
    const button = page.getByRole('button', { name: 'Filters', exact: true });
    await expect(button).toHaveAccessibleDescription('1 active filter');
    await button.click();
    const alaska = page.getByRole('group', { name: 'United States' }).getByRole('link', { name: /Alaska/ });
    await expect(alaska).toHaveAttribute('aria-current', 'page');
    await alaska.focus();
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
    await button.press('Enter');
    await expect(alaska).toHaveAttribute('aria-current', 'page');
    await alaska.focus();
    await expect(alaska).toBeInViewport({ ratio: 1 });
    await page.setViewportSize({ width: 320, height: 400 });
    await expect(alaska).toBeFocused();
    await expect(alaska).toBeInViewport({ ratio: 1 });
});

test('post filter review regressions: scrolling the trigger away dismisses without moving the reader back', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/tests/e2e/fixtures/post-regions.html');
    const button = page.getByRole('button', { name: 'Filters', exact: true });
    await button.click();
    await page.getByRole('link', { name: /Washington/ }).focus();
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(490);
});

test('post filter review regressions: the scrollbar and scroll area retain focus and keyboard navigation', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 320, height: 480 });
    await page.goto('/tests/e2e/fixtures/post-regions.html');
    const button = page.getByRole('button', { name: 'Filters', exact: true });
    await button.click();
    const panel = page.getByRole('region', { name: 'Post filters' });
    await panel.evaluate(node => { node.style.scrollbarGutter = 'stable'; });
    await panel.getByRole('link').first().focus();
    // WPE WebKit uses overlay scrollbars; Chromium exposes a native gutter.
    if (browserName === 'chromium') {
        await expect.poll(() => panel.evaluate(node => (node as HTMLElement).offsetWidth - node.clientWidth)).toBeGreaterThan(2);
    }
    const bounds = (await panel.boundingBox())!;
    await page.mouse.click(bounds.x + bounds.width - 7, bounds.y + bounds.height - 25);
    await expect(panel).toBeVisible();
    await expect(panel).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('link').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
    await expect(panel).toBeHidden();
});

for (const [fontSize, height] of [[16, 240], [16, 600], [32, 600]]) test(`post filter review regressions: a ${fontSize}px font keeps the last option reachable within ${height}px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height });
    await page.goto('/tests/e2e/fixtures/post-regions.html');
    await page.addStyleTag({ content: `html { font-size: ${fontSize}px; }` });
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Post filters' });
    await expect(panel).toBeVisible();
    await expect.poll(async () => { const bounds = (await panel.boundingBox())!; return bounds.y + bounds.height; }).toBeLessThanOrEqual(height);
    await panel.evaluate(node => { node.scrollTop = node.scrollHeight; });
    // A country's post count can follow the final link on another row.
    const last = panel.getByRole('link').last();
    await last.focus();
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
