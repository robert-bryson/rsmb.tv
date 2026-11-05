import { expect, test, type Page } from '@playwright/test';
import { allAirports, airports, flights } from './fixtures/flight-duration';

test.beforeEach(async ({ page }) => {
    await page.route('**/data/flights/flights.geojson', route => route.fulfill({ json: flights }));
    await page.route('**/data/flights/visitedAirports.geojson', route => route.fulfill({ json: airports }));
    // Geography selections request this layer even when paths are hidden.
    await page.route('**/data/flights/allAirports.geojson', route => route.fulfill({ json: allAirports }));
});

async function openFlightSummary(page: Page, query: string, counts: { flights: number; airports: number }) {
    await page.goto(`/projects/flights/map?paths=0&${query}`);
    // Navigation can finish before the lazy map and its flight/airport data load.
    // Keep a separate startup budget; duration assertions retain their default timeout.
    await expect(page.getByRole('application')).toHaveAttribute(
        'aria-label', new RegExp(`showing ${counts.flights} flights across ${counts.airports} airports\\.`), { timeout: 15_000 },
    );
}

const routeSummary = { flights: 2, airports: 2, total: '6h', hours: '5.8', average: '2h 53m' };
const countrySummary = { flights: 3, airports: 3, total: '9h', hours: '8.6', average: '2h 51m' };

async function expectRecordedTime(page: Page, expected: { total: string; hours: string; average: string }) {
    const panel = page.getByTestId('stats-panel-content');
    const time = panel.getByRole('region', { name: 'Flight time', exact: true });
    await expect(time.getByText(expected.total, { exact: true })).toBeVisible();
    await expect(time.getByTitle(`Flight time: ${expected.hours} h.`)).toBeVisible();
    await expect(time).not.toContainText(/Est\.|Estimated|actual ·|Gate-to-gate/);
    await expect(time).toContainText('Total Time');
    await expect(time).toContainText('Avg Time');
    await expect(time.getByText(expected.average, { exact: true })).toBeVisible();
    await expect(time.getByText('Longest Flight Time', { exact: true }).locator('..')).toContainText('3h');
    await expect(time.getByText('Longest Flight Time', { exact: true }).locator('..')).toContainText('Scheduled');
    await expect(time.getByText('Shortest Flight Time', { exact: true }).locator('..')).toContainText('2h 45m');
    await expect(time.getByText('Shortest Flight Time', { exact: true }).locator('..')).toContainText('Actual');
    await expect(page.getByRole('status')).toContainText(expected.total);
    await expect(panel).not.toContainText(/\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/);
}

for (const { selection, heading, summary } of [
    { selection: 'route=LAX-SEA', heading: 'SEA ↔ LAX', summary: routeSummary },
    { selection: 'airport=LAX', heading: 'LAX', summary: routeSummary },
    { selection: 'country=US', heading: 'United States', summary: countrySummary },
    { selection: 'region=US-CA', heading: 'California', summary: routeSummary },
    {
        selection: 'flightType=domestic', heading: 'Flight Statistics',
        summary: { flights: 4, airports: 5, total: '11h', hours: '11.5', average: '2h 52m' },
    },
    {
        selection: '', heading: 'Flight Statistics',
        summary: { flights: 5, airports: 6, total: '14h', hours: '14.4', average: '2h 53m' },
    },
]) {
    test(`recorded durations agree across filtered summaries: ${selection || 'overall'}`, async ({ page }) => {
        await openFlightSummary(page, `year=2024&airline=Test&${selection}`, summary);
        const panel = page.getByTestId('stats-panel-content');
        await expect(panel.getByRole('heading', { name: heading, level: 3, exact: true })).toBeVisible();
        if (selection === 'flightType=domestic') {
            await expect(panel.getByText('Flight type: Domestic', { exact: true })).toBeVisible();
        }
        await expectRecordedTime(page, summary);
        if (selection.startsWith('route=')) {
            await panel.getByRole('button', { name: /All Flights \(2\)/ }).click();
            await expect(panel).toContainText('T101');
            const actual = panel.getByText('2h 45m', { exact: true }).locator('..').filter({ hasText: '· Actual' });
            await expect(actual).toBeVisible();
            await expect(panel.getByText('3h', { exact: true }).locator('..').filter({ hasText: '· Scheduled' })).toBeVisible();
            await expect(actual.getByText('2 hours 45 minutes', { exact: true })).toHaveClass('sr-only');
            await expect(panel).not.toContainText(/\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/);
        }
    });
}

