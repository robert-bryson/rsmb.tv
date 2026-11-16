/**
 * Generates Open Graph images for project pages.
 *
 * Creates PNG social cards (1200x630), with SVG sources, for pages and posts.
 * Outputs to public/og/ so they're available at /og/<slug>.png.
 *
 * Run: node scripts/generate-og-images.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { projects } from '../src/content/projects.ts';
import { writeAtomically } from './atomic-write.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../public/og');
const POSTS_PATH = path.join(__dirname, '../src/content/posts.json');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DEFAULT_PAGES = [
    { slug: 'home', title: 'rsmb', subtitle: 'Interactive data visualizations, geospatial projects, and web tools' },
    { slug: 'about', title: 'About', subtitle: 'Robby Bryson — software developer and geospatial engineer' },
    { slug: 'blog', title: 'Posts', subtitle: 'Writing, motorcycle journeys, and things I find interesting' },
    { slug: 'trips', title: 'Trips', subtitle: 'Motorcycle journeys told through photographs, routes, and field notes' },
    { slug: 'projects', title: 'Projects', subtitle: 'Interactive data visualizations, geospatial tools, and more' },
    ...projects.map(({ slug, title, summary, description }) => ({ slug, title, subtitle: summary ?? description })),
    { slug: 'climate-trends', title: 'Standing Record Ages', subtitle: 'When were today’s county temperature extremes set?' },
];

export function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function generateSvg({ title, subtitle }) {
    const textLines = (text, limit, maxLines) => {
        const lines = [''];
        for (const word of text.split(/\s+/)) {
            const line = lines.length - 1;
            if (lines[line] && lines[line].length + word.length + 1 > limit) lines.push(word);
            else lines[line] += `${lines[line] ? ' ' : ''}${word}`;
        }
        const clipped = lines.slice(0, maxLines).map(line => line.length > limit ? `${line.slice(0, limit - 1)}…` : line);
        if (lines.length > maxLines) clipped[maxLines - 1] = `${clipped[maxLines - 1].slice(0, limit - 1)}…`;
        return clipped;
    };
    const titleLines = textLines(title, 30, 3).map((line, i) => `<tspan x="80" y="${210 + i * 68}">${escapeXml(line)}</tspan>`).join('');
    const subtitleLines = textLines(subtitle, 62, 3).map((line, i) => `<tspan x="80" y="${410 + i * 36}">${escapeXml(line)}</tspan>`).join('');
    return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0a0a0a"/>
  <rect x="0" y="0" width="1200" height="4" fill="#7c3aed"/>
  <text font-family="sans-serif" font-size="60" font-weight="600" fill="#f4f4f5">${titleLines}</text>
  <text font-family="sans-serif" font-size="28" fill="#a1a1aa">${subtitleLines}</text>
  <text x="80" y="560" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="#52525b">rsmb.tv</text>
</svg>`;
}

export function loadBlogPosts(postsPath = POSTS_PATH) {
    let content;
    try {
        content = fs.readFileSync(postsPath, 'utf-8');
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
    return JSON.parse(content);
}

function validateCards(cards, kind) {
    if (!Array.isArray(cards)) throw new Error(`OG ${kind} registry must be an array`);
    const slugs = new Set();
    for (const card of cards) {
        if (!card || typeof card.slug !== 'string' || !SLUG_PATTERN.test(card.slug)) {
            throw new Error(`Invalid OG ${kind} slug`);
        }
        if (slugs.has(card.slug)) throw new Error(`Duplicate OG ${kind} slug: ${card.slug}`);
        slugs.add(card.slug);
        if (typeof card.title !== 'string' || !card.title.trim() || typeof card.subtitle !== 'string') {
            throw new Error(`Invalid OG ${kind} text: ${card.slug}`);
        }
    }
}

function checkOutputDirectory(directory) {
    const entry = fs.lstatSync(directory, { throwIfNoEntry: false });
    if (entry?.isSymbolicLink()) throw new Error('OG output directory must not be a symbolic link');
    if (entry && !entry.isDirectory()) throw new Error('OG output path must be a directory');
}

export async function generateOgImages({
    outDir = OUT_DIR,
    postsPath = POSTS_PATH,
    pages = DEFAULT_PAGES,
} = {}) {
    const posts = loadBlogPosts(postsPath);
    if (!Array.isArray(posts)) throw new Error('OG post registry must be an array');
    const blogCards = posts.map(post => ({ slug: post?.slug, title: post?.title, subtitle: post?.description }));
    validateCards(pages, 'page');
    validateCards(blogCards, 'post');

    const blogDir = path.join(outDir, 'blog');
    checkOutputDirectory(outDir);
    checkOutputDirectory(blogDir);

    // Render the complete batch before changing any published file.
    const rendered = [];
    for (const [directory, cards] of [[outDir, pages], [blogDir, blogCards]]) {
        for (const card of cards) {
            const svg = generateSvg(card);
            const png = await sharp(Buffer.from(svg)).png().toBuffer();
            rendered.push({ directory, slug: card.slug, svg, png });
        }
    }

    fs.mkdirSync(blogDir, { recursive: true });
    for (const { directory, slug, svg, png } of rendered) {
        await writeAtomically(path.join(directory, `${slug}.svg`), svg);
        await writeAtomically(path.join(directory, `${slug}.png`), png);
    }

    // Remove only stale generated cards, after every required write succeeds.
    const currentSlugs = new Set(blogCards.map(card => card.slug));
    for (const entry of fs.readdirSync(blogDir, { withFileTypes: true })) {
        const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(?:svg|png)$/.exec(entry.name);
        if (entry.isFile() && match && !currentSlugs.has(match[1])) {
            fs.unlinkSync(path.join(blogDir, entry.name));
        }
    }

    return { outDir, pageCount: pages.length, blogPostCount: posts.length };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    const { outDir, pageCount, blogPostCount } = await generateOgImages();
    console.log(`OG images generated → ${outDir} (${pageCount} pages + ${blogPostCount} blog posts)`);
}
