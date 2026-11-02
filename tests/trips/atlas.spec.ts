import { expect, test } from '@playwright/test';
import { tripAtlasColor } from '../../src/features/trips/atlas/tripAtlasView';
import { atlas, atlasCamera, expectAtlasUrl, followReport, geometry, mockAtlasAssets, openList, paintedRoute } from './atlasTestHelpers';

test.beforeEach(async ({ page }) => mockAtlasAssets(page));

test('project entry opens a playable map with published routes and accessible card selection', async ({ page }) => {
    await page.goto('/projects/adv-atlas');
    await expectAtlasUrl(page);
    await expect(page.getByRole('heading', { level: 1, name: 'ADV Atlas', exact: true })).toBeVisible();
    await expect(page).toHaveTitle('ADV Atlas — rsmb');
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await openList(page);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(2);
    await expect(page.getByText('Unfinished draft must stay private')).toHaveCount(0);
    const button = page.getByRole('button', { name: 'Daily map test trip' });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expectAtlasUrl(page, { trip: 'daily-test' });
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    await page.getByRole('button', { name: 'Zoom to all trips' }).click();
    await expectAtlasUrl(page);
    await expect(page.getByRole('button', { name: /^(?:Coastal test trip|Daily map test trip)$/, pressed: true })).toHaveCount(0);
});

test('legacy atlas links preserve the selected trip and filter through report returns', async ({ page }) => {
    await page.goto('/projects/motorcycle-trips/map?trip=coastal-test&view=selected');
    await expectAtlasUrl(page, { trip: 'coastal-test', view: 'selected' });
    await expect(page.getByRole('heading', { level: 1, name: 'ADV Atlas', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show only selected trip' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-trip-id]')).toHaveCount(1);
    await expect(page.getByTestId('trip-atlas-map')).toHaveAttribute('data-selected-trip', 'coastal-test');
    await page.getByRole('link', { name: /Read trip report/ }).click();
    await page.getByRole('link', { name: /Back to map/ }).first().click();
    await expectAtlasUrl(page, { trip: 'coastal-test', view: 'selected' });
    await expect(page.locator('[data-trip-id]')).toHaveCount(1);
});

test('shared selection and report returns restore the card scroll and camera after a report reload', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=coastal-test`);
    const card = page.locator('[data-trip-id="coastal-test"]');
    await expect(card.getByRole('button', { name: /^(?:Coastal test trip|Daily map test trip)$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    const reportLink = card.getByRole('link', { name: /Read trip report/ });
    await reportLink.evaluate(element => element.scrollIntoView({ block: 'end' }));
    const initial = await paintedRoute(page, 'coastal-test');
    await page.getByTestId('trip-atlas-map').locator('canvas').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Math.abs((await paintedRoute(page, 'coastal-test')).bounds[0] - initial.bounds[0])).toBeGreaterThan(10);
    const before = await paintedRoute(page, 'coastal-test');
    let scroll = await followReport(page, reportLink);
    await expect(page).toHaveURL(/\/trips\/coastal-test$/);
    await expect(page.getByRole('link', { name: /Back to map/ })).toHaveCount(2);
    await page.goBack();
    await expectAtlasUrl(page, { trip: 'coastal-test' });
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    await expect.poll(() => page.locator('#atlas-trip-list').evaluate(element => element.scrollTop)).toBeCloseTo(scroll, 0);
    const after = await paintedRoute(page, 'coastal-test');
    after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    scroll = await followReport(page, page.locator('[data-trip-id="coastal-test"]').getByRole('link', { name: /Read trip report/ }));
    await page.reload();
    await page.getByRole('link', { name: /Back to map/ }).first().click();
    await expectAtlasUrl(page, { trip: 'coastal-test' });
    await expect(page.locator('[data-trip-id="coastal-test"]').getByRole('button', { name: /^(?:Coastal test trip|Daily map test trip)$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.locator('#atlas-trip-list').evaluate(element => element.scrollTop)).toBeCloseTo(scroll, 0);
    await expect.poll(async () => {
        const reloaded = await paintedRoute(page, 'coastal-test');
        return Math.max(...reloaded.bounds.map((value, index) => Math.abs(value - before.bounds[index])));
    }).toBeLessThan(5);
});

for (const returnLink of ['header', 'footer after another report'] as const) {
    test(`report returns restore their original atlas visit after another same-URL visit (${returnLink})`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(`${atlas}?trip=coastal-test`);
        await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
        const report = page.locator('[data-trip-id="coastal-test"]').getByRole('link', { name: /Read trip report/ });
        await report.evaluate(element => element.scrollIntoView({ block: 'end' }));
        const before = await paintedRoute(page, 'coastal-test');
        const scroll = await followReport(page, report);
        await page.getByRole('link', { name: /Explore this trip and all others in ADV Atlas/ }).click();
        await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
        await page.locator('#atlas-panel-toggle').click();
        await expect(page.locator('#atlas-panel-toggle')).toHaveAttribute('aria-expanded', 'false');
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
        await page.goBack();
        await page.reload();
        if (returnLink === 'footer after another report') {
            await page.getByRole('link', { name: /^Previous post|^Next post/ }).click();
            await page.reload();
        }
        const back = page.getByRole('link', { name: /Back to map/ });
        await (returnLink === 'header' ? back.first() : back.last()).click();
        await expectAtlasUrl(page, { trip: 'coastal-test' });
        await expect(page.locator('#atlas-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
        await expect.poll(() => page.locator('#atlas-trip-list').evaluate(element => element.scrollTop)).toBeCloseTo(scroll, 0);
        await expect.poll(async () => {
            const restored = await paintedRoute(page, 'coastal-test');
            return Math.max(...restored.bounds.map((value, index) => Math.abs(value - before.bounds[index])));
        }).toBeLessThan(5);
    });
}

test('reloading the atlas restores its camera and collapsed panel within the same tab', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=coastal-test`);
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    await page.getByRole('button', { name: 'Collapse trip panel' }).click();
    const initial = await paintedRoute(page, 'coastal-test');
    await page.getByTestId('trip-atlas-map').locator('canvas').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Math.abs((await paintedRoute(page, 'coastal-test')).bounds[0] - initial.bounds[0])).toBeGreaterThan(10);
    const before = await paintedRoute(page, 'coastal-test');
    await page.reload();
    await expect(page.locator('#atlas-panel-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('trip-atlas-map')).toHaveAttribute('data-selected-trip', 'coastal-test');
    await expect.poll(async () => {
        const after = await paintedRoute(page, 'coastal-test');
        return Math.max(...after.bounds.map((value, index) => Math.abs(value - before.bounds[index])));
    }).toBeLessThan(5);
});

