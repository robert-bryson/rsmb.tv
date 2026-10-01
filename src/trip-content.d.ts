declare module 'virtual:trip-content' {
    type Manifest = import('./features/trips/types').TripManifest;
    export const summaries: Record<string, Pick<Manifest, 'id' | 'dates' | 'ridingDays' | 'distanceMiles' | 'series' | 'motorcycle' | 'regions'> & { hero: Manifest['photos'][number] }>;
    export const loaders: Record<string, () => Promise<{ default: unknown }>>;
    export const issues: Record<string, string>;
}

declare module 'virtual:post-content' {
    export const metadata: import('./content/posts').BlogPostMeta[];
    export const mdxLoaders: Record<string, () => Promise<{ default: import('react').ComponentType<import('./content/posts').MdxComponentProps> }>>;
}
