import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
    buildRssXml,
    generateRss,
    resolveFeedBuildDate,
} from '../generate-rss.js';
import {
    buildSitemapXml,
    generateSitemap,
    resolveRouteLastModifiedDate,
} from '../generate-sitemap.js';

const tempDirs: string[] = [];

function createTempDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmbtv-feed-tests-'));
    tempDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('resolveFeedBuildDate', () => {
    it('uses the latest resolved source timestamp when available', () => {
        const resolveLatestTimestampImpl = vi.fn().mockReturnValue(Date.UTC(2026, 3, 20, 14, 30, 0));

        const buildDate = resolveFeedBuildDate([{ date: '2026-04-08' }], {
            repoRoot: '/repo',
            resolveLatestTimestampImpl,
        });

        expect(buildDate).toBe('Mon, 20 Apr 2026 14:30:00 GMT');
    });

    it('falls back to the newest post date when source timestamps cannot be resolved', () => {
        const buildDate = resolveFeedBuildDate([{ date: '2026-04-19' }], {
            resolveLatestTimestampImpl: vi.fn().mockReturnValue(undefined),
        });

        expect(buildDate).toBe('Sun, 19 Apr 2026 00:00:00 GMT');
    });
});

describe('buildRssXml', () => {
    it('escapes xml-sensitive characters and embeds the supplied build date', () => {
        const xml = buildRssXml(
            [
                {
                    slug: 'unsafe',
                    title: 'A & B < C',
                    description: 'Quotes "here" & apostrophes \'there\'',
                    date: '2026-04-08',
                },
            ],
            'Wed, 08 Apr 2026 21:55:30 GMT'
        );

        expect(xml).toContain('<lastBuildDate>Wed, 08 Apr 2026 21:55:30 GMT</lastBuildDate>');
        expect(xml).toContain('<title>A &amp; B &lt; C</title>');
        expect(xml).toContain('&quot;here&quot;');
        expect(xml).toContain('&apos;there&apos;');
    });

    it('writes an rss file from repo metadata and returns the output summary', () => {
        const repoRoot = createTempDir();
        const postsPath = path.join(repoRoot, 'src/content/posts.json');
        const blogDir = path.join(repoRoot, 'src/content/blog');
        const blogPostPath = path.join(blogDir, 'building-through-routes.mdx');
        const outputPath = path.join(repoRoot, 'public/rss.xml');
        const post = {
            slug: 'building-through-routes',
            title: 'Building Through Routes',
            description: 'A generated test post',
            date: '2026-04-19',
        };
        const postDate = new Date('2026-04-19T15:30:00Z');

        fs.mkdirSync(blogDir, { recursive: true });
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(postsPath, JSON.stringify([post]));
        fs.writeFileSync(blogPostPath, '# test');
        fs.utimesSync(postsPath, postDate, postDate);
        fs.utimesSync(blogPostPath, postDate, postDate);

        const result = generateRss({ postsPath, outputPath, repoRoot });
        const xml = fs.readFileSync(outputPath, 'utf-8');

        expect(result).toEqual({ outPath: outputPath, count: 1 });
        expect(xml).toContain('<title>Building Through Routes</title>');
        expect(xml).toContain('<lastBuildDate>Sun, 19 Apr 2026 15:30:00 GMT</lastBuildDate>');
    });
});

describe('resolveRouteLastModifiedDate', () => {
    it('formats resolved timestamps as iso dates', () => {
        const lastModified = resolveRouteLastModifiedDate(['src/pages/Home.tsx'], {
            repoRoot: '/repo',
            resolveLatestTimestampImpl: vi.fn().mockReturnValue(Date.UTC(2026, 3, 17, 9, 0, 0)),
        });

        expect(lastModified).toBe('2026-04-17');
    });

    it('throws when a route source list cannot be resolved', () => {
        expect(() => resolveRouteLastModifiedDate(['missing.ts'], {
            resolveLatestTimestampImpl: vi.fn().mockReturnValue(undefined),
        })).toThrow(/Unable to determine last modified date/);
    });
});

describe('buildSitemapXml', () => {
    it('renders static routes and blog posts with caller-provided dates', () => {
        const xml = buildSitemapXml(
            [{ slug: 'building-through-routes', date: '2026-04-08' }],
            {
                routes: [
                    {
                        path: '/about',
                        priority: '0.8',
                        changefreq: 'monthly',
                        sources: ['src/pages/About.tsx'],
                    },
                ],
                resolveRouteDate: vi.fn().mockReturnValue('2026-04-17'),
            }
        );

        expect(xml).toContain('<loc>https://rsmb.tv/about</loc>');
        expect(xml).toContain('<lastmod>2026-04-17</lastmod>');
        expect(xml).toContain('<loc>https://rsmb.tv/blog/building-through-routes</loc>');
        expect(xml).toContain('<lastmod>2026-04-08</lastmod>');
    });

    it('writes a sitemap file from route sources and returns the output summary', () => {
        const repoRoot = createTempDir();
        const postsPath = path.join(repoRoot, 'src/content/posts.json');
        const aboutPagePath = path.join(repoRoot, 'src/pages/About.tsx');
        const outputPath = path.join(repoRoot, 'public/sitemap.xml');
        const aboutDate = new Date('2026-04-17T09:00:00Z');

        fs.mkdirSync(path.dirname(postsPath), { recursive: true });
        fs.mkdirSync(path.dirname(aboutPagePath), { recursive: true });
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(postsPath, JSON.stringify([{ slug: 'building-through-routes', date: '2026-04-08' }]));
        fs.writeFileSync(aboutPagePath, 'export default function About() { return null; }');
        fs.utimesSync(aboutPagePath, aboutDate, aboutDate);

        const result = generateSitemap({
            postsPath,
            outputPath,
            repoRoot,
            routes: [
                {
                    path: '/about',
                    priority: '0.8',
                    changefreq: 'monthly',
                    sources: ['src/pages/About.tsx'],
                },
            ],
        });
        const xml = fs.readFileSync(outputPath, 'utf-8');

        expect(result).toEqual({ outPath: outputPath, count: 2 });
        expect(xml).toContain('<loc>https://rsmb.tv/about</loc>');
        expect(xml).toContain('<lastmod>2026-04-17</lastmod>');
        expect(xml).toContain('<loc>https://rsmb.tv/blog/building-through-routes</loc>');
    });
});
