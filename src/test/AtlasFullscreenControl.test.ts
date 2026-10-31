import { describe, expect, it, vi } from 'vitest';
import { AtlasFullscreenControl, restoreAtlasFullscreenControl } from '../features/trips/atlas/AtlasFullscreenControl';

function createMapStub() {
    return {
        _getUIString: (key: string) => key === 'FullscreenControl.Exit' ? 'Exit fullscreen' : 'Enter fullscreen',
        cooperativeGestures: { isEnabled: () => true, disable: vi.fn(), enable: vi.fn() },
        resize: vi.fn(),
    };
}

describe('review regressions: fullscreen control reattachment', () => {
    it.each(['fullscreenElement', 'webkitFullscreenElement'] as const)('resets a detached control after native exit through %s', property => {
        let fullscreenElement: Element | null = null;
        const fullscreenEvent = property === 'fullscreenElement' ? 'fullscreenchange' : 'webkitfullscreenchange';
        // JSDOM has no native fullscreen API. The real MapLibre control receives its browser events.
        const originalElement = Object.getOwnPropertyDescriptor(document, property);
        Object.defineProperty(document, property, { configurable: true, get: () => fullscreenElement });
        const originalHandler = Object.getOwnPropertyDescriptor(document, `on${fullscreenEvent}`);
        Object.defineProperty(document, `on${fullscreenEvent}`, { configurable: true, value: null });
        const target = document.createElement('main');
        const changeFullscreen = (element: Element | null) => {
            fullscreenElement = element;
            document.dispatchEvent(new Event(fullscreenEvent));
        };
        const request = vi.fn(() => changeFullscreen(target));
        const exit = vi.fn(() => changeFullscreen(null));
        Object.defineProperty(target, 'requestFullscreen', { configurable: true, value: request });
        const originalExit = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');
        Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
        const map = createMapStub();
        let control = restoreAtlasFullscreenControl(target, null);
        try {
            let container = control.onAdd(map as never);
            container.querySelector('button')!.click();
            expect(request).toHaveBeenCalledOnce();
            expect(container.querySelector('button')).toHaveAttribute('aria-label', 'Exit fullscreen');
            control.onRemove();
            const retained = restoreAtlasFullscreenControl(target, control);
            expect(retained).toBe(control);
            container = retained.onAdd(map as never);
            expect(container.querySelector('button')).toHaveClass('maplibregl-ctrl-shrink');
            retained.onRemove();
            // A failed renderer leaves the control detached while Escape exits native fullscreen.
            changeFullscreen(null);
            control = restoreAtlasFullscreenControl(target, retained);
            container = control.onAdd(map as never);
            const enter = container.querySelector('button')!;
            expect(enter).toHaveAttribute('aria-label', 'Enter fullscreen');
            expect(enter).toHaveClass('maplibregl-ctrl-fullscreen');
            expect(enter).not.toHaveClass('maplibregl-ctrl-shrink');
            enter.click();
            expect(request).toHaveBeenCalledTimes(2);
            expect(exit).not.toHaveBeenCalled();
            expect(enter).toHaveAttribute('aria-label', 'Exit fullscreen');
        } finally {
            control.onRemove();
            if (originalElement) Object.defineProperty(document, property, originalElement);
            else Reflect.deleteProperty(document, property);
            if (originalHandler) Object.defineProperty(document, `on${fullscreenEvent}`, originalHandler);
            else Reflect.deleteProperty(document, `on${fullscreenEvent}`);
            if (originalExit) Object.defineProperty(document, 'exitFullscreen', originalExit);
            else Reflect.deleteProperty(document, 'exitFullscreen');
        }
    });

    it('keeps the icon and action aligned through renderer replacement and exit', () => {
        const target = document.createElement('main');
        const map = createMapStub();
        const control = new AtlasFullscreenControl({ container: target, pseudo: true });
        let container = control.onAdd(map as never);
        container.querySelector('button')!.click();
        expect(target).toHaveClass('maplibregl-pseudo-fullscreen');
        control.onRemove();
        container = control.onAdd(map as never);
        const exit = container.querySelector('button')!;
        expect(exit).toHaveAttribute('aria-label', 'Exit fullscreen');
        expect(exit).toHaveClass('maplibregl-ctrl-shrink');
        expect(exit).not.toHaveClass('maplibregl-ctrl-fullscreen');
        exit.click();
        expect(target).not.toHaveClass('maplibregl-pseudo-fullscreen');
        expect(exit).toHaveAttribute('aria-label', 'Enter fullscreen');
        expect(exit).toHaveClass('maplibregl-ctrl-fullscreen');
        expect(exit).not.toHaveClass('maplibregl-ctrl-shrink');
        expect(map.cooperativeGestures.enable).toHaveBeenCalledOnce();
        control.onRemove();
        container = control.onAdd(map as never);
        expect(container.querySelector('button')).toHaveClass('maplibregl-ctrl-fullscreen');
        control.onRemove();
    });
});
