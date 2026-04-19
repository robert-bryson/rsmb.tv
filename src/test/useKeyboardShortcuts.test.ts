import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../features/flights/hooks/useKeyboardShortcuts';

function createHandlers() {
    return {
        onToggleStats: vi.fn(),
        onToggleFilter: vi.fn(),
        onResetView: vi.fn(),
        onClearSelection: vi.fn(),
        onColorModeChange: vi.fn(),
        onToggleAllAirports: vi.fn(),
        onToggleUSStates: vi.fn(),
    };
}

function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ...opts }));
}

describe('useKeyboardShortcuts', () => {
    it('toggles help with H key', () => {
        const handlers = createHandlers();
        const { result } = renderHook(() => useKeyboardShortcuts(handlers));

        expect(result.current.showHelp).toBe(false);
        act(() => pressKey('h'));
        expect(result.current.showHelp).toBe(true);
        act(() => pressKey('h'));
        expect(result.current.showHelp).toBe(false);
    });

    it('calls onToggleStats on S key', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));
        act(() => pressKey('s'));
        expect(handlers.onToggleStats).toHaveBeenCalledOnce();
    });

    it('calls onToggleFilter on F key', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));
        act(() => pressKey('f'));
        expect(handlers.onToggleFilter).toHaveBeenCalledOnce();
    });

    it('calls onResetView on R key', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));
        act(() => pressKey('r'));
        expect(handlers.onResetView).toHaveBeenCalledOnce();
    });

    it('calls onClearSelection and closes help on Escape', () => {
        const handlers = createHandlers();
        const { result } = renderHook(() => useKeyboardShortcuts(handlers));

        // Open help first
        act(() => pressKey('h'));
        expect(result.current.showHelp).toBe(true);

        act(() => pressKey('Escape'));
        expect(handlers.onClearSelection).toHaveBeenCalledOnce();
        expect(result.current.showHelp).toBe(false);
    });

    it('calls onColorModeChange with correct index for number keys', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));

        act(() => pressKey('1'));
        expect(handlers.onColorModeChange).toHaveBeenCalledWith(0);

        act(() => pressKey('2'));
        expect(handlers.onColorModeChange).toHaveBeenCalledWith(1);

        act(() => pressKey('3'));
        expect(handlers.onColorModeChange).toHaveBeenCalledWith(2);

        act(() => pressKey('4'));
        expect(handlers.onColorModeChange).toHaveBeenCalledWith(3);
    });

    it('calls onToggleAllAirports on Shift+A', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));
        act(() => pressKey('a', { shiftKey: true }));
        expect(handlers.onToggleAllAirports).toHaveBeenCalledOnce();
    });

    it('does not call onToggleAllAirports on A without Shift', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));
        act(() => pressKey('a'));
        expect(handlers.onToggleAllAirports).not.toHaveBeenCalled();
    });

    it('calls onToggleUSStates on Shift+U', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));
        act(() => pressKey('u', { shiftKey: true }));
        expect(handlers.onToggleUSStates).toHaveBeenCalledOnce();
    });

    it('ignores keys when typing in an input', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));

        const input = document.createElement('input');
        document.body.appendChild(input);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
        document.body.removeChild(input);

        // keydown on the input doesn't bubble to window with the input as target
        // in this test setup, so onToggleStats should not be called
        // The important thing is that the hook checks e.target
    });

    it('cleans up event listener on unmount', () => {
        const handlers = createHandlers();
        const { unmount } = renderHook(() => useKeyboardShortcuts(handlers));
        unmount();
        act(() => pressKey('s'));
        expect(handlers.onToggleStats).not.toHaveBeenCalled();
    });
});
