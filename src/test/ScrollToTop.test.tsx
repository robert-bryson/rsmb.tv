import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
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
    it('search match review regressions: saves departure position before a queued scroll event arrives', async () => {
        const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        const router = createMemoryRouter([{ path: '*', element: <ScrollToTop /> }], { initialEntries: ['/start'] });
        render(<RouterProvider router={router} />);
        await act(() => router.navigate('/article', { state: { siteSearchQuery: 'harbor' } }));
        vi.stubGlobal('scrollY', 700);
        // Browsers can commit navigation before delivering the scroll event.
        await act(() => router.navigate('/about'));
        scroll.mockClear();
        await act(() => router.navigate(-1));
        expect(scroll).toHaveBeenCalledWith(0, 700);
    });

    it('yields delayed layout restoration to a new search landing but retains history positions', async () => {
        const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        const callbacks: ResizeObserverCallback[] = [];
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
            observe() {}
            disconnect() {}
        });
        const router = createMemoryRouter([{ path: '*', element: <ScrollToTop /> }], { initialEntries: ['/'] });
        render(<RouterProvider router={router} />);
        await act(() => router.navigate('/article', { state: { siteSearchQuery: 'harbor' } }));
        expect(callbacks).toHaveLength(1);
        expect(scroll).toHaveBeenLastCalledWith(0, 0);
        vi.stubGlobal('scrollY', 700);
        fireEvent.scroll(window);
        await act(() => router.navigate('/about'));
        scroll.mockClear();
        await act(() => router.navigate(-1));
        expect(scroll).toHaveBeenCalledWith(0, 700);
        expect(callbacks).toHaveLength(3);
    });

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
