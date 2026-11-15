import fs from 'node:fs';
import type { BlogPostMeta } from '../src/content/postMetadata.ts';

/** Apply the same publication and reference rules to HTML, loaders, and search. */
export function readPostRegistry(file: string, production: boolean): BlogPostMeta[] {
    if (!fs.existsSync(file)) {
        if (production) throw new Error('Missing post registry. Run blog sync before the production build.');
        return [];
    }
    const posts: BlogPostMeta[] = JSON.parse(fs.readFileSync(file, 'utf8'));
    const visible = posts.filter(post => !production || post.development?.published !== false);
    const identifier = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const slugs = new Set<string>();
    for (const post of visible) {
        if (typeof post.slug !== 'string' || !identifier.test(post.slug)) {
            throw new Error(`Invalid post slug: ${post.slug}`);
        }
        if (slugs.has(post.slug)) throw new Error(`Duplicate post slug: ${post.slug}`);
        slugs.add(post.slug);
        if (post.tripId !== undefined && (typeof post.tripId !== 'string' || !identifier.test(post.tripId))) {
            throw new Error(`Invalid trip ID for post ${post.slug}: ${post.tripId}`);
        }
        if (production && post.format === 'trip' && !post.tripId) {
            throw new Error(`Missing trip ID for published post: ${post.slug}`);
        }
    }
    return visible;
}
