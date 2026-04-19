import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStatsPanelState } from '../features/flights/hooks/useStatsPanelState';

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

describe('useStatsPanelState', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        vi.clearAllMocks();
    });

    it('defaults to false when no stored value', () => {
        const { result } = renderHook(() => useStatsPanelState());
        expect(result.current[0]).toBe(false);
    });

    it('uses provided default', () => {
        const { result } = renderHook(() => useStatsPanelState(true));
        expect(result.current[0]).toBe(true);
    });

    it('persists state changes to localStorage', () => {
        const { result } = renderHook(() => useStatsPanelState(false));
        act(() => result.current[1](true));
        expect(result.current[0]).toBe(true);
        expect(JSON.parse(store['flights-stats-panel-open'])).toBe(true);
    });

    it('reads previously persisted value', () => {
        store['flights-stats-panel-open'] = JSON.stringify(true);
        const { result } = renderHook(() => useStatsPanelState(false));
        expect(result.current[0]).toBe(true);
    });

    it('toggles state correctly', () => {
        const { result } = renderHook(() => useStatsPanelState(false));
        act(() => result.current[1](prev => !prev));
        expect(result.current[0]).toBe(true);
        act(() => result.current[1](prev => !prev));
        expect(result.current[0]).toBe(false);
    });
});
