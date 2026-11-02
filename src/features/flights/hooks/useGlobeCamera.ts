import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { GlobeMethods } from 'react-globe.gl';
import type { GlobeViewState } from '../types';
import { globeViewsEqual } from '../utils/globeView';
import { AUTO_ROTATION_SPEED, DBLCLICK_ZOOM_FACTOR, DEFAULT_VIEW, VIEW_TRANSITION_MS, ZOOM_ALTITUDE_MIN } from '../constants';

interface GlobeCameraOptions {
    globeRef: RefObject<GlobeMethods | undefined>;
    navigationViewRef: RefObject<GlobeViewState | null>;
    selectedView: GlobeViewState | null;
    rotationEnabled: boolean;
    reducedMotion: boolean;
    tileUrl: ((x: number, y: number, level: number) => string) | null;
    onStopRotation: () => void;
    onViewChange: (view: GlobeViewState, options: { replace: boolean }) => void;
}

/** Owns camera listeners and pending work for the current, ready renderer. */
export function useGlobeCamera({
    globeRef, navigationViewRef, selectedView, rotationEnabled, reducedMotion, tileUrl, onStopRotation, onViewChange,
}: GlobeCameraOptions) {
    const [ready, setReady] = useState(false);
    const mounted = useRef(false);
    const readyRequested = useRef(false);
    const pendingSync = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suppressSync = useRef(false);
    const initialized = useRef(false);
    const syncedView = useRef<GlobeViewState | null>(null);
    const { lat, lng, altitude } = selectedView ?? DEFAULT_VIEW;

    useLayoutEffect(() => {
        mounted.current = true;
        if (readyRequested.current) setReady(true);
        return () => { mounted.current = false; };
    }, []);

    const cancelSync = useCallback(() => {
        if (pendingSync.current !== null) clearTimeout(pendingSync.current);
        pendingSync.current = null;
    }, []);

    const syncView = useCallback((view?: GlobeViewState) => {
        if (!ready || suppressSync.current) return;
        const current = view ?? globeRef.current?.pointOfView();
        if (!current || !Number.isFinite(current.lat) || !Number.isFinite(current.lng) || !Number.isFinite(current.altitude)) return;
        syncedView.current = current;
        onViewChange({ lat: current.lat, lng: current.lng, altitude: current.altitude }, { replace: true });
    }, [globeRef, ready, onViewChange]);

    const scheduleSync = useCallback((view?: GlobeViewState) => {
        if (!ready || suppressSync.current) return;
        cancelSync();
        pendingSync.current = setTimeout(() => {
            pendingSync.current = null;
            syncView(view);
        }, 250);
    }, [cancelSync, syncView, ready]);

    useEffect(() => {
        const globe = globeRef.current;
        if (!ready || !globe) return;
        cancelSync();
        const view = { lat, lng, altitude };
        const localUpdate = initialized.current && (
            globeViewsEqual(view, navigationViewRef.current) || globeViewsEqual(view, syncedView.current)
        );
        navigationViewRef.current = null;
        syncedView.current = null;
        initialized.current = true;
        if (localUpdate) return;
        suppressSync.current = true;
        globe.pointOfView(view, 0);
        const timer = setTimeout(() => { suppressSync.current = false; }, 0);
        return () => {
            clearTimeout(timer);
            suppressSync.current = false;
        };
    }, [globeRef, navigationViewRef, ready, lat, lng, altitude, cancelSync]);

    useEffect(() => {
        const globe = globeRef.current;
        if (!ready || !globe) return;
        const controls = globe.controls();
        controls.autoRotate = rotationEnabled && !reducedMotion;
        controls.autoRotateSpeed = AUTO_ROTATION_SPEED;
    }, [globeRef, ready, rotationEnabled, reducedMotion]);

    useEffect(() => {
        const globe = globeRef.current;
        if (!ready || !globe) return;
        globe.globeTileEngineClearCache();
        // Reload the current camera so a new tile style appears without a drag.
        if (tileUrl) globe.pointOfView(globe.pointOfView(), 0);
    }, [globeRef, ready, tileUrl]);

    useEffect(() => {
        const globe = globeRef.current;
        if (!ready || !globe) return;
        const controls = globe.controls();
        const scheduleCurrentView = () => scheduleSync();
        const flushCurrentView = () => {
            cancelSync();
            syncView();
        };
        controls.addEventListener('start', onStopRotation);
        controls.addEventListener('change', scheduleCurrentView);
        controls.addEventListener('end', flushCurrentView);

        const canvas = globe.renderer().domElement;
        const zoom = (event: MouseEvent) => {
            onStopRotation();
            let coords: { lat: number; lng: number } | null;
            try {
                coords = globe.toGlobeCoords(event.offsetX, event.offsetY) ?? null;
            } catch {
                coords = null;
            }
            const view = globe.pointOfView();
            const nextView = {
                lat: coords?.lat ?? view.lat,
                lng: coords?.lng ?? view.lng,
                altitude: Math.max(ZOOM_ALTITUDE_MIN, view.altitude * DBLCLICK_ZOOM_FACTOR),
            };
            cancelSync();
            navigationViewRef.current = nextView;
            globe.pointOfView(nextView, VIEW_TRANSITION_MS);
            onViewChange(nextView, { replace: true });
        };
        canvas.addEventListener('dblclick', zoom);
        return () => {
            controls.removeEventListener('start', onStopRotation);
            controls.removeEventListener('change', scheduleCurrentView);
            controls.removeEventListener('end', flushCurrentView);
            canvas.removeEventListener('dblclick', zoom);
            cancelSync();
        };
    }, [globeRef, navigationViewRef, ready, onStopRotation, onViewChange, scheduleSync, syncView, cancelSync]);

    const onGlobeReady = useCallback(() => {
        // The renderer can report readiness before its parent commits, including
        // from work that React later discards. Apply it only to a mounted camera.
        readyRequested.current = true;
        if (mounted.current) setReady(true);
    }, []);

    return { onGlobeReady, onZoom: scheduleSync };
}
