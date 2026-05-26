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
        onShortcut: vi.fn(),
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

    it('delegates help changes when controlled', () => {
        const handlers = createHandlers();
        const onHelpChange = vi.fn();
        renderHook(() => useKeyboardShortcuts({
            ...handlers,
            showHelp: false,
            onHelpChange,
        }));

        act(() => pressKey('h'));
        expect(onHelpChange).toHaveBeenCalledWith(expect.any(Function));

        act(() => pressKey('Escape'));
        expect(onHelpChange).toHaveBeenCalledWith(false);
    });

    it('calls onToggleStats on S key', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));
        act(() => pressKey('s'));
        expect(handlers.onToggleStats).toHaveBeenCalledOnce();
        expect(handlers.onShortcut).toHaveBeenCalledOnce();
    });

    it('calls onToggleFilter on F key', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));
        act(() => pressKey('f'));
        expect(handlers.onToggleFilter).toHaveBeenCalledOnce();
    });

    it('does not intercept browser or system modified shortcuts', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));

        act(() => pressKey('f', { ctrlKey: true }));
        act(() => pressKey('r', { metaKey: true }));
        act(() => pressKey('h', { altKey: true }));

        expect(handlers.onToggleFilter).not.toHaveBeenCalled();
        expect(handlers.onResetView).not.toHaveBeenCalled();
        expect(handlers.onShortcut).not.toHaveBeenCalled();
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
        expect(handlers.onShortcut).not.toHaveBeenCalled();
    });

    it('does not call onShortcut for unsupported keys', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));
        act(() => pressKey('x'));
        expect(handlers.onShortcut).not.toHaveBeenCalled();
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
        act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true })));
        document.body.removeChild(input);

        expect(handlers.onToggleStats).not.toHaveBeenCalled();
        expect(handlers.onShortcut).not.toHaveBeenCalled();
    });

    it('ignores keys when typing in contenteditable elements', () => {
        const handlers = createHandlers();
        renderHook(() => useKeyboardShortcuts(handlers));

        const editor = document.createElement('div');
        editor.contentEditable = 'true';
        document.body.appendChild(editor);
        act(() => editor.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true })));
        document.body.removeChild(editor);

        expect(handlers.onToggleStats).not.toHaveBeenCalled();
        expect(handlers.onShortcut).not.toHaveBeenCalled();
    });

    it('cleans up event listener on unmount', () => {
        const handlers = createHandlers();
        const { unmount } = renderHook(() => useKeyboardShortcuts(handlers));
        unmount();
        act(() => pressKey('s'));
        expect(handlers.onToggleStats).not.toHaveBeenCalled();
    });
});
