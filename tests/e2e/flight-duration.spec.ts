import fs from 'node:fs';
import { expect, test } from '@playwright/test';

const original = JSON.parse(fs.readFileSync('public/data/flights/flights.geojson', 'utf8'));
const sample = original.features.find((f: { properties: { origin_code: string; destination_code: string } }) => f.properties.origin_code === 'SEA' && f.properties.destination_code === 'LAX') ?? original.features[0];

test.beforeEach(async ({ page }) => {
    const outbound = { ...sample.properties, id: 1, date: '1/1/2024', airline: 'Test', flightNumber: 'T101', origin_code: 'SEA', destination_code: 'LAX', origin_region: 'US-WA', destination_region: 'US-CA', origin_country: 'US', destination_country: 'US', durationMinutes: 165, durationKind: 'actual-block', durationSource: 'manual' };
    const inbound = { ...outbound, id: 2, date: '1/2/2024', flightNumber: 'T102', origin_code: 'LAX', destination_code: 'SEA', origin_region: 'US-CA', destination_region: 'US-WA', origin_lat: outbound.destination_lat, origin_lon: outbound.destination_lon, destination_lat: outbound.origin_lat, destination_lon: outbound.origin_lon, durationMinutes: 180, durationKind: 'scheduled-block', durationSource: 'itinerary' };
    const estimated = { ...outbound, id: 3, date: '1/1/2025', durationMinutes: null, durationKind: null, durationSource: null };
    await page.route('**/data/flights/flights.geojson', route => route.fulfill({ json: {
        type: 'FeatureCollection', features: [outbound, inbound, estimated].map(properties => ({ ...sample, properties })),
    } }));
});

for (const selection of ['route=LAX-SEA', 'airport=LAX', 'country=US', 'region=US-CA', 'flightType=domestic', '']) {
    test(`recorded durations agree across filtered summaries: ${selection || 'overall'}`, async ({ page }) => {
        await page.goto(`/projects/flights/map?paths=0&year=2024&airline=Test&${selection}`);
        const panel = page.getByTestId('stats-panel-content');
        const time = panel.getByRole('region', { name: 'Flight time', exact: true });
        await expect(time.getByText('6h', { exact: true })).toBeVisible();
        await expect(time.getByTitle('Flight time: 5.8 h.')).toBeVisible();
        await expect(time).not.toContainText(/Est\.|Estimated|actual ·|Gate-to-gate/);
        await expect(time).toContainText('Total Time');
        await expect(time).toContainText('Avg Time');
        await expect(time.getByText('2h 53m', { exact: true })).toBeVisible();
        await expect(time.getByText('Longest Flight Time').locator('..')).toContainText('3h');
        await expect(time.getByText('Longest Flight Time').locator('..')).toContainText('Scheduled');
        await expect(time.getByText('Shortest Flight Time', { exact: true }).locator('..')).toContainText('2h 45m');
        await expect(time.getByText('Shortest Flight Time', { exact: true }).locator('..')).toContainText('Actual');
        await expect(page.getByRole('status')).toContainText('6h');
        await expect(panel).not.toContainText(/\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/);
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

for (const width of [1280, 320]) {
    test(`estimated-only flight details omit estimate labels at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/projects/flights/map?paths=0&year=2025&route=LAX-SEA');
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
    await page.goto('/projects/flights/map?paths=0&year=2024');
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
