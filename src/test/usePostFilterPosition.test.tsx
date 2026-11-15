import { useRef, type CSSProperties } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePostFilterPosition } from '../hooks/usePostFilterPosition';

let bounds: DOMRect;
let contentHeight: number;
let headerBottom: number;
let frames: Map<number, FrameRequestCallback>;
let resizeCallbacks: (() => void)[];
const disconnect = vi.fn();
const dismiss = vi.fn();

function Fixture({ open = true, headerOffset = 0 }: { open?: boolean; headerOffset?: number }) {
    const anchor = useRef<HTMLDivElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    usePostFilterPosition(open, anchor, panel, dismiss);
    return <div className="site-layout" data-testid="layout">
        <header className="site-header" data-testid="header" />
        <div ref={anchor} data-testid="anchor" style={{ '--site-header-offset': `${headerOffset}px` } as CSSProperties}>
            <button>Filters</button><div ref={panel} data-testid="panel" />
        </div>
    </div>;
}

function flushFrames() {
    act(() => {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach(callback => callback(0));
    });
}

beforeEach(() => {
    bounds = new DOMRect(260, 140, 100, 44);
    contentHeight = 500;
    headerBottom = 72;
    frames = new Map();
    resizeCallbacks = [];
    let nextFrame = 0;
    dismiss.mockClear();
    disconnect.mockClear();
    vi.stubGlobal('innerHeight', 600);
    vi.stubGlobal('innerWidth', 400);
    vi.stubGlobal('visualViewport', undefined);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
        const id = nextFrame++;
        frames.set(id, callback);
        return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'header' ? new DOMRect(0, 0, 400, headerBottom) : bounds;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => contentHeight);
    vi.stubGlobal('ResizeObserver', class {
        constructor(callback: () => void) { resizeCallbacks.push(callback); }
        observe() {}
        disconnect = disconnect;
    });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('post filter review regressions: dropdown position', () => {
    it('uses the available space below the trigger', () => {
        render(<Fixture />);
        const panel = screen.getByTestId('panel');
        expect(panel.style.top).toBe('calc(100% + 8px)');
        expect(panel.style.bottom).toBe('auto');
        expect(panel.style.getPropertyValue('--post-filter-height')).toBe('390px');
    });

    it('opens above when the lower part of the screen is too short', () => {
        bounds = new DOMRect(260, 430, 100, 44);
        render(<Fixture />);
        const panel = screen.getByTestId('panel');
        expect(panel.style.top).toBe('auto');
        expect(panel.style.bottom).toBe('calc(100% + 8px)');
        expect(panel.style.getPropertyValue('--post-filter-height')).toBe('334px');
    });

    it('keeps a short list below the trigger when the whole list fits', () => {
        bounds = new DOMRect(260, 430, 100, 44);
        contentHeight = 100;
        render(<Fixture />);
        expect(screen.getByTestId('panel').style.top).toBe('calc(100% + 8px)');
    });

    it('repositions a growing list even when its rendered box was already constrained', async () => {
        bounds = new DOMRect(260, 430, 100, 44);
        contentHeight = 100;
        render(<Fixture />);
        const panel = screen.getByTestId('panel');
        expect(panel.style.top).toBe('calc(100% + 8px)');
        contentHeight = 500;
        await act(async () => { panel.append('New filter options'); });
        flushFrames();
        expect(panel.style.top).toBe('auto');
        expect(panel.style.getPropertyValue('--post-filter-height')).toBe('334px');
    });

    it('batches viewport and size changes and repositions after reflow', () => {
        render(<Fixture />);
        bounds = new DOMRect(260, 430, 100, 44);
        fireEvent.resize(window);
        fireEvent.scroll(window);
        resizeCallbacks.forEach(callback => callback());
        expect(frames.size).toBe(1);
        flushFrames();
        expect(screen.getByTestId('panel').style.getPropertyValue('--post-filter-height')).toBe('334px');
    });

    it('fits an offset visual viewport and shifts away from its right edge', () => {
        const viewport = Object.assign(new EventTarget(), { height: 300, width: 220, offsetTop: 120, offsetLeft: 100 });
        vi.stubGlobal('visualViewport', viewport);
        bounds = new DOMRect(260, 200, 100, 44);
        render(<Fixture />);
        const panel = screen.getByTestId('panel');
        expect(panel.style.getPropertyValue('--post-filter-height')).toBe('152px');
        expect(panel.style.maxWidth).toBe('188px');
        expect(panel.style.right).toBe('56px');
        viewport.height = 400;
        viewport.dispatchEvent(new Event('resize'));
        viewport.dispatchEvent(new Event('scroll'));
        flushFrames();
        expect(panel.style.getPropertyValue('--post-filter-height')).toBe('252px');
    });

    it('reserves the header target size while it animates, then recovers the space', async () => {
        bounds = new DOMRect(260, 430, 100, 44);
        const { rerender } = render(<Fixture headerOffset={220} />);
        const panel = screen.getByTestId('panel');
        expect(panel.style.getPropertyValue('--post-filter-height')).toBe('186px');
        rerender(<Fixture />);
        await act(async () => { screen.getByTestId('layout').setAttribute('data-header-visible', 'false'); });
        flushFrames();
        expect(panel.style.getPropertyValue('--post-filter-height')).toBe('334px');
        headerBottom = 0;
        fireEvent.transitionEnd(screen.getByTestId('header'));
        flushFrames();
        expect(panel.style.getPropertyValue('--post-filter-height')).toBe('390px');
    });

    it('dismisses after the trigger leaves the visible reading area', () => {
        render(<Fixture />);
        bounds = new DOMRect(260, -100, 100, 44);
        fireEvent.scroll(window);
        flushFrames();
        expect(dismiss).toHaveBeenCalledOnce();
    });

    it('defers dismissal when opened with an offscreen trigger', () => {
        bounds = new DOMRect(260, 700, 100, 44);
        render(<Fixture />);
        expect(dismiss).not.toHaveBeenCalled();
        flushFrames();
        expect(dismiss).toHaveBeenCalledOnce();
    });

    it('uses window resize events when ResizeObserver is unavailable', () => {
        vi.stubGlobal('ResizeObserver', undefined);
        render(<Fixture />);
        bounds = new DOMRect(260, 430, 100, 44);
        fireEvent.resize(window);
        flushFrames();
        expect(screen.getByTestId('panel').style.getPropertyValue('--post-filter-height')).toBe('334px');
    });

    it('cancels pending work and ignores late observer callbacks after unmount', () => {
        const { unmount } = render(<Fixture />);
        fireEvent.resize(window);
        expect(frames.size).toBe(1);
        unmount();
        expect(disconnect).toHaveBeenCalledOnce();
        resizeCallbacks.forEach(callback => callback());
        fireEvent.resize(window);
        expect(frames.size).toBe(0);
        expect(dismiss).not.toHaveBeenCalled();
    });

    it('does not measure or subscribe while the dropdown is closed', () => {
        render(<Fixture open={false} />);
        fireEvent.resize(window);
        expect(screen.getByTestId('panel').style.getPropertyValue('--post-filter-height')).toBe('');
        expect(resizeCallbacks).toHaveLength(0);
        expect(frames.size).toBe(0);
    });
});
