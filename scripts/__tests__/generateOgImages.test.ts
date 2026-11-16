// @vitest-environment node
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('generateSvg', () => {
    it('escapes XML-sensitive title and subtitle text', () => {
        const svg = generateSvg({
            title: 'A & B < C > D',
            subtitle: 'Quotes "here"',
        });

        expect(svg).toContain('A &amp; B &lt; C &gt; D');
        expect(svg).toContain('Quotes &quot;here&quot;');
    });

    it.each(['word '.repeat(100), 'x'.repeat(250)])('limits long text to three bounded lines', (text) => {
        const svg = generateSvg({ title: text, subtitle: text });
        const blocks = [...svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)].slice(0, 2);
        for (const [index, block] of blocks.entries()) {
            const lines = [...block[1].matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map(match => match[1]);
            expect(lines.length).toBeLessThanOrEqual(3);
            expect(lines.every(line => line.length <= [30, 62][index])).toBe(true);
            expect(lines.some(line => line.endsWith('…'))).toBe(true);
        }
    });

    it('permits an empty subtitle', () => {
        expect(generateSvg({ title: 'Title', subtitle: '' })).toContain('<tspan x="80" y="410"></tspan>');
    });
});

describe('loadBlogPosts', () => {
    it('returns an empty registry before generated posts.json exists', () => {
        expect(loadBlogPosts(path.join(createTempDir(), 'missing-posts.json'))).toEqual([]);
    });

    it('reports a registry read failure instead of treating it as an empty list', () => {
        vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw Object.assign(new Error('Permission denied'), { code: 'EACCES' });
        });
        expect(() => loadBlogPosts('/unreadable/posts.json')).toThrow('Permission denied');
    });
});

