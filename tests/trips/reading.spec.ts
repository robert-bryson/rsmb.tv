import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

async function assets(page: Page) {
    await page.route('**/test-trip/**', async route => {
        if (route.request().url().endsWith('.geojson')) return route.fulfill({ json: {
            type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-122, 47], [-122.5, 46.7], [-123, 46]] },
        } });
        const width = Number(route.request().url().match(/-(\d+)\.svg/)?.[1] ?? 1600);
        await route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width * .625}"><rect width="100%" height="100%" fill="#405b6b"/><path d="M0 ${width / 2} L${width} ${width / 4}" stroke="#d1d5db" stroke-width="20"/></svg>` });
    });
}
test.beforeEach(async ({ page }) => assets(page));

test('emphasis and code inherit the article link color', async ({ page, isMobile }) => {
    await page.goto('/blog/reading-test');
    const link = page.getByRole('link', { name: 'bold, emphasized, and code link text' });
    const initialColor = await link.evaluate(element => getComputedStyle(element).color);
    for (const tag of ['strong', 'em', 'code']) {
        await expect(link.locator(tag)).toHaveCSS('color', initialColor);
    }
    if (!isMobile) {
        await link.hover();
        await expect(link).not.toHaveCSS('color', initialColor);
        for (const tag of ['strong', 'em', 'code']) {
            await expect.poll(async () => link.locator(tag).evaluate(element => {
                const anchor = element.closest('a')!;
                return getComputedStyle(element).color === getComputedStyle(anchor).color;
            })).toBe(true);
        }
    }
});

test('reading routes exclude visualization code and stay within the JavaScript budget', async ({ page }) => {
    for (const path of ['/', '/posts', '/blog/reading-test', '/trips/coastal-test']) {
        const requests: string[] = [];
        const collect = (request: { url(): string }) => requests.push(request.url());
        page.on('request', collect);
        await page.goto(path);
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Unfinished draft must stay private' })).toHaveCount(0);
        if (path.includes('coastal-test')) await expect(page.getByText('Opening story paragraph.')).toBeVisible();
        expect(requests.filter(url => /maplibre|FlightsMap|three-globe|three-/.test(url))).toEqual([]);
        const bytes = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => entry.name.endsWith('.js')).reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).encodedBodySize, 0));
        expect(bytes).toBeLessThan(path.includes('/trips/') ? 190_000 : path.includes('/blog/') ? 185_000 : 125_000);
        page.off('request', collect);
    }
});

