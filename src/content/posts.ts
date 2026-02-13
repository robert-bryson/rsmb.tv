/**
 * Blog post metadata and registry.
 *
 * Each MDX file in content/blog/ exports `frontmatter` via remark-mdx-frontmatter.
 * This module provides a typed registry so pages can list / look up posts.
 */

export interface BlogPostMeta {
    slug: string;
    title: string;
    date: string;
    description: string;
    tags: string[];
}

export interface BlogPost extends BlogPostMeta {
    /** The lazily-loaded MDX component for the post body. */
    Component: React.LazyExoticComponent<React.ComponentType>;
}

// ── Post registry ──────────────────────────────────────────────────
// To add a new post:
//   1. Create src/content/blog/<slug>.mdx with YAML frontmatter
//   2. Add an entry here with matching slug + metadata
//   3. The MDX file is lazy-loaded automatically

import { lazy } from 'react';

const posts: BlogPost[] = [
    {
        slug: 'hello-world',
        title: 'Hello World',
        date: '2025-01-01',
        description:
            'Welcome to my blog — a space for writing about projects, engineering, and things I find interesting.',
        tags: ['meta'],
        Component: lazy(() => import('./blog/hello-world.mdx')),
    },
];

// Sort newest-first
posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export function getAllPosts(): BlogPostMeta[] {
    return posts.map(({ Component: _, ...meta }) => meta);
}

export function getPostBySlug(slug: string): BlogPost | undefined {
    return posts.find((p) => p.slug === slug);
}
