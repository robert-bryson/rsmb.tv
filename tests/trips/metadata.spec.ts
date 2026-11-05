import { expect, test } from '@playwright/test';
import sitePages from '../../src/content/sitePages.json' with { type: 'json' };
import siteAliases from '../../src/content/siteAliases.json' with { type: 'json' };
import coastalTrip from '../fixtures/trip-content/trips/coastal-test.json' with { type: 'json' };
import fixturePosts from '../fixtures/trip-content/posts.json' with { type: 'json' };
import sharp from 'sharp';

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

    test('serves discovery resource bodies linked by the generated page', async ({ page, request }) => {
        await page.goto('/');
        const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
        expect(manifestHref).toBe('/site.webmanifest');
        const manifestResponse = await request.get(new URL(manifestHref!, page.url()).href);
        expect(manifestResponse.ok()).toBe(true);
        expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
        const manifest = await manifestResponse.json();
        expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'browser' });
        expect(manifest.icons).toHaveLength(2);
        for (const icon of manifest.icons) {
            const response = await request.get(new URL(icon.src, manifestResponse.url()).href);
            expect(response.ok()).toBe(true);
            expect(response.headers()['content-type']).toContain('image/png');
            const metadata = await sharp(await response.body()).metadata();
            expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes);
        }

        const feedHref = await page.locator('link[type="application/feed+json"]').getAttribute('href');
        expect(feedHref).toBe('/feed.json');
        const feedResponse = await request.get(new URL(feedHref!, page.url()).href);
        expect(feedResponse.ok()).toBe(true);
        // Vite serves application/json; Amplify supplies application/feed+json.
        expect(feedResponse.headers()['content-type']).toMatch(/^application\/(?:feed\+)?json(?:;|$)/);
        const feed = await feedResponse.json();
        expect(feed.version).toBe('https://jsonfeed.org/version/1.1');
        const expectedIds = fixturePosts.filter(post => post.development?.published !== false)
            .map(post => `https://rsmb.tv/${post.format === 'trip' ? 'trips' : 'blog'}/${post.slug}`);
        expect(feed.items.map((item: { id: string }) => item.id).sort()).toEqual([...expectedIds].sort());
        expect(feed.items.every((item: { content_text?: string }) => typeof item.content_text === 'string')).toBe(true);
        expect(JSON.stringify(feed)).not.toMatch(/unfinished-draft|development|Excluded synthetic draft/);

        const rssHref = await page.locator('link[type="application/rss+xml"]').getAttribute('href');
        const rssResponse = await request.get(new URL(rssHref!, page.url()).href);
        expect(rssResponse.ok()).toBe(true);
        const rss = await page.evaluate(xml => {
            const rssDocument = new DOMParser().parseFromString(xml, 'application/xml');
            return {
                error: rssDocument.querySelector('parsererror')?.textContent ?? null,
                ids: [...rssDocument.querySelectorAll('item > guid')].map(item => item.textContent),
                text: rssDocument.documentElement.textContent,
            };
        }, await rssResponse.text());
        expect(rss.error).toBeNull();
        expect(rss.ids.sort()).toEqual([...expectedIds].sort());
        expect(rss.text).not.toMatch(/unfinished-draft|Excluded synthetic draft/);

        for (const field of ['icon', 'favicon']) {
            const imageUrl = new URL(feed[field]);
            const response = await request.get(imageUrl.pathname);
            expect(response.ok()).toBe(true);
            expect(response.headers()['content-type']).toContain('image/png');
            const image = await sharp(await response.body()).metadata();
            expect(image.width).toBe(image.height);
            expect(image.width).toBeGreaterThanOrEqual(field === 'icon' ? 512 : 64);
        }
    });

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
