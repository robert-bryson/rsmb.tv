import { Suspense, useLayoutEffect } from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import type { GlobeMethods } from 'react-globe.gl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGlobeCamera } from '../features/flights/hooks/useGlobeCamera';
import { DEFAULT_VIEW } from '../features/flights/constants';
import type { GlobeViewState } from '../features/flights/types';

function cameraOptions() {
    const canvas = document.createElement('canvas');
    const controls = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const globe = {
        controls: vi.fn(() => controls),
        pointOfView: vi.fn((): GlobeViewState => DEFAULT_VIEW),
        toGlobeCoords: vi.fn((): { lat: number; lng: number } | null => null),
        globeTileEngineClearCache: vi.fn(),
        renderer: () => ({ domElement: canvas }),
    };
    return {
        canvas, controls, globe,
        options: {
            globeRef: { current: globe as unknown as GlobeMethods },
            navigationViewRef: { current: null },
            selectedView: null,
            rotationEnabled: false,
            reducedMotion: false,
            tileUrl: null,
            onStopRotation: vi.fn(),
            onViewChange: vi.fn(),
        },
    };
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('globe camera readiness lifecycle', () => {
    it('does not update a camera from a render that has not committed', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { globe, options } = cameraOptions();
        let onReady: (() => void) | undefined;
        const pending = new Promise<void>(() => {});
        function SuspendedCamera(): never {
            onReady = useGlobeCamera(options).onGlobeReady;
            throw pending;
        }
        render(<Suspense fallback={<p>Loading</p>}><SuspendedCamera /></Suspense>);
        expect(onReady).toBeTypeOf('function');
        act(() => onReady!());
        expect(error).not.toHaveBeenCalled();
        expect(globe.controls).not.toHaveBeenCalled();
    });

    it('honors readiness reported by a child layout effect before the parent commits', () => {
        const { globe, options } = cameraOptions();
        function Renderer({ onReady }: { onReady: () => void }) {
            useLayoutEffect(onReady, [onReady]);
            return null;
        }
        function Camera() {
            const { onGlobeReady } = useGlobeCamera(options);
            return <Renderer onReady={onGlobeReady} />;
        }
        render(<Camera />);
        expect(globe.controls).toHaveBeenCalled();
        expect(globe.pointOfView).toHaveBeenCalledWith(DEFAULT_VIEW, 0);
    });

    it.each(['zoom', 'gesture end'])('ignores %s callbacks that arrive after unmount', event => {
        vi.useFakeTimers();
        const { controls, options } = cameraOptions();
        const { result, unmount } = renderHook(() => useGlobeCamera(options));
        act(() => result.current.onGlobeReady());
        act(() => vi.advanceTimersByTime(0));
        const onZoom = result.current.onZoom;
        const onGestureEnd = controls.addEventListener.mock.calls.find(([type]) => type === 'end')![1] as () => void;
        unmount();

        act(() => {
            if (event === 'zoom') onZoom({ lat: 10, lng: 20, altitude: 1 });
            else onGestureEnd();
        });
        expect(vi.getTimerCount()).toBe(0);
        act(() => vi.advanceTimersByTime(250));
        expect(options.onViewChange).not.toHaveBeenCalled();
    });

    it.each(['lat', 'lng', 'altitude'] as const)('rejects a non-finite %s from the renderer', key => {
        vi.useFakeTimers();
        const { globe, options } = cameraOptions();
        const { result } = renderHook(() => useGlobeCamera(options));
        act(() => result.current.onGlobeReady());
        act(() => vi.advanceTimersByTime(0));
        globe.pointOfView.mockReturnValue({ ...DEFAULT_VIEW, [key]: Number.NaN });

        act(() => result.current.onZoom());
        act(() => vi.advanceTimersByTime(250));
        expect(options.onViewChange).not.toHaveBeenCalled();
    });

    it.each([false, true])('zooms at the current center when the click misses the globe (lookup throws: %s)', throws => {
        vi.useFakeTimers();
        const { canvas, globe, options } = cameraOptions();
        if (throws) globe.toGlobeCoords.mockImplementation(() => { throw new Error('No globe intersection'); });
        const { result } = renderHook(() => useGlobeCamera(options));
        act(() => result.current.onGlobeReady());
        act(() => vi.advanceTimersByTime(0));
        globe.pointOfView.mockClear();

        fireEvent.doubleClick(canvas);
        const expected = { ...DEFAULT_VIEW, altitude: 1 };
        expect(globe.pointOfView).toHaveBeenLastCalledWith(expected, 1000);
        expect(options.onViewChange).toHaveBeenCalledWith(expected, { replace: true });
    });
});
