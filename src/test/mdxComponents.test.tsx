import { useRef } from 'react';
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
                        {duplicateHeading && <Heading2>First Stop</Heading2>}
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
        expect(navigation).toHaveTextContent('On this page');
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