export type PostType = 'all' | 'writing' | 'trips';

interface PostFilters {
    type: PostType;
    tag: string;
    country: string;
    region: string;
    query: string;
}

export function getPostType(value: string | null): PostType {
    return value === 'writing' || value === 'trips' ? value : 'all';
}

/** Clone the parameters so callers cannot change a router snapshot. */
export function withPostSearchQuery(params: URLSearchParams, query: string): URLSearchParams {
    const next = new URLSearchParams(params);
    if (query) next.set('q', query);
    else next.delete('q');
    return next;
}

export function createPostsUrl({ type = 'all', tag, country, region, query = '' }: Partial<PostFilters> = {}): string {
    const params = new URLSearchParams();
    if (type !== 'all') params.set('type', type);
    if (tag) params.set('tag', tag);
    if (country) params.set('country', country);
    if (region) params.set('region', region);
    const search = withPostSearchQuery(params, query).toString();
    return `/posts${search ? `?${search}` : ''}`;
}