test('fresh direct atlas visits have independent history keys and frame the requested trip', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const url = `${atlas}?trip=coastal-test`;
    await page.goto(url);
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    await expect.poll(() => atlasCamera(page)).toBeDefined();
    const initial = await paintedRoute(page, 'coastal-test');
    const key = await page.evaluate(() => window.history.state.key as string);
    expect(key).toBeTruthy();
    expect(key).not.toBe('default');
    await page.locator('#atlas-panel-toggle').click();
    await expect(page.locator('#atlas-panel-toggle')).toHaveAttribute('aria-expanded', 'false');
    await page.getByTestId('trip-atlas-map').locator('canvas').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Math.abs((await paintedRoute(page, 'coastal-test')).bounds[0] - initial.bounds[0])).toBeGreaterThan(10);
    await page.goto('/posts');
    await page.goto(url);
    await expect(page.locator('#atlas-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => window.history.state.key)).not.toBe(key);
    await expect.poll(async () => {
        const fresh = await paintedRoute(page, 'coastal-test');
        return Math.max(...fresh.bounds.map((value, index) => Math.abs(value - initial.bounds[index])));
    }).toBeLessThan(5);
    await page.goto(`${atlas}?trip=daily-test`);
    await expect(page.getByTestId('trip-atlas-map')).toHaveAttribute('data-selected-trip', 'daily-test');
    await expect(page.locator('#atlas-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => window.history.state.key)).not.toBe(key);
});

test('selected-trip filtering hides other geometry and cards, survives report returns, and resets on deselection', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/test-trip/route.geojson', route => route.fulfill({ json: {
        ...geometry,
        features: [...geometry.features, { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-123, 46], [-121.9, 46], [-121.9, 45.8]] } }],
    } }));
    await page.goto(`${atlas}?trip=daily-test`);
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    const before = await paintedRoute(page, 'daily-test');
    // Include the half-opacity context route while excluding the gray basemap.
    const context = await paintedRoute(page, 'daily-test', 110);
    const filter = page.getByRole('button', { name: 'Show only selected trip' });
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expectAtlasUrl(page, { trip: 'daily-test', view: 'selected' });
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
    await expect(page.getByText('1/1 routes', { exact: false })).toBeVisible();
    await expect.poll(async () => (await paintedRoute(page, 'daily-test', 110)).count).toBeLessThan(context.count - 30);
    const filtered = await paintedRoute(page, 'daily-test');
    filtered.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    await page.getByRole('link', { name: /Read trip report/ }).click();
    await page.getByRole('link', { name: /Back to map/ }).first().click();
    await expectAtlasUrl(page, { trip: 'daily-test', view: 'selected' });
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'false');
    await expectAtlasUrl(page, { trip: 'daily-test' });
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(2);
    await expect.poll(async () => (await paintedRoute(page, 'daily-test', 110)).count).toBeGreaterThan(context.count - 30);

    await page.locator('#atlas-panel-toggle').click();
    const map = page.getByTestId('trip-atlas-map');
    const { point } = await paintedRoute(page, 'daily-test');
    await map.locator('canvas').click({ position: point });
    const choices = page.getByRole('group', { name: 'Trips sharing this road' });
    await expect(choices).toBeVisible();
    await page.locator('#atlas-panel-toggle').click();
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect(choices).toHaveCount(0);
    await map.locator('canvas').click({ position: { x: (await map.boundingBox())!.width - 24, y: 230 } });
    await expectAtlasUrl(page);
    await expect(filter).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(2);
});

