import { expect, it } from 'vitest';
import { captureSkiMapArea, encodeSkiMapArea, readSkiMapArea, skiMapAreaContains } from '../features/ski-status/skiMapArea';

it('round-trips a geographic search on both sides of the antimeridian and excludes the back of the globe', () => {
    const captured = captureSkiMapArea([179, -43], 4, 480, 320, ([x, y]) => [179 + (x - 240) / 40, -43 + (160 - y) / 40]);
    const serialized = encodeSkiMapArea(captured);
    const reloaded = readSkiMapArea(new URLSearchParams({ mapArea: serialized }).get('mapArea'))!;
    const includes = skiMapAreaContains(reloaded);
    expect(serialized.length).toBeLessThan(1800);
    expect(reloaded.center).toEqual([179, -43]);
    expect(reloaded.zoom).toBe(4);
    expect(includes([177, -44])).toBe(true);
    expect(includes([-178, -43])).toBe(true);
    expect(includes([1, 43])).toBe(false);
    expect(includes([165, -43])).toBe(false);
    expect(includes([179, -36])).toBe(false);
    expect(readSkiMapArea(serialized.replace(/^1\./, '2.'))).toBeUndefined();
    expect(readSkiMapArea(serialized.replace(/[^.]+$/, 'z'.repeat(7)))).toBeUndefined();
});
