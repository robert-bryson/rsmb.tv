import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getAllPosts, getPostBySlug } from '../content/posts';
import { filterPostsByTag, getAllBlogTags } from '../content/blogTags';

vi.mock('virtual:post-content', () => ({
    metadata: [
        { slug: 'boise', title: 'Boise', date: '2024-05-19', description: 'Trip', tags: ['motorcycle'], format: 'trip', tripId: 'boise-2024',
            series: { id: 'rides', title: 'Rides', order: 1 },
            development: { published: false, rowNumber: 2, issues: ['Missing content'], contentAvailable: false } },
        { slug: 'already-tagged', title: 'Tagged', date: '2024-05-18', description: 'Trip', tags: ['honda-cb500x'], format: 'trip', tripId: 'boise-2024' },
        { slug: 'no-motorcycle', title: 'Other trip', date: '2024-05-17', description: 'Trip', tags: [], format: 'trip', tripId: 'other' },
        { slug: 'writing', title: 'Writing', date: '2024-05-16', description: 'Post', tags: [], tripId: 'boise-2024' },
    ],
    mdxLoaders: { './blog/writing.mdx': async () => ({ default: () => 'Writing body' }) },
}));

vi.mock('virtual:trip-content', () => ({
    summaries: { 'boise-2024': {
        motorcycle: '  Honda  CB500X  ', regions: [' New  Mexico ', 'Oregon', 'Oregon'],
        countries: [{ code: 'US', regions: ['New Mexico', 'Oregon'] }, { code: 'CA', regions: ['British Columbia'] }],
    }, other: {} },
}));

describe('trip fact tags', () => {
    it('includes each trip in the filters linked from its facts', () => {
        for (const tag of ['motorcycle', 'new-mexico', 'oregon', 'us', 'ca', 'british-columbia']) {
            expect(filterPostsByTag(getAllPosts(), tag).map(post => post.slug)).toEqual(['boise', 'already-tagged']);
        }
    });
    it('lists and filters trip reports by their normalized motorcycle model', () => {
        const posts = getAllPosts();
        expect(getAllBlogTags(posts)).toContain('honda-cb500x');
        expect(filterPostsByTag(posts, 'honda-cb500x').map(post => post.slug)).toEqual(['boise', 'already-tagged']);
        expect(getPostBySlug('boise')?.tags).toEqual(['motorcycle', 'honda-cb500x', 'new-mexico', 'oregon', 'us', 'ca', 'british-columbia']);
    });

    it('preserves explicit tags without duplicates and leaves other posts unchanged', () => {
        expect(getPostBySlug('already-tagged')?.tags).toEqual(['honda-cb500x', 'motorcycle', 'new-mexico', 'oregon', 'us', 'ca', 'british-columbia']);
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
    it('retains series and development metadata for navigation and publication status', () => {
        expect(getAllPosts().find(post => post.slug === 'boise')).toMatchObject({
            series: { id: 'rides', title: 'Rides', order: 1 },
            development: { published: false, rowNumber: 2, issues: ['Missing content'], contentAvailable: false },
        });
    });

    it('loads the generated article body', async () => {
        const content = await getPostBySlug('writing')!.loadComponent();
        expect(renderToStaticMarkup(createElement(content.default))).toBe('Writing body');
    });

    it('reports the affected slug when generated content is absent', async () => {
        const content = await getPostBySlug('boise')!.loadComponent();
        expect(() => renderToStaticMarkup(createElement(content.default)))
            .toThrow('No MDX file found for slug: boise');
    });

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
