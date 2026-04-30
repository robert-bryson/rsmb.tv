/**
 * Generates an RSS 2.0 feed from the blog post registry.
 *
 * Run during build (`npm run build-rss`) or as part of the main build.
 * Outputs public/rss.xml so it's available at /rsmb.tv/rss.xml.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    formatRssDate,
    loadJsonFile,
    resolveLatestTimestamp,
    sortByDateDescending,
} from './siteMetadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const POSTS_PATH = path.join(REPO_ROOT, 'src/content/posts.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'public/rss.xml');
const FEED_SOURCES = ['src/content/posts.json', 'src/content/blog'];
const SITE_URL = 'https://rsmb.tv';
const SITE_TITLE = 'rsmb';
const SITE_DESCRIPTION = 'Personal site and blog by Robert Bryson — projects, engineering, and things I find interesting.';

/**
 * Load post metadata from the shared JSON registry.
 */
export function loadPosts(postsPath = POSTS_PATH) {
    return sortByDateDescending(loadJsonFile(postsPath, { defaultValue: [] }));
}

function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function resolveFeedBuildDate(posts, {
    repoRoot = REPO_ROOT,
    resolveLatestTimestampImpl = resolveLatestTimestamp,
} = {}) {
    const latestTimestamp = resolveLatestTimestampImpl(FEED_SOURCES, { repoRoot });

    if (latestTimestamp !== undefined) {
        return formatRssDate(latestTimestamp);
    }

    if (posts[0]?.date) {
        return formatRssDate(Date.parse(`${posts[0].date}T00:00:00Z`));
    }

    return formatRssDate(0);
}

export function buildRssXml(posts, buildDate = resolveFeedBuildDate(posts)) {
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

    return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

export function generateRss({
    postsPath = POSTS_PATH,
    outputPath = OUTPUT_PATH,
    repoRoot = REPO_ROOT,
    fsImpl = fs,
} = {}) {
    const posts = loadPosts(postsPath);
    const rss = buildRssXml(posts, resolveFeedBuildDate(posts, { repoRoot }));

    fsImpl.writeFileSync(outputPath, rss, 'utf-8');

    return { outPath: outputPath, count: posts.length };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    const { outPath, count } = generateRss();
    console.log(`RSS feed generated → ${outPath} (${count} post(s))`);
}
