import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

async function solidTile(background: string) {
    return sharp({ create: { width: 256, height: 256, channels: 3, background } }).png().toBuffer();
}

async function mockCartoTiles(page: Page) {
    const [light, voyager, dark] = await Promise.all([
        solidTile('#c83232'), solidTile('#32c832'), solidTile('#404040'),
    ]);
    const tiles = new Map([
        ['light_nolabels', light],
        ['rastertiles/voyager_nolabels', voyager],
        ['dark_all', dark],
    ]);
    const requestedStyles = new Set<string>();
    await page.route('https://basemaps.cartocdn.com/**', route => {
        const url = new URL(route.request().url());
        expect(url.searchParams.get('key')).toBe('browser-test-key');
        const style = /^\/(.+)\/\d+\/\d+\/\d+\.png$/.exec(url.pathname)?.[1];
        const tile = style && tiles.get(style);
        if (!tile) throw new Error(`Unexpected CARTO tile path: ${url.pathname}`);
        requestedStyles.add(style);
        return route.fulfill({ contentType: 'image/png', body: tile });
    });
    return requestedStyles;
}

async function expectCartoAttribution(page: Page, visible = true) {
    for (const [name, href] of [
        ['CARTO', 'https://carto.com/attribution/'],
        ['OpenStreetMap', 'https://www.openstreetmap.org/copyright'],
    ]) {
        const link = page.getByRole('link', { name, exact: true });
        if (visible) {
            await expect(link).toBeVisible();
            await expect(link).toHaveAttribute('href', href);
        } else {
            await expect(link).toHaveCount(0);
        }
    }
}

async function basemapPixels(page: Page) {
    const pixels = await sharp(await page.locator('.flights-globe canvas').screenshot()).removeAlpha().raw().toBuffer();
    let red = 0;
    let green = 0;
    let magenta = 0;
    for (let index = 0; index < pixels.length; index += 3) {
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        if (r > 50 && r > g * 1.5 && r > b * 1.5) red++;
        if (g > 50 && g > r * 1.5 && g > b * 1.5) green++;
        if (r > 50 && b > 50 && r > g * 1.5 && b > g * 1.5) magenta++;
    }
    return { red, green, magenta };
}

for (const path of [
    '/projects/flights/map?paths=0&stats=0&basemap=positron',
    '/projects/temperature-records/map',
    '/projects/temperature-records/trends?tab=map',
]) {
    test(`basemap requests carry the configured key: ${path}`, async ({ page }) => {
        const requestedStyles = await mockCartoTiles(page);
        await page.route('https://data.rsmb.tv/**', route => {
            const file = new URL(route.request().url()).pathname;
            if (file.endsWith('climateTrends.json')) return route.fulfill({ json: {
                source: 'test', description: 'test', totalHighs: 1, totalLows: 1,
                byDecade: [{ decade: 2020, label: '2020s', highs: 1, lows: 1, ratio: 1 }],
                byYear: [{ year: 2020, highs: 1, lows: 1 }], rollingRatio: [],
            } });
            if (file.endsWith('recentRecords.json')) return route.fulfill({ json: { asOf: '2026-11-02', dates: [], yesterday: [], last7Days: [] } });
            if (file.endsWith('summary.json')) return route.fulfill({ json: { lastUpdated: '2026-11-02T00:00:00Z', stateRecordCount: 0, countyRecordCount: 0, statesProcessed: 48 } });
            return route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
        });
        await page.goto(path);
        await expect.poll(() => requestedStyles.size).toBeGreaterThan(0);
        await expectCartoAttribution(page);
    });
}

for (const startup of ['normal', 'delayed module'] as const) {
    test.describe(`flight basemap rendering (${startup} startup)`, () => {
        // Keep software WebGL work bounded on CI while exercising the real renderer.
        test.use({ viewport: { width: 800, height: 600 }, reducedMotion: 'reduce' });

        for (const { initialStyle, initialLabel, initialColor, basemap, selectedColor } of [
            { initialStyle: 'positron', initialLabel: 'Light', initialColor: 'red', basemap: 'Voyager', selectedColor: 'green' },
            { initialStyle: 'voyager', initialLabel: 'Voyager', initialColor: 'green', basemap: 'Night', selectedColor: 'magenta' },
        ] as const) {
            test(`switching from ${initialLabel} to ${basemap} replaces the rendered basemap`, async ({ page }) => {
                const requestedStyles = await mockCartoTiles(page);
                const [night, bump] = await Promise.all([solidTile('#c832c8'), solidTile('#808080')]);
                await page.route('**/basemaps/earth-night*.webp', route => route.fulfill({ contentType: 'image/png', body: night }));
                await page.route('**/basemaps/earth-topology*.webp', route => route.fulfill({ contentType: 'image/png', body: bump }));
                await page.route('**/data/flights/*.geojson', route => route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));

                let releaseStartup!: () => void;
                const startupGate = new Promise<void>(resolve => { releaseStartup = resolve; });
                let moduleDelayed = false;
                if (startup === 'delayed module') {
                    await page.route('**/src/features/flights/components/FlightsMap.tsx*', async route => {
                        moduleDelayed = true;
                        await startupGate;
                        await route.continue();
                    });
                }
                let releaseTimer: ReturnType<typeof setTimeout> | undefined;
                try {
                    // A held lazy module must not block navigation before its release timer starts.
                    await page.goto(`/projects/flights/map?paths=0&stats=0&basemap=${initialStyle}`, { waitUntil: 'domcontentloaded' });
                    if (startup === 'delayed module') {
                        // Exceed the default five-second pixel assertion to expose the startup race.
                        releaseTimer = setTimeout(releaseStartup, 6_000);
                    }
                    // Lazy component loading uses the test budget before pixel polling starts.
                    await page.locator('.flights-globe canvas').waitFor({ state: 'visible' });
                    await expect.poll(async () => (await basemapPixels(page))[initialColor]).toBeGreaterThan(10_000);
                    if (startup === 'delayed module') expect(moduleDelayed).toBe(true);
                    await page.getByRole('button', { name: 'Toggle layer options' }).click();
                    await page.getByRole('button', { name: `Basemap (${initialLabel})`, exact: true }).click();
                    await page.getByRole('button', { name: basemap, exact: true }).click();
                    if (basemap === 'Voyager') {
                        await expect(page).toHaveURL(/basemap=voyager/);
                        await expect.poll(() => requestedStyles.has('rastertiles/voyager_nolabels')).toBe(true);
                        await expectCartoAttribution(page);
                    } else {
                        await expect(page).not.toHaveURL(/basemap=/);
                        await expectCartoAttribution(page, false);
                    }
                    await expect(page.getByText('Loading globe...', { exact: true })).toHaveCount(0);
                    // Each style has its own color. Wrong styles and blank globes must fail too.
                    await expect.poll(async () => {
                        const pixels = await basemapPixels(page);
                        return {
                            oldTilesVisible: pixels[initialColor] >= 1_000,
                            selectedBasemapVisible: pixels[selectedColor] > 10_000,
                        };
                    }).toEqual({ oldTilesVisible: false, selectedBasemapVisible: true });
                } finally {
                    clearTimeout(releaseTimer);
                    releaseStartup();
                    await page.unrouteAll({ behavior: 'wait' });
                }
            });
        }
    });
}
