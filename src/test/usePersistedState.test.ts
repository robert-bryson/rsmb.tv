import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedState } from '../hooks/usePersistedState';

// Mock localStorage since jsdom's implementation is incomplete
const store: Record<string, string> = {};
const mockLocalStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

describe('usePersistedState', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        vi.clearAllMocks();
    });

    it('returns the default value when nothing is stored', () => {
        const { result } = renderHook(() => usePersistedState('key', 42));
        expect(result.current[0]).toBe(42);
    });

    it('persists values to localStorage', () => {
        const { result } = renderHook(() => usePersistedState('color', 'blue'));
        act(() => result.current[1]('red'));
        expect(result.current[0]).toBe('red');
        expect(JSON.parse(store['color'])).toBe('red');
    });

    it('reads previously persisted values', () => {
        store['saved'] = JSON.stringify('hello');
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
        store['bad'] = 'not-json';
        const { result } = renderHook(() => usePersistedState('bad', 'fallback'));
        expect(result.current[0]).toBe('fallback');
    });
});
