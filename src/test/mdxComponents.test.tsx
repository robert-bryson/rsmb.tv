import { act, StrictMode, useRef } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostHeadingProvider } from '../blog/LinkedHeading';
import { mdxComponents } from '../blog/MdxComponents';
import { PostTableOfContents } from '../blog/PostTableOfContents';

const Anchor = mdxComponents.a;
const Heading2 = mdxComponents.h2;
const Heading3 = mdxComponents.h3;
const Heading6 = mdxComponents.h6;
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

function mockScrollIntoView() {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    return scrollIntoView;
}

function mockAnimationFrames() {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        const id = nextFrame++;
        frames.set(id, callback);
        return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    return {
        frames,
        flushFrame: () => act(() => {
            const pending = [...frames.values()];
            frames.clear();
            pending.forEach(callback => callback(0));
        }),
    };
}

function TableOfContentsFixture({
    duplicateHeading = false,
    showHeadings = true,
}: {
    duplicateHeading?: boolean;
    showHeadings?: boolean;
}) {
    const contentRef = useRef<HTMLDivElement>(null);

    return (
        <PostHeadingProvider>
            <PostTableOfContents contentRef={contentRef} />
            <div ref={contentRef}>
                {showHeadings && (
                    <>
                        <Heading2>First Stop</Heading2>
                        <p className="blog-subtitle">(339mi. / 545km.)</p>
                        {duplicateHeading && (
                            <>
                                <Heading2>First Stop</Heading2>
                                <Heading2>First Stop 1</Heading2>
                            </>
                        )}
                        <Heading3>Camp Notes</Heading3>
                    </>
                )}
            </div>
        </PostHeadingProvider>
    );
}

function TripContentsFixture({ level }: { level: 1 | 2 }) {
    const contentRef = useRef<HTMLDivElement>(null);
    const Chapter = level === 1 ? mdxComponents.h1 : mdxComponents.h2;
    const Subheading = level === 1 ? mdxComponents.h2 : mdxComponents.h3;
    return <article className="trip-story">
        <h1>Trip title outside the story</h1>
        <PostHeadingProvider>
            <PostTableOfContents contentRef={contentRef} />
            <div ref={contentRef}>
                <Chapter>First Stop</Chapter>
                <Subheading>Camp Notes</Subheading>
                <Chapter>Second Day</Chapter>
            </div>
        </PostHeadingProvider>
    </article>;
}

