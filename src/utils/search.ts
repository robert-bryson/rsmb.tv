export function normalizeSearch(value: string): string {
    return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Clone the parameters so callers cannot change a router snapshot. */
export function withSearchQuery(params: URLSearchParams, query: string): URLSearchParams {
    const next = new URLSearchParams(params);
    if (query) next.set('q', query);
    else next.delete('q');
    return next;
}
