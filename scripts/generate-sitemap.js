/**
 * Generates a sitemap.xml from static routes and blog posts.
 *
 * Run during build (`npm run build-sitemap`) or as part of the main build.
 * Outputs public/sitemap.xml.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    formatIsoDate,
    loadJsonFile,
    resolveLatestTimestamp,
} from './siteMetadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const POSTS_PATH = path.join(REPO_ROOT, 'src/content/posts.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'public/sitemap.xml');
const SITE_URL = 'https://rsmb.tv';

// Static routes with their priorities
const STATIC_ROUTES = [
    { path: '/', priority: '1.0', changefreq: 'weekly', sources: ['src/pages/Home.tsx', 'src/content/projects.ts'] },
    { path: '/about', priority: '0.8', changefreq: 'monthly', sources: ['src/pages/About.tsx'] },
    { path: '/projects', priority: '0.8', changefreq: 'monthly', sources: ['src/pages/Projects.tsx', 'src/content/projects.ts'] },
    { path: '/projects/through-routes', priority: '0.7', changefreq: 'monthly', sources: ['src/pages/ThroughRoutes.tsx'] },
    { path: '/projects/flights', priority: '0.9', changefreq: 'weekly', sources: ['src/pages/Flights.tsx', 'src/features/flights'] },
    { path: '/projects/anki-artisan', priority: '0.7', changefreq: 'monthly', sources: ['src/pages/AnkiArtisan.tsx'] },
    { path: '/projects/bookend', priority: '0.7', changefreq: 'monthly', sources: ['src/pages/Bookend.tsx'] },
    { path: '/projects/temperature-records', priority: '0.7', changefreq: 'monthly', sources: ['src/pages/TemperatureRecords.tsx', 'src/features/temperatures'] },
    { path: '/projects/route2gpx', priority: '0.7', changefreq: 'monthly', sources: ['src/pages/Route2Gpx.tsx'] },
    { path: '/projects/temperature-records/trends', priority: '0.6', changefreq: 'monthly', sources: ['src/pages/ClimateTrends.tsx', 'src/features/temperatures'] },
    { path: '/blog', priority: '0.7', changefreq: 'weekly', sources: ['src/pages/Blog.tsx', 'src/content/posts.json', 'src/content/blog'] },
];

/**
 * Load post metadata from the shared JSON registry.
 */
export function loadPosts(postsPath = POSTS_PATH) {
    return loadJsonFile(postsPath);
}

export function resolveRouteLastModifiedDate(sources, {
    repoRoot = REPO_ROOT,
    resolveLatestTimestampImpl = resolveLatestTimestamp,
} = {}) {
    const latestTimestamp = resolveLatestTimestampImpl(sources, { repoRoot });

    if (latestTimestamp === undefined) {
        throw new Error(
            `Unable to determine last modified date for sitemap sources: ${sources.join(', ')}`
        );
    }

    return formatIsoDate(latestTimestamp);
}

export function buildSitemapXml(posts, {
    routes = STATIC_ROUTES,
    resolveRouteDate = (sources) => resolveRouteLastModifiedDate(sources),
} = {}) {
    const staticUrls = routes.map(
        (route) => `  <url>
    <loc>${SITE_URL}${route.path}</loc>
    <lastmod>${resolveRouteDate(route.sources)}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
    ).join('\n');

    const postUrls = posts.map(
        (post) => `  <url>
    <loc>${SITE_URL}/blog/${post.slug}</loc>
    <lastmod>${post.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${postUrls}
</urlset>
`;
}

export function generateSitemap({
    postsPath = POSTS_PATH,
    outputPath = OUTPUT_PATH,
    routes = STATIC_ROUTES,
    repoRoot = REPO_ROOT,
    fsImpl = fs,
} = {}) {
    const posts = loadPosts(postsPath);
    const sitemap = buildSitemapXml(posts, {
        routes,
        resolveRouteDate: (sources) => resolveRouteLastModifiedDate(sources, { repoRoot }),
    });

    fsImpl.writeFileSync(outputPath, sitemap, 'utf-8');

    return { outPath: outputPath, count: routes.length + posts.length };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    const { outPath, count } = generateSitemap();
    console.log(`Sitemap generated → ${outPath} (${count} URLs)`);
}
