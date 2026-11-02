import { Suspense, useLayoutEffect } from 'react';
import { act, render } from '@testing-library/react';
import type { GlobeMethods } from 'react-globe.gl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGlobeCamera } from '../features/flights/hooks/useGlobeCamera';
import { DEFAULT_VIEW } from '../features/flights/constants';

function cameraOptions() {
    const controls = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const globe = {
        controls: vi.fn(() => controls),
        pointOfView: vi.fn(() => DEFAULT_VIEW),
        globeTileEngineClearCache: vi.fn(),
        renderer: () => ({ domElement: document.createElement('canvas') }),
    };
    return {
        globe,
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

afterEach(() => vi.restoreAllMocks());

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
});
