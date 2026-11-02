import { expect, test } from '@playwright/test';
import { atlas, expectAtlasMapControls, expectAtlasUrl, mockAtlasAssets, paintedRoute } from './atlasTestHelpers';

const responsiveWidths = [858, 768, 'default', 320, 767, 1023, 1024, 1754] as const;

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAtlasAssets(page);
    await page.goto(atlas);
    await expect(page.getByText('2/2 routes', { exact: false })).toBeVisible();
    await expect.poll(async () => (await paintedRoute(page)).count).toBeGreaterThan(30);
    await expect(page.getByRole('button', { name: 'Zoom to all trips' })).toHaveCount(0);
});

// Separate cases keep the complete layout matrix out of a single 30-second timeout.
for (const width of responsiveWidths) {
    test(`overview control avoids panels after resizing to ${width === 'default' ? 'the default width' : `${width}px`}`, async ({ page }) => {
        const reset = page.getByRole('button', { name: 'Zoom to all trips' });
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
        await expect(reset).toBeVisible();
        const initialViewport = page.viewportSize()!;
        await page.setViewportSize({ width: width === 'default' ? initialViewport.width : width, height: initialViewport.height });
        for (const { state, action } of [
            { state: 'compact', action: undefined },
            { state: 'expanded', action: 'Expand trip panel' },
            { state: 'collapsed', action: 'Collapse trip panel' },
        ]) {
            await test.step(`${state} panel`, async () => {
                if (action) await page.getByRole('button', { name: action, exact: true }).click();
                await expect(page.locator('main.atlas-explorer')).toHaveAttribute('data-panel-state', state);
                await expectAtlasMapControls(page);
                const position = await reset.evaluate(element => {
                    const box = element.getBoundingClientRect();
                    const map = element.closest('[data-testid="atlas-map-viewport"]')!.getBoundingClientRect();
                    return { x: box.x - map.x, y: box.y - map.y };
                });
                expect(position.x).toBeCloseTo(12, 0);
                expect(position.y).toBeCloseTo(12, 0);
            });
        }
        await page.getByRole('button', { name: 'Show trips', exact: true }).click();
        // Fit at the resized width too, including narrow desktop maps.
        await reset.click();
        await expect(reset).toHaveCount(0);
        const route = await paintedRoute(page);
        const map = (await page.getByTestId('atlas-map-viewport').boundingBox())!;
        expect(route.count).toBeGreaterThan(30);
        expect(route.cssBounds[0]).toBeGreaterThan(0);
        expect(route.cssBounds[1]).toBeGreaterThan(0);
        expect(route.cssBounds[2]).toBeLessThan(map.width);
        expect(route.cssBounds[3]).toBeLessThan(map.height);
        await expectAtlasUrl(page);
    });
}

test('overview reset restores route bounds after resizing, panel changes, and panning', async ({ page }) => {
    const before = await paintedRoute(page);
    const reset = page.getByRole('button', { name: 'Zoom to all trips' });
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(reset).toBeVisible();
    await page.getByRole('button', { name: 'Collapse trip panel', exact: true }).click();
    const initialViewport = page.viewportSize()!;
    for (const width of responsiveWidths) {
        await page.setViewportSize({ width: width === 'default' ? initialViewport.width : width, height: initialViewport.height });
    }
    await page.setViewportSize(initialViewport);
    await page.getByRole('button', { name: 'Show trips', exact: true }).click();
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
    await expectAtlasUrl(page);
});

test('control guard detects a covered corner while the center remains clickable', async ({ page }) => {
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const reset = page.getByRole('button', { name: 'Zoom to all trips' });
    await expect(reset).toBeVisible();
    await reset.evaluate(element => {
        const box = element.getBoundingClientRect();
        const obstacle = document.createElement('div');
        obstacle.id = 'control-guard-obstacle';
        Object.assign(obstacle.style, {
            position: 'fixed', left: `${box.x}px`, top: `${box.y}px`,
            width: '12px', height: '12px', zIndex: '10000',
        });
        document.body.append(obstacle);
    });
    expect(await reset.evaluate(element => {
        const box = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
    await expect(expectAtlasMapControls(page)).rejects.toThrow('Zoom to all trips must remain clickable across its target');
    await page.locator('#control-guard-obstacle').evaluate(element => element.remove());
    await expectAtlasMapControls(page);
});
