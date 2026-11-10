import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Map as MapLibreMap } from '../maps/maplibre';
import { recoverTornadoBasemap, TORNADO_BASEMAP_TIMEOUT_MS } from '../features/tornadoes/tornadoBasemap';

function renderer() {
    const listeners = new Map<string, Set<(event?: { error: Error }) => void>>();
    const map = {
        setStyle: vi.fn(),
        getStyle: () => ({ sources: { provider: {}, 'tornado-tracks': {} } }),
        getSource: (id: string) => id === 'provider' ? {} : undefined,
        isSourceLoaded: vi.fn((id: string) => id === 'provider'),
        on(type: string, listener: (event?: { error: Error }) => void) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type)!.add(listener);
        },
        off(type: string, listener: (event?: { error: Error }) => void) { listeners.get(type)?.delete(listener); },
    };
    const state = vi.fn();
    const recovery = recoverTornadoBasemap(map as unknown as MapLibreMap, state);
    return { map, state, recovery, fire(type: string, event?: { error: Error }) { listeners.get(type)?.forEach(listener => listener(event)); } };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('finishes provider loading while track data or camera motion keeps the map busy', () => {
    const { map, state, recovery, fire } = renderer();
    fire('style.load');
    fire('render');
    fire('render');
    expect(state).toHaveBeenCalledExactlyOnceWith('ready');
    expect(map.isSourceLoaded).toHaveBeenCalledWith('provider');
    expect(map.isSourceLoaded).not.toHaveBeenCalledWith('tornado-tracks');
    vi.advanceTimersByTime(TORNADO_BASEMAP_TIMEOUT_MS);
    expect(map.setStyle).not.toHaveBeenCalled();
    recovery.dispose();
});

it('does not mark a style ready before provider tiles load', () => {
    const { map, state, recovery, fire } = renderer();
    map.isSourceLoaded.mockReturnValue(false);
    fire('style.load');
    fire('render');
    fire('idle');
    expect(state).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TORNADO_BASEMAP_TIMEOUT_MS);
    expect(state).toHaveBeenLastCalledWith('unavailable');
    recovery.dispose();
});

it('suspends the background deadline while the renderer has lost its context', () => {
    const { map, state, recovery, fire } = renderer();
    fire('webglcontextlost');
    recovery.retry();
    vi.advanceTimersByTime(TORNADO_BASEMAP_TIMEOUT_MS);
    expect(map.setStyle).not.toHaveBeenCalled();
    fire('webglcontextrestored');
    fire('style.load');
    fire('sourcedata');
    expect(state).toHaveBeenLastCalledWith('ready');
    vi.advanceTimersByTime(TORNADO_BASEMAP_TIMEOUT_MS);
    expect(map.setStyle).not.toHaveBeenCalled();
    recovery.dispose();
});

it('does not replace the style after a fatal worker error', () => {
    const { map, recovery, fire } = renderer();
    fire('error', { error: new Error('Worker initialization failed') });
    vi.advanceTimersByTime(TORNADO_BASEMAP_TIMEOUT_MS);
    expect(map.setStyle).not.toHaveBeenCalled();
    recovery.dispose();
});
