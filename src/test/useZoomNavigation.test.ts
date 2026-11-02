import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GlobeMethods } from 'react-globe.gl';
import { useZoomNavigation } from '../features/flights/hooks/useZoomNavigation';
import { DEFAULT_VIEW } from '../features/flights/constants';

function navigation() {
    const pointOfView = vi.fn();
    const onViewChange = vi.fn();
    const { result } = renderHook(() => useZoomNavigation({ current: { pointOfView } as unknown as GlobeMethods }, onViewChange));
    return { ...result.current, pointOfView, onViewChange };
}

describe('flight camera geography', () => {
    it.each([false, true])('centers ICN–YVR over the Pacific in either direction (reversed: %s)', reversed => {
        const nav = navigation();
        const points = [{ lat: 37.46, lng: 126.450996 }, { lat: 49.19, lng: -123.1839981 }];
        if (reversed) points.reverse();
        nav.zoomToRoute(points[0], points[1]);
        const view = nav.pointOfView.mock.calls[0][0];
        expect(view.lng).toBeCloseTo(-178.36650105);
        expect(view.lat).toBeCloseTo(43.325);
        expect(nav.onViewChange).toHaveBeenCalledWith(view, { replace: true });
    });

    it('fits airports on both sides of the date line into their short enclosing span', () => {
        const nav = navigation();
        nav.zoomToPoints([{ lat: 0, lng: 179 }, { lat: 0, lng: -179 }, { lat: 0, lng: 178 }]);
        expect(nav.pointOfView).toHaveBeenCalledWith({ lat: 0, lng: 179.5, altitude: 0.36 }, 1000);
    });

    it('does not shrink a wide distribution into a span that excludes an airport', () => {
        const nav = navigation();
        nav.zoomToPoints([-120, 0, 120].map(lng => ({ lat: 0, lng })), { divisor: 100 });
        expect(nav.pointOfView.mock.calls[0][0].altitude).toBe(2.5);
    });

    it('treats -180 and +180 as the same longitude', () => {
        const nav = navigation();
        nav.zoomToRoute({ lat: 0, lng: -180 }, { lat: 0, lng: 180 });
        expect(nav.pointOfView).toHaveBeenCalledWith({ lat: 0, lng: -180, altitude: 0.6 }, 1000);
    });

    it('preserves ordinary route fitting and custom transitions', () => {
        const nav = navigation();
        nav.zoomToRoute({ lat: 30, lng: -120 }, { lat: 40, lng: -80 }, { divisor: 100, transitionMs: 0 });
        expect(nav.pointOfView).toHaveBeenCalledWith({ lat: 35, lng: -100, altitude: 0.6 }, 0);
    });

    it('keeps reset and point targets available to camera URL synchronization', () => {
        const nav = navigation();
        nav.resetView();
        expect(nav.pointOfView).toHaveBeenLastCalledWith(DEFAULT_VIEW, 1000);
        expect(nav.navigationViewRef.current).toEqual(DEFAULT_VIEW);
        nav.zoomToPoint({ lat: 49, lng: -123 }, 0.8, 200);
        expect(nav.pointOfView).toHaveBeenLastCalledWith({ lat: 49, lng: -123, altitude: 0.8 }, 200);
        expect(nav.onViewChange).toHaveBeenLastCalledWith(nav.navigationViewRef.current, { replace: true });
    });

    it('leaves the camera unchanged for an empty set and fits one airport with the requested transition', () => {
        const nav = navigation();
        nav.zoomToPoints([]);
        expect(nav.pointOfView).not.toHaveBeenCalled();
        nav.zoomToPoints([{ lat: 49, lng: -123 }], { transitionMs: 200 });
        expect(nav.pointOfView).toHaveBeenLastCalledWith({ lat: 49, lng: -123, altitude: 0.5 }, 200);
    });

    it('focuses an isolated airport and uses the short Pacific span for its connections', () => {
        const nav = navigation();
        const airport = { lat: 49, lng: -123 };
        nav.zoomToAirportWithConnections(airport, []);
        expect(nav.pointOfView).toHaveBeenLastCalledWith({ ...airport, altitude: 0.5 }, 1000);
        nav.zoomToAirportWithConnections(airport, [{ lat: 37, lng: 126 }]);
        expect(nav.pointOfView.mock.lastCall?.[0]).toMatchObject(airport);
        expect(nav.pointOfView.mock.lastCall?.[0].altitude).toBe(2.5);
        nav.zoomToAirportWithConnections({ lat: 0, lng: 179 }, [{ lat: 0, lng: -179 }]);
        expect(nav.pointOfView).toHaveBeenLastCalledWith({ lat: 0, lng: 179, altitude: 0.5 }, 1000);
    });

    it('ignores commands while the renderer is unavailable', () => {
        const onViewChange = vi.fn();
        const { result } = renderHook(() => useZoomNavigation({ current: undefined }, onViewChange));
        const point = { lat: 49, lng: -123 };
        result.current.resetView();
        result.current.zoomToPoint(point);
        result.current.zoomToPoints([point]);
        result.current.zoomToRoute(point, point);
        result.current.zoomToAirportWithConnections(point, [point]);
        expect(onViewChange).not.toHaveBeenCalled();
        expect(result.current.navigationViewRef.current).toBeNull();
    });
});
