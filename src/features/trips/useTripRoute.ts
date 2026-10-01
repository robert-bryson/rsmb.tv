import { useEffect, useState } from 'react';
import { isRouteGeoJson, type RouteGeoJson } from './routeGeometry';
const cache = new Map<string, { promise: Promise<RouteGeoJson>; controller: AbortController; users: number; settled: boolean }>();
export function clearTripRouteCache() { for (const entry of cache.values()) entry.controller.abort(); cache.clear(); }
function pruneCache() {
    for (const [key, entry] of cache) {
        if (cache.size <= 8) break;
        if (!entry.users && entry.settled) cache.delete(key);
    }
}
function acquire(url: string) {
    let entry = cache.get(url);
    if (!entry) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(new Error('Route request timed out. Please try again.')), 10_000);
        const promise = fetch(url, { signal: controller.signal }).then(async response => {
            if (!response.ok) throw new Error(`Route request failed with ${response.status}`);
            const value: unknown = await response.json();
            if (!isRouteGeoJson(value)) throw new Error('Route data must contain valid LineString geometry.');
            return value;
        }).finally(() => clearTimeout(timer));
        entry = { promise, controller, users: 0, settled: false };
        cache.set(url, entry);
        const current = entry;
        void promise.then(() => {
            current.settled = true;
            pruneCache();
        }, () => { if (cache.get(url) === current) cache.delete(url); });
    }
    entry.users++;
    return entry;
}
export function useTripRoute(url: string, enabled = true) {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<{ url: string; route?: RouteGeoJson; error: string }>({ url, error: '' });
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        const entry = acquire(url);
        entry.promise.then(route => { if (active) setState({ url, route, error: '' }); }, (error: unknown) => {
            if (active) setState({ url, error: error instanceof Error ? error.message : 'The route could not load.' });
        });
        return () => {
            active = false;
            entry.users--;
            // Delay release by a microtask so Strict Mode and sibling maps can share a request.
            queueMicrotask(() => {
                if (!entry.users && !entry.settled) {
                    entry.controller.abort();
                    if (cache.get(url) === entry) cache.delete(url);
                }
                pruneCache();
            });
        };
    }, [url, enabled, attempt]);
    return {
        route: state.url === url ? state.route ?? null : null,
        error: state.url === url ? state.error : '',
        retry: () => { cache.delete(url); setState({ url, error: '' }); setAttempt(value => value + 1); },
    };
}
