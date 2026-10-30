import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { tripAtlasColor } from '../../src/features/trips/atlas/tripAtlasView';

const atlas = '/projects/adv-atlas/map';
const geometry = {
    type: 'FeatureCollection', features: [{
        type: 'Feature', id: 0, properties: { trackId: 'morning' },
        geometry: { type: 'MultiLineString', coordinates: [[[-122, 47], [-123, 46], [-124, 45]], [[-124.2, 45.1], [-124.3, 45.3]]] },
    }],
};

test.beforeEach(async ({ page }) => {
    const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#777' } }).png().toBuffer();
    await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: tile }));
    await page.route('**/test-trip/**', route => route.request().url().endsWith('.geojson')
        ? route.fulfill({ json: geometry })
        : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="100%" height="100%" fill="#405b6b"/></svg>' }));
});

async function openList(page: Page) {
    const toggle = page.locator('#atlas-panel-toggle');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
}

async function paintedRoute(page: Page, id?: string, tolerance = 12, aim: 'center' | 'north' = 'center') {
    const canvas = page.locator('[data-testid="trip-atlas-map"] canvas');
    const screenshot = await canvas.screenshot({ style: 'header, aside, [data-testid="atlas-overview-control"], .maplibregl-control-container, .maplibregl-popup { opacity: 0 !important; }' });
    const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const hex = id ? tripAtlasColor(id).slice(1) : '';
    const color = id ? [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16)) : undefined;
    let count = 0;
    let point = { x: 0, y: 0 };
    let nearest = Infinity;
    const bounds = [info.width, info.height, 0, 0];
    for (let index = 0; index < data.length; index += info.channels) {
        const matches = color ? color.every((channel, offset) => Math.abs(data[index + offset] - channel) < tolerance)
            : Math.max(data[index], data[index + 1], data[index + 2]) - Math.min(data[index], data[index + 1], data[index + 2]) > 60;
        if (!matches) continue;
        const pixel = index / info.channels;
        const x = pixel % info.width;
        const y = Math.floor(pixel / info.width);
        count++;
        bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
        const distance = aim === 'north' ? y * info.width + Math.abs(x - info.width / 2) : (x - info.width / 2) ** 2 + (y - info.height / 2) ** 2;
        if (distance < nearest) { nearest = distance; point = { x, y }; }
    }
    const box = await canvas.boundingBox();
    const scaleX = box!.width / info.width;
    const scaleY = box!.height / info.height;
    return { count, point: { x: point.x * scaleX, y: point.y * scaleY }, bounds,
        cssBounds: bounds.map((value, index) => value * (index % 2 ? scaleY : scaleX)) };
}

