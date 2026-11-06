import { expect, test } from '@playwright/test';

test('flight statistics have a main landmark, ordered headings, and a working keyboard skip link', async ({ page, browserName }) => {
    await page.goto('/projects/flights/map');
    await expect(page.getByRole('heading', { name: 'Flight Statistics' })).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Flight History', level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Flight Statistics', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Flight Types', level: 3 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Show domestic flights/ })).toHaveAccessibleName(/^Domestic \d+ Show domestic flights$/);
    await expect(page.getByRole('button', { name: /Toggle layer options/ })).toHaveAccessibleName(/^Layers 1 Toggle layer options$/);
    await expect(page.getByRole('button', { name: /Switch to imperial units/ })).toHaveAccessibleName(/^[\d,]+ km\. Switch to imperial units$/);

    // macOS WebKit uses Option+Tab to include links in keyboard navigation.
    const tab = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
    await page.keyboard.press(tab);
    const skip = page.getByRole('link', { name: 'Skip to controls' });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    const toggle = page.getByRole('button', { name: 'Hide stats panel' });
    await expect(toggle).toBeFocused();
    await toggle.press('Enter');
    await expect(page.getByRole('button', { name: 'Show stats panel' })).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Flight History', level: 1 })).toHaveCount(1);
});

test('delayed flight data does not move statistics already visible on the page', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Layout-shift measurement requires Chromium.');
    expect(await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('layout-shift')),
        'A zero CLS result requires a working Layout Instability API').toBe(true);
    let releaseData!: () => void;
    const dataReady = new Promise<void>(resolve => { releaseData = resolve; });
    await page.route('**/data/flights/*.geojson', async route => {
        await dataReady;
        await route.continue();
    });
    await page.addInitScript(() => {
        const measured = window as typeof window & { flightLayoutShifts: number[] };
        measured.flightLayoutShifts = [];
        new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
                const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
                if (!shift.hadRecentInput) measured.flightLayoutShifts.push(shift.value);
            }
        }).observe({ type: 'layout-shift', buffered: true });
    });
    const panel = page.getByTestId('stats-panel-content');
    try {
        await page.goto('/projects/flights/map');
        await expect(panel).toHaveAttribute('aria-busy', 'true');
        await expect(panel.getByRole('status')).toContainText('Loading flight statistics');
        await expect(panel.getByText('Total Flights', { exact: true })).toHaveCount(0);
        // Give the pending panel a painted frame before releasing the real data.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    } finally {
        releaseData();
        await page.unrouteAll({ behavior: 'wait' });
    }
    await expect(panel).toHaveAttribute('aria-busy', 'false');
    await expect(panel.getByRole('heading', { name: 'Flight Statistics' })).toBeVisible();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const cls = await page.evaluate(() => (window as typeof window & { flightLayoutShifts: number[] }).flightLayoutShifts.reduce((sum, value) => sum + value, 0));
    expect(cls, 'Initial flight data must not shift the statistics panel').toBeLessThan(0.01);
});

test('selected airline labels and counts meet the small-text contrast requirement', async ({ page }) => {
    await page.goto('/projects/flights/map');
    const airlines = page.getByRole('heading', { name: /^Airlines \(/ }).locator('..');
    const all = airlines.getByRole('button', { name: 'All', exact: true });
    await expect(all).toBeVisible();
    async function contrast(selector: typeof all, count = false) {
        return selector.evaluate((button, measureCount) => {
            const luminance = (color: string) => {
                // Resolve modern CSS colors (including Tailwind's oklch) to sRGB.
                const context = new OffscreenCanvas(1, 1).getContext('2d')!;
                context.fillStyle = color;
                context.fillRect(0, 0, 1, 1);
                const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
                    const channel = value / 255;
                    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
                });
                return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
            };
            const background = luminance(getComputedStyle(button).backgroundColor);
            const foreground = luminance(getComputedStyle(measureCount ? button.querySelector('span')! : button).color);
            return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
        }, count);
    }
    expect(await contrast(all)).toBeGreaterThanOrEqual(4.5);
    const airline = airlines.getByRole('button').filter({ hasText: '×' }).first();
    await airline.click();
    // Wait for the selected state, including the end of its color transition.
    await expect(airline).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => contrast(airline)).toBeGreaterThanOrEqual(4.5);
    await expect.poll(() => contrast(airline, true)).toBeGreaterThanOrEqual(4.5);
});