test('the opening flows from the hero into prose, facts, map, and collapsed contents', async ({ page }) => {
    await page.goto('/trips/coastal-test');
    const intro = page.getByText('Opening story paragraph.');
    const hero = page.locator('.trip-hero');
    const facts = page.locator('[data-trip-facts-slot] dl');
    const contents = page.getByRole('navigation', { name: 'Table of contents' });
    await expect(facts).toHaveCount(1);
    await expect(contents).toHaveCount(1);
    const heroBox = (await hero.boundingBox())!;
    const introBox = (await intro.boundingBox())!;
    const factsBox = (await facts.boundingBox())!;
    expect(introBox.y - (heroBox.y + heroBox.height)).toBeGreaterThanOrEqual(0);
    expect(introBox.y - (heroBox.y + heroBox.height)).toBeLessThan(50);
    expect(factsBox.y).toBeGreaterThan(introBox.y + introBox.height);
    const mapBox = (await page.locator('[data-trip-map-viewport]').first().boundingBox())!;
    expect(mapBox.y).toBeGreaterThanOrEqual(factsBox.y + factsBox.height);
    expect((await contents.boundingBox())!.y).toBeGreaterThanOrEqual(mapBox.y + mapBox.height);
    await expect(contents.getByRole('button', { name: 'Expand' })).toHaveAttribute('aria-expanded', 'false');
    await contents.getByRole('button', { name: 'Expand' }).click();
    await expect(contents.getByRole('link', { name: 'First day', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
});

test('delivered HTML identifies the article without JavaScript', async ({ request }) => {
    const response = await request.get('/trips/coastal-test');
    const html = await response.text();
    expect(html).toContain('<title>Coastal test trip — rsmb</title>');
    expect(html).toContain('content="A synthetic two-day trip."');
    expect(html).toContain('href="https://rsmb.tv/trips/coastal-test"');
    expect(html).toContain('property="og:type" content="article"');
});

test('inline and gallery photos use the viewer and return keyboard focus', async ({ page }) => {
    await page.goto('/trips/coastal-test');
    for (const alt of ['Coast photograph 2', 'Coast photograph 4']) {
        const trigger = page.getByRole('img', { name: alt }).locator('..');
        await trigger.click();
        await expect(page.locator('.pswp--open')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.locator('.pswp--open')).toHaveCount(0);
        await expect(trigger).toBeFocused();
    }
    await page.getByRole('button', { name: 'View all 6 photos' }).click();
    await expect(page.locator('.pswp--open')).toBeFocused();
    await expect(page.locator('.pswp__counter')).toHaveText('1 / 6');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.pswp__counter')).toHaveText('2 / 6');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'View all 6 photos' })).toBeFocused();
    expect(page.context().pages()).toHaveLength(1);
});

test('photo navigation continues between galleries in both directions', async ({ page, isMobile }) => {
    await page.goto('/trips/coastal-test');
    const caption = page.locator('.pswp__item[aria-hidden="false"] .pswp__dynamic-caption');
    const navigate = async (direction: 'Next' | 'Previous') => {
        // PhotoSwipe hides arrow buttons on touch devices.
        if (isMobile) await page.keyboard.press(direction === 'Next' ? 'ArrowRight' : 'ArrowLeft');
        else await page.getByRole('button', { name: direction }).click();
    };
    const lastPhoto = page.getByRole('link', { name: 'Coast photograph 3' });
    await lastPhoto.click();
    await expect(page.locator('.pswp--open')).toBeFocused();
    await expect(page.locator('.pswp__counter')).toHaveText('2 / 4');
    await navigate('Next');
    await expect(caption).toHaveText('A view from stop 5.');
    await expect(page.locator('.pswp__counter')).toHaveText('3 / 4');
    await navigate('Previous');
    await expect(caption).toHaveText('A view of <harbor> & "coast".');
    await page.keyboard.press('Escape');
    await expect(page.locator('.pswp--open')).toHaveCount(0);
    await expect(lastPhoto).toBeFocused();

    const firstPhoto = page.getByRole('link', { name: 'Coast photograph 5' });
    await firstPhoto.click();
    await expect(page.locator('.pswp--open')).toBeFocused();
    await navigate('Previous');
    await expect(caption).toHaveText('A view of <harbor> & "coast".');
    await page.keyboard.press('ArrowRight');
    await expect(caption).toHaveText('A view from stop 5.');
    await page.keyboard.press('Escape');
    await expect(page.locator('.pswp--open')).toHaveCount(0);
    await expect(firstPhoto).toBeFocused();
});

test('photo captions render as literal text in the gallery, inline, and hero viewers', async ({ page }) => {
    await page.goto('/trips/coastal-test');
    const caption = page.locator('.pswp__item[aria-hidden="false"] .pswp__dynamic-caption');
    for (const [alt, text] of [
        ['Coast photograph 2', 'A view from stop 2.'],
        ['Coast photograph 3', 'A view of <harbor> & "coast".'],
        ['Coast photograph 4', 'A view from stop 4.'],
    ]) {
        await page.getByRole('img', { name: alt }).locator('..').click();
        await expect(page.locator('.pswp--open')).toBeFocused();
        await expect(caption).toHaveText(text);
        await expect(caption).toBeVisible();
        await expect(caption.locator('harbor')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(page.locator('.pswp--open')).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'View all 6 photos' }).click();
    await expect(page.locator('.pswp--open')).toBeFocused();
    await expect(caption).toHaveText('A view from stop 1.');
    await page.keyboard.press('ArrowRight');
    await expect(caption).toHaveText('A view from stop 2.');
    await expect(page.locator('.pswp__item[aria-hidden="false"] .pswp__img').last())
        .toHaveAttribute('alt', 'Coast photograph 2');
});

test('gallery sizes reflect the actual tile instead of the whole phone', async ({ page, isMobile }) => {
    await page.goto('/trips/coastal-test');
    const photo = page.getByRole('img', { name: 'Coast photograph 2' });
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.currentSrc)).toContain(isMobile ? '-960.svg' : '-480.svg');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
});

test('gallery captions support hover, keyboard focus, touch, and reduced motion', async ({ page, isMobile }) => {
    await page.goto('/trips/coastal-test');
    const figure = page.locator('.trip-gallery-photo').filter({ has: page.getByRole('img', { name: 'Coast photograph 2' }) });
    const caption = figure.locator('figcaption');
    const image = figure.locator('img');
    const trigger = figure.locator('a');
    await figure.scrollIntoViewIfNeeded();
    if (isMobile) {
        await expect(caption).toHaveCSS('position', 'static');
        await expect(caption).toBeVisible();
    } else {
        await page.mouse.move(0, 0);
        await expect(caption).toHaveCSS('opacity', '0');
        await trigger.hover();
        await expect(caption).toHaveCSS('opacity', '1');
        await expect(image).toHaveCSS('scale', '1.025');
        await trigger.focus();
        await page.keyboard.press('Escape');
        await expect(caption).toHaveCSS('opacity', '0');
        await page.mouse.move(0, 0);
        await trigger.blur();
        await trigger.focus();
        await expect(caption).toHaveCSS('opacity', '1');
        await expect(figure.locator('.image-caption-frame')).toHaveCSS('outline-style', 'solid');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(image).toHaveCSS('scale', 'none');
        await expect(caption).toHaveCSS('transition-duration', '0s');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
});

test('unavailable WebGL leaves the story and static route usable', async ({ page }) => {
    await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext; });
    await page.goto('/trips/coastal-test');
    await page.locator('[data-trip-map]').first().scrollIntoViewIfNeeded();
    await expect(page.getByText('Interactive map unavailable.', { exact: false })).toBeVisible();
    await expect(page.getByText('Opening story paragraph.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download route (GeoJSON)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Coastal test trip' })).toBeVisible();
});

