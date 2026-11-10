import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { auditAssets } from './fixtures/audit-assets';

test.skip(process.env.PAGE_RECOVERY !== '1', 'Run against the production-format fixture bundle.');
test.beforeEach(async ({ page }) => { await auditAssets(page); });

async function accessible(page: Page) {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    expect(result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([]);
}

for (const width of [390, 1280]) {
    for (const path of ['/', '/posts', '/projects', '/about', '/blog/reading-test', '/trips/coastal-test']) {
        test(`@a11y reading page ${path} at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(path);
            await expect(page.locator('h1')).toBeVisible();
            if (path.startsWith('/trips/')) await expect(page.locator('.trip-hero img')).toBeVisible();
            await accessible(page);
        });
    }

    test(`@a11y Projects disclosure and route focus at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/about');
        await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
        const toggle = page.getByRole('button', { name: 'Project pages', exact: true });
        const posts = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Posts', exact: true });
        await posts.focus();
        await page.getByRole('link', { name: 'Projects', exact: true }).hover();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(posts).toBeFocused();
        await toggle.focus();
        await page.keyboard.press('Space');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await accessible(page);
        await page.keyboard.press('Tab');
        await page.keyboard.press('Escape');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle).toBeFocused();
        await posts.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('main')).toBeFocused();
        await expect(page.locator('[data-route-announcement]')).toHaveText('Posts loaded');
        await expect(posts).toHaveAttribute('aria-current', 'page');
    });

    for (const [path, id] of [
        ['temperature-records', 'temperature-map'], ['tornado-tracks', 'tornado-map'], ['flights', 'flights-map'], ['adv-atlas', 'trip-atlas-map'],
    ]) {
        test(`@a11y map controls ${path} at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(`/projects/${path}/map`);
            await expect(page.getByTestId(id)).toHaveAttribute('data-map-state', 'ready', { timeout: 30_000 });
            await expect(page.getByRole('main')).toHaveCount(1);
            await expect(page.locator('h1')).toHaveCount(1);
            await accessible(page);
            if (path === 'temperature-records') {
                await page.getByRole('button', { name: 'Filters', exact: true }).click();
                await expect(page.getByRole('combobox', { name: 'State filter' })).toBeVisible();
                await accessible(page);
            } else if (path === 'tornado-tracks') {
                if (width < 768) await page.getByRole('button', { name: 'Filters & details', exact: true }).click();
                await expect(page.getByRole('combobox', { name: 'State', exact: true })).toBeVisible();
                await accessible(page);
            } else if (path === 'flights') {
                await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click();
                const dialog = page.getByRole('dialog', { name: 'Keyboard Shortcuts' });
                await expect(dialog).toBeVisible();
                await accessible(page);
                await dialog.getByRole('checkbox', { name: 'Enable character shortcuts' }).uncheck();
                await page.keyboard.press('Escape');
                await expect(dialog).toHaveCount(0);
                const toggle = page.getByRole('button', { name: /^(Show|Hide) stats panel$/ });
                const before = await toggle.getAttribute('aria-label');
                await page.getByRole('link', { name: /rsmb.tv/ }).focus();
                await page.keyboard.press('s');
                await expect(toggle).toHaveAttribute('aria-label', before!);
                await page.reload();
                await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click();
                await expect(page.getByRole('checkbox', { name: 'Enable character shortcuts' })).not.toBeChecked();
            }
        });
    }
}

test('@a11y regression scanner detects an introduced contrast defect', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('h1')).toBeVisible();
    await page.locator('main').evaluate(main => {
        const text = document.createElement('p');
        text.textContent = 'Accessibility regression fixture';
        text.style.cssText = 'color:#777;background:#888;font-size:14px';
        main.appendChild(text);
    });
    const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(result.violations.some(violation => violation.id === 'color-contrast')).toBe(true);
});

test.describe('touch navigation', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    test('@a11y touch disclosure toggles independently of the Projects overview link', async ({ page }) => {
        await page.goto('/about');
        const heading = page.getByRole('heading', { name: 'About', exact: true });
        await expect(heading).toBeVisible();
        const toggle = page.getByRole('button', { name: 'Project pages', exact: true });
        await toggle.tap();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await toggle.tap();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.tap();
        await page.touchscreen.tap(4, 200);
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Projects', exact: true }).tap();
        await expect(page).toHaveURL(/\/projects$/);
        await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    });
});