for (const filename of ['flights.geojson', 'visitedAirports.geojson']) {
    test(`country summary waits for delayed ${filename}`, async ({ page }) => {
        let releaseResponse!: () => void;
        const responseGate = new Promise<void>(resolve => { releaseResponse = resolve; });
        let requestDelayed = false;
        let releaseTimer: ReturnType<typeof setTimeout> | undefined;
        await page.route(`**/data/flights/${filename}`, async route => {
            requestDelayed = true;
            // Exceed the unchanged five-second duration assertion timeout.
            releaseTimer ??= setTimeout(releaseResponse, 6_000);
            await responseGate;
            await route.fallback();
        });
        try {
            await openFlightSummary(page, 'year=2024&airline=Test&country=US', countrySummary);
            await expectRecordedTime(page, countrySummary);
            await expect(page.getByTestId('stats-panel-content').getByRole('heading', {
                name: 'United States', level: 3, exact: true,
            })).toBeVisible();
            expect(requestDelayed).toBe(true);
        } finally {
            clearTimeout(releaseTimer);
            releaseResponse();
            await page.unrouteAll({ behavior: 'wait' });
        }
    });
}

for (const width of [1280, 320]) {
    test(`estimated-only flight details omit estimate labels at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openFlightSummary(page, 'year=2025&route=LAX-SEA', { flights: 1, airports: 2 });
        const panel = page.getByTestId('stats-panel-content');
        const time = panel.getByRole('region', { name: 'Flight time', exact: true });
        await expect(time.getByText('3h', { exact: true })).toBeVisible();
        await expect(time.getByText('Longest Flight Time', { exact: true })).toBeVisible();
        await expect(time.getByText('Shortest Flight Time', { exact: true })).toBeVisible();
        await panel.getByRole('button', { name: /All Flights \(1\)/ }).click();
        await expect(panel.getByText('T101', { exact: false })).toBeVisible();
        await expect(panel).not.toContainText(/Est\.|Estimated|\d+ actual ·|Gate-to-gate|Distance estimate/);
        const status = page.getByRole('status');
        await expect(status).toContainText('3h');
        await expect(status).not.toContainText(/Est\.|Estimated/);
    });
}

test('flight time remains accessible and the stats tab fits a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await openFlightSummary(page, 'year=2024&airline=Test&route=LAX-SEA', routeSummary);
    const time = page.getByRole('region', { name: 'Flight time', exact: true });
    await expect(time.getByText('6h', { exact: true })).toBeVisible();
    await expect(time).not.toContainText(/Est\.|Estimated|actual ·|Gate-to-gate/);
    const timeToggle = time.getByRole('button', { name: 'Flight Time', exact: true });
    await expect(timeToggle).toHaveAttribute('aria-expanded', 'true');
    await timeToggle.focus();
    await page.keyboard.press('Space');
    await expect(timeToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(time.getByText('6h', { exact: true })).not.toBeVisible();
    await page.keyboard.press('Enter');
    await expect(timeToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(time.getByText('6h', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '▼ Collapse All' }).click();
    await expect(time.getByText('6h', { exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: '▶ Expand All' }).click();
    await expect(time.getByText('6h', { exact: true })).toBeVisible();
    const toggle = page.getByRole('button', { name: 'Hide stats panel' });
    const bounds = (await toggle.boundingBox())!;
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    await toggle.click();
    await expect(page.getByTestId('stats-panel-content')).toHaveAttribute('data-state', 'closed');
});
