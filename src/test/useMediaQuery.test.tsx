import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { useMediaQuery } from '../hooks/useMediaQuery';

afterEach(() => vi.unstubAllGlobals());

function mediaQueries() {
    const queries = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
    const matchMedia = vi.fn((query: string) => {
        const state = { matches: false, listeners: new Set<() => void>() };
        queries.set(query, state);
        return {
            get matches() { return state.matches; },
            addEventListener: (_event: string, callback: () => void) => state.listeners.add(callback),
            removeEventListener: (_event: string, callback: () => void) => state.listeners.delete(callback),
        };
    });
    vi.stubGlobal('matchMedia', matchMedia);
    return { queries, matchMedia };
}

it('updates from the subscribed query and removes its listener on unmount', () => {
    const { queries, matchMedia } = mediaQueries();
    const { result, rerender, unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    const state = queries.get('(max-width: 767px)')!;
    expect(result.current).toBe(false);
    act(() => { state.matches = true; state.listeners.forEach(notify => notify()); });
    expect(result.current).toBe(true);
    rerender();
    expect(matchMedia).toHaveBeenCalledOnce();
    expect(state.listeners.size).toBe(1);
    unmount();
    expect(state.listeners.size).toBe(0);
});

it('replaces the subscription when the query changes', () => {
    const { queries } = mediaQueries();
    const { result, rerender } = renderHook(({ query }) => useMediaQuery(query), { initialProps: { query: '(color)' } });
    const previous = queries.get('(color)')!;
    rerender({ query: '(hover)' });
    expect(previous.listeners.size).toBe(0);
    const current = queries.get('(hover)')!;
    act(() => { previous.matches = true; previous.listeners.forEach(notify => notify()); });
    expect(result.current).toBe(false);
    act(() => { current.matches = true; current.listeners.forEach(notify => notify()); });
    expect(result.current).toBe(true);
});

it('has a stable false fallback without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result, unmount } = renderHook(() => useMediaQuery('(hover)'));
    expect(result.current).toBe(false);
    expect(() => unmount()).not.toThrow();
});

it('renders a server snapshot without accessing browser APIs', () => {
    vi.stubGlobal('window', undefined);
    function Preference() { return <span>{String(useMediaQuery('(hover)'))}</span>; }
    expect(renderToString(<Preference />)).toBe('<span>false</span>');
});
