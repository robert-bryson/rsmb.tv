// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSiteSearchIndex, extractArticleText, extractPageText, siteSearchPlugin } from '../site-search-plugin';
import { searchSite } from '../../src/content/siteSearch';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-search-'));
    roots.push(root);
    function write(file: string, text: string) {
        const target = path.join(root, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, text);
    }
    write('src/content/sitePages.json', JSON.stringify({
        '/about': { title: 'About', description: 'A short introduction.' },
        '/projects/anki-artisan': { title: 'Anki Artisan', description: 'Flashcard decks.' },
    }));
    write('src/navigation/pageLoaders.ts', `export const pageLoaders = {
        '/about': () => import('../pages/About').then(m => m.About),
        '/projects/anki-artisan': () => import('../pages/AnkiArtisan'),
    };`);
    write('src/pages/About.tsx', `import { Experience } from '../components/Experience'; export function About() { return <><h1>About</h1><p>I work on federal geospatial platforms.</p><Experience /></>; }`);
    write('src/components/Experience.tsx', 'export const Experience = () => <p>Cartography and wildfire mapping.</p>;');
    write('src/pages/AnkiArtisan.tsx', 'export default () => <p>Study birds, plants, and other wildlife.</p>;');
    const posts = [
        { slug: 'published', title: 'Coastal trip', description: 'A trip.', date: '2024-10-08', tags: ['Washington'], format: 'trip', tripId: 'coastal' },
        { slug: 'draft', title: 'Private draft', description: 'Draft description.', tags: [], development: { published: false, documentUrl: 'private-source-id' } },
        { slug: 'unavailable', title: 'Unavailable draft', description: 'Not ready.', tags: [], development: { published: false, contentAvailable: false } },
    ];
    write('src/content/posts.json', JSON.stringify(posts));
    write('src/content/blog/published.mdx', '---\ntitle: "Coastal trip"\n---\n\n<p style={{ textIndent: "36pt" }}>We explored a temperate rainforest.</p>');
    write('src/content/blog/draft.mdx', 'A secret body about a desert canyon.');
    write('src/content/blog/unavailable.mdx', 'Stale body that must not be searchable.');
    return { root, write };
}

