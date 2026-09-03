import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedState } from '../hooks/usePersistedState';

describe('usePersistedState', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns the default value when nothing is stored', () => {
        const { result } = renderHook(() => usePersistedState('key', 42));
        expect(result.current[0]).toBe(42);
    });

    it('persists values to localStorage', () => {
        const { result } = renderHook(() => usePersistedState('color', 'blue'));
        act(() => result.current[1]('red'));
        expect(result.current[0]).toBe('red');
        expect(JSON.parse(localStorage.getItem('color') ?? '')).toBe('red');
    });

    it('reads previously persisted values', () => {
        localStorage.setItem('saved', JSON.stringify('hello'));
        const { result } = renderHook(() => usePersistedState('saved', 'default'));
        expect(result.current[0]).toBe('hello');
    });

    it('supports functional updater', () => {
        const { result } = renderHook(() => usePersistedState('count', 0));
        act(() => result.current[1]((prev: number) => prev + 1));
        expect(result.current[0]).toBe(1);
        act(() => result.current[1]((prev: number) => prev + 5));
        expect(result.current[0]).toBe(6);
    });

    it('handles complex objects', () => {
        const initial = { a: 1, b: [2, 3] };
        const { result } = renderHook(() => usePersistedState('obj', initial));
        expect(result.current[0]).toEqual(initial);
        act(() => result.current[1]({ a: 10, b: [] }));
        expect(result.current[0]).toEqual({ a: 10, b: [] });
    });

    it('falls back to default on invalid JSON in localStorage', () => {
        localStorage.setItem('bad', 'not-json');
        const { result } = renderHook(() => usePersistedState('bad', 'fallback'));
        expect(result.current[0]).toBe('fallback');
    });
});
