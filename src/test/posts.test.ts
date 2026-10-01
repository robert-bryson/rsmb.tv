import { describe, it, expect, vi } from 'vitest';
import { getAllPosts, getPostBySlug } from '../content/posts';
import { filterPostsByTag, getAllBlogTags } from '../content/blogTags';

vi.mock('virtual:post-content', () => ({
    metadata: [
        { slug: 'boise', title: 'Boise', date: '2024-05-19', description: 'Trip', tags: ['motorcycle'], format: 'trip', tripId: 'boise-2024' },
        { slug: 'already-tagged', title: 'Tagged', date: '2024-05-18', description: 'Trip', tags: ['honda-cb500x'], format: 'trip', tripId: 'boise-2024' },
        { slug: 'no-motorcycle', title: 'Other trip', date: '2024-05-17', description: 'Trip', tags: [], format: 'trip', tripId: 'other' },
        { slug: 'writing', title: 'Writing', date: '2024-05-16', description: 'Post', tags: [], tripId: 'boise-2024' },
    ],
    mdxLoaders: {},
}));

vi.mock('virtual:trip-content', () => ({
    summaries: { 'boise-2024': { motorcycle: '  Honda  CB500X  ', regions: [' New  Mexico ', 'Oregon', 'Oregon'] }, other: {} },
}));

describe('trip fact tags', () => {
    it('includes each trip in the filters linked from its facts', () => {
        for (const tag of ['motorcycle', 'new-mexico', 'oregon']) {
            expect(filterPostsByTag(getAllPosts(), tag).map(post => post.slug)).toEqual(['boise', 'already-tagged']);
        }
    });
    it('lists and filters trip reports by their normalized motorcycle model', () => {
        const posts = getAllPosts();
        expect(getAllBlogTags(posts)).toContain('honda-cb500x');
        expect(filterPostsByTag(posts, 'honda-cb500x').map(post => post.slug)).toEqual(['boise', 'already-tagged']);
        expect(getPostBySlug('boise')?.tags).toEqual(['motorcycle', 'honda-cb500x', 'new-mexico', 'oregon']);
    });

    it('preserves explicit tags without duplicates and leaves other posts unchanged', () => {
        expect(getPostBySlug('already-tagged')?.tags).toEqual(['honda-cb500x', 'motorcycle', 'new-mexico', 'oregon']);
        expect(getPostBySlug('no-motorcycle')?.tags).toEqual([]);
        expect(getPostBySlug('writing')?.tags).toEqual([]);
    });
});

describe('generated post registry schema', () => {
    it('each post has required fields', () => {
        for (const post of getAllPosts()) {
            expect(post).toHaveProperty('slug');
            expect(post).toHaveProperty('title');
            expect(post).toHaveProperty('date');
            expect(post).toHaveProperty('description');
            expect(post).toHaveProperty('tags');
            expect(typeof post.slug).toBe('string');
            expect(typeof post.title).toBe('string');
            expect(typeof post.date).toBe('string');
            expect(typeof post.description).toBe('string');
            expect(Array.isArray(post.tags)).toBe(true);
        }
    });

    it('dates are valid ISO format', () => {
        for (const post of getAllPosts()) {
            expect(new Date(post.date).toString()).not.toBe('Invalid Date');
        }
    });

    it('slugs are unique', () => {
        const slugs = getAllPosts().map(p => p.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });
});

describe('posts registry', () => {
    it('getAllPosts returns metadata without Component', () => {
        const all = getAllPosts();
        expect(Array.isArray(all)).toBe(true);
        for (const post of all) {
            expect(post).toHaveProperty('slug');
            expect(post).not.toHaveProperty('Component');
        }
    });

    it('getPostBySlug finds generated posts when they exist', () => {
        const [firstPost] = getAllPosts();
        if (!firstPost) {
            expect(getPostBySlug('nonexistent')).toBeUndefined();
            return;
        }

        const post = getPostBySlug(firstPost.slug);
        expect(post).toBeDefined();
        expect(post?.title).toBe(firstPost.title);
        expect(post?.loadComponent).toBeTypeOf('function');
        expect(post?.Component).toBeDefined();
    });

    it('getPostBySlug returns undefined for missing slug', () => {
        expect(getPostBySlug('nonexistent')).toBeUndefined();
    });
});
