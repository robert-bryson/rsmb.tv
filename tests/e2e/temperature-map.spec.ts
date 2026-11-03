import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import type { BrokenRecord } from '../../src/features/temperatures/types';

function record(index: number, overrides: Partial<BrokenRecord> = {}): BrokenRecord {
    return {
        stationName: `Station ${index + 1}`, uid: index + 1, state: 'KS', stateName: 'Kansas', county: '20001',
        lat: 38 + Math.floor(index / 3) * 1.5, lon: -102 + index % 3 * 2,
        elev: 100, type: index % 2 === 0 ? 'high' : 'low', tempF: index % 2 === 0 ? 90 : 20,
        prevRecordF: index % 2 === 0 ? 85 : 25, prevRecordDate: '2011-11-02', normalF: 60,
        date: '2026-11-02', recordScope: 'daily', ...overrides,
    };
}

async function fixtures(page: Page, records: BrokenRecord[]) {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
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
        return route.fulfill({ json: { meta: { name: uid === 1 ? 'Target station' : 'Neighbor station', uid }, data: [] } });
    });
    return errors;
}

// The initial camera is fixed at [-98.5, 39.8], zoom 3.5, with no pitch or bearing.
function mapPoint(record: BrokenRecord, width: number, height: number) {
    const mercatorY = (latitude: number) => {
        const sine = Math.sin(latitude * Math.PI / 180);
        return (1 - Math.log((1 + sine) / (1 - sine)) / (2 * Math.PI)) / 2;
    };
    const worldSize = 512 * 2 ** 3.5;
    return {
        x: width / 2 + (record.lon + 98.5) / 360 * worldSize,
        y: height / 2 + (mercatorY(record.lat) - mercatorY(39.8)) * worldSize,
    };
}

async function visibleMarkers(page: Page, records: BrokenRecord[]) {
    const viewport = page.viewportSize()!;
    const { data, info } = await sharp(await page.locator('.maplibregl-canvas').screenshot({ scale: 'css' })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return records.map(record => {
        const point = mapPoint(record, viewport.width, viewport.height);
        let matchingPixels = 0;
        for (let y = Math.round(point.y) - 8; y <= Math.round(point.y) + 8; y++) {
            for (let x = Math.round(point.x) - 8; x <= Math.round(point.x) + 8; x++) {
                const offset = (y * info.width + x) * info.channels;
                const [red, green, blue] = data.subarray(offset, offset + 3);
                if (record.type === 'high' ? red > 150 && red > green * 1.7 && red > blue * 1.2
                    : blue > 150 && blue > red * 1.7 && blue > green * 1.2) matchingPixels++;
            }
        }
        return matchingPixels >= 10;
    });
}

for (const width of [390, 1280]) {
    test(`every nearby high and low marker remains visible at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const records = Array.from({ length: 9 }, (_, index) => record(index));
        const errors = await fixtures(page, records);
        await page.goto('/projects/temperature-records/map');
        await expect.poll(() => visibleMarkers(page, records)).toEqual(records.map(() => true));
        if (width < 768) await page.getByRole('button', { name: 'Show summary panel' }).click();
        await page.getByRole('button', { name: 'Last 7 Days', exact: true }).click();
        if (width < 768) await page.getByRole('button', { name: 'Hide summary panel' }).click();
        await expect.poll(() => visibleMarkers(page, records)).toEqual(records.map((_, index) => index < 4));
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
    await expect.poll(() => visibleMarkers(page, [target, neighbor])).toEqual([true, true]);
    const canvas = page.locator('.maplibregl-canvas');
    const position = mapPoint(target, width, height);
    await canvas.hover({ position });
    await expect(page.locator('.hover-tip')).toContainText('32.2°C');
    await canvas.click({ position });
    await expect(page.getByRole('heading', { name: 'Target station', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Neighbor station', exact: true })).toHaveCount(0);
    await expect(page.locator('.maplibregl-popup')).toHaveCount(1);
    expect(errors).toEqual([]);
});
