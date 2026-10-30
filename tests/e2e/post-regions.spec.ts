import { expect, test } from '@playwright/test';

test('country pills select the whole country and regions fill the available row as it resizes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tests/e2e/fixtures/post-regions.html');
    const us = page.getByRole('group', { name: 'United States' });
    const country = us.getByRole('link', { name: 'United States', exact: true });
    await expect(us.getByRole('link')).toHaveCount(9);
    await expect(us.getByRole('button')).toHaveCount(0);
    const region = us.getByRole('link', { name: /Washington/ });
    expect(await country.evaluate(node => getComputedStyle(node).backgroundColor))
        .toBe(await region.evaluate(node => getComputedStyle(node).backgroundColor));
    await country.click();
    await expect(country).toHaveAttribute('aria-current', 'page');
    await expect(country).toHaveClass(/bg-violet-600/);

    await page.setViewportSize({ width: 800, height: 900 });
    const expand = us.getByRole('button', { name: 'See all (8)' });
    await expect(expand).toBeVisible();
    const collapsedCount = await us.getByRole('link').count();
    expect(collapsedCount).toBeGreaterThan(4);
    expect(collapsedCount).toBeLessThan(9);
    const boxes = await us.getByRole('link').all();
    const top = (await country.boundingBox())!.y;
    for (const link of [...boxes, expand]) expect((await link.boundingBox())!.y).toBeCloseTo(top, 0);

    await expand.focus();
    await page.keyboard.press('Enter');
    await expect(us.getByRole('link')).toHaveCount(9);
    const nextWidth = (await us.getByRole('link').nth(collapsedCount).boundingBox())!.width;
    await us.getByRole('button', { name: 'Show less' }).click();
    await expect(us.getByRole('link')).toHaveCount(collapsedCount);
    const row = (await us.boundingBox())!;
    const toggle = (await expand.boundingBox())!;
    expect(row.x + row.width - toggle.x - toggle.width).toBeLessThan(nextWidth + 8);

    await page.setViewportSize({ width: 500, height: 900 });
    await expect.poll(() => us.getByRole('link').count()).toBeLessThan(collapsedCount);
    await expand.click();
    await expect(us.getByRole('link')).toHaveCount(9);
    await expect(page.getByRole('group', { name: 'Canada' }).getByRole('button', { name: 'See all (6)' }))
        .toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(500);
});

test('filter review regressions: long country and region names wrap inside phone layouts', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/tests/e2e/fixtures/post-regions.html');
    const region = page.getByRole('link', { name: /Región del Libertador General Bernardo O’Higgins/ });
    const country = page.getByRole('link', { name: 'South Georgia & South Sandwich Islands', exact: true });
    for (const link of [region, country]) {
        await expect(link).toBeVisible();
        expect(await link.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(await link.evaluate(node => node.clientWidth));
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('a selected region stays visible when the list is collapsed on a small screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/tests/e2e/fixtures/post-regions.html?country=US&region=alaska');
    const us = page.getByRole('group', { name: 'United States' });
    await expect(us.getByRole('link', { name: /Alaska/ })).toHaveAttribute('aria-current', 'page');
    await us.getByRole('button', { name: 'See all (8)' }).click();
    await expect(us.getByRole('link')).toHaveCount(9);
    await us.getByRole('button', { name: 'Show less' }).click();
    await expect(us.getByRole('link', { name: /Alaska/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
