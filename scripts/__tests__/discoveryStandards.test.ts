// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { JSDOM } from 'jsdom';
import { parse } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { buildJsonFeed, generateJsonFeed } from '../generate-json-feed.js';
import { buildRssXml, loadPosts } from '../generate-rss.js';
import { generateSiteIcons } from '../generate-site-icons.js';
import { pageMetadataHtml } from '../pageMetadataHtml';
import { staticPageMetadata, STATIC_PAGE_PATHS } from '../../src/utils/pageMetadata';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const directories: string[] = [];
function tempDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmb-discovery-'));
    directories.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('JSON Feed 1.1', () => {
    const posts = [
        { slug: 'old', title: 'Older story', description: 'A & B < C', date: '2026-01-01' },
        { slug: 'private', title: 'Private notes', description: 'Secret draft', date: '2026-03-01', development: { published: false } },
        { slug: 'coast', title: 'Coast', description: 'A ride', date: '2026-02-01', format: 'trip' },
    ];
    it('publishes canonical, stable item IDs and required text content in date order', () => {
        const original = structuredClone(posts);
        const feed = buildJsonFeed(posts);
        expect(feed.version).toBe('https://jsonfeed.org/version/1.1');
        expect(feed.feed_url).toBe('https://rsmb.tv/feed.json');
        expect(feed.authors).toEqual([{ name: 'Robby Bryson', url: 'https://rsmb.tv' }]);
        expect(feed.items.map(item => item.id)).toEqual(['https://rsmb.tv/trips/coast', 'https://rsmb.tv/blog/old']);
        expect(feed.items[0]).toEqual({ id: 'https://rsmb.tv/trips/coast', url: 'https://rsmb.tv/trips/coast', title: 'Coast', content_text: 'A ride', date_published: '2026-02-01T00:00:00.000Z' });
        expect(feed.items[1].content_text).toBe('A & B < C');
        expect(JSON.stringify(feed)).not.toMatch(/private|Secret draft|development/);
        expect(buildJsonFeed([{ ...posts[0], title: 'Revised title' }]).items[0].id).toBe(feed.items[1].id);
        expect(posts).toEqual(original);
    });
    it('writes valid JSON and excludes private fields from a mixed registry', () => {
        const dir = tempDir();
        const postsPath = path.join(dir, 'posts.json');
        const outputPath = path.join(dir, 'feed.json');
        fs.writeFileSync(postsPath, JSON.stringify(posts));
        expect(generateJsonFeed({ postsPath, outputPath })).toEqual({ outPath: outputPath, count: 2 });
        expect(JSON.parse(fs.readFileSync(outputPath, 'utf8'))).toEqual(buildJsonFeed(posts));
        const rss = new JSDOM(buildRssXml(loadPosts(postsPath)), { contentType: 'application/xml' }).window.document;
        expect([...rss.querySelectorAll('item > guid')].map(item => item.textContent))
            .toEqual(buildJsonFeed(posts).items.map(item => item.id));
    });
    it('handles an absent registry as an empty feed and rejects invalid publication dates', () => {
        const dir = tempDir();
        const outputPath = path.join(dir, 'feed.json');
        expect(generateJsonFeed({ postsPath: path.join(dir, 'absent.json'), outputPath }).count).toBe(0);
        expect(JSON.parse(fs.readFileSync(outputPath, 'utf8')).items).toEqual([]);
        expect(() => buildJsonFeed([{ ...posts[0], date: 'invalid' }])).toThrow(RangeError);
    });
});

describe('browser identity and discovery', () => {
    it.each([['icon', 512], ['favicon', 64]] as const)('provides a square JSON Feed %s of at least %d pixels', async (field, minimum) => {
        const url = new URL(buildJsonFeed([])[field]);
        const metadata = await sharp(path.join(root, 'public', url.pathname)).metadata();
        expect(metadata.format).toBe('png');
        expect(metadata.width).toBe(metadata.height);
        expect(metadata.width).toBeGreaterThanOrEqual(minimum);
    });
    it.each(STATIC_PAGE_PATHS)('keeps discovery metadata in the static HTML for %s', pathname => {
        const page = new JSDOM(pageMetadataHtml(read('index.html'), staticPageMetadata(pathname))).window.document;
        expect(page.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/site.webmanifest');
        expect(page.querySelector('link[type="application/feed+json"]')?.getAttribute('href')).toBe('/feed.json');
        expect(page.querySelector('link[type="application/rss+xml"]')?.getAttribute('href')).toBe('/rss.xml');
        expect(page.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0a0a0a');
        expect(page.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('max-image-preview:large');
        const identity = page.querySelector('link[rel="me"]')?.getAttribute('href');
        const person = staticPageMetadata('/about').jsonLd.mainEntity as { sameAs: string[] };
        expect(person.sameAs).toContain(identity);
    });
    it('uses stable, origin-relative manifest identity with normal browser navigation', async () => {
        const manifest = JSON.parse(read('public/site.webmanifest'));
        expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'browser', lang: 'en-US' });
        for (const icon of manifest.icons) {
            const metadata = await sharp(path.join(root, 'public', icon.src)).metadata();
            expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes);
            expect(metadata.format).toBe('png');
            expect(icon.purpose).toBe('any');
        }
    });
    it('derives correctly sized opaque PNG icons from the existing vector artwork', async () => {
        const outputDir = tempDir();
        await generateSiteIcons({ outputDir });
        for (const [size, name] of [[48, 'favicon-48.png'], [192, 'icon-192.png'], [512, 'icon-512.png']] as const) {
            const metadata = await sharp(path.join(outputDir, name)).metadata();
            expect(metadata).toMatchObject({ width: size, height: size, format: 'png', hasAlpha: false });
        }
    });
    it('serves machine-readable resources with their declared media types and bounded cache lifetime', () => {
        const config = parse(read('customHttp.yml'));
        for (const [resource, mime] of [['/site.webmanifest', 'application/manifest+json'], ['/feed.json', 'application/feed+json']]) {
            const headers = config.customHeaders.find((rule: { pattern: string }) => rule.pattern === resource).headers;
            expect(headers).toContainEqual({ key: 'Content-Type', value: `${mime}; charset=utf-8` });
            expect(headers).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=0, s-maxage=3600' });
        }
    });
});
