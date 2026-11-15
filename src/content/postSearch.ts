import { getCountryName } from './blogRegions';
import type { BlogPostMeta } from './posts';

type SearchablePost = Pick<BlogPostMeta, 'title' | 'description' | 'tags' | 'countries' | 'series'>;

function normalizeSearch(value: string): string {
    return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Match every keyword against metadata without downloading article bodies. */
export function searchPosts<Post extends SearchablePost>(posts: Post[], query: string): Post[] {
    const terms = normalizeSearch(query).split(' ').filter(Boolean);
    if (!terms.length) return posts;

    return posts.filter(post => {
        const places = post.countries?.flatMap(country => [
            country.code, getCountryName(country.code), ...country.regions,
        ]) ?? [];
        const text = normalizeSearch([
            post.title, post.description, ...post.tags, ...places, post.series?.title ?? '',
        ].join(' '));
        return terms.every(term => text.includes(term));
    });
}
