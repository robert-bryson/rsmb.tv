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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../public/og');
const POSTS_PATH = path.join(__dirname, '../src/content/posts.json');

export const DEFAULT_PAGES = [
    { slug: 'home', title: 'rsmb', subtitle: 'Interactive data visualizations, geospatial projects, and web tools' },
    { slug: 'about', title: 'About', subtitle: 'Robby Bryson — software developer and geospatial engineer' },
    { slug: 'blog', title: 'Posts', subtitle: 'Writing, motorcycle journeys, and things I find interesting' },
    { slug: 'trips', title: 'Trips', subtitle: 'Motorcycle journeys told through photographs, routes, and field notes' },
    { slug: 'projects', title: 'Projects', subtitle: 'Interactive data visualizations, geospatial tools, and more' },
    { slug: 'adv-atlas', title: 'ADV Atlas', subtitle: 'Motorcycle journeys through route maps, photographs, and trip reports' },
    { slug: 'through-routes', title: 'Through Routes', subtitle: 'Find scenic, twisty motorcycle loop routes on rural roads' },
    { slug: 'flights', title: 'Flights', subtitle: 'Interactive 3D globe visualization of flights around the world' },
    { slug: 'anki-artisan', title: 'Anki Artisan', subtitle: 'Generate Anki flashcard decks from iNaturalist and eBird data' },
    { slug: 'aborg', title: 'aborg', subtitle: 'Organize audiobook collections for Audiobookshelf' },
    { slug: 'parc', title: 'parc', subtitle: 'Archive podcast feeds with resumable downloads and SQLite state' },
    { slug: 'bookend', title: 'Bookend', subtitle: 'A personal book-tracking app with reading stats and enrichment' },
    { slug: 'temperature-records', title: 'U.S. Temperature Records', subtitle: 'Explore recent record events, county extremes, and standing record ages' },
    { slug: 'tornado-tracks', title: 'Tornado Tracks', subtitle: 'Historical tornado track map with timeline playback and EF-scale filters' },
    { slug: 'climate-trends', title: 'Standing Record Ages', subtitle: 'When were today’s county temperature extremes set?' },
    { slug: 'route2gpx', title: 'route2gpx', subtitle: 'Plan routes and export GPX, KML, GeoJSON, TCX, or CSV' },
    { slug: 'status-dashboard', title: 'Status Dashboard', subtitle: 'Live terminal monitoring for AWS infrastructure, GitHub CI, and site health' },
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

export function loadBlogPosts(postsPath = POSTS_PATH, { fsImpl = fs } = {}) {
    if (!fsImpl.existsSync(postsPath)) return [];
    return JSON.parse(fsImpl.readFileSync(postsPath, 'utf-8'));
}

export async function generateOgImages({
    outDir = OUT_DIR,
    postsPath = POSTS_PATH,
    pages = DEFAULT_PAGES,
    fsImpl = fs,
} = {}) {
    fsImpl.mkdirSync(outDir, { recursive: true });

    async function writeCard(directory, slug, card) {
        const svg = generateSvg(card);
        fsImpl.writeFileSync(path.join(directory, `${slug}.svg`), svg, 'utf-8');
        fsImpl.writeFileSync(path.join(directory, `${slug}.png`), await sharp(Buffer.from(svg)).png().toBuffer());
    }

    for (const page of pages) {
        await writeCard(outDir, page.slug, page);
    }

    const blogDir = path.join(outDir, 'blog');
    fsImpl.rmSync(blogDir, { recursive: true, force: true });
    fsImpl.mkdirSync(blogDir, { recursive: true });

    const posts = loadBlogPosts(postsPath, { fsImpl });
    for (const post of posts) {
        await writeCard(blogDir, post.slug, { title: post.title, subtitle: post.description });
    }

    return { outDir, pageCount: pages.length, blogPostCount: posts.length };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    const { outDir, pageCount, blogPostCount } = await generateOgImages();
    console.log(`OG images generated → ${outDir} (${pageCount} pages + ${blogPostCount} blog posts)`);
}
