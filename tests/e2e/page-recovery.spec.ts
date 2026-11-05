import { expect, test } from '@playwright/test';

test.skip(process.env.PAGE_RECOVERY !== '1', 'Requires a production bundle so a real route chunk can fail.');

test('a failed page preserves navigation and reloads a fresh loader at the requested URL', async ({ page }) => {
    let requests = 0;
    await page.route(/\/assets\/About-[^/]+\.js$/, route => ++requests === 1 ? route.abort('failed') : route.continue());
    await page.goto('/about?recovery=test#biography');
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/about\?recovery=test#biography$/);
    expect(requests).toBe(2);
});

test('persistent failures have bounded reloads and another route remains usable', async ({ page }) => {
    let requests = 0;
    await page.route(/\/assets\/About-[^/]+\.js$/, route => { requests++; return route.abort('failed'); });
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByText(/Wait a minute before trying again/)).toBeVisible();
    expect(requests).toBe(2);
    await page.getByRole('link', { name: 'Go home', exact: true }).click();
    await expect(page.getByRole('heading', { name: "Hi, I'm Robby" })).toBeVisible();
    await page.getByRole('navigation').getByRole('link', { name: 'Projects', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
});

test('the leading project image fills the card above its text at desktop and phone widths', async ({ page }) => {
    for (const width of [1280, 393]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('/');
        const card = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Through Routes', exact: true }) });
        const image = card.locator('img');
        const boxes = await Promise.all([card.boundingBox(), image.boundingBox(), card.getByRole('heading').boundingBox()]);
        expect(boxes.every(Boolean)).toBe(true);
        expect(Math.abs(boxes[0]!.width - boxes[1]!.width)).toBeLessThanOrEqual(2);
        expect(boxes[1]!.y + boxes[1]!.height).toBeLessThan(boxes[2]!.y);
        await expect(image).toHaveAttribute('fetchpriority', 'high');
        await expect(image).toHaveAttribute('loading', 'eager');
    }
});
