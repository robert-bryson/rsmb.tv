/**
 * Generates a sitemap.xml from static routes and blog posts.
 *
 * Run during build (`npm run build-sitemap`) or as part of the main build.
 * Outputs public/sitemap.xml.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://rsmb.tv';

// Static routes with their priorities
const STATIC_ROUTES = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/about', priority: '0.8', changefreq: 'monthly' },
    { path: '/projects', priority: '0.8', changefreq: 'monthly' },
    { path: '/projects/flights', priority: '0.9', changefreq: 'weekly' },
    { path: '/projects/anki-artisan', priority: '0.7', changefreq: 'monthly' },
    { path: '/blog', priority: '0.7', changefreq: 'weekly' },
];

/**
 * Extract blog posts from the registry (same approach as generate-rss.js).
 */
function extractPosts() {
    const postsFile = fs.readFileSync(
        path.join(__dirname, '../src/content/posts.ts'),
        'utf-8'
    );

    const postRegex = /\{\s*slug:\s*'([^']+)',\s*title:\s*'([^']+)',\s*date:\s*'([^']+)',\s*description:\s*\n?\s*'([^']+)'/g;
    const posts = [];
    let match;

    while ((match = postRegex.exec(postsFile)) !== null) {
        posts.push({
            slug: match[1],
            date: match[3],
        });
    }

    return posts;
}

function generateSitemap() {
    const posts = extractPosts();
    const today = new Date().toISOString().split('T')[0];

    const staticUrls = STATIC_ROUTES.map(
        (route) => `  <url>
    <loc>${SITE_URL}${route.path}</loc>
    <lastmod>${today}</lastmod>
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

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${postUrls}
</urlset>
`;

    const outPath = path.join(__dirname, '../public/sitemap.xml');
    fs.writeFileSync(outPath, sitemap, 'utf-8');
    console.log(`Sitemap generated → ${outPath} (${STATIC_ROUTES.length + posts.length} URLs)`);
}

generateSitemap();