test('overview control avoids panels across responsive widths and hides when all trips are framed again', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(atlas);
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await expect.poll(async () => (await paintedRoute(page)).count).toBeGreaterThan(30);
    const reset = page.getByRole('button', { name: 'Zoom to all trips' });
    await expect(reset).toHaveCount(0);
    const before = await paintedRoute(page);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(reset).toBeVisible();
    const initialViewport = page.viewportSize()!;
    const panelToggle = page.locator('#atlas-panel-toggle');
    const initiallyOpen = await panelToggle.getAttribute('aria-expanded') === 'true';
    for (const width of [...new Set([858, 768, initialViewport.width, 320, 767, 1023, 1024, 1754])]) {
        await page.setViewportSize({ width, height: initialViewport.height });
        for (const open of [true, false]) {
            if (await panelToggle.getAttribute('aria-expanded') !== String(open)) await panelToggle.click();
            const buttonBox = (await reset.boundingBox())!;
            const titleBox = (await page.getByRole('heading', { name: 'ADV Atlas', exact: true }).locator('..').boundingBox())!;
            const panelBox = (await page.getByRole('complementary', { name: 'Trip reports' }).boundingBox())!;
            if (width < 768) {
                expect(buttonBox.x + buttonBox.width / 2).toBeCloseTo(width / 2, 0);
                expect(buttonBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
            } else {
                expect(buttonBox.y).toBeCloseTo(titleBox.y, 0);
                expect(buttonBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width + 4);
                if (width >= 1024) expect(buttonBox.x + buttonBox.width / 2).toBeCloseTo(width / 2, 0);
            }
            const intersectionWidth = Math.max(0, Math.min(buttonBox.x + buttonBox.width, panelBox.x + panelBox.width) - Math.max(buttonBox.x, panelBox.x));
            const intersectionHeight = Math.max(0, Math.min(buttonBox.y + buttonBox.height, panelBox.y + panelBox.height) - Math.max(buttonBox.y, panelBox.y));
            expect(intersectionWidth * intersectionHeight).toBe(0);
            expect(await reset.evaluate(element => {
                const box = element.getBoundingClientRect();
                return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
            })).toBe(true);
        }
    }
    await page.setViewportSize(initialViewport);
    if (await panelToggle.getAttribute('aria-expanded') !== String(initiallyOpen)) await panelToggle.click();
    await reset.click();
    await expect(reset).toHaveCount(0);
    const zoomReset = await paintedRoute(page);
    zoomReset.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    const canvas = page.getByTestId('trip-atlas-map').locator('canvas');
    await canvas.focus();
    await canvas.press('ArrowRight');
    await expect(reset).toBeVisible();
    await reset.click();
    await expect(reset).toHaveCount(0);
    const panReset = await paintedRoute(page);
    panReset.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    await expect(page).toHaveURL(new RegExp(`${atlas}$`));
});

