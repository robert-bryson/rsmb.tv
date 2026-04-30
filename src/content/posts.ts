/**
 * Blog post metadata and registry.
 *
 * Blog post metadata and MDX files are generated from Google Sheets/Docs before
 * local dev and production builds. A fresh clone can still typecheck/test before
 * generation because both registries are discovered dynamically.
 */

import type { ComponentType } from 'react';

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

// ── Generated post registry ─────────────────────────────────────────
// `npm run build-blog` writes src/content/posts.json and src/content/blog/*.mdx
// from Google Sheets/Docs before Vite resolves these globs.

const postsMetaModules = import.meta.glob<BlogPostMeta[]>('./posts.json', {
    eager: true,
    import: 'default',
});

const postsMeta = postsMetaModules['./posts.json'] ?? [];

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
