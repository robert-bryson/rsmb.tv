import { useCallback, type RefObject } from 'react';
import type { GlobeMethods } from 'react-globe.gl';
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
        maxLat = -90,
        minLng = 180,
        maxLng = -180;

    points.forEach((point) => {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLng = Math.min(minLng, point.lng);
        maxLng = Math.max(maxLng, point.lng);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    const adjustedLngSpan = lngSpan > 180 ? 360 - lngSpan : lngSpan;
    const maxSpan = Math.max(latSpan, adjustedLngSpan);

    return { centerLat, centerLng, latSpan, adjustedLngSpan, maxSpan };
}

/**
 * Hook providing reusable zoom/navigation functions for the globe.
 * Eliminates duplicated bounds-calculation logic across handlers.
 */
export function useZoomNavigation(
    globeRef: RefObject<GlobeMethods | undefined>
) {
    /** Reset the view to the default (centered on USA). */
    const resetView = useCallback(() => {
        if (globeRef.current) {
            globeRef.current.pointOfView(DEFAULT_VIEW, VIEW_TRANSITION_MS);
        }
    }, [globeRef]);

    /** Zoom to fit a set of geographic points. */
    const zoomToPoints = useCallback(
        (
            points: LatLng[],
            options?: { divisor?: number; transitionMs?: number }
        ) => {
            if (!globeRef.current || points.length === 0) return;

            if (points.length === 1) {
                globeRef.current.pointOfView(
                    { lat: points[0].lat, lng: points[0].lng, altitude: 0.5 },
                    options?.transitionMs ?? VIEW_TRANSITION_MS
                );
                return;
            }

            const { centerLat, centerLng, maxSpan } = calculateBounds(points);
            const altitude = calculateZoomAltitude(
                maxSpan,
                options?.divisor ?? ZOOM_SPAN_DIVISOR
            );
            globeRef.current.pointOfView(
                { lat: centerLat, lng: centerLng, altitude },
                options?.transitionMs ?? VIEW_TRANSITION_MS
            );
        },
        [globeRef]
    );

    /** Zoom to the midpoint between two geographic points (e.g., a route). */
    const zoomToRoute = useCallback(
        (
            start: LatLng,
            end: LatLng,
            options?: { divisor?: number; transitionMs?: number }
        ) => {
            if (!globeRef.current) return;

            const midLat = (start.lat + end.lat) / 2;
            const midLng = (start.lng + end.lng) / 2;
            const latDiff = Math.abs(start.lat - end.lat);
            const lngDiff = Math.abs(start.lng - end.lng);
            const adjustedLngDiff = lngDiff > 180 ? 360 - lngDiff : lngDiff;
            const maxDiff = Math.max(latDiff, adjustedLngDiff);
            const altitude = Math.min(
                2.5,
                Math.max(0.6, maxDiff / (options?.divisor ?? 70))
            );

            globeRef.current.pointOfView(
                { lat: midLat, lng: midLng, altitude },
                options?.transitionMs ?? 1000
            );
        },
        [globeRef]
    );

    /** Zoom to a single point at a specific altitude. */
    const zoomToPoint = useCallback(
        (point: LatLng, altitude = 0.5, transitionMs = 1000) => {
            if (!globeRef.current) return;
            globeRef.current.pointOfView(
                { lat: point.lat, lng: point.lng, altitude },
                transitionMs
            );
        },
        [globeRef]
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

            globeRef.current.pointOfView(
                { lat: airport.lat, lng: airport.lng, altitude },
                1000
            );
        },
        [globeRef, zoomToPoint]
    );

    return {
        resetView,
        zoomToPoints,
        zoomToRoute,
        zoomToPoint,
        zoomToAirportWithConnections,
    };
}
