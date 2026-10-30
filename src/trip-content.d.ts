declare module 'virtual:trip-content' {
    export const summaries: Record<string, import('./features/trips/types').TripSummary>;
    export const loaders: Record<string, () => Promise<{ default: unknown }>>;
    export const issues: Record<string, string>;
}

declare module 'virtual:post-content' {
    export const metadata: import('./content/posts').BlogPostMeta[];
    export const mdxLoaders: Record<string, () => Promise<{ default: import('react').ComponentType<import('./content/posts').MdxComponentProps> }>>;
}
