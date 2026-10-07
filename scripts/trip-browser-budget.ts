import { gzipSync } from 'node:zlib';
import type { Request, Response } from '@playwright/test';

type JavaScriptRequest = Pick<Request, 'url' | 'resourceType'> & {
    response(): Promise<Pick<Response, 'ok' | 'status' | 'body'> | null>;
};

export async function measureJavaScriptGzip(requests: Iterable<JavaScriptRequest>) {
    const scripts = new Map<string, JavaScriptRequest>();
    for (const request of requests) {
        const url = request.url();
        if (request.resourceType() === 'script' || /\.m?js$/.test(new URL(url).pathname)) {
            if (!scripts.has(url)) scripts.set(url, request);
        }
    }
    if (scripts.size === 0) throw new Error('No JavaScript requests were captured');

    return Promise.all([...scripts].map(async ([url, request]) => {
        const response = await request.response();
        if (!response) throw new Error(`JavaScript request has no response: ${url}`);
        if (!response.ok()) throw new Error(`JavaScript response returned HTTP ${response.status()}: ${url}`);
        const body = await response.body();
        return { url, bytes: gzipSync(body, { level: 6 }).byteLength };
    }));
}