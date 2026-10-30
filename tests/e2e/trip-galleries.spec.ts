import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectSuitableImageSource } from '../responsive-images';
import { scrollbarTest } from '../trips/scrollbars';

async function galleryAssets(page: Page) {
    await page.route('**/gallery-fixture/**', async route => {
        const [, rawWidth, rawHeight, rawSize] = route.request().url().match(/\/(\d+)x(\d+)\/(\d+)\.svg/)!;
        const width = Number(rawSize);
        const height = width * Number(rawHeight) / Number(rawWidth);
        await route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#405b6b"/><path d="M0 ${height * .8} L${width} ${height * .4}" stroke="#d1d5db" stroke-width="20"/></svg>` });
    });
}

test.beforeEach(async ({ page }) => {
    await galleryAssets(page);
    await page.goto('/tests/e2e/fixtures/trip-galleries.html');
});

async function frames(gallery: Locator) {
    return gallery.locator('.image-caption-frame').evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect();
        const image = element.querySelector('img')!;
        return { x: box.x, y: box.y, width: box.width, height: box.height, ratio: Number(image.getAttribute('width')) / Number(image.getAttribute('height')) };
    }));
}

test('pairs fill the gallery and preserve equal heights and intrinsic proportions', async ({ page }) => {
    for (const width of [320, 390, 800, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const group of ['pair', 'mixed']) {
            const gallery = page.locator(`[data-gallery-example="${group}"] .trip-gallery-grid`);
            const box = (await gallery.boundingBox())!;
            const [left, right] = await frames(gallery);
            expect(left.x).toBeCloseTo(box.x, 0);
            expect(right.x + right.width).toBeCloseTo(box.x + box.width, 0);
            expect(right.x - left.x - left.width).toBeCloseTo(12, 0);
            expect(left.y).toBeCloseTo(right.y, 0);
            expect(left.height).toBeCloseTo(right.height, 0);
            expect(left.width / left.height).toBeCloseTo(left.ratio, 2);
            expect(right.width / right.height).toBeCloseTo(right.ratio, 2);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
});

scrollbarTest('adaptive galleries fit the page with classic scrollbars', async ({ page, browserName }) => {
    await page.addStyleTag({ content: 'html { overflow-y: scroll; scrollbar-gutter: stable; } ::-webkit-scrollbar { width: 15px; }' });
    for (const width of [320, 640, 1184, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const layout = await page.evaluate(() => ({
            pageWidth: document.documentElement.getBoundingClientRect().width,
            scrollWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
        }));
        if (browserName === 'chromium') expect(width - layout.pageWidth).toBe(15);
        expect(layout.scrollWidth).toBe(layout.viewportWidth);
        const gallery = page.locator('[data-gallery-example="mixed"] .trip-gallery-grid');
        const box = (await gallery.boundingBox())!;
        expect(box.width).toBeCloseTo(Math.min(1152, layout.pageWidth - 32), 0);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(layout.pageWidth);
    }
});

test('the image content retains its intrinsic ratio inside the gallery frame', async ({ page }) => {
    for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const group of ['mixed', 'collage', 'panorama']) {
            const photos = page.locator(`[data-gallery-example="${group}"] img`);
            for (const photo of await photos.all()) {
                await photo.scrollIntoViewIfNeeded();
                await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
                const geometry = await photo.evaluate(image => {
                    const box = image.getBoundingClientRect();
                    const ratio = Number(image.getAttribute('width')) / Number(image.getAttribute('height'));
                    return { width: box.width, height: box.height, ratio };
                });
                expect(Math.abs(geometry.width / geometry.ratio - geometry.height)).toBeLessThan(0.05);
            }
        }
    }
});

test('hover and keyboard focus keep the complete photo inside its frame', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const figure = page.locator('[data-gallery-example="mixed"] figure').first();
    const image = figure.locator('img');
    const frame = figure.locator('.image-caption-frame');
    await image.scrollIntoViewIfNeeded();
    for (const activate of [() => image.hover(), () => figure.locator('a').focus()]) {
        await activate();
        // Include any transition: a transient zoom also clips the photograph.
        await page.waitForTimeout(220);
        const photoBox = (await image.boundingBox())!;
        const frameBox = (await frame.boundingBox())!;
        expect(photoBox.x).toBeGreaterThanOrEqual(frameBox.x - 0.05);
        expect(photoBox.y).toBeGreaterThanOrEqual(frameBox.y - 0.05);
        expect(photoBox.x + photoBox.width).toBeLessThanOrEqual(frameBox.x + frameBox.width + 0.05);
        expect(photoBox.y + photoBox.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 0.05);
        await page.mouse.move(0, 0);
    }
});

