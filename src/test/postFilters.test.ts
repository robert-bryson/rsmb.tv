import { describe, expect, it } from 'vitest';
import { createPostsUrl, getPostType, withPostSearchQuery } from '../content/postFilters';

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

    it('replaces or clears every query value without changing the source or unrelated parameters', () => {
        const source = new URLSearchParams('type=writing&q=stale&q=duplicate&source=one&source=two');
        const updated = withPostSearchQuery(source, 'weather maps ');
        expect(updated.getAll('q')).toEqual(['weather maps ']);
        expect(updated.getAll('source')).toEqual(['one', 'two']);
        expect(source.getAll('q')).toEqual(['stale', 'duplicate']);
        const cleared = withPostSearchQuery(updated, '');
        expect(cleared.has('q')).toBe(false);
        expect(cleared.get('type')).toBe('writing');
        expect(cleared.getAll('source')).toEqual(['one', 'two']);
        expect(updated.get('q')).toBe('weather maps ');
    });
});
