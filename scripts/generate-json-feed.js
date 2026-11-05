import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEED_SITE, loadFeedPosts, postUrl } from './feedMetadata.js';
import { filterPublishedPosts, sortByDateDescending } from './siteMetadata.js';

/** Publish summaries, with canonical URLs as stable item identities. */
export function buildJsonFeed(posts) {
    return {
        version: 'https://jsonfeed.org/version/1.1',
        title: FEED_SITE.title,
        description: FEED_SITE.description,
        home_page_url: FEED_SITE.url,
        feed_url: `${FEED_SITE.url}/feed.json`,
        language: FEED_SITE.language,
        authors: [{ name: FEED_SITE.authorName, url: FEED_SITE.url }],
        icon: `${FEED_SITE.url}/icon-512.png`,
        favicon: `${FEED_SITE.url}/icon-192.png`,
        items: sortByDateDescending(filterPublishedPosts(posts)).map(post => ({
            id: postUrl(post),
            url: postUrl(post),
            title: post.title,
            content_text: post.description,
            date_published: new Date(`${post.date}T00:00:00Z`).toISOString(),
        })),
    };
}

export function generateJsonFeed({
    postsPath = fileURLToPath(new URL('../src/content/posts.json', import.meta.url)),
    outputPath = fileURLToPath(new URL('../public/feed.json', import.meta.url)),
} = {}) {
    const feed = buildJsonFeed(loadFeedPosts(postsPath));
    fs.writeFileSync(outputPath, JSON.stringify(feed, null, 2) + '\n');
    return { outPath: outputPath, count: feed.items.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { outPath, count } = generateJsonFeed();
    console.log(`JSON Feed generated → ${outPath} (${count} post(s))`);
}
