/**
 * Generates an RSS 2.0 feed from the blog post registry.
 *
 * Run during build (`npm run build-rss`) or as part of the main build.
 * Outputs public/rss.xml so it's available at /rsmb.tv/rss.xml.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://rsmb.tv';
const SITE_TITLE = 'rsmb';
const SITE_DESCRIPTION = 'Personal site and blog by Robert Bryson — projects, engineering, and things I find interesting.';

/**
 * Load post metadata from the shared JSON registry.
 */
function loadPosts() {
    const raw = fs.readFileSync(
        path.join(__dirname, '../src/content/posts.json'),
        'utf-8'
    );
    const posts = JSON.parse(raw);
    // Sort newest first
    posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return posts;
}

function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function generateRss() {
    const posts = loadPosts();

    const items = posts
        .map(
            (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${SITE_URL}/blog/${post.slug}</link>
      <guid>${SITE_URL}/blog/${post.slug}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(post.date + 'T00:00:00Z').toUTCString()}</pubDate>
    </item>`
        )
        .join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

    const outPath = path.join(__dirname, '../public/rss.xml');
    fs.writeFileSync(outPath, rss, 'utf-8');
    console.log(`RSS feed generated → ${outPath} (${posts.length} post(s))`);
}

generateRss();
