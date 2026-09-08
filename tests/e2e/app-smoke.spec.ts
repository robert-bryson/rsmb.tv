import { expect, test } from '@playwright/test';

test('home page renders the main content shell', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Hi, I'm Robby/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await expect(page.getByRole('link', { name: /View all/i }).first()).toHaveAttribute('href', '/projects');
});

test('flights map defers optional layer payloads on first load', async ({ page }) => {
    const requestedUrls: string[] = [];
    page.on('request', (request) => requestedUrls.push(request.url()));

    const airportsResponse = page.waitForResponse((response) =>
        response.url().includes('/data/flights/visitedAirports.geojson') && response.ok(),
    );

    await page.goto('/projects/flights/map');
    await airportsResponse;
    await expect(page.getByRole('application', { name: /Interactive 3D globe/i })).toBeVisible({ timeout: 15_000 });

    expect(requestedUrls.some((url) => url.includes('/data/flights/allAirports.geojson'))).toBe(false);
    expect(requestedUrls.some((url) => url.includes('/data/flights/usStates.geojson'))).toBe(false);
});

test('flights stats panel hides its scrollbar when closed', async ({ page }) => {
    await page.goto('/projects/flights/map?stats=1');

    const panel = page.getByTestId('stats-panel-content');
    const resizeHandle = page.locator('[role="separator"][aria-label="Resize stats panel"]');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
    await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).scrollbarColor)).not.toBe('auto');
    await expect(resizeHandle).toBeVisible();

    const handlePositionBeforeScroll = await resizeHandle.boundingBox();
    expect(handlePositionBeforeScroll).not.toBeNull();
    await panel.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect.poll(async () => (await resizeHandle.boundingBox())?.y).toBe(handlePositionBeforeScroll!.y);

    await page.getByRole('button', { name: 'Hide stats panel' }).click();

    await expect(panel).toHaveAttribute('data-state', 'closed');
    await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).overflowY)).toBe('hidden');
    await expect(resizeHandle).toHaveAttribute('tabindex', '-1');
});

test('temperature map keeps the mobile map open before showing record details', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/recentRecords.json', route => route.fulfill({
        json: {
            asOf: '2026-09-03',
            dates: ['2026-09-02'],
            yesterday: [
                {
                    stationName: 'TEST STATION', uid: 1, state: 'TX', stateName: 'Texas', county: '48001',
                    lat: 31.5, lon: -99.3, elev: 100, type: 'high', tempF: 105, prevRecordF: 101,
                    prevRecordDate: '2011-09-02', normalF: 91, date: '2026-09-02', recordScope: 'monthly',
                },
            ],
            last7Days: [],
        },
    }));
    await page.route('**/summary.json', route => route.fulfill({
        json: { lastUpdated: '2026-09-03T00:00:00Z', stateRecordCount: 96, countyRecordCount: 6078, statesProcessed: 48 },
    }));

    await page.goto('/projects/temperature-records/map');

    await expect(page.getByText('0 daily · 1 monthly')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show summary panel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yesterday' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Show summary panel' }).click();
    await expect(page.getByRole('button', { name: 'Yesterday' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'vs Avg' })).toBeVisible();
});

test('temperature history identifies standing records as survivor data', async ({ page }) => {
    await page.route('**/climateTrends.json', route => route.fulfill({
        json: {
            source: 'test', description: 'test', totalHighs: 1, totalLows: 1,
            byDecade: [{ decade: 2020, label: '2020s', highs: 1, lows: 1, ratio: 1 }],
            byYear: [{ year: 2020, highs: 1, lows: 1 }],
            rollingRatio: [],
        },
    }));

    await page.goto('/projects/temperature-records/trends');

    await expect(page.getByRole('heading', { name: 'Standing Record Ages' })).toBeVisible();
    await expect(page.getByText(/Superseded records are excluded/i)).toBeVisible();
    await expect(page.getByText(/recent records have had less time to be replaced/i)).toBeVisible();
});