test('a portrait can span two filled rows and changing the viewport preserves focused photo links', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const gallery = page.locator('[data-gallery-example="collage"] .trip-gallery-grid');
    const [portrait, ...landscapes] = await frames(gallery);
    const rows = [...new Set(landscapes.map(frame => Math.round(frame.y)))];
    expect(rows).toHaveLength(2);
    const bottom = Math.max(...landscapes.map(frame => frame.y + frame.height));
    expect(portrait.y).toBeCloseTo(landscapes[0].y, 0);
    expect(portrait.y + portrait.height).toBeCloseTo(bottom, 0);
    for (const frame of landscapes) expect(frame.width / frame.height).toBeCloseTo(frame.ratio, 2);
    expect(portrait.width / portrait.height).toBeCloseTo(portrait.ratio, 2);
    const links = gallery.locator('a');
    expect(await gallery.locator('img').evaluateAll(images => images.map(image => image.getAttribute('alt'))))
        .toEqual(Array.from({ length: 5 }, (_, index) => `collage photo ${index + 1}`));
    await links.nth(2).focus();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(links.nth(2)).toBeFocused();
    expect(await gallery.locator('figure').evaluateAll(figures => figures.every(figure => getComputedStyle(figure).gridRowEnd === 'span 1'))).toBe(true);
    const narrow = await frames(gallery);
    for (const frame of narrow) expect(frame.width / frame.height).toBeCloseTo(frame.ratio, 2);
});

test('five landscapes form two complete rows with different photo counts', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const gallery = page.locator('[data-gallery-example="uneven"] .trip-gallery-grid');
    const box = (await gallery.boundingBox())!;
    const photos = await frames(gallery);
    const rows = new Map<number, typeof photos>();
    for (const photo of photos) {
        const y = Math.round(photo.y);
        rows.set(y, [...(rows.get(y) ?? []), photo]);
    }
    expect([...rows.values()].map(row => row.length).sort()).toEqual([2, 3]);
    for (const row of rows.values()) {
        expect(row[0].x).toBeCloseTo(box.x, 0);
        expect(row.at(-1)!.x + row.at(-1)!.width).toBeCloseTo(box.x + box.width, 0);
        for (const photo of row) expect(photo.height).toBeCloseTo(row[0].height, 0);
    }
});

test('six mixed photos use a compact two-row composition', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const gallery = page.locator('[data-gallery-example="six"] .trip-gallery-grid');
    const photos = await frames(gallery);
    const [portrait, ...landscapes] = photos;
    expect(new Set(landscapes.map(frame => Math.round(frame.y))).size).toBe(2);
    expect(portrait.y + portrait.height).toBeCloseTo(Math.max(...landscapes.map(frame => frame.y + frame.height)), 0);
    expect((await gallery.boundingBox())!.height).toBeLessThan(600);
});