test('failed route and photo requests retain surrounding content', async ({ page }) => {
    await page.route('**/test-trip/route.geojson', route => route.fulfill({ status: 503 }));
    await page.route('**/test-trip/photo-4-*', route => route.fulfill({ status: 404 }));
    await page.goto('/trips/coastal-test');
    await page.locator('[data-trip-map]').first().scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Retry route', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download route (GeoJSON)' })).toBeVisible();
    await page.getByText('An inline photograph closes the story.').scrollIntoViewIfNeeded();
    await expect(page.getByText('Photo unavailable')).toBeVisible();
    await expect(page.getByText('A view from stop 4.')).toBeVisible();
});

test('return navigation preserves the list filter and header focus stays visible', async ({ page }) => {
    await page.goto('/posts?type=trips&tag=coast');
    await page.getByRole('link', { name: /Coastal test trip/ }).click();
    await expect(page.getByText('Opening story paragraph.')).toBeVisible();
    await page.getByRole('link', { name: '← Back to posts' }).first().click();
    await expect(page).toHaveURL(/\/posts\?type=trips&tag=coast$/);
    await page.getByRole('link', { name: /Coastal test trip/ }).click();
    await page.getByText('An inline photograph closes the story.').scrollIntoViewIfNeeded();
    const logo = page.getByRole('link', { name: 'rsmb', exact: true });
    await logo.focus();
    await expect.poll(async () => (await logo.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
});


test('map actions appear on the map and attribution starts collapsed', async ({ page }) => {
    const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#999' } }).png().toBuffer();
    await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({
        contentType: 'image/png',
        body: tile,
    }));
    await page.route('https://demotiles.maplibre.org/**', route => route.fulfill({ body: '' }));
    await page.goto('/trips/coastal-test');
    await page.locator('[data-trip-map]').first().scrollIntoViewIfNeeded();
    const map = page.locator('.maplibregl-map').first();
    const download = map.getByRole('link', { name: 'Download route (GeoJSON)' });
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute('href', /route.geojson$/);
    await expect(page.getByRole('combobox', { name: 'Map style' })).toHaveCount(0);
    const reset = map.getByRole('button', { name: 'Show full route' });
    // The fixture starts at a stop, so the full-route action must be available.
    await expect(reset).toBeVisible();
    await reset.click();
    await expect(reset).toBeHidden();
    const attribution = map.locator('.maplibregl-ctrl-attrib');
    await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);
    await map.getByLabel('Toggle attribution').click();
    await expect(attribution).toHaveClass(/maplibregl-compact-show/);
    await map.getByLabel('Toggle attribution').click();
    await expect(attribution).not.toHaveClass(/maplibregl-compact-show/);
    await map.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(reset).toBeVisible();
    await reset.click();
    await expect(reset).toBeHidden();
});
