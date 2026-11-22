import { useEffect, useMemo, useRef, useState } from 'react';
import type { DrivingCatalog } from '../../../shared/skiDrivingCatalog';
import { drivingProviders, drivingRefreshMs, type DrivingProvider } from '../../../shared/skiDriving';
import type { DrivingFeed } from './driving-feed';

const loadCatalog = () => import('virtual:ski-driving-data').then(module => module.default);
type LoadState = 'idle' | 'checking' | 'available' | 'unavailable';

export function useSkiDriving(enabled: boolean, provider?: DrivingProvider | 'all') {
    const [catalog, setCatalog] = useState<DrivingCatalog>();
    const [catalogFailed, setCatalogFailed] = useState(false);
    const [now, setNow] = useState(Date.now);
    const [feed, setFeed] = useState<DrivingFeed>({ providers: {} });
    const [loadState, setLoadState] = useState<{ provider: DrivingProvider | 'all'; status: 'available' | 'unavailable' }>();
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
        if (!enabled || !provider) return;
        const activeProvider = provider;
        const controller = new AbortController();
        const { signal } = controller;
        let refresh: ReturnType<typeof setTimeout>;
        const requested = provider === 'all' ? drivingProviders : [provider];
        async function load() {
            try {
                const { loadDrivingFeed } = await import('./driving-feed');
                if (signal.aborted) return;
                const next = await loadDrivingFeed(current.current, requested, signal);
                if (signal.aborted) return;
                current.current = next;
                setFeed(next);
                setLoadState({ provider: activeProvider, status: 'available' });
            } catch {
                if (!signal.aborted) setLoadState({ provider: activeProvider, status: 'unavailable' });
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
    }, [enabled, provider]);
    const feedStatus: LoadState = enabled && provider
        ? loadState?.provider === provider ? loadState.status : 'checking'
        : 'idle';
    return useMemo(() => ({ catalog, catalogFailed, feed, feedStatus, now }), [catalog, catalogFailed, feed, feedStatus, now]);
}

export type SkiDriving = ReturnType<typeof useSkiDriving>;
