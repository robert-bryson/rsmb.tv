import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardHelp } from '../features/flights/components/KeyboardHelp';
import { useKeyboardShortcuts } from '../features/flights/hooks/useKeyboardShortcuts';

afterEach(() => localStorage.removeItem('flights-character-shortcuts'));

function mount() {
    const actions = {
        onToggleStats: vi.fn(), onToggleFilter: vi.fn(), onResetView: vi.fn(),
        onClearSelection: vi.fn(), onColorModeChange: vi.fn(),
    };
    function Controls() {
        const shortcuts = useKeyboardShortcuts(actions);
        return <>
            <button onClick={() => shortcuts.setShowHelp(true)}>Help</button>
            <KeyboardHelp isOpen={shortcuts.showHelp} onClose={() => shortcuts.setShowHelp(false)}
                shortcutsEnabled={shortcuts.shortcutsEnabled} onShortcutsChange={shortcuts.setShortcutsEnabled} />
        </>;
    }
    const view = render(<Controls />);
    const trigger = screen.getByRole('button', { name: 'Help' });
    trigger.focus();
    fireEvent.click(trigger);
    return { ...view, actions, trigger };
}

describe('keyboard help', () => {
    it('isolates modal input and restores focus without clearing the map selection', () => {
        const { actions, trigger } = mount();
        const dialog = screen.getByRole('dialog', { name: 'Keyboard Shortcuts' });
        for (const key of ['s', 'f', 'r', '1']) fireEvent.keyDown(dialog, { key });
        for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
        fireEvent.keyDown(dialog, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(actions.onClearSelection).not.toHaveBeenCalled();
        expect(trigger).toHaveFocus();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(actions.onClearSelection).toHaveBeenCalledOnce();
    });

    it('keeps help reachable when character shortcuts are disabled', () => {
        const { trigger } = mount();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Enable character shortcuts' }));
        expect(screen.getByRole('dialog')).toHaveTextContent('Press Escape to close');
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'h' });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        fireEvent.click(trigger);
        expect(screen.getByRole('checkbox', { name: 'Enable character shortcuts' })).not.toBeChecked();
        fireEvent.click(screen.getByRole('button', { name: 'Close keyboard shortcuts' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});
