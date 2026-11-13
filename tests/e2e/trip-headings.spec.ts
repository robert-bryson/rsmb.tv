import { expect, test, type Locator, type Page } from '@playwright/test';

const chapterSelector = '.trip-chapter > :is(h1, h2):first-child';

async function scrollTo(page: Page, top: number) {
    await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), top);
}

async function documentTop(element: Locator) {
    return element.evaluate(node => node.getBoundingClientRect().top + window.scrollY);
}

async function expectTop(element: Locator, top: number) {
    await expect.poll(async () => (await element.boundingBox())!.y).toBeCloseTo(top, 0);
}

for (const width of [390, 1280]) {
    test(`trip chapters stick, push each other out, and end with the story at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/tests/e2e/fixtures/trip-headings.html');
        const headings = page.locator(chapterSelector);
        await expect(headings).toHaveCount(3);
        const first = headings.nth(0);
        const second = headings.nth(1);
        const last = headings.nth(2);
        await expect(first).toHaveCSS('position', 'sticky');
        await expect(page.getByRole('heading', { name: 'A scene in the forest', exact: true })).toHaveCSS('position', 'static');
        await expect(page.locator('[data-trip-title]')).toHaveCSS('position', 'static');
        const firstTop = await documentTop(first.locator('..'));
        const secondTop = await documentTop(second.locator('..'));
        const firstHeight = (await first.boundingBox())!.height;

        await scrollTo(page, firstTop + 150);
        await expectTop(first, 0);
        await expect(page.locator('.site-layout')).toHaveAttribute('data-header-visible', 'false');
        // Breakout media keeps its width inside the chapter boundary.
        const bodyWidth = (await page.locator('#trip-story-body').boundingBox())!.width;
        const mediaWidth = (await page.locator('figure.trip-breakout').boundingBox())!.width;
        expect(mediaWidth).toBeGreaterThan(bodyWidth);

        // Measure several points in the physical handoff, including a title
        // that wraps to multiple lines on a phone.
        for (const fraction of [0.25, 0.5, 0.75]) {
            await scrollTo(page, secondTop - firstHeight * (1 - fraction));
            await expect.poll(async () => {
                const upper = (await first.boundingBox())!;
                const lower = (await second.boundingBox())!;
                return upper.y + upper.height - lower.y;
            }).toBeCloseTo(0, 0);
            expect((await first.boundingBox())!.y).toBeLessThan(0);
        }
        await scrollTo(page, secondTop + 150);
        await expectTop(second, 0);
        expect((await first.boundingBox())!.y + firstHeight).toBeLessThanOrEqual(0);

        const lastTop = await documentTop(last.locator('..'));
        await scrollTo(page, lastTop + 150);
        await expectTop(last, 0);
        const storyEnd = await page.locator('#trip-story-body').evaluate(node => node.getBoundingClientRect().bottom + window.scrollY);
        await scrollTo(page, storyEnd + 80);
        expect((await last.boundingBox())!.y + (await last.boundingBox())!.height).toBeLessThanOrEqual(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });

    test(`sticky headings clear visible, focused, and resized navigation at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/tests/e2e/fixtures/trip-headings.html');
        const first = page.locator(chapterSelector).first();
        const top = await documentTop(first.locator('..'));
        await scrollTo(page, top + 350);
        await expectTop(first, 0);
        await scrollTo(page, top + 300);
        const header = page.getByRole('banner');
        await expect(page.locator('.site-layout')).toHaveAttribute('data-header-visible', 'true');
        await expectTop(first, (await header.boundingBox())!.height);

        // Focus must keep navigation available even when scrolling down again.
        await page.getByRole('link', { name: 'rsmb', exact: true }).evaluate(node => (node as HTMLElement).focus({ preventScroll: true }));
        await scrollTo(page, top + 400);
        await expectTop(first, (await header.boundingBox())!.height);
        await header.locator('nav').evaluate(node => { node.style.paddingBlock = '2rem'; });
        const resizedHeight = (await header.boundingBox())!.height;
        await expectTop(first, resizedHeight);
        await expect(page.getByRole('link', { name: 'rsmb', exact: true })).toBeFocused();
    });
}

test('chapter links keep their IDs, keyboard access, and reload position', async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/trip-headings.html');
    const toc = page.getByRole('navigation', { name: 'Table of contents' });
    await expect(toc.getByRole('link')).toHaveCount(4);
    await toc.getByRole('link', { name: 'Second day along the coast and through the mountains', exact: true }).click();
    await expect(page).toHaveURL(/#second-day-along-the-coast-and-through-the-mountains$/);
    await page.reload();
    const heading = page.locator('#second-day-along-the-coast-and-through-the-mountains');
    await expectTop(heading, 96);
    await expect(heading).toBeInViewport();
    const permalink = heading.getByRole('link', { name: 'Link to Second day along the coast and through the mountains' });
    await permalink.focus();
    await expect(permalink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#second-day-along-the-coast-and-through-the-mountains$/);
    const ids = await page.locator('[data-post-heading]').evaluateAll(nodes => nodes.map(node => node.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(4);
});

test('reduced motion removes heading offset animations and print restores normal flow', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/tests/e2e/fixtures/trip-headings.html');
    const first = page.locator(chapterSelector).first();
    await expect(first).toHaveCSS('transition-duration', '0s');
    await scrollTo(page, await documentTop(first.locator('..')) + 150);
    await expectTop(first, 0);
    await page.emulateMedia({ media: 'print' });
    await expect(first).toHaveCSS('position', 'static');
});
