/**
 * Simple in-memory cache for fetch requests.
 * Caches responses by URL and reuses them for subsequent requests.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// Default cache TTL: 5 minutes
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Fetch data with caching support.
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
    } = {}
): Promise<T> {
    const { ttl = DEFAULT_TTL_MS, forceRefresh = false } = options;

    // Check cache first
    if (!forceRefresh) {
        const cached = cache.get(url);
        if (cached && Date.now() - cached.timestamp < ttl) {
            return cached.data as T;
        }
    }

    // Fetch fresh data
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Store in cache
    cache.set(url, {
        data,
        timestamp: Date.now(),
    });

    return data as T;
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
    cache.clear();
}

/**
 * Clear a specific URL from cache
 */
export function invalidateCache(url: string): void {
    cache.delete(url);
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
