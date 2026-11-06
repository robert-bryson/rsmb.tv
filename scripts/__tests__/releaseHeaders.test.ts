// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { assertHostingHeaders, expectedHostingHeaders } from '../release-headers.js';

const immutable = 'public, max-age=31536000, immutable';
const globalHeaders = ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'strict-transport-security', 'permissions-policy', 'content-security-policy'];

describe('hosting header selection', () => {
    it('reads global security policy from customHttp.yml and merges it into asset rules', () => {
        const { customHeaders } = parse(readFileSync(new URL('../../customHttp.yml', import.meta.url), 'utf8'));
        const configured = customHeaders.find((rule: { pattern: string }) => rule.pattern === '**').headers;
        const expected = expectedHostingHeaders('/assets/nested/application.js');
        for (const { key, value } of configured) expect(expected[key.toLowerCase()]).toBe(value);
        expect(expected['cache-control']).toBe(immutable);
        expect(Object.keys(expected).every(name => name === name.toLowerCase())).toBe(true);
    });

    it.each([
        ['/assets/nested/application.js', immutable],
        ['/media/trips/one/two/photo.avif', immutable],
        ['/images/previews/nested/preview.webp', immutable],
        ['/nested/worker.js', immutable],
        ['/nested/theme.css', immutable],
        ['/basemaps/nested/earth.webp', 'public, max-age=604800'],
        ['/basemaps/earth-night-1536-8ec8613bb172.webp', immutable],
        ['/basemaps/earth-topology-1536-8bb5a2698ef0.webp', immutable],
        ['/basemaps/earth-night.webp', 'public, max-age=604800'],
        ['/data/flights/flights.geojson', 'public, max-age=3600'],
    ])('selects cache policy for %s', (pathname, cache) => {
        expect(expectedHostingHeaders(pathname)['cache-control']).toBe(cache);
        expect(Object.keys(expectedHostingHeaders(pathname))).toEqual(expect.arrayContaining(globalHeaders));
    });

    it.each([
        ['/site.webmanifest', 'application/manifest+json; charset=utf-8'],
        ['/feed.json', 'application/feed+json; charset=utf-8'],
    ])('keeps the MIME and shared-cache policy for %s', (pathname, contentType) => {
        expect(expectedHostingHeaders(pathname)).toMatchObject({
            'content-type': contentType,
            'cache-control': 'public, max-age=0, s-maxage=3600',
        });
    });

    it.each(['/', '/about', '/nested/feed.json', '/nested/site.webmanifest', '/assets-old/file.json', '/files/app.js.map', '/files/app.JS', '/feed.json/other'])('does not apply unrelated asset or feed patterns to %s', pathname => {
        const expected = expectedHostingHeaders(pathname);
        expect(Object.keys(expected).sort()).toEqual([...globalHeaders].sort());
        expect(expected).not.toHaveProperty('cache-control');
        expect(expected).not.toHaveProperty('content-type');
    });

    it('matches the URL pathname without query or fragment text', () => {
        expect(expectedHostingHeaders('https://preview.example/data/nested/value.json?file=app.js#feed.json')).toEqual(expectedHostingHeaders('/data/nested/value.json'));
        expect(expectedHostingHeaders('/about?file=/assets/app.js')).toEqual(expectedHostingHeaders('/about'));
    });

    it('returns independent header objects for fixture responses', () => {
        const headers = expectedHostingHeaders('/assets/app.js');
        headers['cache-control'] = 'private';
        expect(expectedHostingHeaders('/assets/app.js')['cache-control']).toBe(immutable);
    });
});

