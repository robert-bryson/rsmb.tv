import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import type { BrokenRecord } from '../../src/features/temperatures/types';

function record(index: number, overrides: Partial<BrokenRecord> = {}): BrokenRecord {
    return {
        stationName: `Station ${index + 1}`, uid: index + 1, state: 'KS', stateName: 'Kansas', county: '20001',
        lat: 34 + Math.floor(index / 3) * 3.5, lon: -108 + index % 3 * 4,
        elev: 100, type: index % 2 === 0 ? 'high' : 'low', tempF: index % 2 === 0 ? 90 : 20,
        prevRecordF: index % 2 === 0 ? 85 : 25, prevRecordDate: '2011-11-02', normalF: 60,
        date: '2026-11-02', recordScope: 'daily', ...overrides,
    };
}

async function fixtures(page: Page, records: BrokenRecord[]) {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
        if (/maplibre.*worker/.test(response.url()) && !response.ok()) errors.push(`Worker HTTP ${response.status()}`);
    });
    page.on('console', message => {
        if (message.type() === 'error' && message.text().includes('MapLibre error:')) errors.push(message.text());
    });
    await page.route('https://**/*', route => route.abort());
    const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#171b24' } }).png().toBuffer();
    await page.route('https://basemaps.cartocdn.com/**', route => route.fulfill({ contentType: 'image/png', body: tile }));
    // An empty glyph range keeps marker checks independent of remote font availability.
    await page.route('https://demotiles.maplibre.org/font/**', route => route.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) }));
    await page.route('**/recentRecords.json', route => route.fulfill({ json: {
        asOf: '2026-11-03', dates: ['2026-11-02'], yesterday: records, last7Days: records.slice(0, 4),
    } }));
    await page.route('**/summary.json', route => route.fulfill({ json: {
        lastUpdated: '2026-11-03T00:00:00Z', stateRecordCount: 0, countyRecordCount: 0, statesProcessed: 48,
    } }));
    await page.route('https://data.rcc-acis.org/StnData', route => {
        const uid = route.request().postDataJSON().uid;
        return route.fulfill({ json: { meta: { name: records.find(record => record.uid === uid)?.stationName ?? 'Unknown station', uid }, data: [] } });
    });
    return errors;
}

