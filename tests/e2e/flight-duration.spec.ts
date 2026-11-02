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
        await expect(time).toContainText('5.8 h');
        await expect(time).toContainText('1 actual · 1 scheduled · 0 estimated');
        await expect(time).toContainText('Average: 2h 53m');
        await expect(page.getByRole('status')).toContainText('5.8 h');
        if (selection.startsWith('route=')) {
            await panel.getByRole('button', { name: /All Flights \(2\)/ }).click();
            await expect(panel).toContainText('T101');
            await expect(panel.getByText('2h 45m', { exact: true }).locator('..')).toContainText('· Actual');
            await expect(panel.getByText('3h', { exact: true }).locator('..')).toContainText('· Scheduled');
            await expect(panel.getByText('2 hours 45 minutes', { exact: true })).toHaveClass('sr-only');
        }
    });
}

test('flight time remains accessible and the stats tab fits a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/projects/flights/map?paths=0&year=2024');
    await expect(page.getByRole('region', { name: 'Flight time', exact: true })).toContainText('5.8 h');
    const toggle = page.getByRole('button', { name: 'Hide stats panel' });
    const bounds = (await toggle.boundingBox())!;
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    await toggle.click();
    await expect(page.getByTestId('stats-panel-content')).toHaveAttribute('data-state', 'closed');
});
