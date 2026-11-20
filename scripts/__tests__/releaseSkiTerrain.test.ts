// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { verifySkiTerrainResponse } from '../release-ski-terrain.ts';

const archive = Buffer.from([0x20, 0xff, 0x00, 0xa1, 0x76]);

function rangeResponse({ range, contentRange = 'bytes 0-1/5', status = 206, bytes = archive.subarray(0, 2) }:
    { range?: string; contentRange?: string; status?: number; bytes?: Buffer }) {
    const requestHeaders: Record<string, string> = range === undefined ? {} : { range };
    return {
        request: () => ({ headers: () => requestHeaders }),
        status: () => status,
        headers: () => ({ 'content-range': contentRange }),
        body: vi.fn(async () => bytes),
    };
}

describe('ski terrain release range checks', () => {
    it.each([
        ['bytes=0-1', 'bytes 0-1/5', 0, 2],
        ['bytes=2-3', 'bytes 2-3/5', 2, 4],
        ['bytes=4-12', 'bytes 4-4/5', 4, 5],
    ] as const)('checks the archive bytes for %s', async (range, contentRange, start, end) => {
        const response = rangeResponse({ range, contentRange, bytes: archive.subarray(start, end) });
        await expect(verifySkiTerrainResponse(response, archive)).resolves.toBeUndefined();
        expect(response.body).toHaveBeenCalledOnce();
    });

    it.each([
        [{ status: 200, range: 'bytes=0-1' }, 'expected HTTP 206'],
        [{}, 'expected HTTP 206'],
        [{ range: 'bytes=2-1' }, 'Invalid ski terrain request range'],
        [{ range: 'bytes=5-9' }, 'Invalid ski terrain request range'],
        [{ range: 'bytes=0-9007199254740992' }, 'Invalid ski terrain request range'],
        [{ range: 'bytes=0-1', contentRange: 'bytes 0-1/6' }, 'Wrong ski terrain Content-Range'],
    ] as const)('rejects invalid range metadata before reading the body: %j', async (options, message) => {
        const response = rangeResponse(options);
        await expect(verifySkiTerrainResponse(response, archive)).rejects.toThrow(message);
        expect(response.body).not.toHaveBeenCalled();
    });

    it('rejects a truncated body with a correct response header', async () => {
        const response = rangeResponse({ range: 'bytes=0-1', bytes: archive.subarray(0, 1) });
        await expect(verifySkiTerrainResponse(response, archive)).rejects.toThrow('Ski terrain bytes differ');
    });
});
