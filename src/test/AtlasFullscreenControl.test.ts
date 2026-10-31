import { describe, expect, it, vi } from 'vitest';
import { AtlasFullscreenControl } from '../features/trips/atlas/AtlasFullscreenControl';

describe('review regressions: fullscreen control reattachment', () => {
    it('keeps the icon and action aligned through renderer replacement and exit', () => {
        const target = document.createElement('main');
        const map = {
            _getUIString: (key: string) => key === 'FullscreenControl.Exit' ? 'Exit fullscreen' : 'Enter fullscreen',
            cooperativeGestures: { isEnabled: () => true, disable: vi.fn(), enable: vi.fn() },
            resize: vi.fn(),
        };
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
