import { describe, expect, it } from 'vitest';
import { createPostsUrl, getPostType } from '../content/postFilters';

describe('post filter URLs', () => {
    it.each([
        [null, 'all'], ['', 'all'], ['all', 'all'], ['writing', 'writing'], ['trips', 'trips'],
        ['WRITING', 'all'], ['unknown', 'all'],
    ] as const)('reads post type %j as %s', (value, expected) => {
        expect(getPostType(value)).toBe(expected);
    });

    it('omits inactive filters and retains the selected filter combination', () => {
        expect(createPostsUrl()).toBe('/posts');
        expect(createPostsUrl({ type: 'all', query: '' })).toBe('/posts');
        expect(createPostsUrl({ type: 'trips', tag: 'coast', country: 'CA', region: 'british-columbia', query: 'river road' }))
            .toBe('/posts?type=trips&tag=coast&country=CA&region=british-columbia&q=river+road');
    });

    it('encodes search text as one literal parameter without introducing another filter or fragment', () => {
        const query = 'Québec &country=JP#<script>alert(1)</script> + coast';
        const url = new URL(createPostsUrl({ country: 'CA', query }), 'https://rsmb.tv');
        expect(url.origin).toBe('https://rsmb.tv');
        expect(url.pathname).toBe('/posts');
        expect(url.searchParams.get('q')).toBe(query);
        expect(url.searchParams.getAll('country')).toEqual(['CA']);
        expect(url.hash).toBe('');
    });
});