describe('site search index', () => {
    it('extracts Markdown, HTML paragraphs, code, captions, and entity text without frontmatter or JSX configuration', () => {
        const text = extractArticleText('---\ntitle: "private-frontmatter"\n---\n\nimport { Gallery } from "private-module";\n\n# Rainforest\n\n<p className="private-style" style={{ textIndent: "36pt" }}>Cedar &amp; fir with **moss**.</p>\n\n![Rocky shore](https://example.com/private-url)\n\n<Gallery caption="A driftwood fort" />\n\n`hello world`');
        expect(text).toBe('Rainforest Cedar & fir with moss . Rocky shore A driftwood fort hello world');
        expect(text).not.toMatch(/private-|textIndent|36pt/);
    });

    it('extracts page prose and captions while excluding code, styles, imports, and URLs', () => {
        const text = extractPageText(`import { Private } from 'private-module'; const image = { src: 'private-url', caption: 'A forest' }; export default () => <div className="private-style"><h1>Map explorer</h1><p>Find a route.</p><Header description="Roads and rivers" /></div>;`);
        expect(text).toContain('A forest');
        expect(text).toContain('Map explorer');
        expect(text).toContain('Find a route.');
        expect(text).toContain('Roads and rivers');
        expect(text).not.toMatch(/private-/);
    });

    it('decodes JSX entities and keeps paragraphs separate for search previews', () => {
        const source = `<><h1>Record ages</h1><p>Explore today&apos;s records &amp; yesterday&#8217;s extremes.</p><p>Failed to load record data</p><p>Compare coastal stations.</p></>`;
        expect(extractPageText(source, true)).toBe('Record ages\nExplore today\'s records & yesterday’s extremes.\nFailed to load record data\nCompare coastal stations.');
        expect(extractPageText('<p>&copy; &#x1F30D; &unknown; &lt;script&gt;</p>')).toBe('© 🌍 &unknown; <script>');
        expect(extractPageText(`<p>One &amp;amp; example {'Another &amp; example'}</p>`)).toBe('One &amp; example Another &amp; example');
        expect(extractArticleText('Use `&amp;` in HTML.')).toBe('Use &amp; in HTML.');
    });

    it('indexes all page routes, nested component text, project technologies, and complete articles', () => {
        const { root } = fixture();
        const watched: string[] = [];
        const index = buildSiteSearchIndex({ root, mode: 'development', command: 'serve' }, file => watched.push(file));
        expect(index.find(doc => doc.url === '/about')?.content).toContain('Cartography and wildfire mapping.');
        expect(index.find(doc => doc.url === '/projects/anki-artisan')?.keywords).toContain('Python');
        expect(index.find(doc => doc.url === '/trips/published')?.content).toBe('We explored a temperate rainforest.');
        expect(watched).toContain(path.join(root, 'src/components/Experience.tsx'));
        expect(watched).toContain(path.join(root, 'src/content/blog/published.mdx'));
    });

    it('excludes draft metadata and bodies from production and never serializes source links', () => {
        const { root } = fixture();
        const index = buildSiteSearchIndex({ root, mode: 'production', command: 'build' });
        expect(index.map(doc => doc.url)).toEqual(['/about', '/projects/anki-artisan', '/trips/published']);
        expect(JSON.stringify(index)).not.toMatch(/secret body|private-source-id|Private draft|Stale body/);
    });

    it('includes trip places and visible photo captions without indexing asset URLs', () => {
        const { root, write } = fixture();
        const posts = [{ slug: 'published', title: 'Coastal trip', description: 'A trip.', tags: [], format: 'trip', tripId: 'coastal' }];
        write('src/content/posts.json', JSON.stringify(posts));
        write('src/content/trips/coastal.json', JSON.stringify({ countries: [{ code: 'CA', regions: ['British Columbia'] }], photos: [{ src: 'private-asset-url', caption: 'A driftwood fort near the beach.' }] }));
        const index = buildSiteSearchIndex({ root, mode: 'development', command: 'serve' });
        expect(index.find(doc => doc.url === '/trips/published')).toMatchObject({ keywords: expect.stringContaining('Canada British Columbia'), content: expect.stringContaining('driftwood fort') });
        expect(JSON.stringify(index)).not.toContain('private-asset-url');
    });

    it('serves the virtual index when a draft body is missing', async () => {
        const { root } = fixture();
        fs.unlinkSync(path.join(root, 'src/content/blog/unavailable.mdx'));
        const server = await createServer({
            configFile: false, root, plugins: [siteSearchPlugin()],
            server: { middlewareMode: true, hmr: false, ws: false, watch: null },
            optimizeDeps: { noDiscovery: true, include: [] },
        });
        try {
            await server.environments.client.moduleGraph.ensureEntryFromUrl('virtual:site-search');
            const result = await server.transformRequest('virtual:site-search');
            expect(result?.code).toContain('temperate rainforest');
        } finally {
            await server.close();
        }
    });

    it.each(['serve', 'build'] as const)('includes draft text only in development previews (%s), and skips unavailable bodies', command => {
        const { root } = fixture();
        const index = buildSiteSearchIndex({ root, mode: 'development', command });
        expect(index.find(doc => doc.url === '/blog/draft')).toMatchObject({ draft: true, content: 'A secret body about a desert canyon.' });
        expect(index.find(doc => doc.url === '/blog/unavailable')).toMatchObject({ draft: true, content: '' });
        expect(JSON.stringify(index)).not.toContain('private-source-id');
    });

    it('uses the fixed article fixtures in trip-test builds', () => {
        const { root, write } = fixture();
        write('tests/fixtures/trip-content/posts.json', JSON.stringify([{ slug: 'test-trip', title: 'Test trip', description: 'A fixture.', tags: [], format: 'trip', tripId: 'synthetic' }]));
        write('tests/fixtures/trip-content/blog/test-trip.mdx', 'A synthetic mountain pass.');
        const index = buildSiteSearchIndex({ root, mode: 'trip-test', command: 'build' });
        expect(index.find(doc => doc.url === '/trips/test-trip')?.content).toBe('A synthetic mountain pass.');
        expect(index.some(doc => doc.url === '/trips/published')).toBe(false);
    });
});

