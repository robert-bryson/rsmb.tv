import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    DEFAULT_PAGES,
    generateOgImages,
    generateSvg,
    loadBlogPosts,
} from '../generate-og-images.js';
import { projects } from '../../src/content/projects';

const tempDirs: string[] = [];

function createTempDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmbtv-og-tests-'));
    tempDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('generateSvg', () => {
    it('escapes XML-sensitive title and subtitle text', () => {
        const svg = generateSvg({
            title: 'A & B < C',
            subtitle: 'Quotes "here"',
        });

        expect(svg).toContain('A &amp; B &lt; C');
        expect(svg).toContain('Quotes &quot;here&quot;');
    });
});

describe('loadBlogPosts', () => {
    it('returns an empty registry before generated posts.json exists', () => {
        expect(loadBlogPosts(path.join(createTempDir(), 'missing-posts.json'))).toEqual([]);
    });
});

describe('generateOgImages', () => {
    it('has a default OG image definition for every project page', () => {
        const pageSlugs = new Set(DEFAULT_PAGES.map((page) => page.slug));

        for (const project of projects) {
            expect(pageSlugs).toContain(project.slug);
        }
    });

    it('clears stale blog images and writes page images when there are no posts', () => {
        const repoRoot = createTempDir();
        const outDir = path.join(repoRoot, 'public/og');
        const staleImage = path.join(outDir, 'blog/stale.svg');
        fs.mkdirSync(path.dirname(staleImage), { recursive: true });
        fs.writeFileSync(staleImage, '<svg></svg>');

        const result = generateOgImages({
            outDir,
            postsPath: path.join(repoRoot, 'src/content/posts.json'),
            pages: [{ slug: 'home', title: 'Home', subtitle: 'Static page' }],
        });

        expect(result).toEqual({ outDir, pageCount: 1, blogPostCount: 0 });
        expect(fs.existsSync(path.join(outDir, 'home.svg'))).toBe(true);
        expect(fs.existsSync(staleImage)).toBe(false);
    });

    it('generates one blog image per generated post', () => {
        const repoRoot = createTempDir();
        const outDir = path.join(repoRoot, 'public/og');
        const postsPath = path.join(repoRoot, 'src/content/posts.json');
        fs.mkdirSync(path.dirname(postsPath), { recursive: true });
        fs.writeFileSync(postsPath, JSON.stringify([
            {
                slug: 'synced-post',
                title: 'Synced Post',
                description: 'Generated from Google',
                date: '2026-04-30',
                tags: [],
            },
        ]));

        const result = generateOgImages({ outDir, postsPath, pages: [] });

        expect(result.blogPostCount).toBe(1);
        expect(fs.readFileSync(path.join(outDir, 'blog/synced-post.svg'), 'utf-8'))
            .toContain('Synced Post');
    });
});
