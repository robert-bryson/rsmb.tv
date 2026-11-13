import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';

async function prepare(page: Page) {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Keep the real renderer and published Census data; isolate the background service.
    const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#171f26' } }).png().toBuffer();
    await page.route('https://**/*', route => route.abort());
    await page.route('https://basemaps.cartocdn.com/**', route => route.fulfill({ contentType: 'image/png', body: tile }));
    await page.route('https://demotiles.maplibre.org/font/**', route => route.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    return errors;
}

async function openMap(page: Page) {
    await page.goto('/projects/pins-of-inaccessibility/map');
    await expect(page.locator('.pins-coverage')).toContainText('3,235');
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await expect(page.getByTestId('pins-map')).toHaveAttribute('data-map-state', /ready|degraded/);
}

async function mapColorPixels(page: Page, color: 'amber' | 'teal' | 'circle' | 'national') {
    const { data, info } = await sharp(await page.locator('.maplibregl-canvas').screenshot({
        mask: [page.locator('.pins-map-toolbar'), page.locator('.pins-layers'), page.locator('.pins-map-legend'), page.locator('.pins-unit-control')],
        maskColor: '#171f26', animations: 'disabled',
    })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let count = 0;
    for (let pixel = 0; pixel < info.width * info.height; pixel++) {
        const offset = pixel * info.channels;
        const [r, g, b] = data.subarray(offset, offset + 3);
        if (color === 'amber' ? r > 180 && g > 115 && g < 220 && b < 150
            : color === 'national' ? r > 160 && g > 100 && b > r && b > g * 1.1
            : color === 'circle' ? r > 90 && r < 180 && g > 65 && b < 115 && r > g * 1.15
                : g > 130 && b > 100 && r < 135 && g > r * 1.3) count++;
    }
    return count;
}

test('reveals distance badges on zoom and keeps selected radii when other circles are hidden', async ({ page }) => {
    const errors = await prepare(page);
    await openMap(page);
    const badges = page.locator('[data-pin-radius-label]');
    await expect(badges).toHaveCount(0);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const national = page.locator('[data-pin-radius-label="country-US"]');
    await expect.poll(() => national.count()).toBeGreaterThan(1);
    await expect(national.first()).toContainText('678.2 mi');
    await page.getByRole('group', { name: 'Distance units' }).getByRole('button', { name: 'km', exact: true }).click();
    await expect(national.first()).toContainText('1,091.5 km');
    await page.getByRole('checkbox', { name: 'All radius circles' }).uncheck();
    await expect(badges).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'All radius circles' }).check();
    await page.getByLabel('Within', { exact: true }).selectOption('08');
    const colorado = page.locator('[data-pin-radius-label="state-08"]');
    await expect.poll(() => colorado.count()).toBeGreaterThan(1);
    await expect(page.locator('.pins-radius-label.is-selected')).toHaveCount(0);
    await page.locator('.pins-results button').first().click();
    await expect.poll(() => page.locator('.pins-radius-label.is-selected').count()).toBeGreaterThan(1);
    await page.getByRole('checkbox', { name: 'All radius circles' }).uncheck();
    await expect.poll(() => colorado.count()).toBeGreaterThan(1);
    await expect(colorado.first()).toContainText('km');
    const layout = await page.locator('.pins-radius-label').evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    }));
    for (let index = 0; index < layout.length; index++) {
        for (const other of layout.slice(index + 1)) {
            const box = layout[index];
            expect(box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top).toBe(false);
        }
    }
    await page.screenshot({ path: '/tmp/pins-radius-detail.png' });
    const originalPositions = await colorado.evaluateAll(elements => elements.map(element => element.getAttribute('style')).join('|'));
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(async () => {
        const positions = await colorado.evaluateAll(elements => elements.map(element => element.getAttribute('style')));
        return positions.length > 1 && positions.join('|') !== originalPositions;
    }).toBe(true);
    expect(errors).toEqual([]);
});

