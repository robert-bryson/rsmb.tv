import { useEffect, useMemo, useRef, useState } from 'react';
import type { DrivingCatalog } from '../../../shared/skiDrivingCatalog';
import { drivingProviders, drivingRefreshMs, type DrivingProvider } from '../../../shared/skiDriving';
import type { DrivingFeed } from './driving-feed';

const loadCatalog = () => import('virtual:ski-driving-data').then(module => module.default);
type LoadState = 'idle' | 'checking' | 'available' | 'unavailable';
type FeedScope = DrivingProvider | 'all' | undefined;

export function useSkiDriving(enabled: boolean, provider?: FeedScope) {
    const scope = enabled ? provider : undefined;
    const [catalog, setCatalog] = useState<DrivingCatalog>();
    const [catalogFailed, setCatalogFailed] = useState(false);
    const [now, setNow] = useState(Date.now);
    const [feed, setFeed] = useState<DrivingFeed>({ providers: {} });
    const [loadState, setLoadState] = useState<{ scope: FeedScope; status: LoadState }>(() => ({
        scope, status: scope ? 'checking' : 'idle',
    }));
    if (scope !== loadState.scope) setLoadState({ scope, status: scope ? 'checking' : 'idle' });
    const current = useRef(feed);
    const catalogLoaded = Boolean(catalog);

    useEffect(() => {
        if (!enabled || catalogLoaded) return;
        let active = true;
        void loadCatalog().then(value => {
            if (active) { setCatalog(value); setCatalogFailed(false); }
        }, () => { if (active) setCatalogFailed(true); });
        return () => { active = false; };
    }, [enabled, catalogLoaded]);

    useEffect(() => {
        if (!scope) return;
        const controller = new AbortController();
        const { signal } = controller;
        let refresh: ReturnType<typeof setTimeout>;
        const requested = scope === 'all' ? drivingProviders : [scope];
        async function load() {
            try {
                const { loadDrivingFeed } = await import('./driving-feed');
                if (signal.aborted) return;
                const next = await loadDrivingFeed(current.current, requested, signal);
                if (signal.aborted) return;
                current.current = next;
                setFeed(next);
                setLoadState({ scope, status: 'available' });
            } catch {
                if (!signal.aborted) setLoadState({ scope, status: 'unavailable' });
            } finally {
                if (!signal.aborted) {
                    setNow(Date.now());
                    refresh = setTimeout(() => { void load(); }, drivingRefreshMs);
                }
            }
        }
        void load();
        const tick = () => setNow(Date.now());
        const clock = window.setInterval(tick, 30_000);
        document.addEventListener('visibilitychange', tick);
        return () => {
            controller.abort();
            clearTimeout(refresh);
            window.clearInterval(clock);
            document.removeEventListener('visibilitychange', tick);
        };
    }, [scope]);
    const feedStatus = loadState.status;
    return useMemo(() => ({ catalog, catalogFailed, feed, feedStatus, now }), [catalog, catalogFailed, feed, feedStatus, now]);
}

export type SkiDriving = ReturnType<typeof useSkiDriving>;
