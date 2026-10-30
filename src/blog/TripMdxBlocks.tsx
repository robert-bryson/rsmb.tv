import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TripRoutePreview } from '../features/trips/components/TripRoutePreview';
import { useTripStory } from '../features/trips/TripStoryContext';
import type { TripMapFocus } from '../features/trips/tripMapView';

const Gallery = lazy(() => import('../features/trips/components/TripGallery').then(module => ({ default: module.TripGallery })));
const Map = lazy(() => import('../features/trips/components/TripRouteMap').then(module => ({ default: module.TripRouteMap })));

type TripBlockBoundaryProps = { children: ReactNode; fallback: ReactNode; resetKey: unknown };
type TripBlockBoundaryState = { failed: boolean; resetKey: unknown };

class TripBlockBoundary extends Component<TripBlockBoundaryProps, TripBlockBoundaryState> {
    state = { failed: false, resetKey: this.props.resetKey };
    static getDerivedStateFromProps(props: TripBlockBoundaryProps, state: TripBlockBoundaryState) {
        return Object.is(props.resetKey, state.resetKey) ? null : { failed: false, resetKey: props.resetKey };
    }
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function TripGalleryBlock(props: { galleryId: string }) {
    return (
        <TripBlockBoundary resetKey={props.galleryId}
            fallback={<p role="status">These photos could not load. Reload the page to try again.</p>}>
            <Suspense fallback={<p role="status" className="py-8 text-zinc-400">Loading photos…</p>}>
                <Gallery {...props} />
            </Suspense>
        </TripBlockBoundary>
    );
}

export function TripMapBlock(props: TripMapFocus) {
    const { manifest } = useTripStory();
    const routeUrl = manifest.route.geoJson;
    const previewScope = JSON.stringify([routeUrl, props.dayId, props.trackId, props.stopId]);
    const [previewSelection, setPreviewSelection] = useState<{ scope: string; dayId?: string }>({ scope: previewScope });
    if (previewSelection.scope !== previewScope) setPreviewSelection({ scope: previewScope });
    const previewDayId = previewSelection.dayId;
    // Reset failures without remounting a healthy map when only its requested stop changes.
    const resetKey = useMemo(
        () => ({ routeUrl, stops: manifest.stops, days: manifest.days, trackId: props.trackId, dayId: props.dayId }),
        [routeUrl, manifest.stops, manifest.days, props.trackId, props.dayId],
    );
    const [attempt, setAttempt] = useState(() => typeof IntersectionObserver === 'undefined' ? 1 : 0);
    const [active, setActive] = useState(() => typeof IntersectionObserver === 'undefined');
    const [retainedHeight, setRetainedHeight] = useState<number>();
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!containerRef.current || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.1)) {
                // Portalled trip facts may move the map after this entry was captured.
                const bounds = containerRef.current?.getBoundingClientRect();
                if (!bounds || bounds.height <= 0) return;
                const visibleHeight = Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0);
                if (visibleHeight / bounds.height < 0.1) return;
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
            if (disposed || nearby || container.contains(document.activeElement)
                || document.fullscreenElement?.contains(container) || container.contains(document.fullscreenElement)) return;
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
    const explore = () => {
        setActive(true);
        setAttempt(value => value + 1);
    };
    const previewProps = {
        ...props,
        dayId: props.dayId ?? previewDayId,
        allowDaySelection: !props.dayId && !props.trackId && !props.stopId,
        onDaySelect: (dayId?: string) => setPreviewSelection({ scope: previewScope, dayId }),
    };
    const preview = <TripRoutePreview {...previewProps} onExplore={explore} />;
    const fallback = <div>
        <p role="status" className="text-sm text-zinc-300">
            Interactive map unavailable. The route and story are still available.
        </p>
        {preview}
    </div>;
    return (
        <div className="scroll-mt-24" data-trip-map>
            <div data-trip-facts-slot />
            <div ref={containerRef} data-trip-map-viewport
                style={!active && retainedHeight ? { minHeight: retainedHeight } : undefined}>
                {attempt ? (
                    <TripBlockBoundary key={attempt} resetKey={resetKey} fallback={fallback}>
                        <Suspense fallback={<TripRoutePreview {...previewProps} />}>
                            <Map {...props} initialDayId={previewDayId} active={active} onExplore={() => setActive(true)} />
                        </Suspense>
                    </TripBlockBoundary>
                ) : preview}
            </div>
            <div data-trip-navigation-slot />
        </div>
    );
}
