import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { flights, airports } from './fixtures/flight-duration';

test.skip(process.env.PAGE_RECOVERY !== '1', 'Intent prefetch checks require a production bundle.');

declare global {
    interface Window { __prefetchWorkers?: { count: number } }
}
const emptyCollection = { type: 'FeatureCollection', features: [] };
const emptyAnnualSummary = [{ year: 2025, count: 0, unknown: 0,
    ef0: 0, ef1: 0, ef2: 0, ef3: 0, ef4: 0, ef5: 0, ef1Plus: 0, ef2Plus: 0,
    deaths: 0, injuries: 0, trackMiles: 0, medianWidthYards: 0 }];

async function tornadoFixtures(page: Page, events: () => unknown = () => []) {
    await page.route('https://data.rsmb.tv/tornadoes/**', route => {
        const path = new URL(route.request().url()).pathname;
        return route.fulfill({ json: path.endsWith('annual-summary.json') ? emptyAnnualSummary
            : path.endsWith('notable-events.json') ? events() : emptyCollection });
    });
    await page.route('**/data/flights/usStates.geojson', route => route.fulfill({ json: emptyCollection }));
}

async function fixtureAssets(page: Page) {
    await page.route('https://**/*', route => route.abort());
    const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#171b24' } }).png().toBuffer();
    await page.route('**/basemaps/**', route => route.fulfill({ contentType: 'image/png', body: tile }));
    await page.route('https://basemaps.cartocdn.com/**', route => new URL(route.request().url()).pathname.endsWith('style.json')
        ? route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#171b24' } }] } })
        : route.fulfill({ contentType: 'image/png', body: tile }));
    await page.route('**/data/flights/flights.geojson', route => route.fulfill({ json: flights }));
    await page.route('**/data/flights/visitedAirports.geojson', route => route.fulfill({ json: airports }));
    await page.route('**/test-trip/**', route => route.request().url().endsWith('.geojson')
        ? route.fulfill({ json: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-122, 47], [-122.5, 46.7], [-123, 46]] } } })
        : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#456"/></svg>' }));
}

async function ready(page: Page) {
    await page.waitForLoadState('load');
    await page.waitForFunction(() => [...document.images].every(image => {
        const box = image.getBoundingClientRect();
        return image.complete || box.bottom <= 0 || box.top >= innerHeight || box.width === 0;
    }));
}

async function noSpeculativeRenderer(page: Page) {
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.evaluate(() => window.__prefetchWorkers?.count)).toBe(0);
}

test.beforeEach(async ({ page }) => {
    await fixtureAssets(page);
    await page.addInitScript(() => {
        const stats = { count: 0 };
        Object.defineProperty(window, '__prefetchWorkers', { value: stats });
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
            constructor(url: string | URL, options?: WorkerOptions) {
                super(url, options);
                stats.count++;
            }
        };
    });
});

