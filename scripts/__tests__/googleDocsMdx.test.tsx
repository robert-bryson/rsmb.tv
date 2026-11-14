// @vitest-environment node
import fs from 'node:fs';
import { evaluate } from '@mdx-js/mdx';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import * as runtime from 'react/jsx-runtime';
import { describe, expect, it } from 'vitest';
import { convertHtmlToMarkdown, expandTripShortcodes } from '../sync-blogs.js';

async function renderDocument(html: string) {
    const markdown = convertHtmlToMarkdown(html);
    const { default: Content } = await evaluate(markdown, runtime);
    return renderToStaticMarkup(<Content />);
}

describe('Google Docs to rendered MDX', () => {
    it('places an animation between the surrounding Google Doc paragraphs, including inline formatting', async () => {
        const markdown = convertHtmlToMarkdown('<p>Before the forest.</p><p><strong>{{trip-animation:speeders}}</strong></p><p>After the forest.</p>');
        const expanded = expandTripShortcodes(markdown, { format: 'trip', tripId: 'coast' }, { animations: [{ id: 'speeders' }] });
        const { default: Content } = await evaluate(expanded, runtime);
        expect(renderToStaticMarkup(<Content components={{
            TripAnimation: ({ animationId }: { animationId: string }) => <figure data-animation={animationId} />,
        }} />)).toBe('<p>Before the forest.</p>\n<figure data-animation="speeders"></figure>\n<p>After the forest.</p>');
    });

    it('keeps the browser fixture equal to the importer output', async () => {
        const html = fs.readFileSync(new URL('../../tests/fixtures/google-doc.html', import.meta.url), 'utf8');
        const fixture = fs.readFileSync(new URL('../../tests/fixtures/google-doc.mdx', import.meta.url), 'utf8');
        expect(`${convertHtmlToMarkdown(html)}\n`).toBe(fixture);
        const dom = new JSDOM(await renderDocument(html));
        try {
            const document = dom.window.document;
            expect([...document.querySelectorAll('h1, h2')].map(node => node.textContent))
                .toEqual(['Route notes', 'First Stop', 'First Stop', 'First Stop 1']);
            expect(document.querySelectorAll('p.blog-subtitle')).toHaveLength(3);
            expect(document.querySelector('.blog-subtitle')).toHaveTextContent('A motorcycle trip');
            expect(document.querySelectorAll('.blog-subtitle')[2].textContent)
                .toBe('Notes & details {optional}Second line.');
            expect(document.querySelector('.blog-subtitle em')?.textContent).toBe('details');
            expect(document.querySelector('.blog-subtitle br')).not.toBeNull();
        } finally {
            dom.window.close();
        }
    });

    it('omits empty subtitles without dropping adjacent content', async () => {
        const html = await renderDocument('<p>Before.</p><p class="subtitle"> &nbsp; </p><p>After.</p>');
        expect(html).toBe('<p>Before.</p>\n<p>After.</p>');
    });

    it('retains Google Docs inline formatting in subtitles', async () => {
        const html = await renderDocument(`
            <style>.italic { font-style: italic; } .bold { font-weight: 700; }</style>
            <p class="subtitle"><span class="italic">Notes</span> and <span class="bold">details</span>.</p>
        `);
        expect(html).toBe('<p class="blog-subtitle"><em>Notes</em> and <strong>details</strong>.</p>');
    });

    it('preserves authored first-line indents from Docs classes and inline overrides', async () => {
        const html = await renderDocument(`
            <style>.first-line { text-indent: 36pt; margin-left: 0; }</style>
            <p class="first-line">First <strong>paragraph</strong> with <a href="https://example.com">a link</a>.</p>
            <p class="first-line" style="text-indent: 2.5em">A different indent with <code>{value}</code>.</p>
            <p class="first-line" style="text-indent: 0px">An unindented paragraph.</p>
            <p>Ordinary body text.</p>
        `);
        const dom = new JSDOM(html);
        try {
            const paragraphs = [...dom.window.document.querySelectorAll('p')];
            expect(paragraphs).toHaveLength(4);
            expect(paragraphs.map(p => p.style.textIndent)).toEqual(['36pt', '2.5em', '', '']);
            expect(paragraphs[0]).toHaveClass('text-zinc-300', 'leading-relaxed', 'mb-4');
            expect(paragraphs[0].querySelector('strong')).toHaveTextContent('paragraph');
            expect(paragraphs[0].querySelector('a')).toHaveAttribute('href', 'https://example.com');
            expect(paragraphs[1].querySelector('code')).toHaveTextContent('{value}');
        } finally {
            dom.window.close();
        }
    });

    it('preserves typed tabs and split nonbreaking spaces as first-line whitespace', async () => {
        const html = await renderDocument(`
            <p><span>&nbsp;&nbsp;&nbsp;&nbsp;</span><span>&nbsp;&nbsp;&nbsp;&nbsp;<em>Tabbed prose</em> continues here.</span></p>
            <p>\tAnother tabbed paragraph.</p>
            <p> A single ordinary leading space.</p>
        `);
        const dom = new JSDOM(html);
        try {
            const paragraphs = [...dom.window.document.querySelectorAll('p')];
            expect(paragraphs).toHaveLength(3);
            expect(paragraphs[0].textContent).toBe(`${'\u00a0'.repeat(8)}Tabbed prose continues here.`);
            expect(paragraphs[0].querySelector('em')).toHaveTextContent('Tabbed prose');
            expect(paragraphs[1].textContent).toBe(`${'\u00a0'.repeat(8)}Another tabbed paragraph.`);
            expect(paragraphs[2].textContent).toBe('A single ordinary leading space.');
            expect(dom.window.document.querySelector('pre')).toBeNull();
        } finally {
            dom.window.close();
        }
    });

    it('resolves conflicting Docs classes in stylesheet order, including repeated rules', async () => {
        const html = await renderDocument(`
            <style>
                .first-line { text-indent: 36pt; font-weight: 700; }
                .reset { text-indent: 0px; font-weight: 400; }
                .first-line { font-style: italic; }
            </style>
            <p class="reset first-line">The reset wins regardless of class attribute order.</p>
            <p class="first-line reset">The same reset wins here.</p>
        `);
        const dom = new JSDOM(html);
        try {
            const paragraphs = [...dom.window.document.querySelectorAll('p')];
            expect(paragraphs).toHaveLength(2);
            expect(paragraphs.map(p => p.style.textIndent)).toEqual(['', '']);
            expect(dom.window.document.querySelectorAll('strong')).toHaveLength(0);
            expect(dom.window.document.querySelectorAll('em')).toHaveLength(2);
        } finally {
            dom.window.close();
        }
    });

    it('retains line breaks in indented prose without nesting paragraphs', async () => {
        const html = await renderDocument('<p style="text-indent: 48px">First line.<br>Second <em>line</em>.</p>');
        const dom = new JSDOM(html);
        try {
            expect(dom.window.document.querySelectorAll('p')).toHaveLength(1);
            expect(dom.window.document.querySelector('p')?.textContent).toBe('First line.\nSecond line.');
            expect(dom.window.document.querySelector('em')).toHaveTextContent('line');
        } finally {
            dom.window.close();
        }
    });

    it('keeps indentation out of code, list layout, subtitles, and trip components', () => {
        const markdown = convertHtmlToMarkdown(`
            <style>.first-line { text-indent: 48px; }</style>
            <p class="first-line">\`\`\`text</p><p class="first-line">\tCode indentation.</p><p class="first-line">\`\`\`</p>
            <ul><li><p class="first-line">List item.</p></li></ul>
            <p class="subtitle first-line">Supporting text.</p>
            <p class="first-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{{trip-map}}</p>
        `);
        expect(markdown).toContain('```text\n\tCode indentation.\n```');
        expect(markdown).toContain('- List item.');
        expect(markdown).toContain('<p className="blog-subtitle">Supporting text.</p>');
        expect(expandTripShortcodes(markdown, { format: 'trip' })).toContain('<TripMap />');
        expect(markdown).not.toContain('textIndent');
    });

    it('does not carry arbitrary paragraph styles or attributes into MDX', async () => {
        const html = await renderDocument(`
            <p style="text-indent: 48px; background: url(https://example.com/unwanted); position: fixed" onclick="alert(1)">Safe indent.</p>
            <p style="text-indent: calc(1px + 2em)" data-blog-text-indent="48px" data-blog-indent-spaces="20">No imported expression.</p>
        `);
        expect(html).toContain('style="text-indent:48px"');
        expect(html).not.toMatch(/unwanted|position|onclick|data-blog|calc\(/);
        expect(html).toContain('<p>No imported expression.</p>');
    });

    it.each(['p', 'p class="subtitle"', 'p style="text-indent: 48px"'])('renders expression syntax as text in %s', async tag => {
        const html = await renderDocument(`<${tag}>{globalThis.mdxInjected = 1} &lt;button&gt; &amp; text</p>`);
        expect(html).toContain('{globalThis.mdxInjected = 1} &lt;button&gt; &amp; text');
        expect(Reflect.has(globalThis, 'mdxInjected')).toBe(false);
    });

    it.each([
        '<p>import test from "./missing.js"</p>',
        '<p><span>im</span><span>port</span> test from "./missing.js"</p>',
        '<p>export const injected = 1</p>',
        '<p><span>ex</span><span>port</span> const injected = 1</p>',
    ])('renders module statements as text: %s', async source => {
        const html = await renderDocument(source);
        expect(html).toMatch(/^<p>(import test from &quot;\.\/missing\.js&quot;|export const injected = 1)<\/p>$/);
    });

    it('keeps expressions and module statements unchanged in code samples', async () => {
        const html = await renderDocument(`
            <p>Inline <code>{value}</code>.</p>
            <pre><code>import value from './value.js'\nexport const result = {value}</code></pre>
            <p>export const outside = 1</p>
        `);
        expect(html).toContain('<code>{value}</code>');
        expect(html).toContain("import value from &#x27;./value.js&#x27;\nexport const result = {value}");
        expect(html).toContain('<p>export const outside = 1</p>');
    });

    it('preserves typed code fences before escaping prose', async () => {
        const html = await renderDocument([
            '<p>```js</p>',
            '<p>import value from "./value.js"</p>',
            '<p>export const result = {value, tag: "&lt;div&gt;", entity: "&amp;lt;"}</p>',
            '<p>```</p>',
            '<p>After {value}.</p>',
        ].join(''));
        expect(html).toContain('export const result = {value, tag: &quot;&lt;div&gt;&quot;, entity: &quot;&amp;lt;&quot;}');
        expect(html).toContain('<p>After {value}.</p>');
    });

    it('keeps literal entity text from being decoded twice', async () => {
        expect(await renderDocument('<p>&amp;lt; &amp;#123;</p>')).toBe('<p>&amp;lt; &amp;#123;</p>');
    });

    it('escapes module statements after an invalid backtick fence', async () => {
        const markdown = convertHtmlToMarkdown('<p>```js`</p><p>export const malformedFence = 1</p><p>```</p>');
        expect(markdown).toContain('&#101;xport const malformedFence = 1');
        const compiled = await evaluate(markdown, runtime);
        expect(compiled).not.toHaveProperty('malformedFence');
        expect(renderToStaticMarkup(<compiled.default />)).toContain('export const malformedFence = 1');
    });

    it('validates shortcodes after an invalid backtick fence', () => {
        expect(() => expandTripShortcodes('```js`\n\n{{trip-gallery:missing}}', { format: 'trip' }, { galleries: {} }))
            .toThrow('unknown gallery "missing"');
    });

    it.each(['~~~text', '````text'])('keeps shorter and mismatched fences inside %s examples', opening => {
        const markdown = `${opening}\n\n{{trip-gallery:missing}}\n\n\`\`\`\n\n{{trip-unknown}}\n\n${opening.slice(0, opening.indexOf('text'))}\n\n{{trip-facts}}`;
        expect(expandTripShortcodes(markdown, { format: 'trip' }, { galleries: {} }))
            .toBe(markdown.replace(/\{\{trip-facts\}\}$/, '<TripFacts />'));
    });

    it('removes active content and unsafe attributes from subtitles', async () => {
        const html = await renderDocument(`
            <p class="subtitle" id="post-table-of-contents" onclick="alert(1)">
                <a href="javascript:alert(1)">Unsafe</a>
                <a href="https://www.google.com/url?q=javascript%3Aalert(1)">Redirect</a>
                <a href="https://example.com/?a=1&amp;b=2" onclick="alert(1)">Safe</a>
                <img src="javascript:alert(1)" onerror="alert(1)">
                <script>alert(1)</script><iframe src="https://example.com">Frame</iframe>
            </p>
        `);
        expect(html).toContain('<a>Unsafe</a>');
        expect(html).toContain('<a>Redirect</a>');
        expect(html).toContain('<a href="https://example.com/?a=1&amp;b=2">Safe</a>');
        expect(html).not.toMatch(/javascript:|onclick|onerror|<script|<iframe|<img| id=/);
    });

    it('retains trip shortcodes for the manifest validation step', () => {
        const markdown = convertHtmlToMarkdown('<p>{{trip-map}}</p><p>{{trip-facts}}</p>');
        expect(expandTripShortcodes(markdown, { format: 'trip', tripId: 'example' }))
            .toBe('<TripMap />\n\n<TripFacts />');
    });

    it.each([
        '<span style="background-color: #ffff00">{{trip-gallery:2024-05-11-1}}</span>',
        '<strong><em><u>{{trip-gallery:2024-05-11-1}}</u></em></strong>',
        '<span>{</span><mark>{trip-gallery:</mark><b>2024-05-11-1}</b><span>}</span>',
    ])('renders a formatted standalone gallery tag as a component: %s', async content => {
        const markdown = convertHtmlToMarkdown(`<p>Before.</p><p> &nbsp;${content}&nbsp; </p><p>After.</p>`);
        const expanded = expandTripShortcodes(markdown, { format: 'trip', tripId: 'boise-2024' }, {
            galleries: { '2024-05-11-1': ['camp'] },
        });
        const { default: Content } = await evaluate(expanded, runtime);
        const html = renderToStaticMarkup(<Content components={{
            TripGallery: ({ galleryId }: { galleryId: string }) => <section data-gallery={galleryId}>Photos</section>,
        }} />);
        expect(html).toBe('<p>Before.</p>\n<section data-gallery="2024-05-11-1">Photos</section>\n<p>After.</p>');
    });

    it('validates highlighted gallery references against the manifest', () => {
        const markdown = convertHtmlToMarkdown('<p><mark>{{trip-gallery:missing}}</mark></p>');
        expect(() => expandTripShortcodes(markdown, { format: 'trip', tripId: 'boise-2024' }, { galleries: {} }))
            .toThrow('unknown gallery "missing"');
    });

    it.each([
        '{{trip-gallery:2024-05-18_2}}',
        '{{trip-photo-pano:Uppercase}}',
        '{{trip-photo:has space}}',
    ])('rejects malformed standalone shortcodes after Google formatting: %s', shortcode => {
        const markdown = convertHtmlToMarkdown(`<p><strong><mark>${shortcode}</mark></strong></p>`);
        expect(() => expandTripShortcodes(markdown, { format: 'trip', tripId: 'example' }, {}))
            .toThrow(`Unsupported trip shortcode: ${shortcode}`);
    });

    it('keeps malformed shortcode examples literal in code', async () => {
        const shortcode = '{{trip-gallery:2024-05-18_2}}';
        const markdown = convertHtmlToMarkdown(`<p><code>${shortcode}</code></p><pre><code>${shortcode}</code></pre>`);
        const expanded = expandTripShortcodes(markdown, { format: 'trip' }, {});
        expect(expanded).toBe(markdown);
        const { default: Content } = await evaluate(expanded, runtime);
        expect(renderToStaticMarkup(<Content />)).toContain(`<code>${shortcode}</code>`);
    });

    it.each([
        '{{trip-gallery:2024-05-18_2}}',
        '{{trip-photo-pano:scene}}',
    ])('renders standalone shortcode text literally in ordinary posts: %s', async shortcode => {
        const markdown = convertHtmlToMarkdown(`<p>${shortcode}</p>`, { tripShortcodes: false });
        const expanded = expandTripShortcodes(markdown, { format: 'post' });
        const { default: Content } = await evaluate(expanded, runtime);
        expect(renderToStaticMarkup(<Content />)).toBe(`<p>${shortcode}</p>`);
    });

    it('renders a formatted panorama shortcode with its photo reference and layout', async () => {
        const markdown = convertHtmlToMarkdown('<p><strong><mark>{{trip-photo-pano:mountains}}</mark></strong></p>');
        const expanded = expandTripShortcodes(markdown, { format: 'trip', tripId: 'coast' }, {
            photos: [{ id: 'mountains' }],
        });
        const { default: Content } = await evaluate(expanded, runtime);
        expect(renderToStaticMarkup(<Content components={{
            TripPhoto: ({ photoId, layout }: { photoId: string; layout: string }) => <figure data-photo={photoId} data-layout={layout} />,
        }} />)).toBe('<figure data-photo="mountains" data-layout="pano"></figure>');
    });

    it('preserves highlighted prose and inline tags as literal text', async () => {
        const markdown = convertHtmlToMarkdown('<p><mark>Remember {{trip-gallery:highlights}}</mark></p>');
        const expanded = expandTripShortcodes(markdown, { format: 'trip' });
        const { default: Content } = await evaluate(expanded, runtime);
        expect(renderToStaticMarkup(<Content />))
            .toBe('<mark>Remember {{trip-gallery:highlights}}</mark>');
    });

    it.each([
        '<p>Remember {{trip-gallery:highlights}} for later.</p>',
        '<p>{{trip-photo-pano:scene}} is a literal example here.</p>',
        '<h2>About {{trip-map}}</h2>',
        '<ul><li>{{trip-gallery:highlights}}</li></ul>',
        '<ul><li><p>{{trip-gallery:highlights}}</p></li></ul>',
        '<blockquote><p>{{trip-photo-pano:scene}}</p></blockquote>',
    ])('renders shortcode text literally outside supported standalone paragraphs: %s', async source => {
        const markdown = convertHtmlToMarkdown(source);
        const expanded = expandTripShortcodes(markdown, { format: 'trip' }, {});
        const { default: Content } = await evaluate(expanded, runtime);
        expect(renderToStaticMarkup(<Content />)).toContain(source.match(/\{\{.*?\}\}/)![0]);
    });

    it.each([
        '<p><code>{{trip-gallery:missing}}</code></p>',
        '<p><code>{{trip-photo-pano:missing}}</code></p>',
        '<pre><code>{{trip-gallery:missing}}\n{{trip-unknown}}</code></pre>',
        '<p>```text</p><p><mark>{{trip-gallery:missing}}</mark></p><p>{{trip-unknown}}</p><p>```</p>',
    ])('keeps shortcode examples literal in code: %s', async source => {
        const markdown = convertHtmlToMarkdown(source);
        const expanded = expandTripShortcodes(markdown, { format: 'trip' }, { galleries: {} });
        expect(expanded).toBe(markdown);
        const { default: Content } = await evaluate(expanded, runtime);
        expect(renderToStaticMarkup(<Content />)).toMatch(/\{\{trip-(?:gallery|photo-pano):missing\}\}/);
    });

});
