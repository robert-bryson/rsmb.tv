import { expect, type Locator } from '@playwright/test';

/** Check resolution against the rendered slot, allowing normal browser downselection. */
export async function expectSuitableImageSource(photo: Locator) {
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const { selected, required, candidates } = await photo.evaluate((image: HTMLImageElement) => ({
        selected: Number(new URL(image.currentSrc).pathname.match(/[-/](\d+)\.svg$/)?.[1]),
        required: image.getBoundingClientRect().width * devicePixelRatio,
        candidates: image.srcset.split(',').map(source => Number(source.trim().match(/\s(\d+)w$/)?.[1])).sort((a, b) => a - b),
    }));
    expect(candidates).toContain(selected);
    const largest = candidates.at(-1)!;
    // Permit rounding near a candidate boundary without accepting a blurry source.
    expect(selected).toBeGreaterThanOrEqual(Math.min(required, largest) * 0.9);
    const nextSize = candidates.find(width => width >= required) ?? largest;
    expect(selected).toBeLessThanOrEqual(nextSize);
}
