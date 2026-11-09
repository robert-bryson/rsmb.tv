import { expect, test } from '@playwright/test';
import { projects } from '../../src/content/projects';

for (const failedFormats of [['avif'], ['avif', 'webp']]) {
    test(`project previews recover when ${failedFormats.join(' and ')} requests fail`, async ({ page }) => {
        await page.route(/\/images\/previews\/through-routes-[^/]+\.(?:avif|webp)$/, route =>
            failedFormats.includes(route.request().url().split('.').at(-1)!)
                ? route.fulfill({ status: 503, body: 'Image temporarily unavailable' }) : route.continue());
        await page.goto('/');
        const card = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Through Routes', exact: true }) });
        await expect.poll(() => card.locator('img').evaluate(element => {
            const image = element as HTMLImageElement;
            return image.complete && image.naturalWidth > 0 ? new URL(image.currentSrc).pathname : '';
        })).toMatch(failedFormats.length === 1
            ? /^\/images\/previews\/through-routes-[^/]+\.webp$/
            : /^\/images\/through-routes\/through-routes-curviness-map\.webp$/);
    });
}

test('project previews use the WebP fallback when the offered source format is unsupported', async ({ page }) => {
    await page.goto('/');
    const card = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Through Routes', exact: true }) });
    await card.locator('source').evaluate(source => { (source as HTMLSourceElement).type = 'image/x-unsupported-test'; });
    await expect.poll(() => card.locator('img').evaluate(element => {
        const img = element as HTMLImageElement;
        return img.complete && img.naturalWidth > 0 ? img.currentSrc : '';
    })).toMatch(/\/images\/previews\/through-routes-\d+-[a-f0-9]+\.webp$/);
});

for (const width of [390, 1280]) {
    test(`homepage responsive previews decode and preserve layout at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        const preview = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Through Routes', exact: true }) }).locator('img');
        await expect(preview).toHaveAttribute('loading', 'eager');
        await expect.poll(() => preview.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        const image = await preview.evaluate(element => {
            const img = element as HTMLImageElement;
            return { source: img.currentSrc, width: img.clientWidth, height: img.clientHeight };
        });
        expect(image.source).toMatch(/\/images\/previews\/through-routes-\d+-[a-f0-9]+\.avif$/);
        expect(image.width).toBeGreaterThan(250);
        expect(image.height).toBeGreaterThan(150);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
}

for (const width of [320, 1280]) {
    for (const slug of ['flights', 'temperature-records', 'tornado-tracks']) {
        test(`${slug} shared gallery loads without overflow at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(`/projects/${slug}`);

            const images = page.locator('figure img');
            await expect(images).toHaveCount(3);
            for (const [index, image] of (await images.all()).entries()) {
                await expect(image).toHaveAttribute('loading', index === 0 ? 'eager' : 'lazy');
                await image.scrollIntoViewIfNeeded();
                await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
                const dimensions = await image.evaluate(element => {
                    const image = element as HTMLImageElement;
                    return {
                        declared: [Number(image.getAttribute('width')), Number(image.getAttribute('height'))],
                        actual: [image.naturalWidth, image.naturalHeight],
                    };
                });
                expect(dimensions.declared).toEqual(dimensions.actual);
            }

            const source = page.getByRole('link', { name: 'Source on GitHub →', exact: true });
            await expect(source).toHaveAttribute('target', '_blank');
            await expect(source).toHaveAttribute('rel', /\bnoopener\b/);
            await expect(source).toHaveAttribute('rel', /\bnoreferrer\b/);
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        });
    }
}

for (const width of [320, 1280]) {
    test(`project dates and changelogs remain readable at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/projects');

        for (const project of projects) {
            const card = page.getByRole('link').filter({
                has: page.getByRole('heading', { name: project.title, exact: true }),
            });
            await expect(card).toHaveAttribute('href', `/projects/${project.slug}`);
            if (project.lastUpdated) {
                await expect(card.getByRole('time')).toHaveAttribute('datetime', project.lastUpdated);
                await expect(card).toContainText('Updated');
            } else {
                await expect(card.getByRole('time')).toHaveCount(0);
                await expect(card).toContainText(String(project.year));
            }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

        await page.getByRole('link').filter({
            has: page.getByRole('heading', { name: 'Through Routes', exact: true }),
        }).click();
        await expect(page.getByRole('heading', { name: 'Changelog', exact: true })).toBeVisible();

        const entries = page.locator('dl > div');
        const changelog = projects.find(project => project.slug === 'through-routes')!.changelog!;
        await expect(entries).toHaveCount(changelog.length);

        for (const [index, entry] of changelog.entries()) {
            const row = entries.nth(index);
            await expect(row.getByRole('time')).toHaveAttribute('datetime', entry.date);
            await expect(row.getByRole('listitem')).toHaveText(entry.notes);
            await expect(row.getByRole('list')).toHaveCSS('list-style-type', 'disc');

            const layout = await row.evaluate(element => {
                const date = element.querySelector('dt')!.getBoundingClientRect();
                const notes = element.querySelector('dd')!.getBoundingClientRect();
                return { dateBottom: date.bottom, dateRight: date.right, notesTop: notes.top, notesLeft: notes.left };
            });
            if (width < 640) {
                expect(layout.notesTop).toBeGreaterThanOrEqual(layout.dateBottom);
            } else {
                expect(layout.notesLeft).toBeGreaterThan(layout.dateRight);
            }
        }

        if (width === 320) {
            const lines = await entries.first().getByRole('listitem').first().evaluate(element => {
                const range = document.createRange();
                range.selectNodeContents(element);
                return [...range.getClientRects()].map(rect => ({ left: rect.left, top: rect.top }));
            });
            expect(new Set(lines.map(line => line.top)).size).toBeGreaterThan(1);
            expect(Math.max(...lines.map(line => line.left)) - Math.min(...lines.map(line => line.left))).toBeLessThan(1);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
}

for (const width of [320, 1280]) {
    test(`Route2GPX page shows current formats and screenshots at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/projects/route2gpx');
        await expect(page.getByRole('heading', { level: 1, name: 'route2gpx', exact: true })).toBeVisible();
        await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /GPX, KML, GeoJSON, TCX, or CSV/);
        await expect(page.getByRole('heading', { name: 'Choose an Output', exact: true })).toBeVisible();
        await expect(page.getByText(/web app 1\.1\.0 and Python CLI 0\.2\.0/)).toBeVisible();
        await expect(page.getByText('Nov 2026', { exact: true })).toHaveAttribute('datetime', '2026-11');
        const screenshots = page.locator('figure img');
        await expect(screenshots).toHaveCount(3);
        for (const image of await screenshots.all()) {
            await image.scrollIntoViewIfNeeded();
            await expect(image).toHaveAttribute('src', /\/images\/route2gpx\/.+-v1-1\.webp$/);
            await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(1440);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
}
