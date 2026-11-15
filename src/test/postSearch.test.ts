import { describe, expect, it } from 'vitest';
import { searchPosts } from '../content/postSearch';
import type { BlogPostMeta } from '../content/posts';

const posts: BlogPostMeta[] = [
    {
        slug: 'quebec', title: 'Riding through Québec', date: '2026-06-01',
        description: 'A motorcycle journey along the Saint-Lawrence River.', tags: ['road-trip'],
        countries: [{ code: 'CA', regions: ['Québec', 'New Brunswick'] }],
        series: { id: 'eastern-roads', title: 'Eastern Roads', order: 1 },
    },
    {
        slug: 'maps', title: 'Mapping weather', date: '2026-05-01',
        description: 'An exploration of temperature records.', tags: ['data-viz'],
        countries: [{ code: 'US', regions: ['Washington'] }],
    },
    {
        slug: 'routing', title: 'React routing', date: '2026-04-01',
        description: 'Client-side navigation and browser history.', tags: [],
    },
];

describe('post search', () => {
    it.each(['', '   ', '…'])('retains every post for an empty keyword query %j', query => {
        expect(searchPosts(posts, query)).toBe(posts);
    });

    it.each([
        ['QUEBEC', ['quebec']],
        ['QuéBeC', ['quebec']],
        ['  saint lawrence  ', ['quebec']],
        ['road trip', ['quebec']],
        ['Canada', ['quebec']],
        ['New Brunswick', ['quebec']],
        ['eastern roads', ['quebec']],
        ['US', ['maps']],
        ['washington records', ['maps']],
        ['weather DATA viz', ['maps']],
        ['client side', ['routing']],
        ['quebec weather', []],
        ['[weather]', ['maps']],
        ['not-found', []],
    ])('matches metadata for %j', (query, slugs) => {
        expect(searchPosts(posts, query).map(post => post.slug)).toEqual(slugs);
    });

    it('preserves chronological order and the original metadata', () => {
        const before = structuredClone(posts);
        const result = searchPosts(posts, 'r');
        expect(result.map(post => post.slug)).toEqual(['quebec', 'maps', 'routing']);
        expect(result[0]).toBe(posts[0]);
        expect(posts).toEqual(before);
    });
});
