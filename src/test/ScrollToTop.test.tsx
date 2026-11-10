import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollToTop } from '../components/ScrollToTop';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount() {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let resize: ResizeObserverCallback = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
        constructor(callback: ResizeObserverCallback) { resize = callback; }
        observe() {}
        disconnect = disconnect;
    });
    render(<MemoryRouter><ScrollToTop /><a href="/posts">Return</a></MemoryRouter>);
    scroll.mockClear();
    return { scroll, disconnect, resize: () => resize([], {} as ResizeObserver), flush: () => frames.splice(0).forEach(frame => frame(0)) };
}

describe('scroll restoration input ownership', () => {
    it.each(['pointerdown', 'wheel', 'touchstart', 'keydown'])('cancels a queued restoration after %s', type => {
        const state = mount();
        state.resize();
        fireEvent(screen.getByRole('link', { name: 'Return' }), new Event(type, { bubbles: true }));
        state.flush();
        expect(state.scroll).not.toHaveBeenCalled();
        expect(state.disconnect).toHaveBeenCalled();
    });

    it('keeps restoring delayed layout when the reader has not interacted', () => {
        const state = mount();
        state.resize();
        state.flush();
        expect(state.scroll).toHaveBeenCalledWith(0, 0);
    });
});
