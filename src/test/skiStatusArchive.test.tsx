import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skiArchiveAssetUrl, skiArchiveIndexUrl, type SkiArchiveAsset } from '../../shared/skiArchive';
import { useSkiArchive } from '../features/ski-status/useSkiArchive';

const fields = {
    areaId: 'resort', source: 'https://example.test/winter', checkedOn: '2026-11-21',
    sha256: 'a'.repeat(64), byteCount: 20,
};
const map = {
    ...fields, kind: 'trail map', coverage: 'Main area', edition: '2026/27',
    relativePath: 'trail-maps/resort/2026-27/Trail Map.pdf',
} satisfies SkiArchiveAsset;
const icon = {
    ...fields, kind: 'details icon', sourceSha256: 'b'.repeat(64),
    relativePath: `resort-icons/resort/${'b'.repeat(64)}/details-84.png`,
} satisfies SkiArchiveAsset;

describe('ski-status local archive discovery', () => {
    beforeEach(() => {
        vi.stubEnv('MODE', 'development');
        vi.stubEnv('DEV', true);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('groups checked maps and icon variants by resort', async () => {
        const fetch = vi.fn().mockResolvedValue(Response.json([map, icon]));
        vi.stubGlobal('fetch', fetch);
        const { result } = renderHook(useSkiArchive);
        await waitFor(() => expect(result.current?.get('resort')).toEqual({
            trailMaps: [map], detailsIcon: skiArchiveAssetUrl(icon),
        }));
        expect(fetch).toHaveBeenCalledExactlyOnceWith(skiArchiveIndexUrl, { cache: 'no-store', signal: expect.any(AbortSignal) });
    });

    it.each([
        ['an unavailable index', () => new Response(null, { status: 503 })],
        ['an invalid row', () => Response.json([{ ...map, edition: '2025/26' }])],
        ['malformed JSON', () => new Response('{')],
        ['an empty index', () => Response.json([])],
    ])('leaves the published catalog available for %s', async (_description, createResponse) => {
        const response = createResponse();
        const json = vi.spyOn(response, 'json');
        const fetch = vi.fn().mockResolvedValue(response);
        vi.stubGlobal('fetch', fetch);
        const { result } = renderHook(useSkiArchive);
        await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        if (response.ok) await waitFor(() => expect(json).toHaveBeenCalledOnce());
        expect(result.current).toBeUndefined();
    });

    it('aborts the pending request when the route unmounts', () => {
        const fetch = vi.fn<(url: string, options: RequestInit) => Promise<Response>>(() => new Promise(() => {}));
        vi.stubGlobal('fetch', fetch);
        const { unmount } = renderHook(useSkiArchive);
        const signal = fetch.mock.calls[0][1].signal;
        expect(signal?.aborted).toBe(false);
        unmount();
        expect(signal?.aborted).toBe(true);
    });
});
