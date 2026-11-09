import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IntentLink } from '../components/IntentLink';

const mocks = vi.hoisted(() => ({ schedule: vi.fn(), cancel: vi.fn(), cancelPending: vi.fn() }));
vi.mock('../navigation/intentPrefetch', () => ({ intentPrefetch: mocks }));
beforeEach(() => { vi.clearAllMocks(); mocks.schedule.mockReturnValue(mocks.cancel); });
afterEach(cleanup);

function pointer(element: Element, type: string, pointerType = 'mouse') {
    fireEvent(element, Object.assign(new Event(type, { bubbles: true }), { pointerType }));
}

it('composes handlers and keeps focus intent when the pointer leaves', () => {
    const onPointerEnter = vi.fn(); const onFocus = vi.fn();
    const ref = createRef<HTMLAnchorElement>();
    render(<MemoryRouter><IntentLink to="/about" ref={ref} onPointerEnter={onPointerEnter} onFocus={onFocus}>About</IntentLink></MemoryRouter>);
    const link = screen.getByRole('link');
    expect(ref.current).toBe(link);
    pointer(link, 'pointerover'); fireEvent.focus(link); pointer(link, 'pointerout');
    expect(onPointerEnter).toHaveBeenCalledTimes(1); expect(onFocus).toHaveBeenCalledTimes(1);
    expect(mocks.schedule).toHaveBeenCalledTimes(1); expect(mocks.cancel).not.toHaveBeenCalled();
    fireEvent.blur(link); expect(mocks.cancel).toHaveBeenCalledTimes(1);
});

it('does not warm touch, prevented handlers, downloads, new tabs, or explicit opt-outs', () => {
    render(<MemoryRouter><IntentLink to="/about">About</IntentLink></MemoryRouter>);
    const link = screen.getByRole('link');
    pointer(link, 'pointerover', 'touch'); pointer(link, 'pointerdown', 'touch'); fireEvent.focus(link);
    expect(mocks.schedule).not.toHaveBeenCalled();
    cleanup();
    for (const props of [{ download: true }, { target: '_blank' }, { reloadDocument: true }, { prefetchMode: 'none' as const }, { onPointerEnter: (event: { preventDefault: () => void }) => event.preventDefault() }]) {
        render(<MemoryRouter><IntentLink to="/about" {...props}>About</IntentLink></MemoryRouter>);
        pointer(screen.getByRole('link'), 'pointerover');
        expect(mocks.schedule).not.toHaveBeenCalled();
        cleanup();
    }
});

it('cancels pending intent when the document is hidden', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    render(<MemoryRouter><IntentLink to="/about">About</IntentLink></MemoryRouter>);
    pointer(screen.getByRole('link'), 'pointerover');
    visibility.mockReturnValue('hidden'); fireEvent(document, new Event('visibilitychange'));
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
});

it('uses the real same-origin absolute destination while preserving router link behavior', () => {
    render(<MemoryRouter><IntentLink to={`${window.location.origin}/about`}>About</IntentLink></MemoryRouter>);
    pointer(screen.getByRole('link'), 'pointerover');
    expect(mocks.schedule).toHaveBeenCalledWith(expect.objectContaining({ page: '/about' }), 'page');
});

it('cancels stale intent when the URL changes or a link unmounts', () => {
    const { rerender, unmount } = render(<MemoryRouter><IntentLink to="/about">About</IntentLink></MemoryRouter>);
    pointer(screen.getByRole('link'), 'pointerover');
    rerender(<MemoryRouter><IntentLink to="/posts">Posts</IntentLink></MemoryRouter>);
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    pointer(screen.getByRole('link'), 'pointerover');
    unmount(); expect(mocks.cancel).toHaveBeenCalledTimes(2);
});

it('preserves router state, fragments and standard click behavior while clearing speculative queues', async () => {
    function Destination() { const location = useLocation(); return <p>{location.pathname}{location.hash}:{(location.state as { from: string }).from}</p>; }
    render(<MemoryRouter><Routes>
        <Route path="/" element={<IntentLink to="/about#bio" state={{ from: '/posts?tag=coast' }}>About</IntentLink>} />
        <Route path="/about" element={<Destination />} />
    </Routes></MemoryRouter>);
    await act(async () => fireEvent.click(screen.getByRole('link')));
    expect(screen.getByText('/about#bio:/posts?tag=coast')).toBeVisible();
    expect(mocks.cancelPending).toHaveBeenCalledTimes(1);
});
