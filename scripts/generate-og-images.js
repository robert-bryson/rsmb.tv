/**
 * Generates Open Graph images for project pages.
 *
 * Creates simple SVG-based OG images (1200x630) for each project.
 * Outputs to public/og/ so they're available at /og/<slug>.svg.
 *
 * Run: node scripts/generate-og-images.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../public/og');
const POSTS_PATH = path.join(__dirname, '../src/content/posts.json');

export const DEFAULT_PAGES = [
    { slug: 'home', title: 'rsmb', subtitle: 'Interactive data visualizations, geospatial projects, and web tools' },
    { slug: 'about', title: 'About', subtitle: 'Robby Bryson — software developer and geospatial engineer' },
    { slug: 'blog', title: 'Blog', subtitle: 'Thoughts on projects, engineering, and things I find interesting' },
    { slug: 'projects', title: 'Projects', subtitle: 'Interactive data visualizations, geospatial tools, and more' },
    { slug: 'through-routes', title: 'Through Routes', subtitle: 'Find scenic, twisty motorcycle loop routes on rural roads' },
    { slug: 'flights', title: 'Flights', subtitle: 'Interactive 3D globe visualization of flights around the world' },
    { slug: 'anki-artisan', title: 'Anki Artisan', subtitle: 'Generate Anki flashcard decks from iNaturalist and eBird data' },
    { slug: 'bookend', title: 'Bookend', subtitle: 'A personal book-tracking app with reading stats and enrichment' },
    { slug: 'temperature-records', title: 'Record Highs', subtitle: 'Interactive map of all-time record temperatures across US counties' },
    { slug: 'tornado-tracks', title: 'Tornado Tracks', subtitle: 'Historical tornado track map with timeline playback and EF-scale filters' },
    { slug: 'climate-trends', title: 'Climate Trends', subtitle: 'Are temperature records being broken more frequently?' },
    { slug: 'route2gpx', title: 'route2gpx', subtitle: 'Convert Google Routes into GPX files for GPS devices' },
];

export function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function generateSvg({ title, subtitle }) {
    return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0a0a0a"/>
  <rect x="0" y="0" width="1200" height="4" fill="#7c3aed"/>
  <text x="80" y="260" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="600" fill="#f4f4f5">${escapeXml(title)}</text>
  <text x="80" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="#a1a1aa">${escapeXml(subtitle)}</text>
  <text x="80" y="560" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="#52525b">rsmb.tv</text>
</svg>`;
}

export function loadBlogPosts(postsPath = POSTS_PATH, { fsImpl = fs } = {}) {
    if (!fsImpl.existsSync(postsPath)) return [];
    return JSON.parse(fsImpl.readFileSync(postsPath, 'utf-8'));
}

export function generateOgImages({
    outDir = OUT_DIR,
    postsPath = POSTS_PATH,
    pages = DEFAULT_PAGES,
    fsImpl = fs,
} = {}) {
    fsImpl.mkdirSync(outDir, { recursive: true });

    for (const page of pages) {
        const svg = generateSvg(page);
        const outPath = path.join(outDir, `${page.slug}.svg`);
        fsImpl.writeFileSync(outPath, svg, 'utf-8');
    }

    const blogDir = path.join(outDir, 'blog');
    fsImpl.rmSync(blogDir, { recursive: true, force: true });
    fsImpl.mkdirSync(blogDir, { recursive: true });

    const posts = loadBlogPosts(postsPath, { fsImpl });
    for (const post of posts) {
        const svg = generateSvg({ title: post.title, subtitle: post.description });
        const outPath = path.join(blogDir, `${post.slug}.svg`);
        fsImpl.writeFileSync(outPath, svg, 'utf-8');
    }

    return { outDir, pageCount: pages.length, blogPostCount: posts.length };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    const { outDir, pageCount, blogPostCount } = generateOgImages();
    console.log(`OG images generated → ${outDir} (${pageCount} pages + ${blogPostCount} blog posts)`);
}
