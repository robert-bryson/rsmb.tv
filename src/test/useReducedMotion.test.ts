import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReducedMotion } from '../features/flights/hooks/useReducedMotion';

describe('useReducedMotion', () => {
    let matchMediaSpy: ReturnType<typeof vi.fn>;
    let listeners: Map<string, Set<() => void>>;

    beforeEach(() => {
        listeners = new Map();
        matchMediaSpy = vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            addEventListener: (_event: string, cb: () => void) => {
                if (!listeners.has(query)) listeners.set(query, new Set());
                listeners.get(query)!.add(cb);
            },
            removeEventListener: (_event: string, cb: () => void) => {
                listeners.get(query)?.delete(cb);
            },
        }));
        Object.defineProperty(window, 'matchMedia', { value: matchMediaSpy, writable: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns false when prefers-reduced-motion is not set', () => {
        const { result } = renderHook(() => useReducedMotion());
        expect(result.current).toBe(false);
    });

    it('returns true when prefers-reduced-motion: reduce is active', () => {
        matchMediaSpy.mockImplementation((query: string) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));

        const { result } = renderHook(() => useReducedMotion());
        expect(result.current).toBe(true);
    });
});
