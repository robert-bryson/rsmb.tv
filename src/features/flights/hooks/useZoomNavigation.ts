import { useCallback, useRef, type RefObject } from 'react';
import type { GlobeMethods } from 'react-globe.gl';
import type { GlobeViewState } from '../types';
import {
    VIEW_TRANSITION_MS,
    ZOOM_ALTITUDE_MIN,
    ZOOM_ALTITUDE_MAX,
    ZOOM_SPAN_DIVISOR,
    ZOOM_BASE_OFFSET,
    DEFAULT_VIEW,
} from '../constants';

interface LatLng {
    lat: number;
    lng: number;
}

/**
 * Calculate optimal zoom altitude for a geographic span.
 */
function calculateZoomAltitude(
    maxSpan: number,
    divisor: number = ZOOM_SPAN_DIVISOR
): number {
    return Math.min(
        ZOOM_ALTITUDE_MAX,
        Math.max(ZOOM_ALTITUDE_MIN, maxSpan / divisor + ZOOM_BASE_OFFSET)
    );
}

/**
 * Calculate geographic bounds from a set of points.
 */
function calculateBounds(points: LatLng[]) {
    let minLat = 90,
        maxLat = -90;

    points.forEach((point) => {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
    });

    // The complement of the largest empty gap is the smallest interval that
    // contains every airport. This also works for distributions wider than 180°.
    const longitudes = points.map(point => ((point.lng % 360) + 360) % 360).sort((a, b) => a - b);
    let largestGap = -1;
    let intervalStart = longitudes[0];
    longitudes.forEach((longitude, index) => {
        const next = longitudes[(index + 1) % longitudes.length];
        const gap = (index === longitudes.length - 1 ? next + 360 : next) - longitude;
        if (gap > largestGap) {
            largestGap = gap;
            intervalStart = next;
        }
    });
    const longitudeSpan = 360 - largestGap;
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = ((intervalStart + longitudeSpan / 2 + 180) % 360) - 180;
    const latSpan = maxLat - minLat;
    const maxSpan = Math.max(latSpan, longitudeSpan);

    return { centerLat, centerLng, maxSpan };
}

/**
 * Hook providing reusable zoom/navigation functions for the globe.
 * Eliminates duplicated bounds-calculation logic across handlers.
 */
export function useZoomNavigation(
    globeRef: RefObject<GlobeMethods | undefined>,
    onViewChange?: (view: GlobeViewState, options?: { replace?: boolean }) => void
) {
    // The camera restoration effect must recognize URL writes from our own
    // transitions. Applying them again with zero duration ends the active tween.
    const navigationViewRef = useRef<GlobeViewState | null>(null);
    const moveToView = useCallback((view: GlobeViewState, transitionMs: number) => {
        if (!globeRef.current) return;
        navigationViewRef.current = view;
        globeRef.current.pointOfView(view, transitionMs);
        onViewChange?.(view, { replace: true });
    }, [globeRef, onViewChange]);

    /** Reset the view to the default (centered on USA). */
    const resetView = useCallback(() => {
        moveToView(DEFAULT_VIEW, VIEW_TRANSITION_MS);
    }, [moveToView]);

    /** Zoom to fit a set of geographic points. */
    const zoomToPoints = useCallback(
        (
            points: LatLng[],
            options?: { divisor?: number; transitionMs?: number }
        ) => {
            if (!globeRef.current || points.length === 0) return;

            if (points.length === 1) {
                const view = { lat: points[0].lat, lng: points[0].lng, altitude: 0.5 };
                moveToView(view, options?.transitionMs ?? VIEW_TRANSITION_MS);
                return;
            }

            const { centerLat, centerLng, maxSpan } = calculateBounds(points);
            const altitude = calculateZoomAltitude(
                maxSpan,
                options?.divisor ?? ZOOM_SPAN_DIVISOR
            );
            const view = { lat: centerLat, lng: centerLng, altitude };
            moveToView(view, options?.transitionMs ?? VIEW_TRANSITION_MS);
        },
        [globeRef, moveToView]
    );

    /** Zoom to the midpoint between two geographic points (e.g., a route). */
    const zoomToRoute = useCallback(
        (
            start: LatLng,
            end: LatLng,
            options?: { divisor?: number; transitionMs?: number }
        ) => {
            if (!globeRef.current) return;

            const { centerLat, centerLng, maxSpan } = calculateBounds([start, end]);
            const altitude = Math.min(
                2.5,
                Math.max(0.6, maxSpan / (options?.divisor ?? 70))
            );

            const view = { lat: centerLat, lng: centerLng, altitude };
            moveToView(view, options?.transitionMs ?? VIEW_TRANSITION_MS);
        },
        [globeRef, moveToView]
    );

    /** Zoom to a single point at a specific altitude. */
    const zoomToPoint = useCallback(
        (point: LatLng, altitude = 0.5, transitionMs = VIEW_TRANSITION_MS) => {
            const view = { lat: point.lat, lng: point.lng, altitude };
            moveToView(view, transitionMs);
        },
        [moveToView]
    );

    /** Zoom to fit an airport and all its connections. */
    const zoomToAirportWithConnections = useCallback(
        (airport: LatLng, connections: LatLng[]) => {
            if (!globeRef.current) return;

            if (connections.length === 0) {
                zoomToPoint(airport, 0.5);
                return;
            }

            const allPoints = [airport, ...connections];
            const { maxSpan } = calculateBounds(allPoints);
            const altitude = Math.min(2.5, Math.max(0.5, maxSpan / 45 + 0.3));

            const view = { lat: airport.lat, lng: airport.lng, altitude };
            moveToView(view, VIEW_TRANSITION_MS);
        },
        [globeRef, moveToView, zoomToPoint]
    );

    return {
        resetView,
        zoomToPoints,
        zoomToRoute,
        zoomToPoint,
        zoomToAirportWithConnections,
        navigationViewRef,
    };
}
