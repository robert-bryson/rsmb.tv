import { expect, test } from '@playwright/test';
import kalaloch from '../../src/content/trips/kalaloch-2024.json' with { type: 'json' };

test('the player defers video loading and preserves a user pause after scrolling', async ({ page }) => {
    const videoRequests: string[] = [];
    page.on('request', request => { if (request.url().endsWith('.mp4')) videoRequests.push(request.url()); });
    await page.goto('/tests/e2e/fixtures/trip-animation.html');
    const animation = page.locator('[data-trip-animation]').first();
    const video = animation.locator('video');
    await expect(video).not.toHaveAttribute('src');
    expect(videoRequests).toHaveLength(0);

    await animation.scrollIntoViewIfNeeded();
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
    // Pointer controls appear when the reader moves over the frame.
    await animation.hover();
    await animation.getByRole('button', { name: 'Pause animation' }).click();
    await expect(video).toHaveJSProperty('paused', true);
    await page.getByRole('heading').scrollIntoViewIfNeeded();
    await expect(animation).not.toBeInViewport();
    await animation.scrollIntoViewIfNeeded();
    // A new observer entry must preserve the user pause.
    await expect(animation.getByRole('button', { name: 'Play animation' })).toBeVisible();
    await expect(video).toHaveJSProperty('paused', true);
    const play = animation.getByRole('button', { name: 'Play animation' });
    await play.focus();
    await play.press('Enter');
    await expect(video).toHaveJSProperty('paused', false);
});

test('reduced motion keeps the poster still until the reader starts playback', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/tests/e2e/fixtures/trip-animation.html');
    const animation = page.locator('[data-trip-animation]').first();
    await animation.scrollIntoViewIfNeeded();
    const video = animation.locator('video');
    await expect(video).toHaveAttribute('src');
    await expect(video).toHaveJSProperty('paused', true);
    await expect(video).toHaveJSProperty('currentTime', 0);
    const play = animation.getByRole('button', { name: 'Play animation' });
    await play.focus();
    await play.press('Enter');
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
    await expect(animation.getByRole('button', { name: 'Pause animation' })).toBeVisible();
});

test('an HTML rewrite at the video URL retains the poster and caption', async ({ page }) => {
    await page.route('**/*.mp4', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Wrong response</title>' }));
    await page.goto('/tests/e2e/fixtures/trip-animation.html');
    const animation = page.locator('[data-trip-animation]').first();
    await animation.scrollIntoViewIfNeeded();
    await expect(animation.getByRole('status')).toHaveText('Animation unavailable.');
    const poster = animation.getByRole('img');
    await expect(poster).toBeVisible();
    await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(animation.locator('video')).toHaveCount(0);
    await expect(animation.getByRole('button')).toHaveCount(0);
    await expect(animation.locator('figcaption')).toContainText(kalaloch.animations[0].caption);
});

test.describe('phone playback', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('touch controls remain visible and pause and resume the clip', async ({ page }) => {
        await page.goto('/tests/e2e/fixtures/trip-animation.html');
        const animation = page.locator('[data-trip-animation]').first();
        await animation.scrollIntoViewIfNeeded();
        const video = animation.locator('video');
        await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
        const pause = animation.getByRole('button', { name: 'Pause animation' });
        await expect(pause).toHaveCSS('opacity', '1');
        await pause.tap();
        await expect(video).toHaveJSProperty('paused', true);
        await animation.getByRole('button', { name: 'Play animation' }).tap();
        await expect(video).toHaveJSProperty('paused', false);
    });
});
