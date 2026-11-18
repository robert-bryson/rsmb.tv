import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { atlas, atlasCamera, mockAtlasAssets, paintedRoute } from './atlasTestHelpers';
import { tripAtlasColor } from '../../src/features/trips/atlas/tripAtlasView';

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAtlasAssets(page);
});

test('table text aligns across columns for short, wrapped, and selected trip names', async ({ page }) => {
    await page.goto(`${atlas}?panel=expanded&results=table`);
    const table = page.getByRole('table', { name: 'Trip comparison', exact: true });
    await expect(table.locator('tbody tr')).toHaveCount(2);
    const expectAlignedText = async () => {
        // Compare the first text lines, not the taller button hit areas.
        const rows = await table.locator('tbody tr').evaluateAll(rows => rows.map(row => {
            const locationIndex = [...row.closest('table')!.querySelectorAll('thead th')]
                .findIndex(header => header.textContent?.trim().startsWith('Location'));
            const location = row.children[locationIndex];
            const bottoms = [row.querySelector('h2 button'), row.querySelector('td'), location.querySelector('button, p')].map(element => {
                const text = element?.firstChild;
                if (!text) throw new Error('Missing first-line text in the Trip, Motorcycle, or Location column');
                const range = document.createRange();
                range.selectNodeContents(text);
                return range.getClientRects()[0].bottom;
            });
            return { trip: row.querySelector('h2')?.textContent, difference: Math.max(...bottoms) - Math.min(...bottoms) };
        }));
        for (const row of rows) expect(row.difference, `${row.trip}: first lines must align`).toBeLessThanOrEqual(2);
    };
    await expectAlignedText();
    const row = table.locator('[data-trip-id="coastal-test"]');
    const title = row.getByRole('button', { name: 'Coastal test trip', exact: true });
    await title.evaluate(element => { element.style.maxWidth = '9ch'; });
    expect(await title.evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element.firstChild!);
        return range.getClientRects().length;
    })).toBeGreaterThan(1);
    await expectAlignedText();
    await title.click();
    await expect(row).toHaveAttribute('data-selected', 'true');
    expect((await title.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expectAlignedText();
});

test('clicking table row content selects and fits that trip', async ({ page }) => {
    await page.goto(`${atlas}?panel=expanded&results=table&camera=-100,40,3,0,0`);
    await expect(page.getByRole('columnheader', { name: 'Motorcycle', exact: true })).toBeVisible();
    await expect(page.getByText(/Compare matching trips/)).toHaveCount(0);
    await page.getByRole('heading', { name: 'Coastal test trip', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('trip')).toBe('coastal-test');
    await expect(page.locator('[data-trip-id="coastal-test"]').getByText('Selected', { exact: true })).toBeVisible();
    await expect.poll(async () => (await atlasCamera(page))?.center[0]).toBeLessThan(-121);
    await expect.poll(async () => (await paintedRoute(page, 'coastal-test')).count).toBeGreaterThan(30);
});

for (const offset of [0, 0.5]) test(`row highlighting includes the sticky first cell and the far edge after scrolling (offset ${offset}px)`, async ({ page }) => {
    await page.goto(`${atlas}?panel=expanded&results=table`);
    await expect(page.getByText('2/2 routes')).toBeVisible();
    const region = page.getByRole('region', { name: 'Trip comparison table' });
    const row = region.locator('[data-trip-id="coastal-test"]');
    await row.getByRole('button', { name: 'Coastal test trip' }).evaluate(element => (element as HTMLElement).focus({ preventScroll: true }));
    await expect(row).toHaveAttribute('data-highlighted', 'true');
    // Fractional layout positions must sample inside the two-pixel borders.
    await region.evaluate((element, offset) => { element.style.transform = `translateY(${offset}px)`; }, offset);
    const expected = tripAtlasColor('coastal-test').slice(1).match(/../g)!.map(hex => parseInt(hex, 16));
    const edges = async (last = false) => {
        const viewport = (await region.boundingBox())!;
        const cell = (await row.locator(last ? 'td:last-child' : 'th').boundingBox())!;
        const { data, info } = await sharp(await region.screenshot({ scale: 'css' })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const points = last ? [[cell.x + cell.width - 1, cell.y + cell.height / 2]] : [
            [cell.x + cell.width / 2, cell.y + 1],
            [cell.x + cell.width / 2, cell.y + cell.height - 1],
            [cell.x + 1, cell.y + cell.height / 2],
        ];
        for (const [x, y] of points) {
            const offset = (Math.floor(y - viewport.y) * info.width + Math.floor(x - viewport.x)) * info.channels;
            expect([...data.subarray(offset, offset + 3)]).toEqual(expected);
        }
    };
    await edges();
    await region.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await edges(true);
    await row.getByRole('button', { name: 'Coastal test trip' }).click();
    await page.mouse.move(0, 0);
    await page.getByRole('button', { name: /^Filters/ }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('atlas-control-tooltip')).toHaveCount(0);
    await expect(row).toHaveAttribute('data-selected', 'true');
    await expect(row).not.toHaveAttribute('data-highlighted');
    await region.evaluate(element => { element.scrollLeft = 0; });
    await edges();
    await region.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await edges(true);
});

test('selected-only and reset icons stay usable at 320 pixels and reset all applied filters', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`${atlas}?panel=expanded&results=table&trip=coastal-test&milesMin=240`);
    const controls = page.getByRole('group', { name: 'Trip browsing controls', exact: true });
    const selectedOnly = controls.getByRole('button', { name: 'Show only selected trip', exact: true });
    await expect(selectedOnly).toHaveText('');
    await expect(selectedOnly).toHaveAttribute('aria-pressed', 'false');
    await selectedOnly.click();
    await expect(selectedOnly).toHaveAttribute('aria-pressed', 'true');
    await expect(selectedOnly).toHaveAttribute('data-atlas-tooltip', 'Show all matching trips again.');
    await expect(page.locator('[data-trip-id]')).toHaveCount(1);
    const panel = (await page.locator('#atlas-trip-panel').boundingBox())!;
    for (const control of await controls.getByRole('button').all()) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(panel.x);
        expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('#atlas-trip-list').evaluate(element => { element.scrollTop = element.scrollHeight; });
    const reset = controls.getByRole('button', { name: 'Reset filters', exact: true });
    await expect(reset).toBeInViewport();
    await reset.click();
    await expect(page.locator('[data-trip-id]')).toHaveCount(2);
    await expect(selectedOnly).toHaveAttribute('aria-pressed', 'false');
    await expect(reset).toHaveCount(0);
    await expect(controls.getByRole('button', { name: 'Filters', exact: true })).toBeFocused();
    await expect(page.getByRole('radio', { name: 'Table', exact: true })).toBeChecked();
    const params = new URL(page.url()).searchParams;
    expect(params.get('trip')).toBe('coastal-test');
    expect(params.has('milesMin')).toBe(false);
    expect(params.has('view')).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