// Locate real rendered markers independently of the responsive map camera.
async function markers(page: Page) {
    const { data, info } = await sharp(await page.locator('.maplibregl-canvas').screenshot({ scale: 'css',
        mask: [page.locator('[data-testid="temperature-map"] > :not(:first-child)'), page.locator('[data-temperature-panel]')], maskColor: '#171b24', animations: 'disabled',
    })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const colors = new Uint8Array(info.width * info.height);
    for (let index = 0; index < colors.length; index++) {
        const [red, green, blue] = data.subarray(index * info.channels, index * info.channels + 3);
        colors[index] = red > 150 && red > green * 1.7 && red > blue * 1.2 ? 1
            : blue > 150 && blue > red * 1.7 && blue > green * 1.2 ? 2 : 0;
    }
    const found: { type: 'high' | 'low'; x: number; y: number }[] = [];
    for (let index = 0; index < colors.length; index++) {
        const color = colors[index];
        if (!color) continue;
        const pending = [index];
        colors[index] = 0;
        let count = 0, sumX = 0, sumY = 0;
        while (pending.length) {
            const next = pending.pop()!;
            const x = next % info.width, y = Math.floor(next / info.width);
            count++; sumX += x; sumY += y;
            for (const neighbor of [x > 0 ? next - 1 : -1, x < info.width - 1 ? next + 1 : -1, next - info.width, next + info.width]) {
                if (neighbor >= 0 && neighbor < colors.length && colors[neighbor] === color) {
                    colors[neighbor] = 0; pending.push(neighbor);
                }
            }
        }
        if (count >= 10) found.push({ type: color === 1 ? 'high' : 'low', x: sumX / count, y: sumY / count });
    }
    return found;
}

async function markerCounts(page: Page) {
    const found = await markers(page);
    return { high: found.filter(marker => marker.type === 'high').length, low: found.filter(marker => marker.type === 'low').length };
}

for (const width of [390, 1280]) {
    test(`every high and low marker renders at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const records = Array.from({ length: 9 }, (_, index) => record(index));
        const errors = await fixtures(page, records);
        await page.goto('/projects/temperature-records/map');
        await expect(page.getByTestId('temperature-map')).toHaveAttribute('data-map-state', 'ready');
        await expect.poll(() => markerCounts(page)).toEqual({ high: 5, low: 4 });
        await page.getByRole('button', { name: 'Last 7 Days', exact: true }).click();
        await expect.poll(() => markerCounts(page)).toEqual({ high: 2, low: 2 });
        expect(errors).toEqual([]);
    });
}

test('clicking a marker selects that station when another glow overlaps it', async ({ page }) => {
    const width = 1280;
    const height = 900;
    await page.setViewportSize({ width, height });
    const target = record(0, { stationName: 'Target station', lat: 39, lon: -100 });
    const neighbor = record(1, { stationName: 'Neighbor station', lat: 39, lon: -99.3 });
    const errors = await fixtures(page, [target, neighbor]);
    await page.goto('/projects/temperature-records/map?unit=C');
    await expect(page.getByTestId('temperature-map')).toHaveAttribute('data-map-state', 'ready');
    await expect.poll(() => markerCounts(page)).toEqual({ high: 1, low: 1 });
    const canvas = page.locator('.maplibregl-canvas');
    const position = (await markers(page)).find(marker => marker.type === 'high')!;
    await canvas.hover({ position });
    await expect(page.locator('.hover-tip')).toContainText('32.2°C');
    await canvas.click({ position });
    await expect(page.getByRole('heading', { name: 'Target station', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Neighbor station', exact: true })).toHaveCount(0);
    await expect(page.locator('.maplibregl-popup')).toHaveCount(1);
    expect(errors).toEqual([]);
});


test('phone controls keep periods visible, clear filters, and open station details from the list', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const records = Array.from({ length: 26 }, (_, index) => record(index, { type: 'high', tempF: 90, prevRecordF: 85, lat: 39, lon: -100 }));
    const errors = await fixtures(page, records);
    await page.goto('/projects/temperature-records/map?unit=C');
    await expect(page.getByRole('button', { name: 'Last 7 Days', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record ages', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'State filter' })).toBeHidden();
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByRole('combobox', { name: 'Record scope filter' }).selectOption('monthly');
    await page.getByRole('button', { name: 'Show summary panel' }).click();
    await expect(page.getByText('No records match these filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page).toHaveURL(/unit=C/);
    await expect(page).not.toHaveURL(/scope=/);
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByRole('button', { name: /Show more/ }).click();
    const row = page.getByRole('button', { name: /Station 26/ });
    await row.click();
    await expect(page.getByRole('heading', { name: 'Station 26' })).toBeFocused();
    await page.getByRole('button', { name: 'Close station detail' }).click();
    await expect(row).toBeFocused();
    expect(errors).toEqual([]);
});

test('county view loads independently and exposes incomplete geographic coverage', async ({ page }) => {
    await fixtures(page, []);
    await page.route('**/recentRecords.json', route => route.abort());
    await page.route('**/stateRecords.json', route => route.abort());
    await page.route('**/countyRecords.json', route => route.fulfill({ json: { type: 'FeatureCollection', features: [{
        type: 'Feature', geometry: { type: 'Point', coordinates: [-100, 39] },
        properties: { countyFips: '20001', countyName: 'Test County', state: 'KS', type: 'high', tempF: 110, date: '2020-08-01', stationName: 'County station', lat: 39, lon: -100 },
    }] } }));
    const requests: string[] = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto('/projects/temperature-records/map?view=county');
    await expect(page.getByText('1/48 states', { exact: false })).toBeVisible();
    await expect(page.getByTestId('temperature-map')).toHaveAttribute('data-map-state', 'ready');
    await expect(page.getByText('Failed to load temperature data')).toHaveCount(0);
    expect(requests.some(url => /recentRecords.json|stateRecords.json/.test(url))).toBe(false);
});

test('a failed county feed keeps the map alive when returning to recent records', async ({ page }) => {
    const errors = await fixtures(page, [record(0)]);
    await page.route('**/countyRecords.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.goto('/projects/temperature-records/map');
    const map = page.getByTestId('temperature-map');
    await expect(map).toHaveAttribute('data-map-state', 'ready');
    const canvas = await page.locator('.maplibregl-canvas').elementHandle();
    expect(canvas).not.toBeNull();
    await page.getByRole('button', { name: /County Extremes/ }).click();
    await expect(page.getByRole('alert')).toContainText('Failed to load temperature data');
    await expect(map).toHaveAttribute('data-map-state', 'error');
    expect(await canvas!.evaluate(element => element.isConnected)).toBe(true);
    await page.getByRole('button', { name: /Recent/ }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(map).toHaveAttribute('data-map-state', 'ready');
    expect(await canvas!.evaluate(element => element.isConnected)).toBe(true);
    await expect.poll(() => markerCounts(page)).toEqual({ high: 1, low: 0 });
    expect(errors).toEqual([]);
});
