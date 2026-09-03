import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStatsPanelState } from '../features/flights/hooks/useStatsPanelState';

describe('useStatsPanelState', () => {
    beforeEach(() => {
        localStorage.clear();
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
        expect(JSON.parse(localStorage.getItem('flights-stats-panel-open') ?? '')).toBe(true);
    });

    it('reads previously persisted value', () => {
        localStorage.setItem('flights-stats-panel-open', JSON.stringify(true));
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