test('clicking empty map space deselects the route without moving the camera', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/test-trip/route.geojson', route => route.fulfill({ json: {
        type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-110, 40], [-111, 41]] },
    } }));
    await page.goto(`${atlas}?trip=daily-test`);
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    const before = await paintedRoute(page);
    const beforeCamera = await atlasCamera(page);
    const canvas = page.locator('[data-testid="trip-atlas-map"] canvas');
    await canvas.click({ position: { x: (await canvas.boundingBox())!.width - 24, y: 230 } });
    await expectAtlasUrl(page);
    await expect(page.getByRole('button', { name: /^(?:Coastal test trip|Daily map test trip)$/, pressed: true })).toHaveCount(0);
    await expect(page.locator('[data-testid="trip-atlas-map"]')).toHaveAttribute('data-selected-trip', '');
    const after = await paintedRoute(page);
    expect(await atlasCamera(page)).toEqual(beforeCamera);
    after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(6));
    const reset = page.getByRole('button', { name: 'Zoom to all trips' });
    await expect(reset).toBeVisible();
    await reset.click();
    await expect(reset).toHaveCount(0);
});

test('route pixel measurements exclude colored UI while retaining its pointer targets', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=daily-test&panel=collapsed&camera=-123,46,6,0,0`);
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    const before = await paintedRoute(page, 'daily-test');
    await page.getByTestId('atlas-map-viewport').evaluate((viewport, color) => {
        const obstacle = document.createElement('button');
        obstacle.dataset.atlasMapObstacle = '';
        obstacle.dataset.testid = 'route-pixel-obstacle';
        obstacle.textContent = 'Map control';
        Object.assign(obstacle.style, { position: 'absolute', inset: '0 auto auto 0', width: '100px', height: '100px', zIndex: '100', background: color, transition: 'opacity 200ms' });
        viewport.append(obstacle);
    }, tripAtlasColor('daily-test'));
    const obstacle = page.getByTestId('route-pixel-obstacle');
    await expect(obstacle).toBeVisible();
    const after = await paintedRoute(page, 'daily-test');
    after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    await expect(obstacle).toBeVisible();
    expect(await obstacle.evaluate(element => {
        const box = element.getBoundingClientRect();
        return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === element;
    })).toBe(true);
});

test('card photos and text select and frame routes while report links navigate normally', async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(atlas);
    await openList(page);
    const card = page.locator('[data-trip-id="coastal-test"]');
    if (isMobile) await card.getByRole('img').tap(); else await card.getByRole('img').click();
    await expectAtlasUrl(page, { trip: 'coastal-test' });
    await expect(card.getByRole('button', { name: /^(?:Coastal test trip|Daily map test trip)$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    const { cssBounds } = await paintedRoute(page, 'coastal-test');
    const mapBox = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
    expect(cssBounds[1]).toBeGreaterThan(55);
    expect(cssBounds[2]).toBeLessThan(mapBox.width - 40);
    expect(cssBounds[3]).toBeLessThan(mapBox.height - 12);
    const otherCard = page.locator('[data-trip-id="daily-test"]');
    await otherCard.getByRole('heading', { name: 'Daily map test trip' }).click();
    await expectAtlasUrl(page, { trip: 'daily-test' });
    await otherCard.getByRole('link', { name: /Read trip report/ }).click();
    await expect(page).toHaveURL(/\/trips\/daily-test$/);
});

test('card hover previews its route above a shared selected route without changing selection or scrolling', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Hover is a pointer-only interaction; phone projects exercise card taps.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/test-trip/route.geojson', route => route.fulfill({ json: {
        ...geometry,
        features: [...geometry.features, { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-123, 46], [-121.9, 46], [-121.9, 45.8]] } }],
    } }));
    await page.goto(`${atlas}?trip=daily-test`);
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    const card = page.locator('[data-trip-id="coastal-test"]');
    await card.getByRole('heading').evaluate(element => element.scrollIntoView({ block: 'center' }));
    const scroll = await page.locator('#atlas-trip-list').evaluate(element => element.scrollTop);
    const map = page.locator('[data-testid="trip-atlas-map"]');
    const before = await paintedRoute(page, 'daily-test');
    await map.locator('canvas').hover({ position: before.point });
    await card.getByRole('heading').hover();
    await expect(map).toHaveAttribute('data-highlighted-trip', 'coastal-test');
    await expect(page.getByRole('tooltip')).toContainText('Coastal test trip');
    await expect(page.getByRole('tooltip').locator('.trip-map-tooltip-subtitle')).toHaveText('January 2024');
    await expect(card).toHaveAttribute('data-highlighted', 'true');
    await expectAtlasUrl(page, { trip: 'daily-test' });
    await expect(card.getByRole('button', { name: /^(?:Coastal test trip|Daily map test trip)$/ })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(before.count + 30);
    expect(await page.locator('#atlas-trip-list').evaluate(element => element.scrollTop)).toBe(scroll);
    await page.mouse.move(page.viewportSize()!.width - 24, 240);
    await expect(card).not.toHaveAttribute('data-highlighted');
    await expect(map).toHaveAttribute('data-highlighted-trip', '');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expectAtlasUrl(page, { trip: 'daily-test' });
});

test('route hover highlights its card without scrolling and route clicks reveal the report card', async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/test-trip/route.geojson', route => route.fulfill({ json: {
        type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-121, 43], [-122, 42], [-122.5, 41.5]] },
    } }));
    await page.goto(atlas);
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    if (!isMobile) await openList(page);
    const card = page.locator('[data-trip-id="daily-test"]');
    const map = page.locator('[data-testid="trip-atlas-map"]');
    await expect.poll(async () => (await paintedRoute(page, 'daily-test', 42, 'north')).count).toBeGreaterThan(30);
    const { point } = await paintedRoute(page, 'daily-test', 42, 'north');
    if (!isMobile) {
        const scroll = await page.locator('#atlas-trip-list').evaluate(element => element.scrollTop);
        await map.locator('canvas').hover({ position: point });
        await expect(map).toHaveAttribute('data-highlighted-trip', 'daily-test');
        const popup = page.getByRole('tooltip');
        await expect(popup).toContainText('Daily map test trip');
        const date = popup.locator('.trip-map-tooltip-subtitle');
        await expect(date).toHaveText('January 2024');
        await expect(date).toHaveCSS('font-size', '12px');
        await expect(date).toHaveCSS('color', 'rgb(161, 161, 170)');
        const hex = tripAtlasColor('daily-test').slice(1);
        const color = `rgb(${[0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`;
        await expect(popup.locator('.maplibregl-popup-content')).toHaveCSS('border-left-color', color);
        await expect(popup.locator('.maplibregl-popup-content')).toHaveCSS('background-color', 'rgb(24, 24, 27)');
        await expect(popup).toHaveCSS('pointer-events', 'none');
        await expect(card).toHaveAttribute('data-highlighted', 'true');
        await expect(card.getByRole('heading')).not.toBeInViewport();
        expect(await page.locator('#atlas-trip-list').evaluate(element => element.scrollTop)).toBe(scroll);
        await expectAtlasUrl(page);
        await expect(card.getByRole('button', { name: /^(?:Coastal test trip|Daily map test trip)$/ })).toHaveAttribute('aria-pressed', 'false');
    }
    if (isMobile) await map.locator('canvas').tap({ position: point }); else await map.locator('canvas').click({ position: point });
    await expectAtlasUrl(page, { trip: 'daily-test' });
    await expect(page.locator('#atlas-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(card.getByRole('heading')).toBeInViewport();
    await expect(card.getByRole('button', { name: /^(?:Coastal test trip|Daily map test trip)$/ })).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard feedback uses the story-map tooltip and Escape dismisses it without clearing selection', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=daily-test`);
    const button = page.getByRole('button', { name: 'Daily map test trip' });
    await button.focus();
    await expect(page.getByRole('tooltip')).toContainText('Daily map test trip');
    await expect(page.getByRole('tooltip').locator('.trip-map-tooltip-subtitle')).toHaveText('January 2024');
    await button.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expectAtlasUrl(page, { trip: 'daily-test' });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
});

test('overlapping routes offer colored previews and a dismissible choice instead of selecting only the top line', async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/test-trip/route.geojson', route => route.fulfill({ json: {
        ...geometry,
        features: [...geometry.features, { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-123, 46], [-121.9, 46], [-121.9, 45.8]] } }],
    } }));
    await page.goto(`${atlas}?trip=daily-test`);
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    await page.locator('#atlas-panel-toggle').click();
    const map = page.locator('[data-testid="trip-atlas-map"]');
    const before = await paintedRoute(page, 'daily-test');
    await expect(page.locator('#atlas-panel-toggle')).toHaveAttribute('aria-expanded', 'false');
    const beforeCamera = await atlasCamera(page);
    await map.locator('canvas').click({ position: before.point });
    const choices = page.getByRole('group', { name: 'Trips sharing this road' });
    await expect(choices).toBeVisible();
    for (const [id, title] of [['daily-test', 'Daily map test trip'], ['coastal-test', 'Coastal test trip']]) {
        const channels = tripAtlasColor(id).slice(1).match(/../g)!.map(channel => parseInt(channel, 16));
        await expect(choices.getByRole('button', { name: title })).toHaveCSS('color', `rgb(${channels.join(', ')})`);
    }
    const close = choices.getByRole('button', { name: 'Close route choices' });
    await expect(close).toHaveText('');
    const popupBox = (await choices.boundingBox())!;
    const closeBox = (await close.boundingBox())!;
    expect(closeBox.x + closeBox.width).toBeGreaterThan(popupBox.x + popupBox.width - 12);
    expect(closeBox.y).toBeLessThan(popupBox.y + 12);
    expect(closeBox.width).toBeGreaterThanOrEqual(44);
    expect(closeBox.height).toBeGreaterThanOrEqual(44);
    const scroll = await page.locator('#atlas-trip-list').evaluate(element => element.scrollTop);
    if (!isMobile) {
        await choices.getByRole('button', { name: 'Coastal test trip' }).hover();
        await expect(map).toHaveAttribute('data-highlighted-trip', 'coastal-test');
        await expect(page.locator('[data-trip-id="coastal-test"]')).toHaveAttribute('data-highlighted', 'true');
        await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(before.count + 30);
        await expectAtlasUrl(page, { trip: 'daily-test' });
        expect(await page.locator('#atlas-trip-list').evaluate(element => element.scrollTop)).toBe(scroll);
        await choices.getByRole('button', { name: 'Daily map test trip' }).hover();
        await expect(map).toHaveAttribute('data-highlighted-trip', 'daily-test');
    }
    await close.click();
    await expect(choices).toHaveCount(0);
    await expect(map).toHaveAttribute('data-highlighted-trip', '');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expectAtlasUrl(page, { trip: 'daily-test' });
    const after = await paintedRoute(page, 'daily-test');
    expect(await atlasCamera(page)).toEqual(beforeCamera);
    after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    await map.locator('canvas').click({ position: before.point });
    await expect(choices).toBeVisible();
    if (!isMobile) {
        const choice = choices.getByRole('button', { name: 'Coastal test trip' });
        await choice.focus();
        await expect(map).toHaveAttribute('data-highlighted-trip', 'coastal-test');
        await choice.press('Escape');
        await expect(choices).toHaveCount(0);
        await expect(map).toHaveAttribute('data-highlighted-trip', '');
        await expectAtlasUrl(page, { trip: 'daily-test' });
        await map.locator('canvas').click({ position: before.point });
        await expect(choices).toBeVisible();
    }
    await choices.getByRole('button', { name: 'Coastal test trip' }).click();
    await expectAtlasUrl(page, { trip: 'coastal-test' });
    await expect(choices).toHaveCount(0);
    await expect(page.locator('[data-trip-id="coastal-test"]').getByText('Selected', { exact: true })).toBeVisible();
    await expect(page.locator('[data-trip-id="coastal-test"]').getByRole('heading')).toBeInViewport();
});

