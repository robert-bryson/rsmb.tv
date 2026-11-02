import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TripAtlasColumnSettings } from '../features/trips/atlas/TripAtlasColumnSettings';
import { defaultAtlasTableColumns } from '../features/trips/atlas/tripAtlasTableColumns';

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 600));
    HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); HTMLElement.prototype.scrollIntoView = originalScrollIntoView; });

function openSettings() {
    const onChange = vi.fn();
    render(<main className="atlas-explorer">
        <TripAtlasColumnSettings columns={defaultAtlasTableColumns()} onChange={onChange} />
        <button type="button">Outside the editor</button>
    </main>);
    const trigger = screen.getByRole('button', { name: 'Customize table columns' });
    fireEvent.click(trigger);
    const editor = screen.getByRole('dialog', { name: 'Table columns' });
    return { trigger, editor, onChange };
}

describe('atlas column editor focus', () => {
    it('closes when keyboard focus leaves the document from the portal', () => {
        const { editor, trigger } = openSettings();
        const reset = within(editor).getByRole('button', { name: 'Reset columns' });
        act(() => reset.focus());
        fireEvent.blur(reset, { relatedTarget: null });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('returns focus to its trigger when resizing removes the focused editor', () => {
        const { trigger } = openSettings();
        expect(screen.getByRole('checkbox', { name: 'Show Motorcycle column' })).toHaveFocus();
        fireEvent(window, new Event('resize'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('keeps pointer interactions inside the editor usable when a browser blurs to no target', () => {
        const { editor, onChange } = openSettings();
        const motorcycle = within(editor).getByRole('checkbox', { name: 'Show Motorcycle column' });
        fireEvent.pointerDown(motorcycle);
        act(() => motorcycle.blur());
        expect(editor).toBeInTheDocument();
        expect(document.body).toHaveFocus();
        fireEvent.pointerUp(motorcycle);
        fireEvent.click(motorcycle);
        expect(onChange).toHaveBeenCalledOnce();
        const reset = within(editor).getByRole('button', { name: 'Reset columns' });
        act(() => reset.focus());
        fireEvent.blur(reset, { relatedTarget: null });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes when focus moves outside after an inside pointer click left focus on the body', () => {
        const { editor } = openSettings();
        const motorcycle = within(editor).getByRole('checkbox', { name: 'Show Motorcycle column' });
        fireEvent.pointerDown(motorcycle);
        act(() => motorcycle.blur());
        fireEvent.pointerCancel(motorcycle);
        expect(editor).toBeInTheDocument();
        act(() => screen.getByRole('button', { name: 'Outside the editor' }).focus());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('dismisses the editor when the browser window loses focus', () => {
        openSettings();
        fireEvent(window, new Event('blur'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('retains the portal while focus moves inside it and closes when focus moves outside', () => {
        const { editor, onChange } = openSettings();
        const motorcycle = within(editor).getByRole('checkbox', { name: 'Show Motorcycle column' });
        fireEvent.click(motorcycle);
        expect(onChange).toHaveBeenCalledWith(defaultAtlasTableColumns().map(column => ({
            ...column, visible: column.id !== 'motorcycle',
        })));
        act(() => within(editor).getByRole('button', { name: 'Reset columns' }).focus());
        expect(editor).toBeInTheDocument();
        act(() => screen.getByRole('button', { name: 'Outside the editor' }).focus());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
