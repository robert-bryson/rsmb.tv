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

async function fontSize(element: Locator) {
    return element.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
}

test('reader input stops fragment correction before it can pull the story back', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tests/e2e/fixtures/trip-headings.html');
    await expect(page.getByRole('navigation', { name: 'Table of contents' }).getByRole('link')).toHaveCount(5);
    const heading = page.locator(chapterSelector).first();
    await heading.evaluate(node => {
        const scroll = node.scrollIntoView.bind(node);
        let interrupted = false;
        node.scrollIntoView = options => {
            scroll(options);
            if (interrupted) return;
            interrupted = true;
            // Input arrives after the initial fragment jump, before the next
            // frame can re-align titles changed by the scroll animation.
            queueMicrotask(() => {
                window.dispatchEvent(new WheelEvent('wheel', { deltaY: 250 }));
                window.scrollBy({ top: 250, behavior: 'instant' });
            });
        };
        window.location.hash = node.id;
    });
    await expectTop(heading, 0);
    await expect(heading).toHaveCSS('font-size', '17px');
});

for (const level of [1, 2]) for (const width of [390, 1280]) {
    test(`h${level} chapter titles shrink smoothly into a compact reminder at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/tests/e2e/fixtures/trip-headings.html?heading-level=${level}`);
        const heading = page.locator(chapterSelector).first();
        const chapterTop = await documentTop(heading.locator('..'));
        const expandedSize = await fontSize(heading);
        const expandedHeight = (await heading.boundingBox())!.height;
        await scrollTo(page, chapterTop + 8);
        await expect(page.locator('.site-layout')).toHaveAttribute('data-header-visible', 'false');
        await expect.poll(() => fontSize(heading)).toBeLessThan(expandedSize - 0.5);
        await expect.poll(() => fontSize(heading)).toBeGreaterThan(17.1);
        await expect.poll(() => page.evaluate(top => Math.abs(window.scrollY - top), chapterTop + 8)).toBeLessThanOrEqual(1);
        await scrollTo(page, chapterTop + 100);
        await expectTop(heading, 0);
        await expect.poll(() => fontSize(heading)).toBeCloseTo(17, 1);
        expect((await heading.boundingBox())!.height).toBeLessThan(expandedHeight * 0.8);
        expect((await heading.boundingBox())!.height).toBeLessThanOrEqual(44);
        await expect(heading).toHaveText('First day#↑');
        const permalink = heading.getByRole('link', { name: 'Link to First day', exact: true });
        await permalink.evaluate(node => (node as HTMLElement).focus({ preventScroll: true }));
        await expect(permalink).toBeFocused();
        await page.emulateMedia({ media: 'print' });
        await expect.poll(() => fontSize(heading)).toBeCloseTo(expandedSize, 1);
        await expect(heading).toHaveCSS('position', 'static');
        await page.emulateMedia({ media: 'screen' });
        await scrollTo(page, chapterTop - 150);
        await expect.poll(() => fontSize(heading)).toBeCloseTo(expandedSize, 1);
    });
}

test('reduced motion snaps sticky titles to the compact size and large text stays readable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/tests/e2e/fixtures/trip-headings.html');
    await page.addStyleTag({ content: 'html { font-size: 32px; }' });
    const heading = page.locator(chapterSelector).first();
    const top = await documentTop(heading.locator('..'));
    const expandedSize = await fontSize(heading);
    await scrollTo(page, top + 100);
    await expect.poll(() => fontSize(heading)).toBeCloseTo(34, 1);
    await expect(heading).toHaveCSS('transition-duration', '0s');
    await expect(heading).toHaveCSS('animation-timing-function', 'steps(1)');
    const navigationHeight = (await page.getByRole('banner').boundingBox())!.height;
    await scrollTo(page, top - navigationHeight - 100);
    await expect.poll(() => fontSize(heading)).toBeCloseTo(expandedSize, 1);
});

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

        await scrollTo(page, firstTop + 150);
        await expectTop(first, 0);
        await expect.poll(() => fontSize(first)).toBeCloseTo(17, 1);
        await expect(page.locator('.site-layout')).toHaveAttribute('data-header-visible', 'false');
        const firstHeight = (await first.boundingBox())!.height;
        const secondTop = await documentTop(second.locator('..'));
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
        // Padding and borders change the border box without resizing the
        // observed content box. Both offsets must follow those changes too.
        await header.evaluate(node => {
            node.style.paddingBlock = '20px';
            node.style.borderBottomWidth = '5px';
        });
        await expectTop(first, (await header.boundingBox())!.height);
        await expect(page.getByRole('link', { name: 'rsmb', exact: true })).toBeFocused();
    });
}

test('chapter links keep their IDs, keyboard access, and reload position', async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/trip-headings.html');
    const toc = page.getByRole('navigation', { name: 'Table of contents' });
    await expect(toc.getByRole('link')).toHaveCount(5);
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
    expect(ids).toHaveLength(5);
});

