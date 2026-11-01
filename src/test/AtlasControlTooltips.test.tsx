import { useRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AtlasControlTooltips } from '../features/trips/atlas/AtlasControlTooltips';

function Example({ enabled = true, controlVisible = true, help = 'Show or hide table columns.' }: { enabled?: boolean; controlVisible?: boolean; help?: string }) {
    const root = useRef<HTMLElement>(null);
    return <main ref={root}>
        <span id="existing-help">Existing description.</span>
        {controlVisible && <button aria-describedby="existing-help" data-atlas-tooltip={help}>Columns</button>}
        <button data-atlas-tooltip="Choose a sort order.">Sort</button>
        {enabled && <AtlasControlTooltips container={root} />}
    </main>;
}

describe('Atlas control tooltips', () => {
    it('keeps the keyboard hint when scrolling moves another control under the pointer', () => {
        vi.useFakeTimers();
        try {
            render(<Example />);
            const control = screen.getByRole('button', { name: 'Columns' });
            const other = screen.getByRole('button', { name: 'Sort' });
            act(() => control.focus());
            fireEvent(other, Object.assign(new Event('pointerover', { bubbles: true }), { pointerType: 'mouse' }));
            fireEvent(other, new Event('pointerout', { bubbles: true }));
            act(() => { vi.runOnlyPendingTimers(); });
            expect(control).toHaveFocus();
            expect(screen.getByRole('tooltip')).toHaveTextContent('Show or hide table columns.');
            expect(control).toHaveAccessibleDescription('Existing description. Show or hide table columns.');
        } finally { vi.useRealTimers(); }
    });

    it('updates an active hint when the control changes its action', async () => {
        const { rerender } = render(<Example />);
        const control = screen.getByRole('button', { name: 'Columns' });
        fireEvent.focusIn(control);
        rerender(<Example help="Close column settings." />);
        await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Close column settings.'));
        expect(control).toHaveAccessibleDescription('Existing description. Close column settings.');
    });

    it('removes a hint and its description when the control is replaced', async () => {
        const { rerender } = render(<Example />);
        const control = screen.getByRole('button', { name: 'Columns' });
        fireEvent.focusIn(control);
        rerender(<Example controlVisible={false} />);
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
        expect(control).toHaveAttribute('aria-describedby', 'existing-help');
    });

    it('dismisses a hint when its control no longer has tooltip text', async () => {
        const { rerender } = render(<Example />);
        fireEvent.focusIn(screen.getByRole('button', { name: 'Columns' }));
        rerender(<Example help="" />);
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    });

    it('explains keyboard-focused controls, preserves existing descriptions, and dismisses with Escape', () => {
        render(<Example />);
        const control = screen.getByRole('button', { name: 'Columns' });
        fireEvent.focusIn(control);
        expect(screen.getByRole('tooltip')).toHaveTextContent('Show or hide table columns.');
        expect(control).toHaveAccessibleDescription('Existing description. Show or hide table columns.');
        fireEvent.keyDown(control, { key: 'Escape' });
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(control).toHaveAttribute('aria-describedby', 'existing-help');
    });

    it('cleans up descriptions and event listeners when removed', () => {
        const { rerender } = render(<Example />);
        const control = screen.getByRole('button', { name: 'Columns' });
        fireEvent.focusIn(control);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        rerender(<Example enabled={false} />);
        expect(control).toHaveAttribute('aria-describedby', 'existing-help');
        fireEvent.focusIn(control);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('suppresses delayed focus hints after touch until keyboard navigation resumes', () => {
        vi.useFakeTimers();
        try {
            render(<Example />);
            const control = screen.getByRole('button', { name: 'Columns' });
            fireEvent(control, Object.assign(new Event('pointerdown', { bubbles: true }), { pointerType: 'touch' }));
            fireEvent.pointerUp(control);
            act(() => { vi.runOnlyPendingTimers(); });
            fireEvent.focusIn(control);
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
            fireEvent.keyDown(control, { key: 'Tab' });
            fireEvent.focusIn(control);
            expect(screen.getByRole('tooltip')).toHaveTextContent('Show or hide table columns.');
        } finally { vi.useRealTimers(); }
    });
});
