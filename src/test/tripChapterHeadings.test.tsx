import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostHeadingProvider } from '../blog/LinkedHeading';
import { mdxComponents } from '../blog/MdxComponents';

const Heading2 = mdxComponents.h2;
const Heading3 = mdxComponents.h3;

interface ObserverStub {
    callback: ResizeObserverCallback;
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
}

const observers: ObserverStub[] = [];
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

function flushFrames() {
    act(() => {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach(callback => callback(0));
    });
}

function Chapters({ second = true, header = true, chapter = true }: {
    second?: boolean;
    header?: boolean;
    chapter?: boolean;
}) {
    return <div className="site-layout">
        {header && <header className="site-header" data-height="61">Navigation</header>}
        <PostHeadingProvider>
            <section className={chapter ? 'trip-chapter' : undefined} data-testid="first-chapter">
                <Heading2 data-height="64">First day</Heading2>
                <Heading3>Forest</Heading3>
            </section>
            {second && <section className="trip-chapter" data-testid="second-chapter">
                <Heading2 data-height="120">Second day</Heading2>
            </section>}
        </PostHeadingProvider>
    </div>;
}

beforeEach(() => {
    observers.length = 0;
    frames = new Map();
    nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        const id = nextFrame++;
        frames.set(id, callback);
        return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.stubGlobal('ResizeObserver', class implements ObserverStub {
        callback: ResizeObserverCallback;
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        constructor(callback: ResizeObserverCallback) {
            this.callback = callback;
            observers.push(this);
        }
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return { height: Number(this.getAttribute('data-height') ?? 0) } as DOMRect;
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('trip chapter heading layout', () => {
    it('shares one border-box observer and batches chapter measurements', () => {
        const addListener = vi.spyOn(window, 'addEventListener');
        const { unmount } = render(<Chapters />);
        expect(observers).toHaveLength(1);
        const observer = observers[0];
        expect(observer.observe.mock.calls.map(([node]) => node.textContent))
            .toEqual(['Navigation', 'First day#↑', 'Second day#↑']);
        expect(observer.observe.mock.calls.every(([, options]) => options.box === 'border-box')).toBe(true);
        expect(addListener.mock.calls.filter(([event]) => event === 'resize')).toHaveLength(1);
        expect(addListener.mock.calls.some(([event]) => event === 'scroll')).toBe(false);
        expect(frames.size).toBe(1);
        flushFrames();
        expect(screen.getByTestId('first-chapter').style.getPropertyValue('--trip-chapter-heading-height')).toBe('64px');
        expect(screen.getByTestId('second-chapter').style.getPropertyValue('--trip-chapter-heading-height')).toBe('120px');
        act(() => {
            observer.callback([], {} as ResizeObserver);
            observer.callback([], {} as ResizeObserver);
            fireEvent.resize(window);
        });
        expect(frames.size).toBe(1);
        unmount();
        expect(frames.size).toBe(0);
        expect(observer.unobserve).toHaveBeenCalledTimes(2);
        expect(observer.disconnect).toHaveBeenCalledOnce();
        act(() => observer.callback([], {} as ResizeObserver));
        expect(frames.size).toBe(0);
    });

    it('updates wrapped title heights and preserves the observer while another chapter remains', () => {
        const { rerender, unmount } = render(<Chapters />);
        flushFrames();
        const first = screen.getByTestId('first-chapter');
        screen.getByRole('heading', { name: 'First day' }).setAttribute('data-height', '180');
        act(() => observers[0].callback([], {} as ResizeObserver));
        flushFrames();
        expect(first.style.getPropertyValue('--trip-chapter-heading-height')).toBe('180px');
        const removed = screen.getByTestId('second-chapter');
        rerender(<Chapters second={false} />);
        expect(removed.style.getPropertyValue('--trip-chapter-heading-height')).toBe('');
        expect(observers[0].disconnect).not.toHaveBeenCalled();
        unmount();
        expect(observers[0].disconnect).toHaveBeenCalledOnce();
    });

    it('returns tall titles to normal flow when the visible viewport becomes too short', () => {
        const viewport = Object.assign(new EventTarget(), { height: 600 });
        vi.stubGlobal('visualViewport', viewport);
        const removeListener = vi.spyOn(viewport, 'removeEventListener');
        const { unmount } = render(<Chapters />);
        flushFrames();
        const chapter = screen.getByTestId('second-chapter');
        expect(chapter).not.toHaveAttribute('data-trip-chapter-static');
        viewport.height = 300;
        act(() => viewport.dispatchEvent(new Event('resize')));
        flushFrames();
        expect(chapter).toHaveAttribute('data-trip-chapter-static');
        viewport.height = 900;
        act(() => viewport.dispatchEvent(new Event('resize')));
        flushFrames();
        expect(chapter).not.toHaveAttribute('data-trip-chapter-static');
        unmount();
        expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('uses viewport resize events when ResizeObserver is unavailable', () => {
        vi.stubGlobal('ResizeObserver', undefined);
        const removeListener = vi.spyOn(window, 'removeEventListener');
        const { unmount } = render(<Chapters header={false} second={false} />);
        flushFrames();
        const chapter = screen.getByTestId('first-chapter');
        expect(chapter.style.getPropertyValue('--trip-chapter-heading-height')).toBe('64px');
        screen.getByRole('heading', { name: 'First day' }).setAttribute('data-height', '1000');
        fireEvent.resize(window);
        flushFrames();
        expect(chapter).toHaveAttribute('data-trip-chapter-static');
        unmount();
        expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('does not allocate observers for writing headings or subsections', () => {
        const { rerender } = render(<Chapters chapter={false} second={false} />);
        expect(observers).toHaveLength(0);
        rerender(<PostHeadingProvider><section className="trip-chapter">
            <Heading3>Scene without a chapter title</Heading3>
            <Heading2>Not the first element</Heading2>
        </section></PostHeadingProvider>);
        expect(observers).toHaveLength(0);
        expect(frames.size).toBe(0);
    });

    it('releases Strict Mode registrations and removes observers without a navigation header', () => {
        const { unmount } = render(<StrictMode><Chapters header={false} /></StrictMode>);
        flushFrames();
        expect(observers.filter(observer => observer.disconnect.mock.calls.length === 0)).toHaveLength(1);
        expect(screen.getAllByRole('heading').map(heading => heading.id)).toEqual(['first-day', 'forest', 'second-day']);
        unmount();
        expect(observers.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true);
        expect(frames.size).toBe(0);
    });
});
