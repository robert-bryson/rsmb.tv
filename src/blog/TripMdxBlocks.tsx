import { Component, Suspense, lazy, startTransition, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TripRoutePreview } from '../features/trips/components/TripRoutePreview';
import { useTripStory } from '../features/trips/TripStoryContext';
import { useTripMapDismiss } from '../features/trips/useTripMapDismiss';
import type { TripMapFocus } from '../features/trips/tripMapView';

const Gallery = lazy(() => import('../features/trips/components/TripGallery').then(module => ({ default: module.TripGallery })));
const loadMap = () => import('../features/trips/components/TripRouteMap').then(module => ({ default: module.TripRouteMap }));
const Map = lazy(loadMap);

type TripBlockBoundaryProps = { children: ReactNode; fallback: ReactNode; resetKey: unknown };
type TripBlockBoundaryState = { failed: boolean; resetKey: unknown };
type PreviewPress = { pointerId: number } | { key: string };

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
    const [attempt, setAttempt] = useState(0);
    const [active, setActive] = useState(false);
    const [retainedHeight, setRetainedHeight] = useState<number>();
    const [previewPress, setPreviewPress] = useState<PreviewPress>();
    const previewRef = useRef<HTMLElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    useTripMapDismiss(previewRef, Boolean(previewDayId), ({ resetSelection }) => {
        if (resetSelection) setPreviewSelection({ scope: previewScope });
    });
    useEffect(() => {
        if (!previewPress) return;
        // Continue loading even when a pressed preview delays the replacement.
        // The lazy component and error boundary report a rejected import after release.
        if (attempt) void loadMap().catch(() => {});
        let releaseTimer: ReturnType<typeof setTimeout>;
        const cancel = () => startTransition(() => setPreviewPress(undefined));
        const release = () => {
            clearTimeout(releaseTimer);
            // Native clicks follow pointerup/keyup. Keep their target through that event.
            releaseTimer = setTimeout(cancel, 0);
        };
        const releaseKey = (event: KeyboardEvent) => {
            if ('key' in previewPress && event.key === previewPress.key) release();
        };
        const releasePointer = (event: PointerEvent) => {
            if ('pointerId' in previewPress && event.pointerId === previewPress.pointerId) release();
        };
        const cancelPointer = (event: PointerEvent) => {
            if ('pointerId' in previewPress && event.pointerId === previewPress.pointerId) cancel();
        };
        document.addEventListener('pointerup', releasePointer);
        document.addEventListener('pointercancel', cancelPointer);
        document.addEventListener('keyup', releaseKey);
        window.addEventListener('blur', cancel);
        return () => {
            clearTimeout(releaseTimer);
            document.removeEventListener('pointerup', releasePointer);
            document.removeEventListener('pointercancel', cancelPointer);
            document.removeEventListener('keyup', releaseKey);
            window.removeEventListener('blur', cancel);
        };
    }, [attempt, previewPress]);
    useEffect(() => {
        if (!containerRef.current) return;
        const activate = () => startTransition(() => {
            setAttempt(value => value || 1);
            setActive(true);
        });
        if (typeof IntersectionObserver === 'undefined') {
            activate();
            return;
        }
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.1)) {
                // Portalled trip facts may move the map after this entry was captured.
                const bounds = containerRef.current?.getBoundingClientRect();
                if (!bounds || bounds.height <= 0) return;
                const visibleHeight = Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0);
                if (visibleHeight / bounds.height < 0.1) return;
                // Keep the current preview's controls mounted while the map module loads.
                activate();
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
        startTransition(() => {
            setActive(true);
            setAttempt(value => value || 1);
        });
    };
    const retry = () => {
        startTransition(() => {
            setActive(true);
            setAttempt(value => value + 1);
        });
    };
    const previewProps = {
        ...props,
        dayId: props.dayId ?? previewDayId,
        allowDaySelection: !props.dayId && !props.trackId && !props.stopId,
        onDaySelect: (dayId?: string) => setPreviewSelection({ scope: previewScope, dayId }),
        figureRef: previewRef,
    };
    const preview = <TripRoutePreview {...previewProps} onExplore={explore} />;
    const fallback = <div>
        <p role="status" className="text-sm text-zinc-300">
            Interactive map unavailable. The route and story are still available.
        </p>
        <TripRoutePreview {...previewProps} onExplore={retry} />
    </div>;
    return (
        <div className="scroll-mt-24" data-trip-map>
            <div data-trip-facts-slot />
            <div ref={containerRef} data-trip-map-viewport
                onPointerDownCapture={event => {
                    if (event.button === 0 && event.isPrimary !== false && previewRef.current?.contains(event.target as Node)) {
                        setPreviewPress({ pointerId: event.pointerId });
                    }
                }}
                onKeyDownCapture={event => {
                    if ((event.key === ' ' || event.key === 'Enter') && previewRef.current?.contains(event.target as Node)) {
                        setPreviewPress({ key: event.key });
                    }
                }}
                onClick={() => startTransition(() => setPreviewPress(undefined))}
                onBlurCapture={event => {
                    if (previewPress && 'key' in previewPress && !event.currentTarget.contains(event.relatedTarget)) {
                        setPreviewPress(undefined);
                    }
                }}
                style={!active && retainedHeight ? { minHeight: retainedHeight } : undefined}>
                {/* Initial activation retains the boundary; explicit retries replace it. */}
                <TripBlockBoundary key={attempt || 1} resetKey={resetKey} fallback={fallback}>
                    <Suspense fallback={<TripRoutePreview {...previewProps} />}>
                        {attempt && !previewPress
                            ? <Map {...props} initialDayId={previewDayId} active={active} onExplore={() => setActive(true)} />
                            : preview}
                    </Suspense>
                </TripBlockBoundary>
            </div>
            <div data-trip-navigation-slot />
        </div>
    );
}
