import { expect, test } from '@playwright/test';
import kalaloch from '../../src/content/trips/kalaloch-2024.json' with { type: 'json' };

for (const animation of kalaloch.animations) {
    test(`${animation.id} is served as video and plays in the browser`, async ({ page, request, baseURL }) => {
        const response = await request.get(animation.src, { headers: { Range: 'bytes=0-31' } });
        expect(response.ok()).toBe(true);
        expect(response.headers()['content-type']?.split(';')[0]).toBe('video/mp4');
        expect((await response.body()).subarray(4, 8).toString()).toBe('ftyp');
        const poster = await request.get(animation.poster);
        expect(poster.ok()).toBe(true);
        expect(poster.headers()['content-type']?.split(';')[0]).toBe('image/webp');

        await page.setContent('<video muted playsinline loop aria-label="Trip animation"></video>');
        await page.getByLabel('Trip animation').evaluate(async (video: HTMLVideoElement, src) => {
            video.src = src;
            await video.play();
        }, new URL(animation.src, baseURL).href);
        await expect.poll(() => page.getByLabel('Trip animation').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(0);
        await expect(page.getByLabel('Trip animation')).toHaveJSProperty('paused', false);
    });
}
