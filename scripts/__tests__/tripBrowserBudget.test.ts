// @vitest-environment node
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { measureJavaScriptGzip } from '../trip-browser-budget';

function script(url = 'http://localhost/assets/index.js', contents = 'export const value = 42;', resourceType = 'script') {
    const body = vi.fn().mockResolvedValue(Buffer.from(contents));
    const response = vi.fn().mockResolvedValue({
        ok: () => true,
        status: () => 200,
        body,
    });
    return { url: () => url, resourceType: () => resourceType, response, body };
}

describe('measureJavaScriptGzip', () => {
    it('measures the captured body with fixed gzip settings', async () => {
        const contents = 'export const value = 42;'.repeat(100);
        const request = script(undefined, contents);
        await expect(measureJavaScriptGzip([request])).resolves.toEqual([
            { url: request.url(), bytes: gzipSync(Buffer.from(contents), { level: 6 }).byteLength },
        ]);
        expect(request.response).toHaveBeenCalledTimes(1);
        expect(request.body).toHaveBeenCalledTimes(1);
    });

    it('counts duplicate module and preload requests once', async () => {
        const request = script();
        const duplicate = script(request.url(), 'different second response', 'other');
        const resources = await measureJavaScriptGzip([request, duplicate]);
        expect(resources).toHaveLength(1);
        expect(duplicate.response).not.toHaveBeenCalled();
    });

    it('includes extensionless scripts and module preloads with query strings', async () => {
        const requests = [
            script('http://localhost/module?id=1'),
            script('http://localhost/chunk.js?v=1', 'first', 'other'),
            script('http://localhost/chunk.js?v=2', 'second', 'other'),
            script('http://localhost/chunk.mjs', 'module', 'other'),
        ];
        const resources = await measureJavaScriptGzip(requests);
        expect(resources.map(resource => resource.url)).toEqual(requests.map(request => request.url()));
    });

    it('excludes non-JavaScript resources', async () => {
        const css = script('http://localhost/site.css', 'body {}', 'stylesheet');
        const image = script('http://localhost/photo.png', 'image', 'image');
        const resources = await measureJavaScriptGzip([css, script(), image]);
        expect(resources).toHaveLength(1);
        expect(css.response).not.toHaveBeenCalled();
        expect(image.response).not.toHaveBeenCalled();
    });

    it('rejects an empty script set instead of reporting a zero-byte pass', async () => {
        await expect(measureJavaScriptGzip([])).rejects.toThrow('No JavaScript requests were captured');
    });

    it('rejects a request with no response', async () => {
        const request = script();
        request.response.mockResolvedValue(null);
        await expect(measureJavaScriptGzip([request])).rejects.toThrow(`JavaScript request has no response: ${request.url()}`);
    });

    it('rejects an unsuccessful response', async () => {
        const request = script();
        request.response.mockResolvedValue({ ok: () => false, status: () => 404, body: request.body });
        await expect(measureJavaScriptGzip([request])).rejects.toThrow(`JavaScript response returned HTTP 404: ${request.url()}`);
        expect(request.body).not.toHaveBeenCalled();
    });

    it('propagates body read failures', async () => {
        const request = script();
        const error = new Error('Response body is unavailable');
        request.body.mockRejectedValue(error);
        await expect(measureJavaScriptGzip([request])).rejects.toBe(error);
    });
});