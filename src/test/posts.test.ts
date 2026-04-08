import { describe, it, expect } from 'vitest';
import postsJson from '../content/posts.json';
import { getAllPosts, getPostBySlug } from '../content/posts';

describe('posts.json schema', () => {
    it('is a non-empty array', () => {
        expect(Array.isArray(postsJson)).toBe(true);
        expect(postsJson.length).toBeGreaterThan(0);
    });

    it('each post has required fields', () => {
        for (const post of postsJson) {
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
        for (const post of postsJson) {
            expect(new Date(post.date).toString()).not.toBe('Invalid Date');
        }
    });

    it('slugs are unique', () => {
        const slugs = postsJson.map(p => p.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });
});

describe('posts registry', () => {
    it('getAllPosts returns metadata without Component', () => {
        const all = getAllPosts();
        expect(all.length).toBeGreaterThan(0);
        for (const post of all) {
            expect(post).toHaveProperty('slug');
            expect(post).not.toHaveProperty('Component');
        }
    });

    it('getPostBySlug finds existing post', () => {
        const post = getPostBySlug('building-through-routes');
        expect(post).toBeDefined();
        expect(post?.title).toBe('Building Through Routes: Scoring Roads for Scenic Motorcycle Loops');
        expect(post?.Component).toBeDefined();
    });

    it('getPostBySlug returns undefined for missing slug', () => {
        expect(getPostBySlug('nonexistent')).toBeUndefined();
    });
});