test('draws the national pole, supports map selection, and restores its shared link', async ({ page }) => {
    const errors = await prepare(page);
    await openMap(page);
    await expect(page.getByRole('region', { name: 'U.S. pole', exact: true })).toContainText('678.2 mi');
    await expect.poll(() => mapColorPixels(page, 'national')).toBeGreaterThan(50);
    const canvas = page.locator('.maplibregl-canvas');
    const { data, info } = await sharp(await canvas.screenshot({
        mask: [page.locator('.pins-map-toolbar'), page.locator('.pins-layers'), page.locator('.pins-map-legend'), page.locator('.pins-unit-control')],
        maskColor: '#171f26',
    })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const box = (await canvas.boundingBox())!;
    let count = 0, sumX = 0, sumY = 0;
    for (let pixel = 0; pixel < info.width * info.height; pixel++) {
        const offset = pixel * info.channels;
        const [r, g, b] = data.subarray(offset, offset + 3);
        // The bright violet marker is independent of the dimmer circle outline.
        if (r > 175 && r < 220 && g > 120 && g < 185 && b > 220) {
            sumX += pixel % info.width; sumY += Math.floor(pixel / info.width); count++;
        }
    }
    expect(count).toBeGreaterThan(30);
    // Screenshots use device pixels; pointer input uses CSS pixels.
    await page.mouse.click(box.x + sumX / count * box.width / info.width, box.y + sumY / count * box.height / info.height);
    await expect(page).toHaveURL(/pin=country-US/);
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('United States');
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Internal state borders do not');
    await page.reload();
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('United States');
    await page.getByLabel('Within', { exact: true }).selectOption('66');
    await page.getByRole('region', { name: 'U.S. pole', exact: true }).getByRole('button').click();
    await expect(page.getByLabel('Within', { exact: true })).toHaveValue('');
    await expect(page).toHaveURL(/pin=country-US/);
    expect(errors).toEqual([]);
});

test('opens the project page and map through existing project navigation', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/projects');
    await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Pins of Inaccessibility', exact: true }) }).click();
    await expect(page).toHaveURL(/\/projects\/pins-of-inaccessibility$/);
    const image = page.getByRole('img', { name: 'Map of the national U.S. pole in violet and state interior pins with amber radius circles' });
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(1440);
    await page.getByRole('link', { name: 'Open interactive map →' }).click();
    await expect(page.locator('.pins-coverage')).toContainText('3,235');
    await expect.poll(() => mapColorPixels(page, 'amber')).toBeGreaterThan(1500);
    await page.getByRole('link', { name: 'Back to projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    expect(errors).toEqual([]);
});

test('draws real pins and circles, changes units, and recovers invalid pin data', async ({ page }) => {
    const errors = await prepare(page);
    let fail = true;
    await page.route('**/data/pins-of-inaccessibility/pins.json', route => fail ? route.fulfill({ json: {} }) : route.continue());
    await page.goto('/projects/pins-of-inaccessibility/map');
    await expect(page.getByRole('button', { name: 'Retry pin data' })).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Retry pin data' }).click();
    await expect(page.locator('.pins-coverage')).toContainText('3,235');
    await expect.poll(() => mapColorPixels(page, 'amber')).toBeGreaterThan(1500);
    await expect.poll(() => mapColorPixels(page, 'circle')).toBeGreaterThan(1500);
    const withCircles = await mapColorPixels(page, 'circle');
    await page.getByRole('checkbox', { name: 'All radius circles' }).uncheck();
    await expect.poll(() => mapColorPixels(page, 'circle')).toBeLessThan(withCircles * 0.5);
    await page.getByRole('group', { name: 'Distance units' }).getByRole('button', { name: 'km', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Radius extremes' })).toContainText('484.8 km');
    expect(errors).toEqual([]);
});

test('loads counties on zoom, selects a county, and restores a shared pin', async ({ page }) => {
    const errors = await prepare(page);
    let countyRequests = 0;
    page.on('request', request => { if (request.url().endsWith('/counties.geojson')) countyRequests++; });
    await openMap(page);
    expect(countyRequests).toBe(0);
    await page.getByRole('group', { name: 'Rank pins by geography' }).getByRole('button', { name: 'Counties', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search pins' }).fill('Falls Church');
    await page.locator('.pins-results button').first().click();
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Falls Church city');
    await expect.poll(() => page.locator('[data-pin-radius-label="county-51610"]').count()).toBeGreaterThan(0);
    await expect(page.locator('[data-pin-radius-label="county-51610"]').first()).toContainText('mi');
    await expect.poll(() => countyRequests).toBe(1);
    await expect(page.getByText('County pins visible', { exact: true })).toBeVisible();
    await expect.poll(() => mapColorPixels(page, 'teal')).toBeGreaterThan(20);
    await expect(page).toHaveURL(/pin=county-51610/);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Falls Church city');
    await page.getByRole('button', { name: 'Off', exact: true }).click();
    await expect(page.getByText('County pins hidden', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'On', exact: true }).click();
    await expect(page.getByText('County pins always visible', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});

test('shows territorial counties, filters rankings, and supports accessible controls', async ({ page }) => {
    const errors = await prepare(page);
    await openMap(page);
    await page.getByLabel('Within', { exact: true }).selectOption('66');
    await page.getByRole('group', { name: 'Rank pins by geography' }).getByRole('button', { name: 'Counties', exact: true }).click();
    await expect(page.locator('.pins-results li')).toHaveCount(1);
    await expect(page.locator('.pins-results')).toContainText('Guam');
    await page.locator('.pins-results button').first().click();
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Guam');
    await page.getByRole('button', { name: 'Clear selected pin' }).click();
    await page.getByRole('searchbox', { name: 'Search pins' }).fill('no such county');
    await expect(page.getByText('No pins match this selection.', { exact: false })).toBeVisible();
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations).toEqual([]);
    expect(errors).toEqual([]);
});

test('keeps the map and explorer usable at a mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await prepare(page);
    await openMap(page);
    await expect(page.getByRole('complementary', { name: 'Pin explorer' })).toBeHidden();
    await page.getByRole('button', { name: 'Explore pins' }).click();
    await expect(page.getByRole('complementary', { name: 'Pin explorer' })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search pins' }).fill('Guam');
    await page.locator('.pins-results button').first().click();
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Guam');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const canvas = await page.locator('.maplibregl-canvas').boundingBox();
    const panel = await page.getByRole('complementary', { name: 'Pin explorer' }).boundingBox();
    expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(panel!.y + 1);
    await page.screenshot({ path: '/tmp/pins-mobile-panel.png' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Explore pins' })).toBeFocused();
    await page.screenshot({ path: '/tmp/pins-mobile.png' });
    expect(errors).toEqual([]);
});

test('keeps fullscreen controls correct after graphics loss and renderer retry', async ({ page }) => {
    const errors = await prepare(page);
    await openMap(page);
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement
        || !!document.querySelector('.maplibregl-pseudo-fullscreen'))).toBe(true);
    await page.locator('.maplibregl-canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost')));
    await page.getByRole('button', { name: 'Retry map', exact: true }).click();
    await expect(page.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'ready');
    await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement
        || !!document.querySelector('.maplibregl-pseudo-fullscreen'))).toBe(false);
    await expect.poll(() => mapColorPixels(page, 'national')).toBeGreaterThan(50);
    expect(errors).toEqual([]);
});

test('recovers a stalled worker while keeping the data panel usable', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = await prepare(page);
    let failWorker = true, blocked = 0;
    await page.route(url => /\/maplibre-gl-worker-[^/]+\.js$/.test(url.pathname)
        || (url.pathname.endsWith('/maplibre-gl-worker.mjs') && url.searchParams.has('worker_file')), route => {
        if (!failWorker) return route.continue();
        blocked++;
        // An initialized but inert worker sends no source response or error event.
        return route.fulfill({ contentType: 'application/javascript', body: 'self.onmessage = () => {};' });
    });
    await page.goto('/projects/pins-of-inaccessibility/map');
    await expect(page.locator('.pins-coverage')).toContainText('3,235');
    await expect(page.getByRole('button', { name: 'Retry map', exact: true })).toBeVisible({ timeout: 25_000 });
    expect(blocked).toBeGreaterThan(0);
    await page.getByRole('region', { name: 'U.S. pole', exact: true }).getByRole('button').click();
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('United States');
    failWorker = false;
    await page.getByRole('button', { name: 'Retry map', exact: true }).click();
    await expect(page.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'ready');
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('United States');
    await expect.poll(() => mapColorPixels(page, 'national')).toBeGreaterThan(50);
    expect(errors).toEqual([]);
});

test('retains application layers when tiles fail and retries malformed county boundaries', async ({ page }) => {
    const errors = await prepare(page);
    await page.route('https://basemaps.cartocdn.com/**', route => route.abort());
    let failCounties = true;
    await page.route('**/data/pins-of-inaccessibility/counties.geojson', route => failCounties ? route.fulfill({ json: {} }) : route.continue());
    await openMap(page);
    await expect(page.getByRole('button', { name: 'Retry background' })).toBeVisible();
    await expect.poll(() => mapColorPixels(page, 'amber')).toBeGreaterThan(1500);
    await page.getByLabel('Within', { exact: true }).selectOption('66');
    await page.getByRole('button', { name: 'On', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('County boundaries unavailable.');
    failCounties = false;
    await page.getByRole('button', { name: 'Retry boundaries' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect.poll(() => mapColorPixels(page, 'teal')).toBeGreaterThan(20);
    expect(errors).toEqual([]);
});
