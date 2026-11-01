import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtlasPanelState } from '../features/trips/atlas/tripAtlasBrowser';
import { useAtlasPanelDrag } from '../features/trips/atlas/useAtlasPanelDrag';

function Example() {
    const drawer = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<AtlasPanelState>('compact');
    const handlers = useAtlasPanelDrag(drawer, state, setState);
    return <main className="atlas-explorer" data-state={state}>
        <div ref={drawer} className="atlas-drawer">
            <div data-testid="handle" {...handlers}>
                <button onClick={() => setState(current => current === 'collapsed' ? 'compact' : 'collapsed')}>Toggle panel</button>
            </div>
        </div>
    </main>;
}

function pointer(target: Element, type: string, values: Record<string, unknown> = {}) {
    fireEvent(target, Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        pointerId: 1, isPrimary: true, button: 0, clientX: 0, clientY: 0, ...values,
    }));
}

describe('atlas panel dragging', () => {
    let vertical: boolean;
    let captured: boolean;
    let release: ReturnType<typeof vi.fn<(pointerId: number) => void>>;

    const setup = () => {
        const view = render(<Example />);
        const button = screen.getByRole('button');
        button.setPointerCapture = vi.fn(() => { captured = true; });
        button.hasPointerCapture = vi.fn(() => captured);
        button.releasePointerCapture = release;
        return view;
    };

    beforeEach(() => {
        vertical = false;
        captured = false;
        release = vi.fn(() => { captured = false; });
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: vertical })));
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            const size = (dimension: 'width' | 'height') => this.style[dimension].includes('expanded') ? 600 : 360;
            return { width: size('width'), height: size('height') } as DOMRect;
        });
    });

    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

    it('retains ordinary clicks below the movement threshold', () => {
        setup();
        const button = screen.getByRole('button');
        pointer(button, 'pointerdown');
        pointer(button, 'pointermove', { clientX: 3 });
        expect(screen.getByRole('main')).not.toHaveAttribute('data-panel-dragging');
        pointer(button, 'pointerup');
        fireEvent.click(button, { detail: 1 });
        expect(screen.getByRole('main')).toHaveAttribute('data-state', 'collapsed');
    });

    it.each([{ isPrimary: false }, { button: 2 }])('ignores unsupported presses: %j', values => {
        setup();
        pointer(screen.getByRole('button'), 'pointerdown', values);
        pointer(screen.getByTestId('handle'), 'pointermove', { clientX: 400 });
        expect(captured).toBe(false);
        expect(screen.getByRole('main')).toHaveAttribute('data-state', 'compact');
    });

    it('snaps a horizontal drag and suppresses its generated release click', () => {
        setup();
        const button = screen.getByRole('button');
        pointer(button, 'pointerdown');
        pointer(button, 'pointermove', { clientX: 400 });
        const root = screen.getByRole('main');
        expect(root).toHaveAttribute('data-state', 'expanded');
        expect(root.style.getPropertyValue('--atlas-drag-size')).toBe('600px');
        pointer(button, 'pointerup', { pointerId: 2 });
        expect(root).toHaveAttribute('data-panel-dragging');
        pointer(button, 'pointerup');
        fireEvent.click(button, { detail: 1 });
        expect(root).toHaveAttribute('data-state', 'expanded');
        expect(root).not.toHaveAttribute('data-panel-dragging');
        expect(release).toHaveBeenCalledWith(1);
    });

    it('uses upward movement to expand the phone sheet and restores its state on cancellation', () => {
        vertical = true;
        setup();
        const button = screen.getByRole('button');
        pointer(button, 'pointerdown', { clientY: 500 });
        pointer(button, 'pointermove', { clientY: 0 });
        expect(screen.getByRole('main')).toHaveAttribute('data-state', 'expanded');
        pointer(button, 'pointercancel');
        expect(screen.getByRole('main')).toHaveAttribute('data-state', 'compact');
        expect(screen.getByRole('main').style.getPropertyValue('--atlas-drag-size')).toBe('');
    });

    it.each(['resize', 'blur'])('cancels an interrupted drag on window %s and keeps the next click usable', type => {
        setup();
        const button = screen.getByRole('button');
        pointer(button, 'pointerdown');
        pointer(button, 'pointermove', { clientX: 400 });
        fireEvent(window, new Event(type));
        pointer(button, 'pointermove', { clientX: -400 });
        pointer(button, 'pointerup');
        expect(screen.getByRole('main')).toHaveAttribute('data-state', 'compact');
        expect(screen.getByRole('main')).not.toHaveAttribute('data-panel-dragging');
        pointer(button, 'pointerdown');
        pointer(button, 'pointerup');
        fireEvent.click(button, { detail: 1 });
        expect(screen.getByRole('main')).toHaveAttribute('data-state', 'collapsed');
    });

    it('restores the starting state with Escape and commits on lost capture', () => {
        setup();
        const button = screen.getByRole('button');
        pointer(button, 'pointerdown');
        pointer(button, 'pointermove', { clientX: -400 });
        button.blur();
        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(screen.getByRole('main')).toHaveAttribute('data-state', 'compact');
        pointer(button, 'pointerdown');
        pointer(button, 'pointermove', { clientX: -400 });
        pointer(button, 'lostpointercapture');
        expect(screen.getByRole('main')).toHaveAttribute('data-state', 'collapsed');
        expect(screen.getByRole('main')).not.toHaveAttribute('data-panel-dragging');
    });

    it('releases capture and removes transient styles on unmount', () => {
        const { unmount } = setup();
        const button = screen.getByRole('button');
        const root = screen.getByRole('main');
        pointer(button, 'pointerdown');
        pointer(button, 'pointermove', { clientX: 100 });
        unmount();
        expect(root).not.toHaveAttribute('data-panel-dragging');
        expect(root.style.getPropertyValue('--atlas-drag-size')).toBe('');
        expect(captured).toBe(false);
    });
});
