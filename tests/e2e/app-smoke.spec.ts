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
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
    await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).scrollbarColor)).not.toBe('auto');

    await page.getByRole('button', { name: 'Hide stats panel' }).click();

    await expect(panel).toHaveAttribute('data-state', 'closed');
    await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).overflowY)).toBe('hidden');
});