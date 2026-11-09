/**
 * Shared in-memory cache for JSON fetch requests.
 * Caches responses by URL and reuses them for subsequent requests.
 * Deduplicates in-flight requests to prevent duplicate network calls.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();
const activeRequestTokens = new Map<string, symbol>();

// Default cache TTL: 5 minutes
const DEFAULT_TTL_MS = 5 * 60 * 1000;
// Default request timeout: 30 seconds
const DEFAULT_TIMEOUT_MS = 30 * 1000;
export const MAX_CACHE_ENTRIES = 32;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

function pruneCache() {
    const now = Date.now();
    for (const [url, entry] of cache) {
        if (entry.expiresAt <= now) cache.delete(url);
    }
    while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
}

function scheduleExpiry() {
    clearTimeout(expiryTimer);
    expiryTimer = undefined;
    const nextExpiry = Math.min(...Array.from(cache.values(), entry => entry.expiresAt));
    if (Number.isFinite(nextExpiry)) {
        expiryTimer = setTimeout(() => { pruneCache(); scheduleExpiry(); }, Math.min(2_147_483_647, Math.max(1, nextExpiry - Date.now())));
    }
}

/** Retained entry counts for diagnostics; pending requests are never evicted. */
export function getCacheStats() {
    return { entries: cache.size, pendingRequests: pendingRequests.size, capacity: MAX_CACHE_ENTRIES };
}

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
        priority?: RequestPriority;
    } = {}
): Promise<T> {
    const { ttl = DEFAULT_TTL_MS, forceRefresh = false, timeout = DEFAULT_TIMEOUT_MS, priority } = options;
    pruneCache();

    // Check cache first
    if (!forceRefresh) {
        const cached = cache.get(url);
        if (cached && Date.now() - cached.timestamp < ttl) {
            cache.delete(url);
            cache.set(url, cached);
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
            const response = await fetch(url, { signal: controller.signal, ...(priority ? { priority } : {}) });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type') ?? '';
            if (contentType.startsWith('text/html')) {
                throw new Error(`Expected JSON but server returned HTML from ${url}`);
            }

            const data = await response.json();

            if (activeRequestTokens.get(url) === requestToken) {
                const timestamp = Date.now();
                cache.delete(url);
                cache.set(url, {
                    data,
                    timestamp,
                    expiresAt: timestamp + (Number.isNaN(ttl) ? DEFAULT_TTL_MS : Math.max(0, ttl)),
                });
                pruneCache();
                scheduleExpiry();
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
    clearTimeout(expiryTimer);
    expiryTimer = undefined;
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
    scheduleExpiry();
}

/** Discard only the response a validator rejected, preserving newer refreshes and pending readers. */
export function discardCachedValue(url: string, value: unknown): void {
    if (cache.get(url)?.data !== value) return;
    cache.delete(url);
    scheduleExpiry();
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
