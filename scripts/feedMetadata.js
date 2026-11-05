import { fileURLToPath } from 'node:url';
import { filterPublishedPosts, loadJsonFile, sortByDateDescending } from './siteMetadata.js';

export const FEED_SITE = {
    url: 'https://rsmb.tv',
    title: 'rsmb',
    description: 'Summaries of writing and trip stories by Robby Bryson — projects, engineering, maps, and things I find interesting.',
    language: 'en-US',
    authorName: 'Robby Bryson',
};

export function postUrl(post) {
    return `${FEED_SITE.url}/${post.format === 'trip' ? 'trips' : 'blog'}/${post.slug}`;
}

export function loadFeedPosts(postsPath = fileURLToPath(new URL('../src/content/posts.json', import.meta.url))) {
    return sortByDateDescending(filterPublishedPosts(loadJsonFile(postsPath, { defaultValue: [] })));
}
