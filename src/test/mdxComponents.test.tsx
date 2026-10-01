import { act, StrictMode, useRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostHeadingProvider } from '../blog/LinkedHeading';
import { mdxComponents } from '../blog/MdxComponents';
import { PostTableOfContents } from '../blog/PostTableOfContents';

const Anchor = mdxComponents.a;
const Heading2 = mdxComponents.h2;
const Heading3 = mdxComponents.h3;
const Heading6 = mdxComponents.h6;

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

afterEach(() => {
    window.history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

describe('MDX headings', () => {
    it('adds a stable ID and permalink while preserving an explicit ID', () => {
        const { rerender } = render(<Heading2>Résumé &amp; Road / Day 1</Heading2>);

        const generatedHeading = screen.getByRole('heading', { name: /Résumé & Road \/ Day 1/ });
        expect(generatedHeading).toHaveAttribute('id', 'resume-road-day-1');
        expect(screen.getByRole('link', { name: 'Link to Résumé & Road / Day 1' }))
            .toHaveAttribute('href', '#resume-road-day-1');
        expect(screen.getByRole('link', { name: 'Back to table of contents' }))
            .toHaveAttribute('href', '#post-table-of-contents');

        rerender(<Heading2 id="author-id">Named section</Heading2>);
        expect(screen.getByRole('heading', { name: /Named section/ })).toHaveAttribute('id', 'author-id');
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
        const scrollIntoView = vi.fn(function (this: HTMLElement) { return this.id; });
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: scrollIntoView,
        });
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
        const scrollIntoView = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: scrollIntoView,
        });
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
        const scrollIntoView = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: scrollIntoView,
        });
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        render(<TableOfContentsFixture />);
        await screen.findByRole('navigation', { name: 'Table of contents' });

        window.history.replaceState(null, '', '#camp-notes');
        window.dispatchEvent(new HashChangeEvent('hashchange'));

        await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce());
    });
});