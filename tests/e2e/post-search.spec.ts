import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { auditAssets } from './fixtures/audit-assets';

test.skip(process.env.PAGE_RECOVERY !== '1', 'Uses the production bundle and fixed article bodies.');
test.beforeEach(async ({ page }) => { await auditAssets(page); });

for (const width of [320, 1280]) {
    test(`site search landing finds a passage after the trip body loads at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 700 });
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        let requested = false;
        await page.route(/\/assets\/coastal-test-[^/]+\.js$/, async route => {
            requested = true;
            await gate;
            await route.continue();
        });
        await page.goto('/posts');
        await page.getByRole('searchbox', { name: 'Search site' }).fill('the quiet harbor');
        const result = page.getByRole('region', { name: 'Search results' }).locator('a[href="/trips/coastal-test"]');
        await expect(result).toBeVisible();
        expect(requested).toBe(false);
        await result.click();
        await expect.poll(() => requested).toBe(true);
        expect(await page.locator('[data-site-search-match]').count()).toBe(0);
        release();
        const match = page.locator('[data-site-search-match]');
        await expect(match).toContainText('authored first-line indent');
        await expect(match).toBeFocused();
        await expect(page).toHaveURL(/\/trips\/coastal-test$/);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
        await expect.poll(() => match.evaluate(node => {
            const range = CSS.highlights?.get('site-search-result')?.values().next().value as Range | undefined;
            const bounds = range?.getBoundingClientRect() ?? node.getBoundingClientRect();
            const chapter = node.closest('.trip-chapter')?.querySelector(':scope > :is(h1,h2):first-child');
            const header = document.querySelector('.site-header');
            return bounds.top >= Math.max(0, header?.getBoundingClientRect().bottom ?? 0)
                + (chapter?.getBoundingClientRect().height ?? 0) + 8 && bounds.bottom <= window.innerHeight;
        })).toBe(true);
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(audit.violations).toEqual([]);
    });

    test(`site search landing supports Enter and phrases across article formatting at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 700 });
        await page.goto('/projects');
        const search = page.getByRole('searchbox', { name: 'Search site' });
        await search.fill('bold emphasized and code');
        const results = page.getByRole('region', { name: 'Search results' });
        await expect(results.getByRole('link').first()).toHaveAttribute('href', '/blog/reading-test');
        await search.press('Enter');
        const match = page.locator('[data-site-search-match]');
        await expect(match).toContainText('link text');
        await expect(match).toBeFocused();
        await expect(match).toBeInViewport({ ratio: 1 });
        await expect(page).toHaveURL(/\/blog\/reading-test$/);
        expect(await page.evaluate(() => {
            const range = CSS.highlights?.get('site-search-result')?.values().next().value as Range | undefined;
            return range?.toString() ?? 'bold, emphasized, and code';
        })).toBe('bold, emphasized, and code');
    });

    test(`site search landing reaches project text and another match on the current page at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 700 });
        await page.goto('/posts');
        const search = page.getByRole('searchbox', { name: 'Search site' });
        await search.fill('vagrants');
        await page.getByRole('region', { name: 'Search results' }).locator('a[href="/projects/anki-artisan"]').click();
        await expect(page.locator('[data-site-search-match]')).toContainText('vagrants');
        await expect(page.locator('[data-site-search-match]')).toBeFocused();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
        await search.fill('Microsoft');
        await page.getByRole('region', { name: 'Search results' }).locator('a[href="/about"]').click();
        await expect(page.locator('[data-site-search-match]')).toContainText('several years at Microsoft');
        await search.fill('hello@rsmb.tv');
        await page.getByRole('region', { name: 'Search results' }).locator('a[href="/about"]').click();
        await expect(page.locator('[data-site-search-match]')).toContainText('hello@rsmb.tv');
        await expect(page.locator('[data-site-search-match]')).toBeFocused();
        await expect(page.locator('[data-site-search-match]')).toBeInViewport({ ratio: 1 });
        await expect(page).toHaveURL(/\/about$/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });

    test(`site search landing preserves the reader position through history at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 700 });
        await page.goto('/posts');
        await page.getByRole('searchbox', { name: 'Search site' }).fill('quiet harbor');
        await page.getByRole('region', { name: 'Search results' }).locator('a[href="/trips/coastal-test"]').click();
        await expect(page.locator('[data-site-search-match]')).toBeFocused();
        await page.keyboard.press('Escape');
        await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' }));
        await expect.poll(() => page.evaluate(() => scrollY)).toBe(700);
        // Programmatic activation avoids changing the saved position to reveal the sticky navigation.
        await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'About', exact: true })
            .evaluate(node => (node as HTMLAnchorElement).click());
        await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
        await page.goBack();
        await expect(page).toHaveURL(/\/trips\/coastal-test$/);
        await expect.poll(() => page.evaluate(() => scrollY)).toBe(700);
        await expect(page.locator('[data-site-search-match]')).toHaveCount(0);
        await page.goForward();
        await expect(page).toHaveURL(/\/about$/);
        await page.goBack();
        await expect.poll(() => page.evaluate(() => scrollY)).toBe(700);
    });

    test(`post filter review regressions: all options fit the visible screen at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 480 });
        await page.goto('/posts');
        await page.getByRole('button', { name: 'Filters', exact: true }).click();
        const panel = page.getByRole('region', { name: 'Post filters' });
        await expect(panel).toBeVisible();
        await expect.poll(async () => {
            const bounds = (await panel.boundingBox())!;
            return bounds.y + bounds.height;
        }).toBeLessThanOrEqual(480);
        const bounds = (await panel.boundingBox())!;
        const header = (await page.getByRole('banner').boundingBox())!;
        expect(bounds.y).toBeGreaterThanOrEqual(Math.max(0, header.y + header.height));
        await panel.evaluate(node => { node.scrollTop = node.scrollHeight; });
        await expect(panel.getByRole('link').last()).toBeInViewport({ ratio: 1 });
        await page.setViewportSize({ width, height: 700 });
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(audit.violations).toEqual([]);
    });

    test(`post filters open below the right-aligned type controls at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/posts');
        const types = page.getByRole('navigation', { name: 'Post type' });
        const button = page.getByRole('button', { name: 'Filters', exact: true });
        const panel = page.getByRole('region', { name: 'Post filters' });
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByRole('navigation', { name: 'Post tags' })).toHaveCount(0);
        const typeBounds = (await types.boundingBox())!;
        const buttonBounds = (await button.boundingBox())!;
        expect(buttonBounds.x + buttonBounds.width).toBeCloseTo(typeBounds.x + typeBounds.width, 0);
        expect(buttonBounds.y).toBeGreaterThanOrEqual(typeBounds.y + typeBounds.height);
        if (width >= 640) {
            const title = (await page.getByRole('heading', { level: 1, name: 'Posts' }).boundingBox())!;
            expect(typeBounds.y + typeBounds.height / 2).toBeCloseTo(title.y + title.height / 2, 0);
        }
        await button.click();
        await expect(panel).toBeVisible();
        await expect(panel.getByRole('navigation', { name: 'Post regions' })).toBeVisible();
        await expect(panel.getByRole('button', { name: /See all/ })).toHaveCount(0);
        const bounds = (await panel.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        await panel.getByRole('navigation', { name: 'Post tags' }).getByRole('link', { name: 'coast', exact: true }).click();
        await expect(panel).toBeVisible();
        await panel.getByRole('navigation', { name: 'Post regions' }).getByRole('link', { name: 'Canada', exact: true }).click();
        await expect(page).toHaveURL(/\/posts\?tag=coast&country=CA$/);
        await expect(button).toHaveAccessibleDescription('2 active filters');
        await page.keyboard.press('Escape');
        await expect(button).toBeFocused();
        await expect(panel).toBeHidden();
        await button.click();
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(audit.violations).toEqual([]);
        await page.getByRole('heading', { level: 1, name: 'Posts' }).click();
        await expect(panel).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });

    test(`site search keeps large-text results within the viewport at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/projects');
        // Search can load before the page body. Include its layout, and use a
        // wider installed font so local font fallback cannot hide overflow.
        await expect(page.getByRole('list', { name: 'Projects', exact: true })).toBeVisible();
        await page.addStyleTag({ content: 'html { font-size: 32px; font-family: "DejaVu Sans", sans-serif; }' });
        await page.getByRole('searchbox', { name: 'Search site' }).fill('a');
        const results = page.getByRole('region', { name: 'Search results' });
        const last = results.getByRole('link').last();
        await expect(last).toBeVisible();
        const bounds = (await results.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
        await last.focus();
        await expect(last).toBeInViewport({ ratio: 1 });
        expect(await results.getByRole('link').evaluateAll(links => links.every(link => link.scrollWidth <= link.clientWidth))).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });

    test(`site navigation uses consistent visible gaps at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/projects');
        const navigation = page.getByRole('navigation', { name: 'Main navigation' });
        const posts = (await navigation.getByRole('link', { name: 'Posts', exact: true }).boundingBox())!;
        const projects = (await navigation.getByRole('link', { name: 'Projects', exact: true }).boundingBox())!;
        const arrow = (await navigation.getByRole('button', { name: 'Project pages', exact: true }).locator('svg').boundingBox())!;
        const about = (await navigation.getByRole('link', { name: 'About', exact: true }).boundingBox())!;
        const field = (await navigation.getByRole('searchbox', { name: 'Search site' }).locator('..').boundingBox())!;
        const gap = projects.x - posts.x - posts.width;
        expect(gap).toBeGreaterThan(0);
        expect(about.x - arrow.x - arrow.width).toBeCloseTo(gap, 1);
        if (width >= 640) expect(field.x - about.x - about.width).toBeCloseTo(gap, 1);
        else expect(field.y).toBeGreaterThanOrEqual(about.y + about.height);
    });

    test(`site search can retry a failed index request at ${width}px`, async ({ page }) => {
        let attempts = 0;
        await page.route(/\/assets\/.*site-search[^/]*\.js$/, async route => {
            attempts++;
            if (attempts === 1) await route.abort('failed');
            else await route.continue();
        });
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/posts');
        await page.getByRole('searchbox', { name: 'Search site' }).fill('quiet harbor');
        const retry = page.getByRole('button', { name: 'Try again', exact: true });
        await expect(retry).toBeVisible();
        await retry.click();
        await expect(page.getByRole('region', { name: 'Search results' }).locator('a[href="/trips/coastal-test"]')).toBeVisible();
        expect(attempts).toBe(2);
    });

    test(`@a11y site search keeps a visible focus outline in forced colors at ${width}px`, async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Forced-color emulation requires Chromium.');
        await page.emulateMedia({ forcedColors: 'active' });
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/posts');
        const search = page.getByRole('searchbox', { name: 'Search site' });
        await search.focus();
        await expect(search).toBeFocused();
        const outline = await search.evaluate(input => {
            const style = getComputedStyle(input);
            return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
        });
        expect(outline.style).not.toBe('none');
        expect(outline.width).toBeGreaterThanOrEqual(2);
    });

    test(`site search finds full article text, projects, and other pages at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const articleRequests: string[] = [];
        const indexRequests: string[] = [];
        page.on('request', request => {
            if (/\/assets\/(reading-test|coastal-test|daily-test)-[^/]+\.js/.test(request.url())) articleRequests.push(request.url());
            if (/\/assets\/.*site-search[^/]*\.js/.test(request.url())) indexRequests.push(request.url());
        });
        await page.goto('/projects');
        expect(indexRequests).toEqual([]);
        const search = page.getByRole('searchbox', { name: 'Search site' });
        const results = page.getByRole('region', { name: 'Search results' });
        await expect(page.locator('main').getByRole('searchbox')).toHaveCount(0);
        await search.pressSequentially('quiet harbor');
        const article = results.locator('a[href="/trips/coastal-test"]');
        await expect(article).toContainText('Coastal test trip');
        await expect(article).toContainText('quiet harbor');
        expect(articleRequests).toEqual([]);
        expect(indexRequests).toHaveLength(1);
        await expect(search).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        const bounds = await results.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(audit.violations).toEqual([]);

        await search.fill('python');
        await expect(results.locator('a[href="/projects/anki-artisan"]')).toBeVisible();
        await search.fill('federal');
        await expect(results.locator('a[href="/about"]')).toBeVisible();
        await search.fill('no matching page');
        await expect(results.getByText(/No results for/)).toBeVisible();
        await page.getByRole('button', { name: 'Clear site search' }).click();
        await expect(search).toHaveValue('');
        await expect(search).toBeFocused();
        await expect(results).toHaveCount(0);
        await search.fill('unfinished draft');
        await expect(results.getByText(/No results for/)).toBeVisible();
    });

    test(`site search supports keyboard navigation, Escape, and opening a result at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/posts?type=trips&tag=coast&country=CA');
        const search = page.getByRole('searchbox', { name: 'Search site' });
        const results = page.getByRole('region', { name: 'Search results' });
        await search.fill('quiet harbor');
        await expect(results.getByRole('link')).toHaveCount(1);
        await search.press('ArrowDown');
        await expect(results.getByRole('link')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(search).toBeFocused();
        await expect(results).toHaveCount(0);
        await search.fill('geospatial');
        await expect(results.locator('a[href="/about"]')).toBeVisible();
        await results.locator('a[href="/about"]').click();
        await expect(page).toHaveURL(/\/about$/);
        await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
        await expect(search).toHaveValue('');
        await search.fill('Anki Artisan');
        await expect(results.getByRole('link').first()).toContainText('Anki Artisan');
        await search.press('Enter');
        await expect(page).toHaveURL(/\/projects\/anki-artisan$/);
    });

    test(`post filters preserve legacy shared queries and article return at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/posts?q=ordinary+article');
        await expect(page.locator('main h2')).toHaveText(['Reading test']);
        await expect(page.getByRole('status')).toHaveText('1 of 3 posts matching “ordinary article”');
        await page.getByRole('button', { name: 'Filters', exact: true }).click();
        await page.getByRole('navigation', { name: 'Post tags' }).getByRole('link', { name: 'coast', exact: true }).click();
        await expect(page).toHaveURL(/\/posts\?tag=coast&q=ordinary\+article$/);
        await page.goBack();
        await expect(page).toHaveURL(/\/posts\?q=ordinary\+article$/);
        await page.reload();
        await expect(page.locator('main h2')).toHaveText(['Reading test']);
        const returnUrl = page.url();
        await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Reading test', exact: true }) }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Reading test', exact: true })).toBeVisible();
        await page.getByRole('link', { name: 'Back to posts', exact: true }).first().click();
        await expect(page).toHaveURL(returnUrl);
        await page.getByRole('button', { name: 'Clear all filters' }).click();
        await expect(page).toHaveURL(/\/posts$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Posts' })).toBeFocused();
        await expect(page.locator('main h2')).toHaveCount(3);
    });
}
