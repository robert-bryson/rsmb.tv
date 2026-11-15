import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { auditAssets } from './fixtures/audit-assets';

test.skip(process.env.PAGE_RECOVERY !== '1', 'Uses the production bundle and fixed post metadata.');
test.beforeEach(async ({ page }) => { await auditAssets(page); });

for (const width of [320, 1280]) {
    test(`@a11y post search keeps a visible focus outline in forced colors at ${width}px`, async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Forced-color emulation requires Chromium.');
        await page.emulateMedia({ forcedColors: 'active' });
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/posts');
        const search = page.getByRole('searchbox', { name: 'Search posts' });
        await search.focus();
        await expect(search).toBeFocused();
        const hasOutline = await search.evaluate(input => [input, input.parentElement!].some(element => {
            const style = getComputedStyle(element);
            return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
        }));
        expect(hasOutline).toBe(true);
    });

    test(`post search combines filters and clears with keyboard focus at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/posts?type=trips&tag=coast&country=CA');
        const search = page.getByRole('searchbox', { name: 'Search posts' });
        await search.pressSequentially('british columbia');
        await expect(search).toBeFocused();
        await expect(search).toHaveValue('british columbia');
        await expect(page.locator('main h2')).toHaveText(['Coastal test trip']);
        await expect(page.getByRole('status')).toHaveText('1 of 3 posts');
        expect(new URL(page.url()).searchParams.get('country')).toBe('CA');
        await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('british columbia');
        await search.press('Enter');
        await expect(search).toBeFocused();

        await search.fill('no matching post');
        await expect(page.getByText('No posts match these filters.')).toBeVisible();
        await expect(page.getByRole('status')).toHaveText('0 of 3 posts');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(accessibility.violations).toEqual([]);

        await search.press('Tab');
        await expect(page.getByRole('button', { name: 'Clear search' })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(search).toHaveValue('');
        await expect(search).toBeFocused();
        expect(new URL(page.url()).searchParams.get('country')).toBe('CA');
        await expect(page.locator('main h2')).toHaveText(['Coastal test trip']);

        await page.getByRole('button', { name: 'Clear all filters' }).click();
        await expect(page).toHaveURL(/\/posts$/);
        await expect(search).toBeFocused();
        await expect(page.getByRole('status')).toHaveText('3 posts');
        await expect(page.locator('main h2')).toHaveCount(3);
    });

    test(`post search survives reload, history, and article return at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/about');
        await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Posts' }).click();
        const search = page.getByRole('searchbox', { name: 'Search posts' });
        await expect(search).toBeVisible();
        const articleRequests: string[] = [];
        page.on('request', request => {
            if (/\/assets\/(reading-test|coastal-test|daily-test)-[^/]+\.js/.test(request.url())) articleRequests.push(request.url());
        });
        await search.pressSequentially('ordinary article');
        await expect(page.locator('main h2')).toHaveText(['Reading test']);
        expect(articleRequests).toEqual([]);
        await page.getByRole('navigation', { name: 'Post tags' }).getByRole('link', { name: 'coast', exact: true }).click();
        await expect(page).toHaveURL(/\/posts\?tag=coast&q=ordinary\+article$/);
        await page.goBack();
        await expect(page).toHaveURL(/\/posts\?q=ordinary\+article$/);
        await expect(search).toHaveValue('ordinary article');
        await page.goBack();
        await expect(page).toHaveURL(/\/about$/);
        await page.goForward();
        await expect(search).toHaveValue('ordinary article');
        await page.reload();
        await expect(search).toHaveValue('ordinary article');
        await expect(page.locator('main h2')).toHaveText(['Reading test']);
        const returnUrl = page.url();
        await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Reading test', exact: true }) }).click();
        await expect(page).toHaveURL(/\/blog\/reading-test$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Reading test', exact: true })).toBeVisible();
        expect(articleRequests.some(url => /\/assets\/reading-test-[^/]+\.js/.test(url))).toBe(true);
        await page.getByRole('link', { name: 'Back to posts', exact: true }).first().click();
        await expect(page).toHaveURL(returnUrl);
        await expect(search).toHaveValue('ordinary article');
        await expect(page.locator('main h2')).toHaveText(['Reading test']);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });

    test(`post search retains every character through repeated router transitions at ${width}px`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/posts?type=trips&tag=coast&country=CA');
        const search = page.getByRole('searchbox', { name: 'Search posts' });
        for (let attempt = 0; attempt < 20; attempt++) {
            const query = attempt % 2 === 0 ? 'british columbia' : 'ordinary article';
            await search.fill('');
            await search.pressSequentially(query);
            await expect(search).toHaveValue(query);
            await expect(search).toBeFocused();
            await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(query);
            expect(new URL(page.url()).searchParams.get('country')).toBe('CA');
        }
        expect(errors).toEqual([]);
    });
}