test('project entry opens a playable map with published routes and accessible card selection', async ({ page }) => {
    await page.goto('/projects/adv-atlas');
    await expect(page).toHaveURL(new RegExp(`${atlas}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'ADV Atlas', exact: true })).toBeVisible();
    await expect(page).toHaveTitle('ADV Atlas — rsmb');
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await openList(page);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(2);
    await expect(page.getByText('Unfinished draft must stay private')).toHaveCount(0);
    const button = page.getByRole('button', { name: 'Show route: Daily map test trip' });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/\?trip=daily-test$/);
    await expect.poll(async () => (await paintedRoute(page, 'daily-test')).count).toBeGreaterThan(30);
    await page.getByRole('button', { name: 'Zoom to all trips' }).click();
    await expect(page).toHaveURL(new RegExp(`${atlas}$`));
    await expect(page.getByRole('button', { name: /^Show route:/, pressed: true })).toHaveCount(0);
});

test('legacy atlas links preserve the selected trip and filter through report returns', async ({ page }) => {
    await page.goto('/projects/motorcycle-trips/map?trip=coastal-test&view=selected');
    await expect(page).toHaveURL(`${atlas}?trip=coastal-test&view=selected`);
    await expect(page.getByRole('heading', { level: 1, name: 'ADV Atlas', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show only selected trip' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-trip-id]')).toHaveCount(1);
    await expect(page.getByTestId('trip-atlas-map')).toHaveAttribute('data-selected-trip', 'coastal-test');
    await page.getByRole('link', { name: /Read trip report/ }).click();
    await page.getByRole('link', { name: /Back to map/ }).first().click();
    await expect(page).toHaveURL(`${atlas}?trip=coastal-test&view=selected`);
    await expect(page.locator('[data-trip-id]')).toHaveCount(1);
});

test('shared selection and report returns restore the card scroll and camera', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=coastal-test`);
    const card = page.locator('[data-trip-id="coastal-test"]');
    await expect(card.getByRole('button', { name: /^Show route:/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    const reportLink = card.getByRole('link', { name: /Read trip report/ });
    await reportLink.scrollIntoViewIfNeeded();
    const before = await paintedRoute(page, 'coastal-test');
    const scroll = await page.locator('#atlas-trip-list').evaluate(element => element.scrollTop);
    await reportLink.click();
    await expect(page).toHaveURL(/\/trips\/coastal-test$/);
    await expect(page.getByRole('link', { name: /Back to map/ })).toHaveCount(2);
    await page.goBack();
    await expect(page).toHaveURL(/\?trip=coastal-test$/);
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    await expect.poll(() => page.locator('#atlas-trip-list').evaluate(element => element.scrollTop)).toBeCloseTo(scroll, 0);
    const after = await paintedRoute(page, 'coastal-test');
    after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    await page.locator('[data-trip-id="coastal-test"]').getByRole('link', { name: /Read trip report/ }).click();
    await page.getByRole('link', { name: /Back to map/ }).first().click();
    await expect(page).toHaveURL(/\?trip=coastal-test$/);
    await expect(page.locator('[data-trip-id="coastal-test"]').getByRole('button', { name: /^Show route:/ })).toHaveAttribute('aria-pressed', 'true');
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
    await expect(page).toHaveURL(/\?trip=daily-test&view=selected$/);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
    await expect(page.getByText('1/1 routes', { exact: false })).toBeVisible();
    await expect.poll(async () => (await paintedRoute(page, 'daily-test', 110)).count).toBeLessThan(context.count - 30);
    const filtered = await paintedRoute(page, 'daily-test');
    filtered.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    await page.getByRole('link', { name: /Read trip report/ }).click();
    await page.getByRole('link', { name: /Back to map/ }).first().click();
    await expect(page).toHaveURL(/\?trip=daily-test&view=selected$/);
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/\?trip=daily-test$/);
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
    await map.locator('canvas').click({ position: { x: page.viewportSize()!.width - 24, y: 240 } });
    await expect(page).toHaveURL(new RegExp(`${atlas}$`));
    await expect(filter).toHaveAttribute('aria-pressed', 'false');
    await expect(filter).toBeDisabled();
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
    const canvas = page.locator('[data-testid="trip-atlas-map"] canvas');
    await canvas.click({ position: { x: page.viewportSize()!.width - 24, y: 240 } });
    await expect(page).toHaveURL(new RegExp(`${atlas}$`));
    await expect(page.getByRole('button', { name: /^Show route:/, pressed: true })).toHaveCount(0);
    await expect(page.locator('[data-testid="trip-atlas-map"]')).toHaveAttribute('data-selected-trip', '');
    const after = await paintedRoute(page);
    after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(6));
    const reset = page.getByRole('button', { name: 'Zoom to all trips' });
    await expect(reset).toBeVisible();
    await reset.click();
    await expect(reset).toHaveCount(0);
});

test('card photos and text select and frame routes while report links navigate normally', async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(atlas);
    await openList(page);
    const card = page.locator('[data-trip-id="coastal-test"]');
    if (isMobile) await card.getByRole('img').tap(); else await card.getByRole('img').click();
    await expect(page).toHaveURL(/\?trip=coastal-test$/);
    await expect(card.getByRole('button', { name: /^Show route:/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
    const { cssBounds } = await paintedRoute(page, 'coastal-test');
    const panel = await page.getByRole('complementary', { name: 'Trip reports' }).boundingBox();
    expect(cssBounds[1]).toBeGreaterThan(140);
    expect(cssBounds[2]).toBeLessThan(page.viewportSize()!.width - 40);
    expect(cssBounds[3]).toBeLessThan((isMobile ? panel!.y : page.viewportSize()!.height) - 12);
    const otherCard = page.locator('[data-trip-id="daily-test"]');
    await otherCard.getByRole('heading', { name: 'Daily map test trip' }).click();
    await expect(page).toHaveURL(/\?trip=daily-test$/);
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
    await card.getByRole('heading').scrollIntoViewIfNeeded();
    const scroll = await page.locator('#atlas-trip-list').evaluate(element => element.scrollTop);
    const map = page.locator('[data-testid="trip-atlas-map"]');
    const before = await paintedRoute(page, 'daily-test');
    await map.locator('canvas').hover({ position: before.point });
    await card.getByRole('heading').hover();
    await expect(map).toHaveAttribute('data-highlighted-trip', 'coastal-test');
    await expect(page.getByRole('tooltip')).toContainText('Coastal test trip');
    await expect(page.getByRole('tooltip').locator('.trip-map-tooltip-subtitle')).toHaveText('January 2024');
    await expect(card).toHaveAttribute('data-highlighted', 'true');
    await expect(page).toHaveURL(/\?trip=daily-test$/);
    await expect(card.getByRole('button', { name: /^Show route:/ })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(before.count + 30);
    expect(await page.locator('#atlas-trip-list').evaluate(element => element.scrollTop)).toBe(scroll);
    await page.mouse.move(page.viewportSize()!.width - 24, 240);
    await expect(card).not.toHaveAttribute('data-highlighted');
    await expect(map).toHaveAttribute('data-highlighted-trip', '');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(page).toHaveURL(/\?trip=daily-test$/);
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
        await expect(page).toHaveURL(new RegExp(`${atlas}$`));
        await expect(card.getByRole('button', { name: /^Show route:/ })).toHaveAttribute('aria-pressed', 'false');
    }
    if (isMobile) await map.locator('canvas').tap({ position: point }); else await map.locator('canvas').click({ position: point });
    await expect(page).toHaveURL(/\?trip=daily-test$/);
    await expect(page.locator('#atlas-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(card.getByRole('heading')).toBeInViewport();
    await expect(card.getByRole('button', { name: /^Show route:/ })).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard feedback uses the story-map tooltip and Escape dismisses it without clearing selection', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${atlas}?trip=daily-test`);
    const button = page.getByRole('button', { name: 'Show route: Daily map test trip' });
    await button.focus();
    await expect(page.getByRole('tooltip')).toContainText('Daily map test trip');
    await expect(page.getByRole('tooltip').locator('.trip-map-tooltip-subtitle')).toHaveText('January 2024');
    await button.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(page).toHaveURL(/\?trip=daily-test$/);
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
        await expect(page).toHaveURL(/\?trip=daily-test$/);
        expect(await page.locator('#atlas-trip-list').evaluate(element => element.scrollTop)).toBe(scroll);
        await choices.getByRole('button', { name: 'Daily map test trip' }).hover();
        await expect(map).toHaveAttribute('data-highlighted-trip', 'daily-test');
    }
    await close.click();
    await expect(choices).toHaveCount(0);
    await expect(map).toHaveAttribute('data-highlighted-trip', '');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(page).toHaveURL(/\?trip=daily-test$/);
    const after = await paintedRoute(page, 'daily-test');
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
        await expect(page).toHaveURL(/\?trip=daily-test$/);
        await map.locator('canvas').click({ position: before.point });
        await expect(choices).toBeVisible();
    }
    await choices.getByRole('button', { name: 'Coastal test trip' }).click();
    await expect(page).toHaveURL(/\?trip=coastal-test$/);
    await expect(choices).toHaveCount(0);
    await expect(page.locator('[data-trip-id="coastal-test"]').getByText('Selected', { exact: true })).toBeVisible();
    await expect(page.locator('[data-trip-id="coastal-test"]').getByRole('heading')).toBeInViewport();
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
    await page.getByRole('button', { name: 'Show route: Daily map test trip' }).click();
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
        await page.getByRole('button', { name: 'Show route: Coastal test trip' }).click();
        await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
        const before = await paintedRoute(page, 'coastal-test');
        release();
        await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
        await expect(page).toHaveURL(/\?trip=coastal-test$/);
        const after = await paintedRoute(page, 'coastal-test');
        after.bounds.forEach((value, index) => expect(Math.abs(value - before.bounds[index])).toBeLessThan(5));
    } finally { release(); }
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
    await expect(page).toHaveURL(/\?trip=coastal-test$/);
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
    expect(attribution!.y).toBeGreaterThanOrEqual(panel!.y + panel!.height);
    await page.locator('#atlas-panel-toggle').click();
    await expect(page.getByRole('button', { name: /^Show route:/ })).toHaveCount(0);
    await page.locator('#atlas-panel-toggle').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /^Show route:/ })).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
