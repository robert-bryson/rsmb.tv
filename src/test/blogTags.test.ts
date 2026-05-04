import { describe, expect, it } from 'vitest';
import { createBlogTagSearch, filterPostsByTag, getAllBlogTags } from '../content/blogTags';

const posts = [
    { slug: 'mapping', tags: ['Maps', 'Data Viz'] },
    { slug: 'weather', tags: ['Weather', 'Maps'] },
    { slug: 'react', tags: ['React'] },
];

describe('blog tag helpers', () => {
    it('returns unique tags in a stable display order', () => {
        expect(getAllBlogTags(posts)).toEqual(['Data Viz', 'Maps', 'React', 'Weather']);
    });

    it('filters posts by an exact tag and treats blank tags as no filter', () => {
        expect(filterPostsByTag(posts, 'Maps').map((post) => post.slug)).toEqual(['mapping', 'weather']);
        expect(filterPostsByTag(posts, '  ').map((post) => post.slug)).toEqual(['mapping', 'weather', 'react']);
    });

    it('builds encoded URL search strings for tag links', () => {
        expect(createBlogTagSearch('Data Viz')).toBe('?tag=Data+Viz');
        expect(createBlogTagSearch('')).toBe('');
    });
});
