/**
 * Simple in-memory cache for fetch requests.
 * Caches responses by URL and reuses them for subsequent requests.
 * Deduplicates in-flight requests to prevent duplicate network calls.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();
const activeRequestTokens = new Map<string, symbol>();

// Default cache TTL: 5 minutes
const DEFAULT_TTL_MS = 5 * 60 * 1000;
// Default request timeout: 30 seconds
const DEFAULT_TIMEOUT_MS = 30 * 1000;

/**
 * Fetch data with caching and in-flight deduplication.
 * 
 * If multiple callers request the same URL before the first resolves,
 * they share the same network request instead of firing duplicates.
 * 
 * @param url - The URL to fetch
 * @param options - Optional configuration
 * @returns Cached or freshly fetched data
 */
export async function fetchWithCache<T>(
    url: string,
    options: {
        ttl?: number;
        forceRefresh?: boolean;
        timeout?: number;
    } = {}
): Promise<T> {
    const { ttl = DEFAULT_TTL_MS, forceRefresh = false, timeout = DEFAULT_TIMEOUT_MS } = options;

    // Check cache first
    if (!forceRefresh) {
        const cached = cache.get(url);
        if (cached && Date.now() - cached.timestamp < ttl) {
            return cached.data as T;
        }
    }

    // Check if there's already an in-flight request for this URL
    if (!forceRefresh && pendingRequests.has(url)) {
        return pendingRequests.get(url) as Promise<T>;
    }

    const requestToken = Symbol(url);
    activeRequestTokens.set(url, requestToken);

    const fetchPromise = Promise.resolve().then(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type') ?? '';
            if (contentType.startsWith('text/html')) {
                throw new Error(`Expected JSON but server returned HTML from ${url}`);
            }

            const data = await response.json();

            if (activeRequestTokens.get(url) === requestToken) {
                cache.set(url, {
                    data,
                    timestamp: Date.now(),
                });
            }

            return data as T;
        } finally {
            clearTimeout(timeoutId);
            if (activeRequestTokens.get(url) === requestToken) {
                pendingRequests.delete(url);
                activeRequestTokens.delete(url);
            }
        }
    });

    pendingRequests.set(url, fetchPromise);
    return fetchPromise;
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
    cache.clear();
    pendingRequests.clear();
    activeRequestTokens.clear();
}

/**
 * Clear a specific URL from cache
 */
export function invalidateCache(url: string): void {
    cache.delete(url);
    pendingRequests.delete(url);
    activeRequestTokens.delete(url);
}

/**
 * Preload data into cache without returning it
 */
export async function preloadCache(urls: string[]): Promise<void> {
    await Promise.all(
        urls.map(url => fetchWithCache(url).catch(err => {
            console.warn(`Failed to preload ${url}:`, err);
        }))
    );
}
