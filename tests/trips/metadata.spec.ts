import { expect, test } from '@playwright/test';
import sitePages from '../../src/content/sitePages.json' with { type: 'json' };
import siteAliases from '../../src/content/siteAliases.json' with { type: 'json' };
import coastalTrip from '../fixtures/trip-content/trips/coastal-test.json' with { type: 'json' };

test('exposes identity and feed links without horizontal overflow on narrow screens', async ({ page }) => {
    await page.goto('/about');
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole('link', { name: 'JSON Feed', exact: true })).toHaveAttribute('href', '/feed.json');
    await expect(footer.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('rel', 'me noopener noreferrer');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test.describe('crawler metadata', () => {
    test.use({ javaScriptEnabled: false });

    for (const [pathname, image] of [
        ['/projects/flights', 'https://rsmb.tv/images/flights/flight-globe.webp'],
        ['/projects/flights/map', 'https://rsmb.tv/images/flights/flight-globe.webp'],
        ['/trips/coastal-test', `https://rsmb.tv${coastalTrip.photos.find(photo => photo.id === coastalTrip.hero)!.src}`],
        ['/blog/reading-test', 'https://rsmb.tv/test-trip/photo-1-1600.svg'],
    ]) {
        test(`serves the page's image to link-preview crawlers: ${pathname}`, async ({ page }) => {
            await page.goto(pathname);
            await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', image);
            await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', image);
            const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
            expect(schema['@graph'][0].image).toBe(image);
        });
    }

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
                await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
                await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'max-image-preview:large');
                await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/site.webmanifest');
                await expect(page.locator('link[type="application/feed+json"]')).toHaveAttribute('href', '/feed.json');
                const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
                expect(schemas).toHaveLength(1);
                expect(() => JSON.parse(schemas[0])).not.toThrow();
            }
        });
    }
});

test('keeps the imported article image after React starts and clears its dimensions after navigation', async ({ page }) => {
    await page.route('**/test-trip/photo-1-1600.svg', route => route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#405b6b"/></svg>',
    }));
    await page.goto('/blog/reading-test');
    await expect(page.getByRole('heading', { level: 1, name: 'Reading test' })).toBeVisible();
    await expect(page.locator('[data-prerendered]')).toHaveCount(0);
    const image = 'https://rsmb.tv/test-trip/photo-1-1600.svg';
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', image);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', image);
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', 'An illustrated coast');
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1600');
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '1000');
    const articleImage = page.getByRole('img', { name: 'An illustrated coast', exact: true });
    await articleImage.scrollIntoViewIfNeeded();
    await expect.poll(() => articleImage.evaluate(element => ({ src: (element as HTMLImageElement).currentSrc, width: (element as HTMLImageElement).naturalWidth })))
        .toEqual({ src: image.replace('https://rsmb.tv', new URL(page.url()).origin), width: 1600 });
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(schemas.map(schema => JSON.parse(schema)).find(schema => schema['@type'] === 'BlogPosting')?.image).toBe(image);

    await page.getByRole('link', { name: 'Projects', exact: true }).first().click();
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://rsmb.tv/og/projects.png');
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
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
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'max-image-preview:large');
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
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, max-image-preview:large');
    await page.getByRole('link', { name: 'Back to posts' }).click();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://rsmb.tv/posts');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'max-image-preview:large');
});
