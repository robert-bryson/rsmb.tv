/**
 * Blog post metadata and registry.
 *
 * Post metadata lives in posts.json (the single source of truth shared by
 * build scripts like generate-rss.js and generate-sitemap.js).
 * This module adds the compiled MDX component for each post.
 */

import type { ComponentType } from 'react';
import postsMeta from './posts.json';

export interface BlogPostMeta {
    slug: string;
    title: string;
    date: string;
    description: string;
    tags: string[];
}

export interface MdxComponentProps {
    components?: Record<string, unknown>;
}

export interface BlogPost extends BlogPostMeta {
    /** The eagerly imported MDX component for the post body. */
    Component: ComponentType<MdxComponentProps>;
}

// ── Post registry ──────────────────────────────────────────────────
// To add a new post:
//   1. Create src/content/blog/<slug>.mdx with YAML frontmatter
//   2. Add an entry to posts.json with matching slug + metadata
//   MDX components are auto-discovered via import.meta.glob

// Auto-discover MDX files — no manual mapping needed.
// Eager imports avoid the nested "Loading post..." state when a post route opens.
const mdxModules = import.meta.glob<{ default: ComponentType<MdxComponentProps> }>('./blog/*.mdx', {
    eager: true,
});

function missingMdxComponent(slug: string): ComponentType<MdxComponentProps> {
    return function MissingMdxComponent() {
        throw new Error(`No MDX file found for slug: ${slug}`);
    };
}

function postComponent(slug: string): ComponentType<MdxComponentProps> {
    const path = `./blog/${slug}.mdx`;
    return mdxModules[path]?.default ?? missingMdxComponent(slug);
}

const posts: BlogPost[] = postsMeta.map((meta) => ({
    ...meta,
    Component: postComponent(meta.slug),
}));

// Sort newest-first
posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export function getAllPosts(): BlogPostMeta[] {
    return posts.map(({ slug, title, date, description, tags }) => ({ slug, title, date, description, tags }));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
    return posts.find((p) => p.slug === slug);
}
