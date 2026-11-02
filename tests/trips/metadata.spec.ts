import { expect, test } from '@playwright/test';
import sitePages from '../../src/content/sitePages.json' with { type: 'json' };
import siteAliases from '../../src/content/siteAliases.json' with { type: 'json' };

test.describe('crawler metadata', () => {
    test.use({ javaScriptEnabled: false });

    for (const [pathname, canonicalPath] of [
        ...Object.keys(sitePages).map(pathname => [pathname, pathname]),
        ...Object.entries(siteAliases),
        ['/blog/reading-test', '/blog/reading-test'],
        ['/trips/reading-test', '/blog/reading-test'],
        ['/trips/coastal-test', '/trips/coastal-test'],
        ['/blog/coastal-test', '/trips/coastal-test'],
    ]) {
        test(`serves canonical metadata before JavaScript: ${pathname}`, async ({ page }) => {
            const variants = pathname === '/' ? ['/', '/index.html'] : [pathname, `${pathname}/`, `${pathname}.html`];
            for (const variant of variants) {
                const response = await page.goto(`${variant}?source=share#heading`);
                expect(response?.status()).toBe(200);
                await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://rsmb.tv${canonicalPath}`);
                await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `https://rsmb.tv${canonicalPath}`);
                await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
                const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
                expect(schemas).toHaveLength(1);
                expect(() => JSON.parse(schemas[0])).not.toThrow();
            }
        });
    }
});

for (const [pathname, canonicalPath] of [
    ['/index.html', '/'],
    ['/about.html', '/about'],
    ['/projects/parc.html', '/projects/parc'],
    ['/trips/coastal-test.html', '/trips/coastal-test'],
    ['/blog/coastal-test.html', '/trips/coastal-test'],
    ['/blog.html', '/posts'],
]) {
    test(`renders the public page from its HTML file: ${pathname}`, async ({ page }) => {
        await page.goto(`${pathname}?source=share#heading`);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://rsmb.tv${canonicalPath}`);
        await expect.poll(() => new URL(page.url()).pathname).toBe(canonicalPath);
        expect(new URL(page.url()).searchParams.get('source')).toBe('share');
        expect(new URL(page.url()).hash).toBe('#heading');
        await expect(page.locator('[data-prerendered]')).toHaveCount(0);
    });
}

test('clears article metadata after navigation and recovers from a missing page', async ({ page }) => {
    await page.goto('/blog/reading-test');
    await expect(page.locator('meta[property="article:published_time"]')).toHaveCount(1);
    await page.getByRole('link', { name: 'Projects', exact: true }).first().click();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://rsmb.tv/projects');
    await expect(page.locator('meta[property="article:published_time"]')).toHaveCount(0);
    await expect.poll(async () => (await page.locator('script[type="application/ld+json"]').allTextContents()).join('')).not.toContain('BlogPosting');

    await page.goto('/blog/missing-post');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    await page.getByRole('link', { name: 'Back to posts' }).click();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://rsmb.tv/posts');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});