test('single portraits follow the text column and panoramas retain full-width frames', async ({ page }) => {
    for (const width of [320, 800, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const body = (await page.locator('[data-text-body]').boundingBox())!;
        const portrait = (await page.locator('[data-gallery-example="portrait"] .image-caption-frame').boundingBox())!;
        expect(portrait.x).toBeCloseTo(body.x, 0);
        expect(portrait.width).toBeCloseTo(body.width, 0);
        const landscape = (await page.locator('[data-gallery-example="landscape"] .image-caption-frame').boundingBox())!;
        expect(landscape.width).toBeCloseTo(Math.min(1152, width - 32), 0);
        const gallery = page.locator('[data-gallery-example="panorama"] .trip-gallery-grid');
        const photo = (await frames(gallery))[1];
        expect(photo.width).toBeCloseTo((await gallery.boundingBox())!.width, 0);
        expect(photo.width / photo.height).toBeCloseTo(photo.ratio, 2);
    }
});

test('standalone photos follow their layout and retain their image height after failure', async ({ page }) => {
    for (const width of [320, 768, 1184, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const body = (await page.locator('[data-text-body]').boundingBox())!;
        const pageWidth = await page.evaluate(() => document.documentElement.getBoundingClientRect().width);
        for (const group of ['portrait', 'landscape', 'panorama']) {
            const example = page.locator(`[data-photo-example="${group}"]`);
            const figure = example.locator('figure');
            const box = (await figure.boundingBox())!;
            const expectedWidth = group === 'portrait' ? body.width : group === 'panorama'
                ? pageWidth : Math.min(1152, pageWidth - 32);
            expect(box.width).toBeCloseTo(expectedWidth, 0);
            expect(box.x).toBeCloseTo((pageWidth - expectedWidth) / 2, 0);
            const photo = example.getByRole('img');
            const before = (await photo.boundingBox())!;
            await photo.dispatchEvent('error');
            await expect(example.getByText('Photo unavailable')).toBeVisible();
            const after = (await example.getByRole('img').boundingBox())!;
            expect(after.width).toBeCloseTo(before.width, 0);
            expect(after.height).toBeCloseTo(before.height, 0);
        }
        // Load the images again so each viewport exercises both states.
        await page.reload();
    }
});

test('long standalone captions fit the photo on pointer and touch screens', async ({ browser }) => {
    for (const hasTouch of [false, true]) {
        const context = await browser.newContext({ viewport: { width: 320, height: 1000 }, hasTouch });
        try {
            const page = await context.newPage();
            await galleryAssets(page);
            await page.goto('/tests/e2e/fixtures/trip-galleries.html');
            for (const width of [320, 390, 800, 1440]) {
                await page.setViewportSize({ width, height: 1000 });
                for (const group of ['portrait', 'panorama']) {
                    const figure = page.locator(`[data-photo-example="${group}"] figure`);
                    await figure.locator('a').focus();
                    const caption = figure.locator('figcaption');
                    await expect(caption).toBeVisible();
                    const bounds = await caption.evaluate(element => ({
                        width: element.clientWidth, scrollWidth: element.scrollWidth,
                    }));
                    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
                }
                expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
            }
        } finally {
            await context.close();
        }
    }
});

test('expanded galleries retain hidden viewer links and a failed image retains its planned frame', async ({ page }) => {
    const example = page.locator('[data-gallery-example="expanded"]');
    const links = example.locator('a[data-pswp-width]');
    const before = await links.evaluateAll(elements => elements.map(element => element.getAttribute('href')));
    await expect(example.locator('img')).toHaveCount(9);
    await example.getByRole('button', { name: 'Show all 11 photos' }).click();
    await expect(example.locator('img')).toHaveCount(11);
    expect(await links.evaluateAll(elements => elements.map(element => element.getAttribute('href')))).toEqual(before);
    await example.getByRole('button', { name: 'Show fewer photos' }).click();
    await expect(example.locator('img')).toHaveCount(9);
    const failed = page.locator('[data-gallery-example="collage"] figure').first();
    const box = (await failed.locator('.image-caption-frame').boundingBox())!;
    await failed.locator('img').evaluate(image => image.dispatchEvent(new Event('error')));
    await expect(failed.getByText('Photo unavailable')).toBeVisible();
    const after = (await failed.locator('.image-caption-frame').boundingBox())!;
    expect(after.width).toBeCloseTo(box.width, 0);
    expect(after.height).toBeCloseTo(box.height, 0);
});

test('touch captions stay in flow without spanning rows', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const page = await context.newPage();
    try {
        await galleryAssets(page);
        await page.goto('/tests/e2e/fixtures/trip-galleries.html');
        for (const width of [390, 900]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const group of ['collage', 'captions']) {
                const gallery = page.locator(`[data-gallery-example="${group}"]`);
                await gallery.scrollIntoViewIfNeeded();
                await expect(gallery.locator('figcaption').first()).toHaveCSS('position', 'static');
                await expect(gallery.locator('figcaption').first()).toBeVisible();
                expect(await gallery.locator('figure').evaluateAll(figures => figures.every(figure => getComputedStyle(figure).gridRowEnd === 'span 1'))).toBe(true);
                for (const frame of await frames(gallery)) expect(frame.width / frame.height).toBeCloseTo(frame.ratio, 2);
                const figures = await gallery.locator('figure').evaluateAll(figures => figures.map(figure => {
                    const box = figure.getBoundingClientRect();
                    return { top: box.top, bottom: box.bottom, width: box.width, scrollWidth: figure.scrollWidth };
                }));
                for (const figure of figures) {
                    expect(figure.scrollWidth).toBeLessThanOrEqual(Math.ceil(figure.width));
                    for (const later of figures.filter(other => other.top > figure.top + 1)) {
                        expect(later.top).toBeGreaterThanOrEqual(figure.bottom + 11);
                    }
                }
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        }
    } finally {
        await context.close();
    }
});

for (const fallback of [false, true]) {
    test(`responsive sources fit fresh image slots with ${fallback ? 'explicit fallback' : 'automatic'} sizes`, async ({ browser }) => {
        for (const options of [
            { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
            { viewport: { width: 900, height: 1000 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
            { viewport: { width: 640, height: 1000 }, deviceScaleFactor: 1 },
            { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 },
        ]) {
            const context = await browser.newContext(options);
            try {
                const page = await context.newPage();
                await galleryAssets(page);
                if (fallback) {
                    // Exercise browsers that cannot use sizes=auto before they select a source.
                    await page.addInitScript(() => {
                        new MutationObserver(() => {
                            document.querySelectorAll<HTMLImageElement>('img[sizes^="auto,"]').forEach(image => {
                                image.sizes = image.sizes.replace(/^auto,\s*/, '');
                            });
                        }).observe(document, { subtree: true, childList: true });
                    });
                }
                await page.goto('/tests/e2e/fixtures/trip-galleries.html');
                if (fallback) await expect(page.locator('img[sizes^="auto,"]')).toHaveCount(0);
                for (const group of ['mixed', 'collage', 'portrait', 'panorama']) {
                    const photos = page.locator(`[data-gallery-example="${group}"] img`);
                    for (const photo of await photos.all()) await expectSuitableImageSource(photo);
                }
                for (const group of ['portrait', 'landscape', 'panorama']) {
                    await expectSuitableImageSource(page.locator(`[data-photo-example="${group}"] img`));
                }
            } finally {
                await context.close();
            }
        }
    });
}
