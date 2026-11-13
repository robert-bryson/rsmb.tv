import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as geometry from '../../src/features/pins/geometry';
import { useCountyCircles } from '../../src/features/pins/useCountyCircles';
import { publishedPins } from './pinsFixtures';

const pins = publishedPins.pins.filter(pin => pin.level === 'county').slice(0, 256);
const context: ReadonlySet<string> = new Set();

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('county circle preparation', () => {
    it('yields when the time budget is exhausted and publishes only a complete collection', () => {
        const build = vi.spyOn(geometry, 'pinCircles');
        let time = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => time += 10);
        const { result } = renderHook(() => useCountyCircles(pins, context, true));
        act(() => vi.advanceTimersToNextTimer());
        expect(build.mock.calls.flatMap(([batch]) => batch)).toHaveLength(8);
        expect(result.current.features).toHaveLength(0);
        act(() => vi.runAllTimers());
        expect(result.current.features).toHaveLength(pins.length);
        expect(result.current.features.every(feature => feature.geometry.type === 'Polygon')).toBe(true);
    });

    it('cancels queued work on unmount', () => {
        const build = vi.spyOn(geometry, 'pinCircles');
        const view = renderHook(() => useCountyCircles(pins, context, true));
        view.unmount();
        act(() => vi.runAllTimers());
        expect(build).not.toHaveBeenCalled();
    });

    it('reuses a completed collection after the layer is hidden and restored', () => {
        const build = vi.spyOn(geometry, 'pinCircles');
        const { result, rerender } = renderHook(({ enabled }) => useCountyCircles(pins, context, enabled), { initialProps: { enabled: true } });
        act(() => vi.runAllTimers());
        const prepared = result.current;
        const calls = build.mock.calls.length;
        rerender({ enabled: false });
        expect(result.current.features).toHaveLength(0);
        rerender({ enabled: true });
        act(() => vi.runAllTimers());
        expect(result.current).toBe(prepared);
        expect(build).toHaveBeenCalledTimes(calls);
    });

    it('does not schedule work for an empty county collection', () => {
        const build = vi.spyOn(geometry, 'pinCircles');
        const { result } = renderHook(() => useCountyCircles([], context, true));
        act(() => vi.runAllTimers());
        expect(result.current.features).toHaveLength(0);
        expect(build).not.toHaveBeenCalled();
    });
});
