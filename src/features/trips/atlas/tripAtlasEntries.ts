import type { BlogPostMeta } from '../../../content/posts';
import type { TripSummary } from '../types';

export interface TripAtlasReport {
    slug: string;
    title: string;
    date: string;
    href: `/trips/${string}`;
    draft: boolean;
    contentAvailable: boolean;
}

export interface TripAtlasEntry {
    id: string;
    title: string;
    description: string;
    summary?: TripSummary;
    countries?: BlogPostMeta['countries'];
    reports: TripAtlasReport[];
}

function compareReports(a: BlogPostMeta, b: BlogPostMeta, summary?: TripSummary) {
    const aOrder = a.series?.order ?? summary?.series?.order ?? Infinity;
    const bOrder = b.series?.order ?? summary?.series?.order ?? Infinity;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug);
}

/**
 * Join report metadata to validated summaries without loading stories or full manifests.
 * Production validation rejects missing published manifests before this adapter runs.
 * Development can retain incomplete reports as cards without inventing trip facts or routes.
 */
export function buildTripAtlasEntries(
    posts: readonly BlogPostMeta[],
    getSummary: (id: string) => TripSummary | undefined,
    { includeDrafts = false, includeIncomplete = false }: { includeDrafts?: boolean; includeIncomplete?: boolean } = {},
): TripAtlasEntry[] {
    const groups = new Map<string, BlogPostMeta[]>();
    for (const post of posts) {
        if (post.format !== 'trip' || (!post.tripId && !includeIncomplete)) continue;
        if (!includeDrafts && post.development?.published === false) continue;
        // Manifest IDs cannot contain colons, so report-only keys cannot collide with real trips.
        const id = post.tripId || `report:${post.slug}`;
        const reports = groups.get(id) ?? [];
        reports.push(post);
        groups.set(id, reports);
    }

    const entries: TripAtlasEntry[] = [];
    for (const [id, reports] of groups) {
        const tripId = reports[0].tripId;
        const summary = tripId ? getSummary(tripId) : undefined;
        if (!summary && !includeIncomplete) continue;
        reports.sort((a, b) => compareReports(a, b, summary));
        const first = reports[0];
        entries.push({
            id,
            title: first.series?.title ?? summary?.series?.title ?? first.title,
            description: first.description,
            summary,
            countries: first.countries,
            reports: reports.map(post => ({
                slug: post.slug,
                title: post.title,
                date: post.date,
                href: `/trips/${post.slug}`,
                draft: post.development?.published === false,
                contentAvailable: post.development?.contentAvailable !== false,
            })),
        });
    }

    return entries.sort((a, b) => (b.summary?.dates.start ?? b.reports[0].date).localeCompare(a.summary?.dates.start ?? a.reports[0].date) || a.id.localeCompare(b.id));
}
