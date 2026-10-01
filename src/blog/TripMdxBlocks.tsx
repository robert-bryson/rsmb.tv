import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { TripRoutePreview } from '../features/trips/components/TripRoutePreview';
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
export function TripMapBlock(props: { stopId?: string; trackId?: string }) {
    const [attempt, setAttempt] = useState(() => typeof IntersectionObserver === 'undefined' ? 1 : 0);
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!containerRef.current || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.1)) {
                setAttempt(value => value || 1);
                observer.disconnect();
            }
        }, { threshold: 0.1 });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);
    const fallback = <div><p role="status" className="text-sm text-zinc-300">Interactive map unavailable. The route and story are still available.</p><TripRoutePreview {...props} onExplore={() => setAttempt(value => value + 1)} /></div>;
    return <div className="scroll-mt-24" data-trip-map>
        <div data-trip-facts-slot />
        <div ref={containerRef} data-trip-map-viewport>
        {attempt ? <TripBlockBoundary key={attempt} fallback={fallback}><Suspense fallback={<TripRoutePreview {...props} />}><Map {...props} /></Suspense></TripBlockBoundary>
            : <TripRoutePreview {...props} onExplore={() => setAttempt(1)} />}
        </div>
        <div data-trip-navigation-slot />
    </div>;
}