for (const level of [1, 2]) {
    test(`subsection links clear sticky h${level} chapters when moving upward and after reload`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 900 });
        await page.goto(`/tests/e2e/fixtures/trip-headings.html?heading-level=${level}`);
        const chapters = page.locator('.trip-chapter');
        const end = await documentTop(chapters.nth(2));
        await scrollTo(page, end + 200);
        await expect(page.locator('.site-layout')).toHaveAttribute('data-header-visible', 'false');

        for (const id of ['a-pass-through-the-mountains', 'a-scene-in-the-forest']) {
            await page.evaluate(id => { window.location.hash = id; }, id);
            await expect(page.locator('.site-layout')).toHaveAttribute('data-header-visible', 'true');
            const target = page.locator(`#${id}`);
            await expect.poll(() => target.evaluate(node => {
                const title = node.closest('.trip-chapter')!.firstElementChild!;
                return node.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
            })).toBeGreaterThanOrEqual(8);
            await expect(target).toBeInViewport();
        }
        await page.reload();
        const target = page.locator('#a-scene-in-the-forest');
        await expect(target).toBeInViewport();
        await expect.poll(() => target.evaluate(node => node.getBoundingClientRect().top
            - node.closest('.trip-chapter')!.firstElementChild!.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(8);

        // Reflow the long title, then repeat the jump with its new height.
        await page.addStyleTag({ content: 'html { font-size: 24px; }' });
        await expect.poll(() => chapters.nth(1).evaluate(node => parseFloat(node.style.getPropertyValue('--trip-chapter-heading-height'))))
            .toBeGreaterThan(120);
        await scrollTo(page, await documentTop(chapters.nth(2)) + 200);
        await page.evaluate(() => { window.location.hash = 'a-pass-through-the-mountains'; });
        const mountain = page.locator('#a-pass-through-the-mountains');
        await expect.poll(() => mountain.evaluate(node => node.getBoundingClientRect().top
            - node.closest('.trip-chapter')!.firstElementChild!.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(8);
    });

    test(`oversized h${level} titles leave reading space on a short screen and recover after rotation`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 240 });
        await page.goto(`/tests/e2e/fixtures/trip-headings.html?heading-level=${level}`);
        const chapters = page.locator('.trip-chapter');
        const longChapter = chapters.nth(1);
        const title = longChapter.locator(':scope > :first-child');
        const combinedHeight = () => title.evaluate(node => node.getBoundingClientRect().height
            + document.querySelector('.site-header')!.getBoundingClientRect().height);
        // The compact banner can fit at 320px. Make this fixture exceed the
        // half-screen limit explicitly instead of assuming a particular wrap.
        await expect.poll(combinedHeight).toBeGreaterThan(120);
        await expect(longChapter).toHaveAttribute('data-trip-chapter-static');
        await expect(title).toHaveCSS('position', 'static');
        await scrollTo(page, await documentTop(longChapter) + 250);
        await expect.poll(async () => (await title.boundingBox())!.y + (await title.boundingBox())!.height).toBeLessThan(0);
        await page.setViewportSize({ width: 390, height: 900 });
        await expect(longChapter).not.toHaveAttribute('data-trip-chapter-static');
        await expect(title).toHaveCSS('position', 'sticky');
        // Measure enlarged titles in normal flow, before they become compact.
        await scrollTo(page, 0);
        await page.addStyleTag({ content: 'html { font-size: 40px; }' });
        await expect.poll(combinedHeight).toBeGreaterThan(450);
        await expect(longChapter).toHaveAttribute('data-trip-chapter-static');
        await expect(title).toHaveCSS('position', 'static');
    });
}

for (const font of ['', 'DejaVu Sans']) for (const width of [320, 390]) {
    test(`200% text keeps navigation and contents controls within ${width}px (${font || 'default font'})`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/tests/e2e/fixtures/trip-headings.html');
        await page.addStyleTag({ content: `html { font-size: 32px; ${font ? `font-family: '${font}', sans-serif;` : ''} }` });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        const navigation = page.getByRole('navigation', { name: 'Main navigation' });
        for (const name of ['rsmb', 'Posts', 'Projects', 'About']) {
            const link = navigation.getByRole('link', { name, exact: true });
            await link.focus();
            await expect(link).toBeInViewport();
            const bounds = (await link.boundingBox())!;
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        }
        const contents = page.getByRole('navigation', { name: 'Table of contents' });
        const collapse = contents.getByRole('button', { name: 'Collapse', exact: true });
        await collapse.scrollIntoViewIfNeeded();
        const bounds = (await collapse.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        await collapse.click();
        await expect(contents.locator('ul')).toBeHidden();
        await contents.getByRole('button', { name: 'Expand', exact: true }).click();
        await expect(contents.locator('ul')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });
}

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
