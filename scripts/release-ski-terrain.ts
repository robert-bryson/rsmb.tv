import type { Page, Request, Response } from '@playwright/test';

export const SKI_TERRAIN_ROUTE = '/projects/ski-status/map?q=heavenly&view=map&skiTerrain=0';
export const skiTerrainArchivePath = /\/resort-terrain(?:-[\w-]+)?\.pmtiles$/;

type RangeResponse = Pick<Response, 'status' | 'headers' | 'body'> & { request(): Pick<Request, 'headers'> };

export async function verifySkiTerrainResponse(response: RangeResponse, archive: Buffer) {
    const range = response.request().headers().range;
    const match = /^bytes=(\d+)-(\d+)$/.exec(range ?? '');
    if (!match || response.status() !== 206) {
        throw new Error(`Ski terrain expected HTTP 206 for a byte range. Received HTTP ${response.status()} for ${range ?? '(no range)'}.`);
    }

    const start = Number(match[1]);
    const requestedEnd = Number(match[2]);
    const end = Math.min(requestedEnd, archive.length - 1);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start > end) {
        throw new Error(`Invalid ski terrain request range: ${range}.`);
    }

    const expected = `bytes ${start}-${end}/${archive.length}`;
    const actual = response.headers()['content-range'];
    if (actual !== expected) throw new Error(`Wrong ski terrain Content-Range: expected ${expected}, received ${actual ?? '(missing)'}.`);
    if (!archive.subarray(start, end + 1).equals(await response.body())) {
        throw new Error(`Ski terrain bytes differ from the checked-in archive for range ${range}.`);
    }
}

// Offsets from the Heavenly marker at zoom 13. The tooltips exercise the rendered layers.
const heavenlyFeatures = [
    { label: 'Heavenly Gondola · gondola', x: -146, y: -94 },
    { label: 'Cloud 9 · Ski run · intermediate', x: 109, y: -110 },
];

export async function verifyRenderedSkiTerrain(page: Page, timeoutMs: number) {
    const { expect } = await import('@playwright/test');
    const ready = page.getByTestId('ski-status-map').and(page.locator('[data-map-state="ready"], [data-map-state="degraded"]'));
    await ready.waitFor({ state: 'visible' });

    // A single result fits at zoom 9. The route keeps terrain off until the final zoom.
    const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true });
    for (let clicks = 0; clicks < 4; clicks++) await zoomIn.click();
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByRole('dialog', { name: 'Map layers', exact: true });
    await layers.getByRole('checkbox', { name: 'Ski terrain', exact: true }).check();
    await layers.getByRole('button', { name: 'Done', exact: true }).click();

    const canvas = await ready.locator('.maplibregl-canvas').boundingBox();
    if (!canvas) throw new Error('Heavenly map canvas is unavailable.');
    const center = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 };
    for (const { label, x, y } of heavenlyFeatures) {
        const tooltip = page.getByText(label, { exact: true });
        await expect.poll(async () => {
            await page.mouse.move(center.x, center.y);
            await page.mouse.move(center.x + x, center.y + y);
            return tooltip.isVisible();
        }, { timeout: timeoutMs, message: `Heavenly terrain did not render ${label}.` }).toBe(true);
    }
}
