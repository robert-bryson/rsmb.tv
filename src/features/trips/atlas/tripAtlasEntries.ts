import type { BlogPostMeta } from '../../../content/posts';
import type { TripSummary } from '../types';

export interface TripAtlasReport {
    slug: string;
    title: string;
    date: string;
    href: `/trips/${string}`;
    draft: boolean;
}

export interface TripAtlasEntry {
    id: string;
    title: string;
    description: string;
    summary: TripSummary;
    reports: TripAtlasReport[];
}

function compareReports(a: BlogPostMeta, b: BlogPostMeta, summary: TripSummary) {
    const aOrder = a.series?.order ?? summary.series?.order ?? Infinity;
    const bOrder = b.series?.order ?? summary.series?.order ?? Infinity;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug);
}

/**
 * Join report metadata to validated summaries without loading stories or full manifests.
 * Production validation rejects missing published manifests before this adapter runs.
 * Incomplete development entries without a summary are omitted.
 */
export function buildTripAtlasEntries(
    posts: readonly BlogPostMeta[],
    getSummary: (id: string) => TripSummary | undefined,
    { includeDrafts = false }: { includeDrafts?: boolean } = {},
): TripAtlasEntry[] {
    const groups = new Map<string, BlogPostMeta[]>();
    for (const post of posts) {
        if (post.format !== 'trip' || !post.tripId) continue;
        if (!includeDrafts && post.development?.published === false) continue;
        const reports = groups.get(post.tripId) ?? [];
        reports.push(post);
        groups.set(post.tripId, reports);
    }

    const entries: TripAtlasEntry[] = [];
    for (const [id, reports] of groups) {
        const summary = getSummary(id);
        if (!summary) continue;
        reports.sort((a, b) => compareReports(a, b, summary));
        const first = reports[0];
        entries.push({
            id,
            title: first.series?.title ?? summary.series?.title ?? first.title,
            description: first.description,
            summary,
            reports: reports.map(post => ({
                slug: post.slug,
                title: post.title,
                date: post.date,
                href: `/trips/${post.slug}`,
                draft: post.development?.published === false,
            })),
        });
    }

    return entries.sort((a, b) => b.summary.dates.start.localeCompare(a.summary.dates.start) || a.id.localeCompare(b.id));
}