test('prefetch starts after sustained hover, reuses the route chunk, and preserves the current page', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', request => { if (/\/About-[^/]+\.js$/.test(request.url())) requests.push(request.url()); });
    await page.goto('/'); await ready(page);
    const link = page.locator('header').getByRole('link', { name: 'About', exact: true });
    await page.mouse.move(1, 850);
    expect(requests).toHaveLength(0);
    await link.hover(); await page.mouse.move(1, 850); await page.waitForTimeout(180);
    expect(requests).toHaveLength(0);
    await link.hover();
    await expect.poll(() => requests.length).toBe(1);
    await expect(page.getByRole('heading', { name: "Hi, I'm Robby" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await link.click();
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
    expect(requests).toHaveLength(1);
});

test('prefetch supports keyboard focus', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', request => { if (/\/About-[^/]+\.js$/.test(request.url())) requests.push(request.url()); });
    await page.goto('/'); await ready(page);
    await page.locator('header').getByRole('link', { name: 'About', exact: true }).focus();
    await expect.poll(() => requests.length).toBe(1);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
    expect(requests).toHaveLength(1);
});

test('a click bypasses an unrelated speculative module that is still downloading', async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let requested = false;
    let finished: Promise<unknown> | undefined;
    await page.route(/\/About-[^/]+\.js$/, async route => { requested = true; await held; await route.continue(); });
    await page.goto('/'); await ready(page);
    try {
        await page.locator('header').getByRole('link', { name: 'About', exact: true }).hover();
        await expect.poll(() => requested).toBe(true);
        finished = page.waitForResponse(/\/About-[^/]+\.js$/).then(response => response.finished());
        await page.locator('header').getByRole('link', { name: 'Projects', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    } finally { release(); await finished; }
});

test('prefetch failures leave navigation available and a later demanded load can recover', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let requests = 0;
    await page.route(/\/assets\/About-[^/]+\.js$/, route => ++requests === 1 ? route.fulfill({ status: 503, body: 'Temporary failure', headers: { 'cache-control': 'no-store' } }) : route.continue());
    await page.goto('/'); await ready(page);
    const link = page.locator('header').getByRole('link', { name: 'About', exact: true });
    await link.hover(); await expect.poll(() => requests).toBe(1);
    await page.waitForTimeout(150);
    await expect(page.getByRole('heading', { name: "Hi, I'm Robby" })).toBeVisible();
    expect(errors).toEqual([]);
    await link.click();
    // Engines may retain a failed module graph; the existing explicit recovery remains available.
    await expect(page.locator('h1')).toHaveText(/About|Something went wrong/);
    if (await page.getByRole('button', { name: 'Try again', exact: true }).count()) await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
});

for (const connection of [{ saveData: true }, { effectiveType: '2g' }]) {
    test(`prefetch respects connection hints ${JSON.stringify(connection)} while clicks still navigate`, async ({ page }) => {
        await page.addInitScript(value => Object.defineProperty(navigator, 'connection', { configurable: true, value }), connection);
        let requests = 0; page.on('request', request => { if (/\/About-[^/]+\.js$/.test(request.url())) requests++; });
        await page.goto('/'); await ready(page);
        const link = page.locator('header').getByRole('link', { name: 'About', exact: true });
        await link.hover(); await page.waitForTimeout(400); expect(requests).toBe(0);
        await link.click(); await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
        expect(requests).toBe(1);
    });
}

test('prefetch warms the actual globe and shared data without creating a renderer or fetching optional assets', async ({ page }) => {
    const requests: string[] = []; const errors: string[] = [];
    page.on('request', request => requests.push(request.url())); page.on('pageerror', error => errors.push(error.message));
    await page.goto('/projects/flights'); await ready(page);
    const before = await page.locator('h1').boundingBox();
    await page.getByRole('link', { name: 'Open interactive globe →' }).hover();
    await expect.poll(() => requests.filter(url => /\/FlightsMap-[^/]+\.js$/.test(url)).length).toBe(1);
    await expect.poll(() => requests.filter(url => url.endsWith('/visitedAirports.geojson')).length).toBe(1);
    await page.waitForTimeout(200);
    await noSpeculativeRenderer(page);
    expect(requests.filter(url => /allAirports|usStates|\/basemaps\/|worker/.test(url))).toEqual([]);
    expect(await page.locator('h1').boundingBox()).toEqual(before);
    await page.getByRole('link', { name: 'Open interactive globe →' }).click();
    await expect(page.getByRole('application')).toHaveAttribute('aria-label', /showing 7 flights/, { timeout: 20_000 });
    await expect(page.locator('.flights-globe canvas')).toBeVisible();
    await expect(page.getByText('Loading globe...', { exact: true })).toHaveCount(0);
    expect(requests.filter(url => url.endsWith('/visitedAirports.geojson'))).toHaveLength(1);
    expect(requests.filter(url => url.endsWith('/flights.geojson'))).toHaveLength(1);
    expect(errors).toEqual([]);
});

test('prefetch prepares one trip body and manifest, preserves return state, and leaves embedded maps deferred', async ({ page }) => {
    const requests: string[] = []; page.on('request', request => requests.push(request.url()));
    await page.goto('/posts?tag=coast'); await ready(page);
    const link = page.getByRole('link', { name: /Coastal test trip/ }).first();
    await link.hover();
    await expect.poll(() => requests.filter(url => /coastal-test-[^/]+\.js/.test(url)).length).toBeGreaterThan(0);
    await page.waitForTimeout(300);
    expect(requests.filter(url => /maplibre|TripRouteMap|FlightsMap|reading-test-.*\.js|daily-test-.*\.js|\.geojson$/.test(url))).toEqual([]);
    await link.click();
    await expect(page.getByText('Opening story paragraph.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to posts|All posts/ }).first()).toBeVisible();
    expect(requests.filter(url => /maplibre|TripRouteMap/.test(url))).toEqual([]);
});

test('prefetch prepares temperature data before its renderer finishes, and a bad speculative snapshot can recover', async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route(/\/TemperatureMap-[^/]+\.js$/, async route => { await held; await route.continue(); });
    let records = 0;
    await page.route('**/recentRecords.json', route => route.fulfill({ json: ++records === 1 ? { malformed: true }
        : { asOf: '2026-11-03', dates: ['2026-11-02'], yesterday: [], last7Days: [] } }));
    await page.route('**/summary.json', route => route.fulfill({ json: { lastUpdated: '2026-11-03', stateRecordCount: 0, countyRecordCount: 0, statesProcessed: 48 } }));
    await page.route('https://demotiles.maplibre.org/**', route => route.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) }));
    await page.goto('/projects/temperature-records'); await ready(page);
    const link = page.getByRole('link', { name: 'Open interactive map →' });
    try {
        await link.hover(); await expect.poll(() => records).toBe(1); await page.waitForTimeout(200);
    } finally { release(); }
    await noSpeculativeRenderer(page);
    await link.click();
    await expect(page.getByTestId('temperature-map')).toHaveAttribute('data-map-state', 'ready', { timeout: 20_000 });
    expect(records).toBe(2);
});

