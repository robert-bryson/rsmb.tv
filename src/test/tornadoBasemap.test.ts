import type { Map as MapLibreMap } from '../maps/maplibre';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recoverTornadoBasemap, TORNADO_BASEMAP_TIMEOUT_MS } from '../features/tornadoes/tornadoBasemap';

type Listener = (event: { error?: Error; sourceId?: string }) => void;

function renderer() {
    const listeners = new Map<string, Set<Listener>>();
    const map = {
        setStyle: vi.fn(),
        getStyle: () => ({ sources: { 'provider-tiles': {} } }),
        getSource: () => ({}),
        isSourceLoaded: () => true,
        on(type: string, listener: Listener) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type)!.add(listener);
        },
        off(type: string, listener: Listener) { listeners.get(type)?.delete(listener); },
    };
    return {
        map,
        fire(type: string, event = {}) { listeners.get(type)?.forEach(listener => listener(event)); },
        connect: (onState: Parameters<typeof recoverTornadoBasemap>[1]) => recoverTornadoBasemap(map as unknown as MapLibreMap, onState),
    };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('tornado basemap recovery', () => {
    it('replaces a failed background once and allows another failed attempt', () => {
        const { map, fire, connect } = renderer();
        const state = vi.fn();
        const recovery = connect(state);
        fire('error', { error: new Error('HTTP 503'), sourceId: 'provider-tiles' });
        fire('error', { error: new Error('another tile failed') });
        expect(map.setStyle).toHaveBeenCalledTimes(1);
        const neutralStyle = map.setStyle.mock.calls[0][0];
        expect(JSON.stringify(neutralStyle)).not.toContain('basemaps.cartocdn.com');
        expect(state).toHaveBeenLastCalledWith('unavailable');
        fire('idle');
        expect(state).toHaveBeenLastCalledWith('unavailable');

        recovery.retry();
        expect(state).toHaveBeenLastCalledWith('loading');
        expect(map.setStyle).toHaveBeenLastCalledWith(expect.anything(), { diff: false });
        fire('error', { error: new Error('HTTP 503') });
        expect(map.setStyle).toHaveBeenCalledTimes(3);
        expect(state).toHaveBeenLastCalledWith('unavailable');
        recovery.dispose();
    });

    it('bounds a stalled request and cancels the deadline after successful retry', () => {
        const { map, fire, connect } = renderer();
        const state = vi.fn();
        const recovery = connect(state);
        vi.advanceTimersByTime(TORNADO_BASEMAP_TIMEOUT_MS);
        expect(state).toHaveBeenLastCalledWith('unavailable');
        recovery.retry();
        fire('style.load');
        fire('idle');
        expect(state).toHaveBeenLastCalledWith('ready');
        vi.advanceTimersByTime(TORNADO_BASEMAP_TIMEOUT_MS);
        expect(map.setStyle).toHaveBeenCalledTimes(2);
        recovery.dispose();
    });

    it('leaves data and renderer errors to their existing recovery paths', () => {
        const { map, fire, connect } = renderer();
        const recovery = connect(vi.fn());
        for (const sourceId of ['tornado-tracks', 'tornado-track-points', 'tornado-points', 'selected-tornado-track', 'us-states']) {
            fire('error', { error: new Error('Invalid data'), sourceId });
        }
        fire('error', { error: new Error('WebGL context lost') });
        fire('error', { error: new Error('Worker initialization failed') });
        vi.advanceTimersByTime(TORNADO_BASEMAP_TIMEOUT_MS);
        expect(map.setStyle).not.toHaveBeenCalled();
        recovery.dispose();
    });

    it('removes listeners and pending work on disposal', () => {
        const { map, fire, connect } = renderer();
        const state = vi.fn();
        const recovery = connect(state);
        recovery.dispose();
        fire('idle');
        fire('error', { error: new Error('HTTP 503') });
        recovery.retry();
        vi.runAllTimers();
        expect(map.setStyle).not.toHaveBeenCalled();
        expect(state).not.toHaveBeenCalled();
    });
});
