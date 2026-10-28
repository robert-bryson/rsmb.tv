import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { TripRoutePreview } from '../features/trips/components/TripRoutePreview';
import type { TripMapFocus } from '../features/trips/tripMapView';
const Gallery = lazy(() => import('../features/trips/components/TripGallery').then(module => ({ default: module.TripGallery })));
const Map = lazy(() => import('../features/trips/components/TripRouteMap').then(module => ({ default: module.TripRouteMap })));

class TripBlockBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export function TripGalleryBlock(props: { galleryId: string }) {
    return <TripBlockBoundary fallback={<p role="status">These photos could not load. Reload the page to try again.</p>}>
        <Suspense fallback={<p role="status" className="py-8 text-zinc-400">Loading photos…</p>}><Gallery {...props} /></Suspense>
    </TripBlockBoundary>;
}
export function TripMapBlock(props: TripMapFocus) {
    const [attempt, setAttempt] = useState(() => typeof IntersectionObserver === 'undefined' ? 1 : 0);
    const [active, setActive] = useState(() => typeof IntersectionObserver === 'undefined');
    const [retainedHeight, setRetainedHeight] = useState<number>();
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!containerRef.current || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.1)) {
                setAttempt(value => value || 1);
                setActive(true);
            }
        }, { threshold: 0.1 });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const container = containerRef.current;
        if (!container || typeof IntersectionObserver === 'undefined') return;
        let nearby = true;
        let disposed = false;
        const suspend = () => {
            if (disposed || nearby || container.contains(document.activeElement) || document.fullscreenElement?.contains(container) || container.contains(document.fullscreenElement)) return;
            setRetainedHeight(container.getBoundingClientRect().height);
            setActive(false);
        };
        const afterFocus = () => queueMicrotask(suspend);
        // Only retain an already-visible map here. Do not prefetch offscreen tiles.
        const observer = new IntersectionObserver(entries => {
            nearby = entries.some(entry => entry.isIntersecting);
            if (!nearby) suspend();
        }, { rootMargin: '1200px' });
        observer.observe(container);
        container.addEventListener('focusout', afterFocus);
        document.addEventListener('fullscreenchange', suspend);
        return () => {
            disposed = true;
            observer.disconnect();
            container.removeEventListener('focusout', afterFocus);
            document.removeEventListener('fullscreenchange', suspend);
        };
    }, []);
    const fallback = <div><p role="status" className="text-sm text-zinc-300">Interactive map unavailable. The route and story are still available.</p><TripRoutePreview {...props} onExplore={() => { setActive(true); setAttempt(value => value + 1); }} /></div>;
    return <div className="scroll-mt-24" data-trip-map>
        <div data-trip-facts-slot />
        <div ref={containerRef} data-trip-map-viewport style={!active && retainedHeight ? { minHeight: retainedHeight } : undefined}>
        {attempt ? <TripBlockBoundary key={attempt} fallback={fallback}><Suspense fallback={<TripRoutePreview {...props} />}><Map {...props} active={active} onExplore={() => setActive(true)} /></Suspense></TripBlockBoundary>
            : <TripRoutePreview {...props} onExplore={() => { setAttempt(1); setActive(true); }} />}
        </div>
        <div data-trip-navigation-slot />
    </div>;
}