afterEach(() => {
    window.history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

describe('MDX links', () => {
    it('keeps emphasized link text on the shared link color', () => {
        const Strong = mdxComponents.strong;
        render(<Anchor href="/posts"><Strong>Posts</Strong></Anchor>);
        expect(screen.getByRole('link', { name: 'Posts' })).toHaveClass('[&_*]:text-inherit', 'hover:text-violet-300');
    });

    it.each([
        'https://rsmb.tv/trips/ocean-shores-2024',
        'https://www.rsmb.tv/blog/example',
        '/projects/flights',
    ])('opens internal link %s in the same tab', (href) => {
        render(<Anchor href={href}>Internal</Anchor>);

        const link = screen.getByRole('link', { name: 'Internal' });
        expect(link).not.toHaveAttribute('target');
        expect(link).not.toHaveAttribute('rel');
    });

    it.each([
        'https://example.com',
        'HTTPS://EXAMPLE.COM/path',
        'https://blog.rsmb.tv',
    ])('opens external HTTP link %s in a new tab', (href) => {
        render(<Anchor href={href}>External</Anchor>);

        const link = screen.getByRole('link', { name: 'External' });
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('does not crash on a malformed URL', () => {
        render(<Anchor href="https://[">Malformed</Anchor>);

        expect(screen.getByRole('link', { name: 'Malformed' })).not.toHaveAttribute('target');
    });

    it('does not let MDX override external-link protections', () => {
        render(
            <Anchor href="https://example.com" target="_self" rel="opener">
                Protected
            </Anchor>,
        );

        const link = screen.getByRole('link', { name: 'Protected' });
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
});

describe('November 15 trip contents review regressions', () => {
    it.each([1, 2] as const)('lists only h%s chapters and keeps subsection permalinks usable', async level => {
        const scrollIntoView = mockScrollIntoView();
        const { flushFrame } = mockAnimationFrames();
        window.history.replaceState(null, '', '#camp-notes');
        render(<TripContentsFixture level={level} />);
        const navigation = await screen.findByRole('navigation', { name: 'Table of contents' });
        expect(within(navigation).getAllByRole('link').map(link => link.textContent)).toEqual(['First Stop', 'Second Day']);
        expect(within(navigation).queryByRole('link', { name: 'Camp Notes' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Link to Camp Notes' })).toHaveAttribute('href', '#camp-notes');
        flushFrame();
        expect(scrollIntoView).toHaveBeenCalledOnce();
        expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('heading', { name: 'Camp Notes' }));
    });

    it('observes chapter headings only when updating the current trip location', async () => {
        const observe = vi.fn();
        vi.stubGlobal('IntersectionObserver', class {
            observe = observe;
            disconnect() {}
        });
        render(<TripContentsFixture level={1} />);
        await screen.findByRole('navigation', { name: 'Table of contents' });
        expect(observe).toHaveBeenCalledWith(screen.getByRole('heading', { name: 'First Stop' }));
        expect(observe).toHaveBeenCalledWith(screen.getByRole('heading', { name: 'Second Day' }));
        expect(observe).not.toHaveBeenCalledWith(screen.getByRole('heading', { name: 'Camp Notes' }));
    });
});

describe('MDX headings', () => {
    it('adds a stable ID and permalink while preserving an explicit ID', () => {
        const { rerender } = render(<Heading2>Résumé &amp; Road / Day 1</Heading2>);

        const generatedHeading = screen.getByRole('heading', { name: /Résumé & Road \/ Day 1/ });
        expect(generatedHeading).toHaveAttribute('id', 'resume-road-day-1');
        expect(screen.getByRole('link', { name: 'Link to Résumé & Road / Day 1' }))
            .toHaveAttribute('href', '#resume-road-day-1');
        expect(screen.getByRole('link', { name: 'Link to Résumé & Road / Day 1' }))
            .toHaveTextContent('Résumé & Road / Day 1');
        expect(screen.getByRole('link', { name: 'Back to table of contents' }))
            .toHaveAttribute('href', '#post-table-of-contents');

        rerender(<Heading2 id="author-id">Named section</Heading2>);
        expect(screen.getByRole('heading', { name: /Named section/ })).toHaveAttribute('id', 'author-id');
    });

    it('preserves links inside headings without nesting anchors', () => {
        const { container } = render(
            <Heading2>Notes from <em><Anchor href="https://example.com">Boise</Anchor></em></Heading2>,
        );

        expect(screen.getByRole('heading', { name: 'Notes from Boise' })).toHaveAttribute('id', 'notes-from-boise');
        expect(screen.getByRole('link', { name: 'Boise' })).toHaveAttribute('href', 'https://example.com');
        expect(screen.getByRole('link', { name: 'Link to Notes from Boise' }))
            .toHaveAttribute('href', '#notes-from-boise');
        expect(container.querySelector('a a')).toBeNull();
    });

    it('keeps heading IDs stable under Strict Mode and avoids suffix collisions', () => {
        const { container } = render(
            <StrictMode>
                <PostHeadingProvider>
                    <Heading2>First Stop</Heading2>
                    <Heading2>First Stop</Heading2>
                    <Heading2>First Stop 1</Heading2>
                    <Heading2 id="first-stop">Explicit duplicate</Heading2>
                    <Heading2>Post Table of Contents</Heading2>
                </PostHeadingProvider>
            </StrictMode>,
        );

        const ids = Array.from(container.querySelectorAll('[data-post-heading]'), heading => heading.id);
        expect(ids).toEqual([
            'first-stop', 'first-stop-1', 'first-stop-1-1', 'first-stop-2', 'post-table-of-contents-1',
        ]);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('does not consume IDs on rerender and releases them when headings unmount', () => {
        function Fixture({ show }: { show: boolean }) {
            return (
                <PostHeadingProvider>
                    <Heading2>First Stop</Heading2>
                    {show && <Heading2>First Stop</Heading2>}
                </PostHeadingProvider>
            );
        }
        const { rerender } = render(<Fixture show />);
        expect(screen.getAllByRole('heading')[1]).toHaveAttribute('id', 'first-stop-1');
        rerender(<Fixture show={false} />);
        rerender(<Fixture show />);
        expect(screen.getAllByRole('heading')[1]).toHaveAttribute('id', 'first-stop-1');
        rerender(<Fixture show />);
        expect(screen.getAllByRole('heading')[1]).toHaveAttribute('id', 'first-stop-1');
    });

    it('updates TOC labels and targets after text and ID changes', async () => {
        render(<TableOfContentsFixture />);
        const heading = screen.getByRole('heading', { name: 'First Stop' });
        await screen.findByRole('link', { name: 'First Stop' });
        act(() => {
            heading.firstChild!.textContent = 'Updated stop';
            heading.id = 'updated-stop';
        });
        await waitFor(() => expect(screen.getByRole('link', { name: 'Updated stop' }))
            .toHaveAttribute('href', '#updated-stop'));
    });

    it('resolves an initial hash only after duplicate heading IDs are assigned', async () => {
        const scrollIntoView = mockScrollIntoView();
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        window.history.replaceState(null, '', '#first-stop-1');
        render(<StrictMode><TableOfContentsFixture duplicateHeading /></StrictMode>);

        await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
        const target = screen.getAllByRole('heading', { name: 'First Stop' })[1];
        expect(scrollIntoView.mock.contexts.every(node => node === target)).toBe(true);
    });

    it('ignores malformed URL hashes without throwing', async () => {
        window.history.replaceState(null, '', '#%E0%A4%A');
        render(<TableOfContentsFixture />);
        expect(await screen.findByRole('navigation', { name: 'Table of contents' })).toBeInTheDocument();
    });

    it('uses a fallback ID for a heading with no slug characters', () => {
        render(<Heading2>東京</Heading2>);
        expect(screen.getByRole('heading', { name: '東京' })).toHaveAttribute('id', 'section');
    });

    it('links sixth-level headings', () => {
        render(<Heading6>Small detail</Heading6>);

        expect(screen.getByRole('heading', { level: 6, name: 'Small detail' }))
            .toHaveAttribute('id', 'small-detail');
        expect(screen.getByRole('link', { name: 'Link to Small detail' }))
            .toHaveAttribute('href', '#small-detail');
    });

    it('lists rendered headings and indents third-level sections', async () => {
        render(<TableOfContentsFixture />);

        const navigation = await screen.findByRole('navigation', { name: 'Table of contents' });
        expect(navigation).toHaveAttribute('id', 'post-table-of-contents');
        expect(navigation).toHaveTextContent('Table of contents');
        expect(navigation).not.toHaveTextContent('(339mi. / 545km.)');
        expect(screen.getByText('(339mi. / 545km.)').tagName).toBe('P');
        expect(screen.queryByRole('heading', { name: '(339mi. / 545km.)' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'First Stop' })).toHaveAttribute('href', '#first-stop');
        expect(screen.getByRole('link', { name: 'Camp Notes' }).parentElement).toHaveClass('pl-4');
    });

    it('gives repeated headings unique IDs and clean TOC labels', async () => {
        render(<TableOfContentsFixture duplicateHeading />);

        const navigation = await screen.findByRole('navigation', { name: 'Table of contents' });
        const firstStopLinks = Array.from(navigation.querySelectorAll('a')).filter((link) => (
            link.textContent === 'First Stop'
        ));
        expect(firstStopLinks).toHaveLength(2);
        expect(firstStopLinks.map((link) => link.getAttribute('href'))).toEqual([
            '#first-stop',
            '#first-stop-1',
        ]);
        expect(navigation).not.toHaveTextContent('↑');
    });

    it('scrolls to a hash target that mounts after the page loads', async () => {
        const scrollIntoView = mockScrollIntoView();
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        window.history.replaceState(null, '', '#first-stop');

        const { rerender } = render(<TableOfContentsFixture showHeadings={false} />);
        rerender(<TableOfContentsFixture />);

        await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce());
    });

    it('handles a hash change after the headings mount', async () => {
        const scrollIntoView = mockScrollIntoView();
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        render(<TableOfContentsFixture />);
        await screen.findByRole('navigation', { name: 'Table of contents' });

        act(() => {
            window.history.replaceState(null, '', '#camp-notes');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });

        await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce());
    });

    it('keeps the contents disclosure usable after collapsing and reopening it', async () => {
        render(<TableOfContentsFixture />);
        const navigation = await screen.findByRole('navigation', { name: 'Table of contents' });
        fireEvent.click(within(navigation).getByRole('button', { name: 'Collapse' }));
        expect(within(navigation).getByRole('button', { name: 'Expand' })).toHaveAttribute('aria-expanded', 'false');
        expect(navigation.querySelector('ul')).toHaveClass('hidden');
        fireEvent.click(within(navigation).getByRole('button', { name: 'Expand' }));
        expect(within(navigation).getByRole('link', { name: 'Camp Notes' })).toHaveAttribute('href', '#camp-notes');
        expect(navigation.querySelector('ul')).not.toHaveClass('hidden');
    });

    it('marks the visible subsection and disconnects its visibility observer on unmount', async () => {
        let onIntersection: IntersectionObserverCallback = () => undefined;
        const observe = vi.fn();
        const disconnect = vi.fn();
        vi.stubGlobal('IntersectionObserver', class {
            constructor(callback: IntersectionObserverCallback) { onIntersection = callback; }
            observe = observe;
            disconnect = disconnect;
        });
        const { unmount } = render(<TableOfContentsFixture />);
        const navigation = await screen.findByRole('navigation', { name: 'Table of contents' });
        const subsection = screen.getByRole('heading', { name: 'Camp Notes' });
        await waitFor(() => expect(observe).toHaveBeenCalledWith(subsection));
        const visible: IntersectionObserverEntry = {
            target: subsection, isIntersecting: true, boundingClientRect: new DOMRect(0, 140, 720, 30),
            intersectionRatio: 1, intersectionRect: new DOMRect(0, 140, 720, 30), rootBounds: null, time: 0,
        };
        act(() => onIntersection([
            visible,
            { ...visible, target: screen.getByRole('heading', { name: 'First Stop' }), isIntersecting: false, intersectionRatio: 0 },
        ], {} as IntersectionObserver));
        expect(within(navigation).getByRole('link', { name: 'Camp Notes' })).toHaveAttribute('aria-current', 'location');
        expect(within(navigation).getByRole('link', { name: 'First Stop' })).not.toHaveAttribute('aria-current');
        act(() => onIntersection([], {} as IntersectionObserver));
        expect(within(navigation).getByRole('link', { name: 'Camp Notes' })).toHaveAttribute('aria-current', 'location');
        unmount();
        expect(disconnect).toHaveBeenCalledOnce();
    });

    it('keeps a hash target aligned when earlier chapter titles change height after scrolling', async () => {
        const scrollIntoView = mockScrollIntoView();
        const { frames, flushFrame } = mockAnimationFrames();
        render(<TableOfContentsFixture />);
        await screen.findByRole('navigation', { name: 'Table of contents' });
        const target = screen.getByRole('heading', { name: 'Camp Notes' });
        let top = 500;
        vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, top, 300, 40));
        act(() => {
            window.history.replaceState(null, '', '#camp-notes');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        flushFrame();
        expect(scrollIntoView).toHaveBeenCalledOnce();
        top = 475;
        flushFrame();
        expect(scrollIntoView).toHaveBeenCalledTimes(2);
        expect(scrollIntoView.mock.contexts.every(node => node === target)).toBe(true);
        flushFrame();
        expect(scrollIntoView).toHaveBeenCalledTimes(2);
        expect(frames.size).toBe(0);
    });

    it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])(
        'lets reader %s input cancel a pending hash alignment', async event => {
            const scrollIntoView = mockScrollIntoView();
            const { frames, flushFrame } = mockAnimationFrames();
            window.history.replaceState(null, '', '#camp-notes');
            render(<TableOfContentsFixture />);
            await screen.findByRole('navigation', { name: 'Table of contents' });
            const target = screen.getByRole('heading', { name: 'Camp Notes' });
            let top = 500;
            vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, top, 300, 40));
            flushFrame();
            expect(scrollIntoView).toHaveBeenCalledOnce();
            top = 475;
            act(() => window.dispatchEvent(new Event(event)));
            expect(frames.size).toBe(0);
            flushFrame();
            expect(scrollIntoView).toHaveBeenCalledOnce();
        },
    );

    it('bounds hash corrections and releases input listeners when layout never settles', async () => {
        const scrollIntoView = mockScrollIntoView();
        const { frames, flushFrame } = mockAnimationFrames();
        const removeListener = vi.spyOn(window, 'removeEventListener');
        window.history.replaceState(null, '', '#camp-notes');
        render(<TableOfContentsFixture />);
        await screen.findByRole('navigation', { name: 'Table of contents' });
        let top = 500;
        vi.spyOn(screen.getByRole('heading', { name: 'Camp Notes' }), 'getBoundingClientRect')
            .mockImplementation(() => new DOMRect(0, top, 300, 40));
        for (let index = 0; index < 8; index++) {
            top += 25;
            flushFrame();
        }
        expect(scrollIntoView).toHaveBeenCalledTimes(4);
        expect(frames.size).toBe(0);
        for (const event of ['pointerdown', 'wheel', 'touchstart', 'keydown']) {
            expect(removeListener).toHaveBeenCalledWith(event, expect.any(Function), true);
        }
    });

    it.each(['remove', 'rename'])('abandons a hash target after a content update can %s it', async change => {
        const scrollIntoView = mockScrollIntoView();
        const { frames, flushFrame } = mockAnimationFrames();
        window.history.replaceState(null, '', '#camp-notes');
        render(<TableOfContentsFixture />);
        await screen.findByRole('navigation', { name: 'Table of contents' });
        const target = screen.getByRole('heading', { name: 'Camp Notes' });
        await act(async () => {
            if (change === 'remove') target.remove();
            else target.id = 'renamed-notes';
        });
        flushFrame();
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(frames.size).toBe(0);
    });

    it('cancels stale hash scrolls and pending work when the article unmounts', async () => {
        const scrollIntoView = mockScrollIntoView();
        const { frames, flushFrame } = mockAnimationFrames();
        window.history.replaceState(null, '', '#first-stop');
        const { unmount } = render(<TableOfContentsFixture />);
        await screen.findByRole('navigation', { name: 'Table of contents' });
        act(() => {
            window.history.replaceState(null, '', '#camp-notes');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        expect(frames.size).toBe(1);
        flushFrame();
        expect(scrollIntoView).toHaveBeenCalledOnce();
        expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('heading', { name: 'Camp Notes' }));
        act(() => {
            window.history.replaceState(null, '', '#first-stop');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        expect(frames.size).toBe(1);
        unmount();
        expect(frames.size).toBe(0);
    });
});

describe('review regressions: November 14 contents visibility', () => {
    it('observes article headings when an unrelated element has the same ID', async () => {
        const observe = vi.fn();
        vi.stubGlobal('IntersectionObserver', class {
            observe = observe;
            disconnect() {}
        });
        render(<><h2 id="first-stop">Unrelated heading</h2><TableOfContentsFixture /></>);
        const heading = screen.getByRole('heading', { name: 'First Stop' });
        await waitFor(() => expect(observe).toHaveBeenCalledWith(heading));
        expect(observe).not.toHaveBeenCalledWith(screen.getByRole('heading', { name: 'Unrelated heading' }));
    });

    it('ignores queued entries from an observer replaced after a heading changes', async () => {
        const observers: { callback: IntersectionObserverCallback; observe: ReturnType<typeof vi.fn> }[] = [];
        vi.stubGlobal('IntersectionObserver', class {
            observe = vi.fn();
            disconnect() {}
            constructor(callback: IntersectionObserverCallback) { observers.push({ callback, observe: this.observe }); }
        });
        render(<TableOfContentsFixture />);
        const navigation = await screen.findByRole('navigation', { name: 'Table of contents' });
        const first = screen.getByRole('heading', { name: 'First Stop' });
        const second = screen.getByRole('heading', { name: 'Camp Notes' });
        await waitFor(() => expect(observers.at(-1)?.observe).toHaveBeenCalledWith(second));
        const previous = observers.at(-1)!;
        await act(async () => { second.id = 'updated-camp-notes'; });
        await waitFor(() => expect(observers.at(-1)).not.toBe(previous));
        const entry = (target: Element): IntersectionObserverEntry => ({
            target, isIntersecting: true, boundingClientRect: new DOMRect(), intersectionRatio: 1,
            intersectionRect: new DOMRect(), rootBounds: null, time: 0,
        });
        act(() => observers.at(-1)!.callback([entry(second)], {} as IntersectionObserver));
        expect(within(navigation).getByRole('link', { name: 'Camp Notes' })).toHaveAttribute('aria-current', 'location');
        act(() => previous.callback([entry(first)], {} as IntersectionObserver));
        expect(within(navigation).getByRole('link', { name: 'Camp Notes' })).toHaveAttribute('aria-current', 'location');
    });

    it.each(['enter', 'exit'])('keeps the first visible heading current after a partial %s notification', async change => {
        let onIntersection: IntersectionObserverCallback = () => undefined;
        let ready = false;
        vi.stubGlobal('IntersectionObserver', class {
            constructor(callback: IntersectionObserverCallback) { onIntersection = callback; ready = false; }
            observe(target: Element) { if (target.id === 'camp-notes') ready = true; }
            disconnect() {}
        });
        render(<TableOfContentsFixture />);
        const navigation = await screen.findByRole('navigation', { name: 'Table of contents' });
        const first = screen.getByRole('heading', { name: 'First Stop' });
        const second = screen.getByRole('heading', { name: 'Camp Notes' });
        await waitFor(() => expect(ready).toBe(true));
        vi.spyOn(first, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 120, 720, 30));
        vi.spyOn(second, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 240, 720, 30));
        const entry = (target: Element, isIntersecting: boolean): IntersectionObserverEntry => ({
            target, isIntersecting, boundingClientRect: target.getBoundingClientRect(),
            intersectionRatio: isIntersecting ? 1 : 0, intersectionRect: new DOMRect(), rootBounds: null, time: 0,
        });
        const notify = (...entries: IntersectionObserverEntry[]) => act(() => onIntersection(entries, {} as IntersectionObserver));

        notify(entry(first, true));
        if (change === 'enter') {
            notify(entry(second, true));
            expect(within(navigation).getByRole('link', { name: 'First Stop' })).toHaveAttribute('aria-current', 'location');
            expect(within(navigation).getByRole('link', { name: 'Camp Notes' })).not.toHaveAttribute('aria-current');
        } else {
            notify(entry(second, true), entry(first, true));
            notify(entry(first, false));
            expect(within(navigation).getByRole('link', { name: 'Camp Notes' })).toHaveAttribute('aria-current', 'location');
            expect(within(navigation).getByRole('link', { name: 'First Stop' })).not.toHaveAttribute('aria-current');
        }
    });
});