test('prefetch warms tornado metadata and code without historical geometry or a hidden map', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', request => requests.push(request.url()));
    await tornadoFixtures(page);
    await page.goto('/projects/tornado-tracks'); await ready(page);
    const launch = page.getByRole('link', { name: 'Open interactive map →' });
    await launch.hover();
    await expect.poll(() => requests.filter(url => url.endsWith('annual-summary.json')).length).toBe(1);
    await expect.poll(() => requests.filter(url => /\/TornadoMap-[^/]+\.js$/.test(url)).length).toBe(1);
    expect(requests.filter(url => /\/tracks\/|\/track-points\/|trend-index|warning-summary|worker/.test(url))).toEqual([]);
    await noSpeculativeRenderer(page);
    await launch.click();
    await expect(page.getByTestId('tornado-map')).toHaveAttribute('data-map-state', 'ready', { timeout: 20_000 });
    expect(requests.filter(url => url.endsWith('annual-summary.json'))).toHaveLength(1);
});

test('a malformed speculative notable-event response cannot crash the demanded tornado map', async ({ page }) => {
    let events = 0;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await tornadoFixtures(page, () => ++events === 1 ? { malformed: true } : []);
    await page.goto('/projects/tornado-tracks'); await ready(page);
    const launch = page.getByRole('link', { name: 'Open interactive map →' });
    await launch.hover(); await expect.poll(() => events).toBe(1); await page.waitForTimeout(200);
    await noSpeculativeRenderer(page);
    await launch.click();
    await expect(page.getByTestId('tornado-map')).toHaveAttribute('data-map-state', 'ready', { timeout: 20_000 });
    expect(events).toBe(2);
    expect(errors).toEqual([]);
});

test('prefetch follows the atlas alias while preserving selection and report return state', async ({ page }) => {
    const requests: string[] = []; page.on('request', request => requests.push(request.url()));
    await page.goto('/projects'); await ready(page);
    const atlas = page.locator('main').getByRole('link', { name: /^ADV Atlas/ });
    await atlas.hover();
    await expect.poll(() => requests.filter(url => /\/TripAtlasMap-[^/]+\.js$/.test(url)).length).toBe(1);
    expect(requests.filter(url => /\.geojson$|worker/.test(url))).toEqual([]);
    await noSpeculativeRenderer(page);
    await atlas.click();
    await expect(page).toHaveURL(/\/projects\/adv-atlas\/map/);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    const report = page.getByRole('link', { name: 'Read trip report' }).first();
    await report.click();
    await expect(page.locator('.trip-story')).toBeVisible();
    const from = await page.evaluate(() => window.history.state.usr.from);
    expect(from).toContain('/projects/adv-atlas/map');
});