describe('hosting header assertions', () => {
    it('accepts header-name casing, charset quoting, directive ordering, and harmless whitespace', () => {
        const headers = expectedHostingHeaders('/site.webmanifest');
        const csp = headers['content-security-policy'].split(';').map(directive => directive.trim()).filter(Boolean).reverse().map(directive => {
            const [name, ...sources] = directive.split(/\s+/);
            return `${name.toUpperCase()}   ${sources.reverse().map(source => source.replace('https://data.rsmb.tv', 'HTTPS://DATA.RSMB.TV').replace("'self'", "'SELF'")).join('  ')}`;
        }).join(' ; ');
        const actual = Object.fromEntries(Object.entries({
            ...headers,
            'content-type': 'Application/Manifest+JSON ; CHARSET="UTF-8"',
            'cache-control': 'S-MAXAGE = 3600, PUBLIC, MAX-AGE = 0',
            'content-security-policy': csp,
            'permissions-policy': 'GEOLOCATION = ( ), CAMERA=(), microphone = ()',
            'strict-transport-security': 'PRELOAD ; INCLUDESUBDOMAINS ; MAX-AGE = 63072000',
            'x-content-type-options': 'NoSniff',
            'x-frame-options': 'deny',
            'referrer-policy': 'STRICT-ORIGIN-WHEN-CROSS-ORIGIN',
        }).map(([key, value]) => [key.toUpperCase(), value]));
        expect(() => assertHostingHeaders('https://preview.example/site.webmanifest', actual)).not.toThrow();
    });

    it.each(globalHeaders)('rejects a missing %s header with the affected URL', name => {
        const headers = expectedHostingHeaders('/about');
        delete headers[name];
        expect(() => assertHostingHeaders('/about', headers)).toThrow(`Missing hosting header ${name} for /about`);
    });

    it.each([
        ['x-content-type-options', ''],
        ['x-frame-options', 'SAMEORIGIN'],
        ['referrer-policy', 'unsafe-url'],
        ['strict-transport-security', 'max-age=60; includeSubDomains; preload'],
        ['permissions-policy', 'camera=*, microphone=(), geolocation=()'],
        ['content-security-policy', "default-src *; script-src 'unsafe-inline'"],
    ])('rejects an incorrect %s security policy', (name, value) => {
        expect(() => assertHostingHeaders('/about', { ...expectedHostingHeaders('/about'), [name]: value })).toThrow(name);
    });

    it.each([
        'public, max-age=31536000',
        'public, max-age=3600, immutable',
        'private, max-age=31536000, immutable',
        'public, max-age=31536000, immutable, max-age=0',
    ])('rejects an incorrect immutable asset policy: %s', cache => {
        expect(() => assertHostingHeaders('/assets/app.js', { ...expectedHostingHeaders('/assets/app.js'), 'cache-control': cache })).toThrow('cache-control mismatch');
    });

    it('accepts reordered immutable directives while checking their complete values', () => {
        const headers = { ...expectedHostingHeaders('/assets/app.js'), 'cache-control': 'IMMUTABLE, MAX-AGE=031536000, PUBLIC' };
        expect(() => assertHostingHeaders('/assets/app.js', headers)).not.toThrow();
    });

    it('rejects missing cache headers and a changed feed shared-cache lifetime', () => {
        const headers = expectedHostingHeaders('/feed.json');
        delete headers['cache-control'];
        expect(() => assertHostingHeaders('/feed.json', headers)).toThrow('Missing hosting header cache-control');
        expect(() => assertHostingHeaders('/feed.json', { ...headers, 'cache-control': 'public, max-age=0, s-maxage=60' })).toThrow('cache-control mismatch');
    });

    it.each(['/feed.json', '/site.webmanifest'])('rejects a missing or incorrect configured Content-Type for %s', pathname => {
        const headers = expectedHostingHeaders(pathname);
        delete headers['content-type'];
        expect(() => assertHostingHeaders(pathname, headers)).toThrow('Missing hosting header content-type');
        expect(() => assertHostingHeaders(pathname, { ...headers, 'content-type': 'application/json; charset=utf-8' })).toThrow('content-type mismatch');
    });

    it('does not confuse manifest and feed response types', () => {
        expect(() => assertHostingHeaders('/feed.json', expectedHostingHeaders('/site.webmanifest'))).toThrow('content-type mismatch');
    });

    it('reports a malformed media type as a header mismatch', () => {
        expect(() => assertHostingHeaders('/feed.json', { ...expectedHostingHeaders('/feed.json'), 'content-type': ';' })).toThrow('content-type mismatch');
    });

    it('rejects an expanded CSP allowlist and duplicate policy directives', () => {
        const headers = expectedHostingHeaders('/about');
        for (const addition of [' https://untrusted.example', "; default-src 'none'"]) {
            expect(() => assertHostingHeaders('/about', { ...headers, 'content-security-policy': headers['content-security-policy'] + addition })).toThrow('content-security-policy mismatch');
        }
    });

    it('rejects duplicate differently-cased actual fields', () => {
        const headers = expectedHostingHeaders('/about');
        expect(() => assertHostingHeaders('/about', { ...headers, 'X-FRAME-OPTIONS': 'SAMEORIGIN' })).toThrow('Duplicate hosting header x-frame-options');
    });

    it('allows unrelated hosting headers when no corresponding pattern configures them', () => {
        expect(() => assertHostingHeaders('/about', { ...expectedHostingHeaders('/about'), 'cache-control': 'public, max-age=0', 'content-type': 'text/html; charset=utf-8', server: 'fixture' })).not.toThrow();
    });
});
