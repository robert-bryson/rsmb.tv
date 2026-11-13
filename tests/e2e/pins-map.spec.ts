import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { pinContextFileFixture, pinContextManifestFixture } from '../fixtures/pinContext';

const CARTO_FIXTURE_ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://carto.com/attribution/">CARTO</a>';

async function prepare(page: Page, background = '#171f26') {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Keep the real renderer and published Census data; isolate the background service.
    const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background } }).png().toBuffer();
    await page.route('https://**/*', route => route.abort());
    await page.route('https://basemaps.cartocdn.com/**', route => route.fulfill({ contentType: 'image/png', body: tile }));
    await page.route('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json*', route => {
        expect(new URL(route.request().url()).searchParams.get('key')).toBe('browser-test-key');
        return route.fulfill({ json: {
            version: 8, glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
            sources: { 'carto-fixture': { type: 'raster', tileSize: 256,
                tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=browser-test-key'], attribution: CARTO_FIXTURE_ATTRIBUTION } },
            layers: [{ id: 'carto-fixture', type: 'raster', source: 'carto-fixture' }],
        } });
    });
    await page.route('https://demotiles.maplibre.org/font/**', route => route.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    return errors;
}

async function expectMapReady(page: Page, state: string | RegExp = 'ready') {
    // Source parsing precedes the renderer's 15-second drawing deadline.
    await expect(page.getByTestId('pins-map')).toHaveAttribute('data-map-state', state, { timeout: 20_000 });
}

async function openMap(page: Page) {
    await page.goto('/projects/pins-of-inaccessibility/map');
    await expect(page.locator('.pins-coverage')).toContainText('3,235');
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await expectMapReady(page, /ready|degraded/);
    await expect(page.getByRole('link', { name: 'CARTO', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'OpenStreetMap', exact: true })).toBeVisible();
}

test('shows selected elevation and nearby town with map links, then closes to the globe', async ({ page }) => {
    const errors = await prepare(page);
    await page.route('**/maps/pins/context/manifest-v1.json', route => route.fulfill({ json: pinContextManifestFixture }));
    await page.route('**/maps/pins/context/releases/*/countries.json', route => route.fulfill({ json: pinContextFileFixture }));
    await page.goto('/projects/pins-of-inaccessibility/map?pin=country-US&keep=value');
    const selected = page.getByRole('region', { name: 'Selected pin' });
    await expectMapReady(page);
    await expect(selected.getByText('1,280 ft above sea level')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pins of Inaccessibility', exact: true })).toBeInViewport();
    await expect(selected).toContainText('8.31 mi E of Bennington');
    await expect(selected.getByRole('link', { name: 'Google Maps ↗' })).toHaveAttribute('href', /query=39\.05186600%2C-97\.44220300/);
    await expect(selected.getByRole('link', { name: 'OpenStreetMap ↗' })).toHaveAttribute('href', /mlat=39\.05186600&mlon=-97\.44220300/);
    await page.getByRole('group', { name: 'Distance units' }).getByRole('button', { name: 'km', exact: true }).click();
    await expect(selected).toContainText('390 m above sea level');
    await expect(selected).toContainText('13.4 km E of Bennington');
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations).toEqual([]);
    await selected.getByRole('button', { name: 'Back to world overview, close selection' }).click();
    await expect(selected).toHaveCount(0);
    await expect(page.getByLabel('Country / territory')).toHaveValue('ALL');
    await expect(page.locator('.pins-panel-intro h2')).toBeInViewport();
    await expect(page).toHaveURL(/keep=value/);
    await expect(page).not.toHaveURL(/pin=/);
    await expect(page.getByRole('button', { name: 'World overview', exact: true })).toBeFocused();
    expect(errors).toEqual([]);
});

test('opens a shared pin directly to its card and map links on a narrow phone', async ({ page }) => {
    const errors = await prepare(page);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.route('**/maps/pins/context/manifest-v1.json', route => route.fulfill({ json: pinContextManifestFixture }));
    await page.route('**/maps/pins/context/releases/*/countries.json', route => route.fulfill({ json: pinContextFileFixture }));
    await page.goto('/projects/pins-of-inaccessibility/map?pin=country-US');
    const selected = page.getByRole('region', { name: 'Selected pin' });
    await expectMapReady(page);
    await expect(selected.getByText('1,280 ft above sea level')).toBeVisible();
    await expect(selected.getByRole('button', { name: 'Back to world overview, close selection' })).toBeInViewport();
    await expect(selected.getByRole('link', { name: 'Google Maps ↗' })).toBeInViewport();
    await expect(selected.getByRole('link', { name: 'OpenStreetMap ↗' })).toBeInViewport();
    await expect(selected.locator('.pins-nearby-place')).toBeInViewport();
    await expect(page.getByRole('heading', { name: 'Pins of Inaccessibility', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'World overview', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'World overview', exact: true }).click();
    await expect(page.getByLabel('Country / territory')).toHaveValue('ALL');
    await expect(page.locator('.pins-panel-intro h2')).toBeInViewport();
    expect(errors).toEqual([]);
});

test('recovers malformed location context without blocking the selected pin or map', async ({ page }) => {
    const errors = await prepare(page);
    let invalid = true;
    await page.route('**/maps/pins/context/manifest-v1.json', route => route.fulfill({ json: pinContextManifestFixture }));
    await page.route('**/maps/pins/context/releases/*/countries.json', route => route.fulfill({
        json: invalid ? { ...pinContextFileFixture, pins: [] } : pinContextFileFixture,
    }));
    await page.goto('/projects/pins-of-inaccessibility/map?pin=country-US');
    const selected = page.getByRole('region', { name: 'Selected pin' });
    await expectMapReady(page);
    await expect(selected.getByRole('button', { name: 'Retry location details' })).toBeVisible();
    await expect(selected.getByRole('link', { name: 'Google Maps ↗' })).toBeVisible();
    await expectMapReady(page, /ready|degraded/);
    invalid = false;
    await selected.getByRole('button', { name: 'Retry location details' }).click();
    await expect(selected.getByText('1,280 ft above sea level')).toBeVisible();
    await expect(page).toHaveURL(/pin=country-US/);
    await expect(selected.getByRole('button', { name: 'Retry location details' })).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('clicks away from a selected country to the world while preserving native map gestures', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/projects/pins-of-inaccessibility/map?country=TTO&pin=country-TTO&keep=1');
    await expectMapReady(page);
    const selected = page.getByRole('region', { name: 'Selected pin' });
    await expect(selected).toContainText('Trinidad and Tobago');
    await expect(page.locator('.pins-map-legend')).toContainText('Other pins · selectable');
    await expect(page.locator('.pins-radius-label:not(.is-selected)')).toHaveCount(0);
    const canvas = page.locator('.maplibregl-canvas');
    const box = (await canvas.boundingBox())!;
    const point = { x: box.width - 80, y: box.height * 0.6 };
    const before = await canvas.screenshot();
    await canvas.dblclick({ position: point });
    await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
    await expect(page).toHaveURL(/pin=country-TTO/);
    await page.mouse.move(box.x + point.x, box.y + point.y);
    await page.mouse.down();
    await page.mouse.move(box.x + point.x - 55, box.y + point.y + 10, { steps: 8 });
    await page.mouse.up();
    await expect(selected).toBeVisible();
    // Restore the same known camera before testing empty ocean east of Trinidad.
    await selected.getByRole('button', { name: 'Zoom to pin ↗' }).click();
    await expectMapReady(page);
    await canvas.click({ position: point });
    await expect(page.getByLabel('Country / territory')).toHaveValue('ALL');
    await expect(selected).toHaveCount(0);
    await expect(page).toHaveURL(/keep=1/);
    await expect(page.getByRole('navigation', { name: 'Map location' }).locator('[aria-current]')).toHaveText('World');
    expect(errors).toEqual([]);
});

test('restores county, state, and country views through parent navigation and browser history', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/projects/pins-of-inaccessibility/map?pin=county-51610&keep=1');
    const selected = page.getByRole('region', { name: 'Selected pin' });
    const location = page.getByRole('navigation', { name: 'Map location' });
    await expect(selected).toContainText('Falls Church city');
    await selected.getByRole('button', { name: 'Back to Virginia, close selection' }).click();
    await expect(page.getByLabel('Within', { exact: true })).toHaveValue('51');
    await expect(page).toHaveURL(/state=51/);
    await expect(location.locator('[aria-current]')).toHaveText('Virginia');
    await page.reload();
    await expect(location.locator('[aria-current]')).toHaveText('Virginia');
    await expect(selected).toHaveCount(0);
    await page.getByRole('button', { name: 'Up one level: United States', exact: true }).click();
    await expect(location.locator('[aria-current]')).toHaveText('United States');
    await page.getByRole('button', { name: 'Up one level: world overview', exact: true }).click();
    await expect(page.getByLabel('Country / territory')).toHaveValue('ALL');
    await page.goBack();
    await expect(location.locator('[aria-current]')).toHaveText('United States');
    await page.goBack();
    await expect(location.locator('[aria-current]')).toHaveText('Virginia');
    await page.goBack();
    await expect(selected).toContainText('Falls Church city');
    await page.goForward();
    await expect(selected).toHaveCount(0);
    await expect(page.getByLabel('Within', { exact: true })).toHaveValue('51');
    expect(errors).toEqual([]);
});

test.describe('touch hierarchy', () => {
    test.use({ viewport: { width: 320, height: 844 }, hasTouch: true });

    test('keeps the trail usable at 320 pixels and supports tapping away from a country', async ({ page }) => {
        const errors = await prepare(page);
        await page.goto('/projects/pins-of-inaccessibility/map?pin=county-51610');
        const selected = page.getByRole('region', { name: 'Selected pin' });
        await expect(selected).toContainText('Falls Church city');
        const up = page.getByRole('button', { name: 'Up one level: Virginia', exact: true });
        await expect(up).toBeInViewport();
        const upBox = (await up.boundingBox())!;
        expect(upBox.height).toBeGreaterThanOrEqual(44);
        expect(upBox.width).toBeGreaterThanOrEqual(44);
        await expect(up).toHaveCSS('touch-action', 'manipulation');
        await expect(page.getByRole('checkbox', { name: 'All radius circles' })).toBeHidden();
        await page.locator('.pins-layers summary').tap();
        await expect(page.getByRole('checkbox', { name: 'All radius circles' })).toBeVisible();
        await page.locator('.pins-layers summary').tap();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const scan = await new AxeBuilder({ page }).analyze();
        expect(scan.violations).toEqual([]);
        await page.screenshot({ path: '/tmp/pins-hierarchy-mobile.png' });
        await page.setViewportSize({ width: 667, height: 375 });
        const mapBox = (await page.locator('.maplibregl-canvas').boundingBox())!;
        const panelBox = (await page.getByRole('complementary', { name: 'Pin explorer' }).boundingBox())!;
        expect(mapBox.height).toBeGreaterThan(250);
        expect(mapBox.x).toBeGreaterThanOrEqual(panelBox.x + panelBox.width - 1);
        await expect(up).toBeInViewport();
        await page.screenshot({ path: '/tmp/pins-hierarchy-landscape.png' });
        await page.setViewportSize({ width: 320, height: 844 });
        await up.tap();
        await expect(page).toHaveURL(/state=51/);
        await expect(selected).toHaveCount(0);
        await page.getByRole('button', { name: 'Up one level: United States', exact: true }).tap();
        await expect(page.getByRole('navigation', { name: 'Map location' }).locator('[aria-current]')).toHaveText('United States');
        await page.getByRole('button', { name: 'Up one level: world overview', exact: true }).tap();
        await expect(page.getByLabel('Country / territory')).toHaveValue('ALL');
        await page.getByLabel('Jump to region').selectOption('TTO');
        await page.getByLabel('Jump to region').selectOption('country-TTO');
        await expect(selected).toContainText('Trinidad and Tobago');
        await expectMapReady(page);
        const canvas = (await page.locator('.maplibregl-canvas').boundingBox())!;
        await page.touchscreen.tap(canvas.x + canvas.width - 16, canvas.y + canvas.height * 0.65);
        await expect(page.getByLabel('Country / territory')).toHaveValue('ALL');
        expect(errors).toEqual([]);
    });
});

async function mapColorPixels(page: Page, color: 'amber' | 'teal' | 'circle' | 'national' | 'selected') {
    const { data, info } = await sharp(await page.locator('.maplibregl-canvas').screenshot({
        mask: [page.locator('.pins-map-toolbar'), page.locator('.pins-layers'), page.locator('.pins-map-legend'), page.locator('.pins-unit-control')],
        maskColor: '#171f26', animations: 'disabled',
    })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let count = 0;
    for (let pixel = 0; pixel < info.width * info.height; pixel++) {
        const offset = pixel * info.channels;
        const [r, g, b] = data.subarray(offset, offset + 3);
        if (color === 'amber' ? r > 180 && g > 115 && g < 220 && b < 150
            : color === 'selected' ? r > 225 && g > 195 && b > 155 && b < 240
                : color === 'national' ? r > 160 && g > 100 && b > r && b > g * 1.1
            : color === 'circle' ? r > 90 && r < 180 && g > 65 && b < 115 && r > g * 1.15
                : g > 130 && b > 100 && r < 135 && g > r * 1.3) count++;
    }
    return count;
}

async function nationalPinPosition(page: Page) {
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
        // Separate the bright violet marker from its dimmer radius circle.
        if (r > 175 && r < 220 && g > 120 && g < 185 && b > 220) {
            sumX += pixel % info.width; sumY += Math.floor(pixel / info.width); count++;
        }
    }
    expect(count).toBeGreaterThan(30);
    // Screenshots use device pixels; pointer input uses CSS pixels.
    return { x: box.x + sumX / count * box.width / info.width, y: box.y + sumY / count * box.height / info.height };
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
    const point = await nationalPinPosition(page);
    await page.mouse.click(point.x, point.y);
    await expect(page).toHaveURL(/pin=country-US/);
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('United States');
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Internal state borders do not');
    await page.reload();
    await expectMapReady(page);
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('United States');
    await page.getByLabel('Within', { exact: true }).selectOption('66');
    await expect.poll(() => mapColorPixels(page, 'amber')).toBeGreaterThan(20);
    await page.getByRole('region', { name: 'U.S. pole', exact: true }).getByRole('button').click();
    await expect(page.getByLabel('Within', { exact: true })).toHaveValue('');
    await expect(page).toHaveURL(/pin=country-US/);
    expect(errors).toEqual([]);
});

test('dismisses hover details without canvas focus and clears them when changing country', async ({ page }) => {
    const errors = await prepare(page);
    await openMap(page);
    const point = await nationalPinPosition(page);
    await page.mouse.move(point.x, point.y);
    const tooltip = page.locator('.pins-tooltip');
    await expect(tooltip).toContainText('United States');
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    await page.mouse.move(point.x + 1, point.y);
    await expect(tooltip).toBeVisible();
    await page.getByLabel('Country / territory', { exact: true }).selectOption('CAN');
    await expect(tooltip).toHaveCount(0);
    await expect(page.locator('.pins-results li')).toHaveCount(13);
    expect(errors).toEqual([]);
});

test('a hidden province outline cannot block country pins and reloads when shown', async ({ page }) => {
    const errors = await prepare(page);
    let invalid = true;
    await page.route('**/world/regions/CAN.geojson', route => invalid ? route.fulfill({ json: {} }) : route.continue());
    await page.goto('/projects/pins-of-inaccessibility/map?country=CAN');
    await expect(page.getByRole('button', { name: 'Retry boundaries' })).toBeVisible();
    await expect(page.getByTestId('pins-map')).toHaveAttribute('data-map-state', 'error');
    await page.getByRole('checkbox', { name: 'States & provinces', exact: true }).uncheck();
    await expect(page.getByRole('button', { name: 'Retry boundaries' })).toHaveCount(0);
    await expectMapReady(page);
    await expect(page.locator('.pins-results li')).toHaveCount(13);
    invalid = false;
    await page.getByRole('checkbox', { name: 'States & provinces', exact: true }).check();
    await expectMapReady(page);
    await expect(page.getByRole('button', { name: 'Retry boundaries' })).toHaveCount(0);
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
    await expect.poll(() => mapColorPixels(page, 'selected')).toBeGreaterThan(20);
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
    await page.getByRole('button', { name: 'Back to Guam, close selection' }).click();
    await expect(page.getByLabel('Country / territory')).toHaveValue('USA');
    await expect(page.getByLabel('Within', { exact: true })).toHaveValue('66');
    await expect(page.getByRole('button', { name: 'World overview', exact: true })).toBeVisible();
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
    await expect(page.getByRole('region', { name: 'Selected pin' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Up one level: world overview', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'World overview', exact: true })).toBeFocused();
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
    await expectMapReady(page);
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
    await expectMapReady(page);
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

test('keeps global files lazy and expands Canada into its thirteen provinces and territories', async ({ page }) => {
    const errors = await prepare(page);
    const globalRequests: string[] = [];
    page.on('request', request => { if (request.url().includes('/pins-of-inaccessibility/world/')) globalRequests.push(new URL(request.url()).pathname); });
    await openMap(page);
    expect(globalRequests).toEqual(['/data/pins-of-inaccessibility/world/pins.json']);
    await page.getByLabel('Country / territory', { exact: true }).selectOption('CAN');
    await expect(page.locator('.pins-results li')).toHaveCount(13);
    await expectMapReady(page);
    await expect(page.getByRole('region', { name: 'Canada pole', exact: true })).toBeVisible();
    expect(globalRequests.some(path => path.endsWith('/CAN.json'))).toBe(true);
    expect(globalRequests.some(path => path.endsWith('/AUS.json'))).toBe(false);
    const ontario = page.locator('.pins-results button').filter({ hasText: 'Ontario' });
    await ontario.click();
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Ontario');
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Mapped area');
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Natural Earth');
    await expect(page).toHaveURL(/country=CAN/);
    const selectedBadges = page.locator('.pins-radius-label.is-selected');
    await expect.poll(() => selectedBadges.count()).toBeGreaterThan(1);
    await page.getByRole('checkbox', { name: 'States & provinces', exact: true }).uncheck();
    await expect.poll(() => selectedBadges.count()).toBeGreaterThan(1);
    await page.getByRole('group', { name: 'Distance units' }).getByRole('button', { name: 'km', exact: true }).click();
    await expect(selectedBadges.first()).toContainText('km');
    await page.reload();
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Ontario');
    expect(errors).toEqual([]);
});

test('ranks global country poles and opens a date-line country without world-spanning circles', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/projects/pins-of-inaccessibility/map?country=ALL');
    await expect(page.locator('.pins-coverage')).toContainText('257');
    await expect(page.getByText('257 pins ranked by radius')).toBeVisible();
    await expectMapReady(page);
    await page.getByRole('searchbox', { name: 'Search pins' }).fill('Fiji');
    await expect(page.locator('.pins-results li')).toHaveCount(1);
    await page.locator('.pins-results button').first().click();
    await expect(page.getByLabel('Country / territory', { exact: true })).toHaveValue('FJI');
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Fiji');
    await expectMapReady(page);
    await expect.poll(() => page.locator('.pins-radius-label.is-selected').count()).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Fiji overview', exact: true }).click();
    await expect(page.locator('.pins-results li')).toHaveCount(5);
    await page.screenshot({ path: '/tmp/pins-world-fiji.png' });
    expect(errors).toEqual([]);
});

test('renders Tobago detail and switches between province and country outlines', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/projects/pins-of-inaccessibility/map?country=TTO&pin=region-TTO-5090');
    await expect(page.locator('.pins-results li')).toHaveCount(16);
    await expect(page.getByRole('region', { name: 'Selected pin' })).toContainText('Tobago, Trinidad and Tobago');
    await expectMapReady(page);
    const selectedBadges = page.locator('.pins-radius-label.is-selected');
    await expect.poll(() => selectedBadges.count()).toBeGreaterThan(1);
    await expect(selectedBadges.first()).toContainText('2.24 mi');
    await page.getByRole('checkbox', { name: 'States & provinces', exact: true }).uncheck();
    await expectMapReady(page);
    await expect.poll(() => selectedBadges.count()).toBeGreaterThan(1);
    await page.getByRole('checkbox', { name: 'States & provinces', exact: true }).check();
    await expectMapReady(page);
    await page.screenshot({ path: '/tmp/pins-tobago-boundaries.png' });
    expect(errors).toEqual([]);
});

test('wraps the CARTO basemap around a globe and supports dragging and world reset', async ({ page }) => {
    const errors = await prepare(page, '#35546a');
    await page.goto('/projects/pins-of-inaccessibility/map?country=ALL');
    await expectMapReady(page);
    const canvas = page.locator('.maplibregl-canvas');
    await expect(canvas).toHaveAttribute('aria-label', /Interactive globe/);
    const before = await canvas.screenshot();
    const { data, info } = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    // The uniform CARTO test tiles fill the sphere. Space remains visible in all
    // four corners; a flat tiled map would fill those pixels with the tile color.
    for (const [x, y] of [[4, 4], [info.width - 5, 4], [4, info.height - 5], [info.width - 5, info.height - 5]]) {
        const offset = (y * info.width + x) * info.channels;
        expect(data[offset]).toBeLessThan(30);
        expect(data[offset + 1]).toBeLessThan(40);
    }
    const center = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
    expect(data[center + 1]).toBeGreaterThan(60);
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 130, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
    await page.getByRole('button', { name: 'World overview', exact: true }).click();
    await expectMapReady(page);
    await page.screenshot({ path: '/tmp/pins-carto-globe.png' });
    expect(errors).toEqual([]);
});

test('ignores a late country response and recovers malformed province pins', async ({ page }) => {
    const errors = await prepare(page);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/world/regions/CAN.*', async route => { await gate; await route.continue(); });
    await page.goto('/projects/pins-of-inaccessibility/map?country=CAN');
    await expect(page.getByRole('region', { name: 'Canada pole', exact: true })).toBeVisible();
    await page.getByLabel('Country / territory', { exact: true }).selectOption('AUS');
    await expect(page.locator('.pins-results li')).toHaveCount(11);
    release();
    await page.getByRole('searchbox', { name: 'Search pins' }).fill('New South Wales');
    await expect(page.locator('.pins-results li')).toHaveCount(1);
    await expect(page.locator('.pins-results')).toContainText('AU-NSW');
    let invalid = true;
    await page.unroute('**/world/regions/CAN.*');
    await page.route('**/world/regions/JPN.json', route => invalid ? route.fulfill({ json: {} }) : route.continue());
    await page.getByLabel('Country / territory', { exact: true }).selectOption('JPN');
    await expect(page.getByRole('button', { name: 'Retry pin data' })).toBeVisible();
    invalid = false;
    await page.getByRole('button', { name: 'Retry pin data' }).click();
    await expect(page.locator('.pins-results li')).toHaveCount(30);
    await expect(page.getByText('47 pins ranked by radius')).toBeVisible();
    await page.getByLabel('Country / territory', { exact: true }).selectOption('USA');
    await expect(page.locator('.pins-coverage')).toContainText('3,235');
    await expect(page.getByRole('region', { name: 'U.S. pole', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});
