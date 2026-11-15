import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchMatch } from '../components/SearchMatch';

let frames: Map<number, FrameRequestCallback>;
let resize: () => void;
let targetTop: number;
let scroll: ReturnType<typeof vi.spyOn>;
let highlights: Map<string, Highlight>;

function flush() {
    act(() => {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach(callback => callback(0));
    });
}

async function mount(html = '<p>Past the quiet harbor.</p>', options: { pop?: boolean; marker?: string } = {}) {
    const router = createMemoryRouter([{ path: '*', element: <>
        <SearchMatch />
        <header className="site-header" />
        <main tabIndex={-1} dangerouslySetInnerHTML={{ __html: html }} />
        <span hidden data-route-path={options.marker ?? '/article'} />
    </> }], { initialEntries: [options.pop ? { pathname: '/article', state: { siteSearchQuery: 'quiet harbor' } } : '/'] });
    const view = render(<RouterProvider router={router} />);
    if (!options.pop) await act(() => router.navigate('/article', { state: { siteSearchQuery: 'quiet harbor' } }));
    return { router, ...view };
}

beforeEach(() => {
    frames = new Map();
    targetTop = 600;
    highlights = new Map();
    let id = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(id, callback); return id++; });
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame));
    vi.stubGlobal('scrollY', 0);
    vi.stubGlobal('CSS', { highlights });
    vi.stubGlobal('Highlight', class extends Set<Range> { constructor(range: Range) { super([range]); } });
    vi.stubGlobal('ResizeObserver', class {
        constructor(callback: () => void) { resize = callback; }
        observe() {}
        disconnect() {}
    });
    scroll = vi.spyOn(window, 'scrollTo').mockImplementation((options: ScrollToOptions | number) => {
        if (typeof options === 'object') vi.stubGlobal('scrollY', options.top ?? 0);
    });
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([new DOMRect(0, 0, 300, 24)] as unknown as DOMRectList);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return new DOMRect(0, 0, 300, this.classList.contains('site-header') ? 72 : 60);
    });
    const createRange = document.createRange.bind(document);
    vi.spyOn(document, 'createRange').mockImplementation(() => {
        const range = createRange();
        range.getBoundingClientRect = () => new DOMRect(0, targetTop - window.scrollY, 160, 24);
        return range;
    });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('search match landing', () => {
    it('focuses and highlights the original passage below the navigation', async () => {
        await mount();
        flush();
        const paragraph = screen.getByText('Past the quiet harbor.');
        expect(paragraph).toHaveFocus();
        expect(paragraph).toHaveAttribute('tabindex', '-1');
        expect(scroll).toHaveBeenLastCalledWith({ top: 504, behavior: 'instant' });
        expect([...highlights.get('site-search-result')!][0].toString()).toBe('quiet harbor');
        expect(paragraph.querySelector('mark')).toBeNull();
    });

    it('waits for the destination marker and lazy article text', async () => {
        await mount('', { marker: '/old' });
        flush();
        expect(scroll).not.toHaveBeenCalled();
        await act(async () => { document.querySelector('[data-route-path]')!.setAttribute('data-route-path', '/article'); });
        flush();
        expect(screen.getByRole('main')).toHaveFocus();
        await act(async () => { screen.getByRole('main').innerHTML = '<p>A quiet <em>harbor</em> at sunset.</p>'; });
        flush();
        expect(document.querySelector('[data-site-search-match]')).toHaveFocus();
        expect(scroll).toHaveBeenCalledOnce();
    });

    it('keeps the target visible after delayed layout changes', async () => {
        await mount();
        flush();
        targetTop = 1000;
        resize();
        flush();
        expect(scroll).toHaveBeenLastCalledWith({ top: 904, behavior: 'instant' });
    });

    it('waits beyond the match timeout for a slow article instead of matching its temporary title', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        await mount('<div data-search-pending><h1>Quiet harbor</h1><p>Loading trip…</p></div>');
        flush();
        expect(scroll).not.toHaveBeenCalled();
        expect(document.querySelector('[data-site-search-match]')).toBeNull();
        act(() => vi.advanceTimersByTime(15000));
        await act(async () => { screen.getByRole('main').innerHTML = '<p>The quiet harbor was empty.</p>'; });
        flush();
        expect(screen.getByText('The quiet harbor was empty.')).toHaveFocus();
        expect(scroll).toHaveBeenCalledOnce();
    });

    it.each(['pointerdown', 'wheel', 'touchstart', 'keydown'])('yields pending and future layout work to %s', async type => {
        await mount();
        fireEvent(window, new Event(type));
        flush();
        resize();
        flush();
        expect(scroll).not.toHaveBeenCalled();
        expect(document.querySelector('[data-site-search-match]')).toBeNull();
    });

    it.each(['<section class="trip-chapter"><h2>First day</h2><p>Quiet harbor.</p></section>',
        '<section class="trip-chapter"><h2>Quiet harbor</h2><p>First day.</p></section>'])('clears a sticky chapter heading when appropriate: %s', async html => {
        await mount(html);
        flush();
        expect(scroll).toHaveBeenLastCalledWith({ top: html.includes('<h2>Quiet') ? 504 : 444, behavior: 'instant' });
    });

    it('still scrolls and focuses without the CSS highlight API', async () => {
        vi.stubGlobal('Highlight', undefined);
        await mount();
        flush();
        expect(screen.getByText('Past the quiet harbor.')).toHaveFocus();
        expect(scroll).toHaveBeenCalledOnce();
        expect(highlights.size).toBe(0);
    });

    it('supports another search on the same page and removes the previous highlight', async () => {
        const { router } = await mount('<p>Quiet harbor.</p><p>A forest campsite.</p>');
        flush();
        await act(() => router.navigate('/article', { state: { siteSearchQuery: 'forest' } }));
        flush();
        expect(screen.getByText('Quiet harbor.')).not.toHaveAttribute('data-site-search-match');
        expect(screen.getByText('A forest campsite.')).toHaveFocus();
        expect([...highlights.get('site-search-result')!][0].toString()).toBe('forest');
    });

    it('leaves history position restoration in charge on Back and Forward', async () => {
        await mount(undefined, { pop: true });
        flush();
        expect(scroll).not.toHaveBeenCalled();
        expect(frames.size).toBe(0);
    });

    it('orients a failed destination without waiting for a successful route marker', async () => {
        await mount('<section data-testid="page-error"><h1>Page unavailable</h1></section>', { marker: '/old' });
        flush();
        expect(screen.getByRole('main')).toHaveFocus();
        resize();
        expect(frames.size).toBe(0);
        expect(scroll).not.toHaveBeenCalled();
    });

    it('stops waiting when only metadata matched and cleans up on unmount', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { unmount } = await mount('<p>Other text.</p>');
        flush();
        expect(screen.getByRole('main')).toHaveFocus();
        act(() => vi.advanceTimersByTime(8000));
        resize();
        expect(frames.size).toBe(0);
        expect(scroll).not.toHaveBeenCalled();
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('bounds layout correction and restores existing focus attributes on unmount', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { unmount } = await mount('<p tabindex="0">Quiet harbor.</p>');
        flush();
        const paragraph = screen.getByText('Quiet harbor.');
        expect(paragraph).toHaveAttribute('tabindex', '0');
        act(() => vi.advanceTimersByTime(3000));
        resize();
        expect(frames.size).toBe(0);
        unmount();
        expect(paragraph).not.toHaveAttribute('data-site-search-match');
        expect(paragraph).toHaveAttribute('tabindex', '0');
        expect(highlights.size).toBe(0);
    });
});
