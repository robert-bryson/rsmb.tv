/**
 * Blog post metadata and registry.
 *
 * Blog post metadata and MDX files are generated from Google Sheets/Docs before
 * local dev and production builds. A fresh clone can still typecheck/test before
 * generation because both registries are discovered dynamically.
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

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
    /** Loads the generated MDX component for the post body on demand. */
    loadComponent: () => Promise<{ default: ComponentType<MdxComponentProps> }>;
    /** Lazy wrapper for the generated MDX component. */
    Component: LazyExoticComponent<ComponentType<MdxComponentProps>>;
}

// ── Generated post registry ─────────────────────────────────────────
// `npm run build-blog` writes src/content/posts.json and src/content/blog/*.mdx
// from Google Sheets/Docs before Vite resolves these globs.

const postsMetaModules = import.meta.glob<BlogPostMeta[]>('./posts.json', {
    eager: true,
    import: 'default',
});

const postsMeta = postsMetaModules['./posts.json'] ?? [];

// Auto-discover MDX files — no manual mapping needed. Keep these lazy so the
// initial app shell and blog index only pay for metadata, not every post body.
const mdxModules = import.meta.glob<{ default: ComponentType<MdxComponentProps> }>('./blog/*.mdx');

function missingMdxComponent(slug: string): ComponentType<MdxComponentProps> {
    return function MissingMdxComponent() {
        throw new Error(`No MDX file found for slug: ${slug}`);
    };
}

function postComponentLoader(slug: string): BlogPost['loadComponent'] {
    const path = `./blog/${slug}.mdx`;
    return mdxModules[path] ?? (async () => ({ default: missingMdxComponent(slug) }));
}

const posts: BlogPost[] = postsMeta.map((meta) => {
    const loadComponent = postComponentLoader(meta.slug);
    return {
        ...meta,
        loadComponent,
        Component: lazy(loadComponent),
    };
});

// Sort newest-first
posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export function getAllPosts(): BlogPostMeta[] {
    return posts.map(({ slug, title, date, description, tags }) => ({ slug, title, date, description, tags }));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
    return posts.find((p) => p.slug === slug);
}
