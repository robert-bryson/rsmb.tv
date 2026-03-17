/**
 * Blog post metadata and registry.
 *
 * Post metadata lives in posts.json (the single source of truth shared by
 * build scripts like generate-rss.js and generate-sitemap.js).
 * This module adds the lazily-loaded MDX component for each post.
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
//   2. Add an entry to posts.json with matching slug + metadata
//   MDX components are auto-discovered via import.meta.glob

import { lazy } from 'react';
import postsMeta from './posts.json';

// Auto-discover MDX files — no manual mapping needed
const mdxModules = import.meta.glob<{ default: React.ComponentType }>('./blog/*.mdx');

function lazyComponent(slug: string): React.LazyExoticComponent<React.ComponentType> {
    const path = `./blog/${slug}.mdx`;
    const loader = mdxModules[path];
    if (!loader) {
        return lazy(() => Promise.reject(new Error(`No MDX file found for slug: ${slug}`)));
    }
    return lazy(() => loader().then((mod) => ({ default: mod.default })));
}

const posts: BlogPost[] = postsMeta.map((meta) => ({
    ...meta,
    Component: lazyComponent(meta.slug),
}));

// Sort newest-first
posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export function getAllPosts(): BlogPostMeta[] {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return posts.map(({ Component, ...meta }) => meta);
}

export function getPostBySlug(slug: string): BlogPost | undefined {
    return posts.find((p) => p.slug === slug);
}
