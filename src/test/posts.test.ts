import { describe, it, expect } from 'vitest';
import { getAllPosts, getPostBySlug } from '../content/posts';

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
