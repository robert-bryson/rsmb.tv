// @vitest-environment node
import { evaluate } from '@mdx-js/mdx';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import * as runtime from 'react/jsx-runtime';
import remarkFrontmatter from 'remark-frontmatter';
import { describe, expect, it } from 'vitest';
import { remarkTripChapters } from '../remark-trip-chapters';

async function renderStory(body: string, metadata = 'format: trip') {
    const module = await evaluate(`---\n${metadata}\n---\n\n${body}`, {
        ...runtime,
        remarkPlugins: [remarkFrontmatter, remarkTripChapters],
    });
    const dom = new JSDOM(renderToStaticMarkup(<module.default components={{
        TripPhoto: ({ photoId }: { photoId: string }) => <figure data-photo-id={photoId} />,
    }} />));
    return { module, dom, document: dom.window.document };
}

describe('trip chapter boundaries', () => {
    it.each([1, 2])('groups level %i chapters with their subsections and media, preserving the introduction', async depth => {
        const heading = '#'.repeat(depth);
        const { dom, document } = await renderStory(`Opening paragraph.

${heading} First day

First day text.

${heading}# A scene

<TripPhoto photoId="camp" />

${heading} Second day

Last paragraph.`);
        try {
            const chapters = document.querySelectorAll('.trip-chapter');
            expect(chapters).toHaveLength(2);
            expect(document.body.firstElementChild?.textContent).toBe('Opening paragraph.');
            expect(chapters[0].firstElementChild?.tagName).toBe(`H${depth}`);
            expect(chapters[0].querySelector(`h${depth + 1}`)?.textContent).toBe('A scene');
            expect(chapters[0].querySelector('figure')?.getAttribute('data-photo-id')).toBe('camp');
            expect(chapters[0].textContent).toContain('First day text.');
            expect(chapters[1].textContent).toContain('Last paragraph.');
        } finally {
            dom.window.close();
        }
    });

    it('keeps h2 subsections inside h1 chapters', async () => {
        const { dom, document } = await renderStory('# First chapter\n\n## A scene\n\nText.\n\n# Second chapter');
        try {
            expect(document.querySelectorAll('.trip-chapter')).toHaveLength(2);
            expect(document.querySelector('.trip-chapter h2')?.textContent).toBe('A scene');
        } finally {
            dom.window.close();
        }
    });

    it.each(['format: writing', 'title: A post', 'null', 'plain text', '[]'])('leaves non-trip metadata unchanged: %s', async metadata => {
        const { dom, document } = await renderStory('## A heading\n\nText.', metadata);
        try {
            expect(document.querySelector('.trip-chapter')).toBeNull();
            expect(document.querySelector('h2')?.parentElement).toBe(document.body);
        } finally {
            dom.window.close();
        }
    });

    it('leaves content without frontmatter or chapter headings unchanged', async () => {
        const { default: Content } = await evaluate('## A heading', {
            ...runtime, remarkPlugins: [remarkTripChapters],
        });
        expect(renderToStaticMarkup(<Content />)).toBe('<h2>A heading</h2>');
        const { dom, document } = await renderStory('Opening.\n\n### A scene\n\nMore text.');
        try {
            expect(document.querySelector('.trip-chapter')).toBeNull();
            expect(document.querySelector('h3')?.textContent).toBe('A scene');
        } finally {
            dom.window.close();
        }
    });

    it('preserves module exports and cross-chapter Markdown references', async () => {
        const { dom, document, module } = await renderStory(`## First day

export const route = 'coast';

[Continue][next]

## Second day

[next]: https://example.com/coast`);
        try {
            expect(module.route).toBe('coast');
            expect(document.querySelectorAll('.trip-chapter')).toHaveLength(2);
            expect(document.querySelector('.trip-chapter a')?.getAttribute('href')).toBe('https://example.com/coast');
        } finally {
            dom.window.close();
        }
    });
});