test('Escape dismisses shared-road choices after focus moves to the trip panel', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=daily-test`);
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await page.locator('#atlas-panel-toggle').click();
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    const before = await paintedRoute(page, 'daily-test');
    await page.getByTestId('trip-atlas-map').locator('canvas').click({ position: before.point });
    const choices = page.getByRole('group', { name: 'Trips sharing this road' });
    await expect(choices).toBeVisible();
    const panel = page.locator('#atlas-panel-toggle');
    await panel.focus();
    await panel.press('Escape');
    await expect(choices).toHaveCount(0);
    await expect(panel).toBeFocused();
    await expectAtlasUrl(page, { trip: 'daily-test' });
    await expect(page.getByTestId('trip-atlas-map')).toHaveAttribute('data-highlighted-trip', '');
});

test('keyboard route choice moves focus to the selected card after the chooser closes', async ({ page, browserName }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=daily-test`);
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    const panel = page.locator('#atlas-panel-toggle');
    if (await panel.getAttribute('aria-expanded') === 'true') await panel.click();
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    const before = await paintedRoute(page, 'daily-test');
    await page.getByTestId('trip-atlas-map').locator('canvas').click({ position: before.point });
    const choices = page.getByRole('group', { name: 'Trips sharing this road' });
    const choice = choices.getByRole('button', { name: 'Coastal test trip' });
    await choice.focus();
    await choice.press('Enter');
    await expect(choices).toHaveCount(0);
    await expectAtlasUrl(page, { trip: 'coastal-test' });
    const selected = page.locator('[data-trip-id="coastal-test"]');
    await expect(selected.getByRole('button', { name: 'Coastal test trip' })).toBeFocused();
    // Visit the visible location controls before the report link; clipped names stay out of this order.
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
    await page.keyboard.press(tab);
    await expect(selected.getByRole('button', { name: 'Explore United States', exact: true })).toBeFocused();
    const controls = await selected.locator('.atlas-locations').getByRole('button').count();
    for (let index = 0; index < controls; index++) await page.keyboard.press(tab);
    await expect(selected.getByRole('link', { name: /Read trip report/ })).toBeFocused();
    await panel.focus();
    await panel.press('Enter');
    await panel.press('Enter');
    await expect(panel).toBeFocused();
});