describe('generateOgImages', () => {
    it('has a default OG image definition for every project page', () => {
        const pageSlugs = new Set(DEFAULT_PAGES.map((page) => page.slug));

        for (const project of projects) {
            expect(pageSlugs).toContain(project.slug);
            expect(DEFAULT_PAGES.find(page => page.slug === project.slug)).toEqual({
                slug: project.slug,
                title: project.title,
                subtitle: project.summary ?? project.description,
            });
        }
    });

    it('clears stale blog images and writes page images when there are no posts', async () => {
        const repoRoot = createTempDir();
        const outDir = path.join(repoRoot, 'public/og');
        const staleImage = path.join(outDir, 'blog/stale.svg');
        fs.mkdirSync(path.dirname(staleImage), { recursive: true });
        fs.writeFileSync(staleImage, '<svg></svg>');

        const result = await generateOgImages({
            outDir,
            postsPath: path.join(repoRoot, 'src/content/posts.json'),
            pages: [{ slug: 'home', title: 'Home', subtitle: 'Static page' }],
        });

        expect(result).toEqual({ outDir, pageCount: 1, blogPostCount: 0 });
        expect(fs.existsSync(path.join(outDir, 'home.svg'))).toBe(true);
        expect(await sharp(path.join(outDir, 'home.png')).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
        expect(fs.existsSync(staleImage)).toBe(false);
    });

    it('generates one blog image per generated post', async () => {
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

        const result = await generateOgImages({ outDir, postsPath, pages: [] });

        expect(result.blogPostCount).toBe(1);
        expect(await sharp(path.join(outDir, 'blog/synced-post.png')).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
        expect(fs.readFileSync(path.join(outDir, 'blog/synced-post.svg'), 'utf-8'))
            .toContain('Synced Post');
    });

    it.each(['page', 'post'])('rejects unsafe %s slugs before changing any output', async (kind) => {
        const root = createTempDir();
        const outDir = path.join(root, 'og');
        const postsPath = path.join(root, 'posts.json');
        const sentinel = path.join(root, 'outside.svg');
        fs.writeFileSync(sentinel, 'Keep this file');
        const card = { slug: kind === 'page' ? '../outside' : '../../outside', title: 'Unsafe', subtitle: 'Unsafe' };
        fs.writeFileSync(postsPath, JSON.stringify(kind === 'post' ? [{ ...card, description: card.subtitle }] : []));

        await expect(generateOgImages({ outDir, postsPath, pages: kind === 'page' ? [card] : [] }))
            .rejects.toThrow(/slug/i);
        expect(fs.readFileSync(sentinel, 'utf8')).toBe('Keep this file');
        expect(fs.existsSync(outDir)).toBe(false);
    });

    it.each(['{', '{}', '[null]', '[{"slug":"valid","title":1,"description":"Text"}]'])('retains published cards for invalid JSON or records: %s', async (registry) => {
        const root = createTempDir();
        const outDir = path.join(root, 'og');
        const postsPath = path.join(root, 'posts.json');
        const published = path.join(outDir, 'blog/previous.png');
        fs.mkdirSync(path.dirname(published), { recursive: true });
        fs.writeFileSync(published, 'Published image');
        fs.writeFileSync(postsPath, registry);

        await expect(generateOgImages({ outDir, postsPath, pages: [{ slug: 'home', title: 'Home', subtitle: '' }] }))
            .rejects.toThrow();
        expect(fs.readFileSync(published, 'utf8')).toBe('Published image');
        expect(fs.existsSync(path.join(outDir, 'home.svg'))).toBe(false);
    });

    it.each(['page', 'post'])('rejects duplicate %s slugs before writing', async (kind) => {
        const root = createTempDir();
        const postsPath = path.join(root, 'posts.json');
        const card = { slug: 'duplicate', title: 'Title', subtitle: '', description: '' };
        fs.writeFileSync(postsPath, JSON.stringify(kind === 'post' ? [card, card] : []));
        await expect(generateOgImages({ outDir: path.join(root, 'og'), postsPath, pages: kind === 'page' ? [card, card] : [] }))
            .rejects.toThrow(/duplicate/i);
    });

    it.each([
        null,
        { slug: 1, title: 'Title', subtitle: '' },
        { slug: 'Uppercase', title: 'Title', subtitle: '' },
        { slug: 'double--hyphen', title: 'Title', subtitle: '' },
        { slug: 'back\\slash', title: 'Title', subtitle: '' },
        { slug: 'valid', title: ' ', subtitle: '' },
        { slug: 'valid', title: 'Title' },
    ])('rejects invalid page metadata: %j', async (card) => {
        const root = createTempDir();
        await expect(generateOgImages({
            outDir: path.join(root, 'og'), postsPath: path.join(root, 'missing.json'), pages: [card],
        })).rejects.toThrow(/Invalid OG page/);
    });

    it('rejects a page registry that is not an array', async () => {
        const root = createTempDir();
        await expect(generateOgImages({
            outDir: path.join(root, 'og'), postsPath: path.join(root, 'missing.json'), pages: {},
        })).rejects.toThrow(/must be an array/);
    });

    it('rejects a file in place of the output directory', async () => {
        const root = createTempDir();
        const outDir = path.join(root, 'og');
        fs.writeFileSync(outDir, 'Original');
        await expect(generateOgImages({ outDir, postsPath: path.join(root, 'missing.json'), pages: [] }))
            .rejects.toThrow(/must be a directory/);
        expect(fs.readFileSync(outDir, 'utf8')).toBe('Original');
    });

    it.each(['output', 'blog'])('rejects a symbolic link for the %s directory', async (directory) => {
        const root = createTempDir();
        const outDir = path.join(root, 'og');
        const target = path.join(root, 'originals');
        fs.mkdirSync(target);
        fs.writeFileSync(path.join(target, 'previous.svg'), 'Original');
        if (directory === 'blog') fs.mkdirSync(outDir);
        fs.symlinkSync(target, directory === 'blog' ? path.join(outDir, 'blog') : outDir);

        await expect(generateOgImages({ outDir, postsPath: path.join(root, 'missing.json'), pages: [] }))
            .rejects.toThrow(/symbolic link/);
        expect(fs.readFileSync(path.join(target, 'previous.svg'), 'utf8')).toBe('Original');
    });

    it('does not change published cards when another card cannot render', async () => {
        const root = createTempDir();
        const outDir = path.join(root, 'og');
        fs.mkdirSync(outDir);
        fs.writeFileSync(path.join(outDir, 'home.png'), 'Published image');

        await expect(generateOgImages({ outDir, postsPath: path.join(root, 'missing.json'), pages: [
            { slug: 'home', title: 'New home', subtitle: '' },
            { slug: 'invalid', title: 'Invalid\u0000XML', subtitle: '' },
        ] })).rejects.toThrow();
        expect(fs.readFileSync(path.join(outDir, 'home.png'), 'utf8')).toBe('Published image');
    });

    it('retains the previous PNG and stale cards after a partial write fails', async () => {
        const root = createTempDir();
        const outDir = path.join(root, 'og');
        const postsPath = path.join(root, 'posts.json');
        const blogDir = path.join(outDir, 'blog');
        fs.mkdirSync(blogDir, { recursive: true });
        fs.writeFileSync(path.join(blogDir, 'published.png'), 'Published image');
        fs.writeFileSync(path.join(blogDir, 'stale.svg'), 'Stale card');
        fs.writeFileSync(postsPath, JSON.stringify([{ slug: 'published', title: 'New title', description: '' }]));
        const write = fsPromises.writeFile.bind(fsPromises);
        vi.spyOn(fsPromises, 'writeFile').mockImplementation(async (filename, ...args) => {
            if (String(filename).includes('.png.')) {
                await write(filename, 'Partial image');
                throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' });
            }
            return write(filename, ...args);
        });

        await expect(generateOgImages({ outDir, postsPath, pages: [] })).rejects.toMatchObject({ code: 'ENOSPC' });
        expect(fs.readFileSync(path.join(blogDir, 'published.png'), 'utf8')).toBe('Published image');
        expect(fs.readFileSync(path.join(blogDir, 'stale.svg'), 'utf8')).toBe('Stale card');
        expect(fs.readdirSync(blogDir).filter(file => file.endsWith('.tmp'))).toEqual([]);
    });

    it('prunes only stale card files and leaves other files and directories intact', async () => {
        const root = createTempDir();
        const outDir = path.join(root, 'og');
        const blogDir = path.join(outDir, 'blog');
        fs.mkdirSync(path.join(blogDir, 'nested'), { recursive: true });
        for (const file of ['stale.svg', 'stale.png', 'notes.md', 'README.svg', 'nested/keep.svg']) {
            fs.writeFileSync(path.join(blogDir, file), file);
        }
        fs.symlinkSync(path.join(blogDir, 'notes.md'), path.join(blogDir, 'alias.svg'));

        await generateOgImages({ outDir, postsPath: path.join(root, 'missing.json'), pages: [] });
        expect(fs.readdirSync(blogDir).sort()).toEqual(['README.svg', 'alias.svg', 'nested', 'notes.md']);
        expect(fs.readFileSync(path.join(blogDir, 'nested/keep.svg'), 'utf8')).toBe('nested/keep.svg');
    });
});