describe('November 15 search review regressions', () => {
    it('finds articles by their public slug and year as well as their display title', () => {
        const { root } = fixture();
        const index = buildSiteSearchIndex({ root, mode: 'production', command: 'build' });
        expect(searchSite(index, 'published 2024')[0]?.url).toBe('/trips/published');
    });

    it('indexes the motorcycle name shown in trip facts', () => {
        const { root, write } = fixture();
        write('src/content/trips/coastal.json', JSON.stringify({ motorcycle: 'Honda CB500X' }));
        const index = buildSiteSearchIndex({ root, mode: 'production', command: 'build' });
        expect(searchSite(index, 'Honda CB500X')[0]?.url).toBe('/trips/published');
    });

    it('ignores nested objects in non-text JSX attributes', () => {
        const text = extractPageText(`<Widget data-config={{ title: 'private-title', description: 'private-description' }} caption={'Public caption'} />`);
        expect(text).toBe('Public caption');
    });

    it('indexes countries whose valid manifest entries have no region list', () => {
        const { root, write } = fixture();
        write('src/content/trips/coastal.json', JSON.stringify({ countries: [{ code: 'US' }] }));
        const index = buildSiteSearchIndex({ root, mode: 'production', command: 'build' });
        expect(index.find(doc => doc.url === '/trips/published')?.keywords).toContain('US United States');
    });

    it('excludes JSX configuration whether its strings use quotes, braces, or arrays', () => {
        const text = extractPageText(`<a href={'private-destination'} className={\`private-style\`} data-config={['private-data']} title={'Public label'}>Public text</a>`);
        expect(text).toBe('Public label Public text');
        expect(text).not.toContain('private-');
    });
    it('extracts static MDX expressions without evaluating code or indexing configuration', () => {
        const text = extractArticleText(`<p>{'A redwood grove.'} {\`Pacific coast\`} {secretToken}</p>\n\n<Photo caption={'A mountain meadow'} alt={\`Granite peaks\`} src={'private-url'} />\n\n{(() => { throw new Error('must not execute'); })()}`);
        expect(text).toBe('A redwood grove. Pacific coast A mountain meadow Granite peaks');
        expect(text).not.toMatch(/secretToken|private-url|must not execute/);
    });

    it('finds visible literal array items in JSX without indexing import paths or identifiers', () => {
        const text = extractPageText(`import { Private } from 'private-module'; export default () => <><TechBadges tech={['Python', 'TypeScript']} /><p>{'A public explanation.'}</p><img src={'private-url'} /></>;`);
        expect(text).toContain('Python');
        expect(text).toContain('TypeScript');
        expect(text).toContain('A public explanation.');
        expect(text).not.toMatch(/private-|Private/);
    });

    it('rejects a missing production registry instead of silently publishing an incomplete index', () => {
        const { root } = fixture();
        fs.unlinkSync(path.join(root, 'src/content/posts.json'));
        expect(() => buildSiteSearchIndex({ root, mode: 'production', command: 'build' })).toThrow(/Missing post registry/);
    });

    it('rejects duplicate public slugs and invalid trip IDs consistently with the page registry', () => {
        const { root, write } = fixture();
        const post = { slug: 'published', title: 'A trip', description: 'Coastal camping.', tags: [], format: 'trip', tripId: 'coastal' };
        write('src/content/posts.json', JSON.stringify([post, post]));
        expect(() => buildSiteSearchIndex({ root, mode: 'production', command: 'build' })).toThrow(/Duplicate post slug/);
        write('src/content/posts.json', JSON.stringify([{ ...post, tripId: '../private' }]));
        expect(() => buildSiteSearchIndex({ root, mode: 'production', command: 'build' })).toThrow(/Invalid trip ID/);
    });

    it('follows component imports once through a cycle and leaves unrelated source text out', () => {
        const { root, write } = fixture();
        write('src/pages/About.tsx', `import { Experience } from '../components/Experience'; export default () => <><Experience /><p>About this site.</p></>;`);
        write('src/components/Experience.tsx', `import About from '../pages/About'; export const Experience = () => <p>Wildfire mapping.</p>;`);
        write('src/pages/Private.tsx', 'export default () => <p>unregistered private text</p>;');
        const index = buildSiteSearchIndex({ root, mode: 'development', command: 'serve' });
        expect(index.find(doc => doc.url === '/about')?.content).toBe('About this site.\nWildfire mapping.');
        expect(JSON.stringify(index)).not.toContain('unregistered private text');
    });

    it('skips malformed draft manifests in development and rejects them in production', () => {
        const { root, write } = fixture();
        write('src/content/trips/coastal.json', '{invalid');
        expect(() => buildSiteSearchIndex({ root, mode: 'development', command: 'serve' })).not.toThrow();
        expect(() => buildSiteSearchIndex({ root, mode: 'production', command: 'build' })).toThrow(SyntaxError);
    });
});