test('one failed route keeps report links and retries without reloading successful geometry', async ({ page }) => {
    let attempts = 0;
    let successfulRequests = 0;
    await page.route('**/test-trip/route.geojson', route => { successfulRequests++; return route.fulfill({ json: geometry }); });
    await page.route('**/test-trip/daily-route.geojson', route => ++attempts === 1
        ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fulfill({ json: geometry }));
    await page.goto(atlas);
    await openList(page);
    await expect(page.getByText('Route unavailable.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: /Read trip report/ })).toHaveCount(2);
    await page.getByRole('button', { name: 'Retry route', exact: true }).click();
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Daily map test trip' }).click();
    await page.getByRole('button', { name: 'Zoom to all trips' }).click();
    expect(attempts).toBe(2);
    expect(successfulRequests).toBe(1);
});

test('a late route response does not replace a newer trip selection', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/test-trip/daily-route.geojson', async route => { await held; await route.fulfill({ json: geometry }); });
    try {
        await page.goto(atlas);
        await openList(page);
        await page.getByRole('button', { name: 'Coastal test trip' }).click();
        await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
        const before = await paintedRoute(page, 'coastal-test');
        release();
        await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
        await expectAtlasUrl(page, { trip: 'coastal-test' });
        const after = await paintedRoute(page, 'coastal-test');
        after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    } finally { release(); }
});

for (const selected of [false, true]) {
    test(`manual movement cancels a delayed ${selected ? 'selected-route' : 'overview'} fit and permits an explicit reset`, async ({ page, isMobile }) => {
        test.skip(isMobile, 'Keyboard panning requires a desktop map.');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        let release!: () => void;
        const held = new Promise<void>(resolve => { release = resolve; });
        await page.route('**/test-trip/daily-route.geojson', async route => { await held; await route.fulfill({ json: geometry }); });
        try {
            await page.goto(atlas);
            await expect(page.getByText('1/2 routes', { exact: false })).toBeVisible();
            await openList(page);
            if (selected) await page.getByRole('button', { name: 'Daily map test trip' }).click();
            const canvas = page.getByTestId('trip-atlas-map').locator('canvas');
            await expect(canvas).toBeVisible();
            await expect.poll(async () => (await paintedRoute(page, 'coastal-test', 100)).count).toBeGreaterThan(30);
            await canvas.focus();
            await canvas.press('ArrowRight');
            // Include the half-opacity context route while excluding gray tiles.
            const before = await paintedRoute(page, 'coastal-test', 100);
            expect(before.count).toBeGreaterThan(30);
            release();
            await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
            const after = await paintedRoute(page, 'coastal-test', 100);
            after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
            const reset = page.getByRole('button', { name: 'Zoom to all trips' });
            await expect(reset).toBeVisible();
            await reset.click();
            await expect(reset).toHaveCount(0);
            await expectAtlasUrl(page);
        } finally { release(); }
    });
}

test('fullscreen retains trip controls, overlapping-route choices, and map recovery', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=daily-test`);
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => {
        const target = document.fullscreenElement ?? document.querySelector('.maplibregl-pseudo-fullscreen');
        return target?.tagName;
    })).toBe('MAIN');
    await openList(page);
    await expect(page.getByRole('link', { name: /Read trip report/ })).toHaveCount(2);
    await page.locator('#atlas-panel-toggle').click();
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    const position = (await paintedRoute(page, 'daily-test')).point;
    const canvas = page.getByTestId('trip-atlas-map').locator('canvas');
    await canvas.click({ position });
    const choices = page.getByRole('group', { name: 'Trips sharing this road' });
    await expect(choices).toBeVisible();
    await choices.getByRole('button', { name: 'Coastal test trip' }).click();
    await expectAtlasUrl(page, { trip: 'coastal-test' });
    await expect(page.getByRole('button', { name: 'Zoom to all trips' })).toBeVisible();
    await canvas.evaluate((element: HTMLCanvasElement) => {
        const extension = element.getContext('webgl2')?.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('WebGL context loss simulation is unavailable.');
        extension.loseContext();
    });
    await expect(page.getByText('The interactive map is unavailable.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Retry map' }).click();
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    const exit = page.getByRole('button', { name: 'Exit fullscreen', exact: true });
    await expect(exit).toHaveClass(/maplibregl-ctrl-shrink/);
    await expect(exit).not.toHaveClass(/maplibregl-ctrl-fullscreen/);
    await exit.click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement ?? document.querySelector('.maplibregl-pseudo-fullscreen')))).toBe(false);
    const enter = page.getByRole('button', { name: 'Enter fullscreen', exact: true });
    await expect(enter).toHaveClass(/maplibregl-ctrl-fullscreen/);
    await expect(enter).not.toHaveClass(/maplibregl-ctrl-shrink/);
});

test('renderer initialization failure retains usable cards and report navigation', async ({ page }) => {
    await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
            if (String(args[0]).includes('webgl')) return null;
            return original.apply(this, args);
        } as typeof original;
    });
    await page.goto(atlas);
    await openList(page);
    await expect(page.getByText('The interactive map is unavailable.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry map' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Read trip report/ })).toHaveCount(2);
    await page.getByRole('link', { name: /Read trip report/ }).first().click();
    await expect(page).toHaveURL(/\/trips\//);
});

test('native fullscreen exit during a failed retry restores the next enter action', async ({ page, isMobile }) => {
    test.skip(isMobile, 'This sequence requires desktop native fullscreen; phone projects check pseudo fullscreen recovery separately.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=coastal-test`);
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe('MAIN');
    await page.getByTestId('trip-atlas-map').locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
        const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('WebGL context loss simulation is unavailable.');
        extension.loseContext();
    });
    await expect(page.getByRole('button', { name: 'Retry map' })).toBeVisible();
    await page.evaluate(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        document.documentElement.setAttribute('data-block-webgl', '');
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
            if (document.documentElement.hasAttribute('data-block-webgl') && String(args[0]).includes('webgl')) {
                document.documentElement.setAttribute('data-webgl-blocked', '');
                return null;
            }
            return original.apply(this, args);
        } as typeof original;
    });
    await page.getByRole('button', { name: 'Retry map' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-webgl-blocked', '');
    await expect(page.getByText('The interactive map is unavailable.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toHaveCount(0);
    await page.evaluate(async () => {
        await document.exitFullscreen();
        document.documentElement.removeAttribute('data-block-webgl');
    });
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
    await page.getByRole('button', { name: 'Retry map' }).click();
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    const enter = page.getByRole('button', { name: 'Enter fullscreen', exact: true });
    await expect(enter).toHaveClass(/maplibregl-ctrl-fullscreen/);
    await expect(enter).not.toHaveClass(/maplibregl-ctrl-shrink/);
    await enter.click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe('MAIN');
    await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
    await expectAtlasUrl(page, { trip: 'coastal-test' });
});

test('a lost WebGL context retries without losing the selected trip or report links', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=coastal-test`);
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    await page.locator('[data-testid="trip-atlas-map"] canvas').evaluate((canvas: HTMLCanvasElement) => {
        const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('WebGL context loss simulation is unavailable.');
        extension.loseContext();
    });
    await expect(page.getByText('The interactive map is unavailable.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: /Read trip report/ })).toHaveCount(2);
    await page.getByRole('button', { name: 'Retry map' }).click();
    await expect(page.getByRole('button', { name: 'Retry map' })).toHaveCount(0);
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    await expectAtlasUrl(page, { trip: 'coastal-test' });
});

test('a failed renderer module leaves the trip list outside its error fallback', async ({ page }) => {
    await page.route(/\/assets\/TripAtlasMap-[^/]+\.js$/, route => route.abort());
    await page.goto(atlas);
    await openList(page);
    await expect(page.getByText('The map could not load.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload map' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Read trip report/ })).toHaveCount(2);
});

test('narrow screens keep panel controls, attribution, and invalid-selection feedback usable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`${atlas}?trip=unknown`);
    await expect(page.getByText('That trip is not available', { exact: false })).toBeVisible();
    await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible();
    const attribution = await page.locator('.maplibregl-ctrl-attrib').boundingBox();
    const panel = await page.getByRole('complementary', { name: 'Trip reports' }).boundingBox();
    expect(attribution!.y + attribution!.height).toBeLessThanOrEqual(panel!.y + 1);
    await page.locator('#atlas-panel-toggle').click();
    await expect(page.getByRole('button', { name: /^(?:Coastal test trip|Daily map test trip)$/ })).toHaveCount(0);
    await page.locator('#atlas-panel-toggle').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /^(?:Coastal test trip|Daily map test trip)$/ })).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