test('prefetch CSS failures cannot leave the destination map unstyled after retry', async ({ page }) => {
    let styles = 0;
    await page.route(/\/maplibre-gl-[^/]+\.css$/, route => ++styles === 1
        ? route.fulfill({ status: 503, body: 'Unavailable', headers: { 'cache-control': 'no-store' } }) : route.continue());
    await page.route('**/recentRecords.json', route => route.fulfill({ json: { asOf: '2026-11-03', dates: ['2026-11-02'], yesterday: [], last7Days: [] } }));
    await page.route('**/summary.json', route => route.fulfill({ json: { lastUpdated: '2026-11-03', stateRecordCount: 0, countyRecordCount: 0, statesProcessed: 48 } }));
    await page.goto('/projects/temperature-records'); await ready(page);
    const link = page.getByRole('link', { name: 'Open interactive map →' });
    await link.hover(); await expect.poll(() => styles).toBe(1); await page.waitForTimeout(200);
    await expect(page.getByRole('heading', { name: 'U.S. Temperature Records', exact: true })).toBeVisible();
    await link.click();
    await expect(page.getByTestId('temperature-map')).toHaveAttribute('data-map-state', 'ready', { timeout: 20_000 });
    await expect.poll(() => styles).toBe(2);
    expect(await page.evaluate(() => [...document.styleSheets].some(sheet => /maplibre-gl-.*\.css$/.test(sheet.href ?? '') && sheet.cssRules.length > 0))).toBe(true);
});

test('a failed speculative stylesheet is recovered when a different map needs it', async ({ page }) => {
    let styles = 0;
    await page.route(/\/maplibre-gl-[^/]+\.css$/, route => ++styles === 1
        ? route.fulfill({ status: 503, body: 'Unavailable', headers: { 'cache-control': 'no-store' } }) : route.continue());
    await tornadoFixtures(page);
    await page.goto('/projects/temperature-records'); await ready(page);
    await page.getByRole('link', { name: 'Open interactive map →' }).hover();
    await expect.poll(() => styles).toBe(1); await page.waitForTimeout(200);
    await page.locator('header').getByRole('link', { name: 'Projects', exact: true }).click();
    await page.locator('main').getByRole('link', { name: /^Tornado Tracks/ }).click();
    await page.getByRole('link', { name: 'Open interactive map →' }).click();
    await expect(page.getByTestId('tornado-map')).toHaveAttribute('data-map-state', 'ready', { timeout: 20_000 });
    expect(styles).toBe(2);
    expect(await page.evaluate(() => [...document.styleSheets].some(sheet => /maplibre-gl-.*\.css$/.test(sheet.href ?? '') && sheet.cssRules.length > 0))).toBe(true);
});

test('an embedded map retries a rejected lazy CSS load without reloading its story', async ({ page }) => {
    let styles = 0;
    await page.route(/\/maplibre-gl-[^/]+\.css$/, route => ++styles === 1
        ? route.fulfill({ status: 503, body: 'Unavailable', headers: { 'cache-control': 'no-store' } }) : route.continue());
    await page.goto('/trips/coastal-test'); await ready(page);
    const map = page.locator('[data-trip-map]').first();
    await map.scrollIntoViewIfNeeded();
    await expect(map.getByText('Interactive map unavailable. The route and story are still available.')).toBeVisible();
    await map.getByRole('button', { name: 'Explore interactive map' }).click();
    await expect(map.locator('.maplibregl-canvas')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Opening story paragraph.')).toBeVisible();
    expect(styles).toBe(2);
    await expect(page).toHaveURL(/\/trips\/coastal-test$/);
});
