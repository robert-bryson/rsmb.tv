// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build, createServer, type ResolvedConfig } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { articleHtml, tripContentPlugin } from '../trip-content-plugin';
import { updateManifestAssets } from '../update-trip-manifest-assets.js';
import { tripManifestSchema, type TripManifest } from '../../shared/tripManifestSchema';
import { isRouteGeoJson } from '../../shared/routeGeometry';
import manifest from '../../tests/fixtures/trip-content/trips/coastal-test.json';
import { STATIC_PAGE_PATHS, staticPageMetadata } from '../../src/utils/pageMetadata';
import siteAliases from '../../src/content/siteAliases.json';

const temporaryRoots: string[] = [];
afterEach(() => {
    for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

interface ContentFixtureOptions {
    manifests?: TripManifest[];
    bodies?: string[];
    createTripDirectory?: boolean;
    mode?: string;
}

function createContentFixture(posts: unknown[], { manifests = [], bodies = [], createTripDirectory = true }: ContentFixtureOptions = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-registry-test-'));
    temporaryRoots.push(root);
    const directory = path.join(root, 'src/content');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'posts.json'), JSON.stringify(posts));
    if (createTripDirectory) fs.mkdirSync(path.join(directory, 'trips'));
    for (const trip of manifests) fs.writeFileSync(path.join(directory, 'trips', `${trip.id}.json`), JSON.stringify(trip));
    if (bodies.length) fs.mkdirSync(path.join(directory, 'blog'));
    for (const slug of bodies) fs.writeFileSync(path.join(directory, 'blog', `${slug}.mdx`), '# Story');
    return root;
}

function loadPostRegistry(posts: unknown[], command: 'build' | 'serve', watchedFiles: string[] = [], moduleId = 'virtual:post-content', options: ContentFixtureOptions = {}) {
    const root = createContentFixture(posts, options);
    const plugin = tripContentPlugin();
    const configure = plugin.configResolved;
    const load = plugin.load;
    if (typeof configure !== 'function' || typeof load !== 'function') throw new Error('Expected function hooks.');
    configure.call({} as never, { root, mode: options.mode ?? 'production', command } as ResolvedConfig);
    return load.call({ addWatchFile: vi.fn((file: string) => watchedFiles.push(file)) } as never, `\0${moduleId}`);
}

describe('trip publication contracts', () => {
    it.each(['production', 'development'])('builds article HTML with the correct publication and crawler metadata in %s mode', async mode => {
        const published = {
            slug: 'coast', title: 'Coast & mountains', description: 'A coastal trip.', date: '2026-04-08',
            tags: [], format: 'trip', tripId: manifest.id,
        };
        const draft = {
            ...published, slug: 'unfinished', title: 'Unfinished journey', tripId: 'missing',
            development: { published: false, contentAvailable: false },
        };
        const root = createContentFixture([published, draft], { manifests: [manifest] });
        fs.writeFileSync(path.join(root, 'index.html'), `<html><head><title>Site</title>
            <meta name="description" content="Site" /><meta property="og:image" content="https://rsmb.tv/og/home.svg" />
            <link rel="canonical" href="https://rsmb.tv/" /></head><body><script type="module">
            import { summaries } from 'virtual:trip-content'; globalThis.trips = summaries;
            </script></body></html>`);
        const result = await build({ configFile: false, root, mode, plugins: [tripContentPlugin()], logLevel: 'silent', build: { write: false } });
        if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one content bundle.');
        const assets = Object.fromEntries(result.output.filter(item => item.type === 'asset').map(item => [item.fileName, String(item.source)]));
        for (const pathname of STATIC_PAGE_PATHS) {
            const html = assets[pathname === '/' ? 'index.html' : `${pathname.slice(1)}.html`];
            const metadata = staticPageMetadata(pathname, [published]);
            expect(html).toContain(`href="${metadata.ogUrl}"`);
            expect(html).toContain(`content="${metadata.ogImage}"`);
            expect(html.match(/rel="canonical"/g)).toHaveLength(1);
            expect(html.match(/type="application\/ld\+json"/g)).toHaveLength(1);
            const graph = JSON.parse(html.match(/data-prerendered>(.*?)<\/script>/s)![1]);
            expect(graph['@graph']?.[0] ?? graph).toEqual(metadata.jsonLd);
        }
        for (const [alias, pathname] of Object.entries(siteAliases)) {
            expect(assets[`${alias.slice(1)}.html`]).toContain(`href="https://rsmb.tv${pathname}"`);
        }
        expect(assets['trips/coast.html']).toBe(assets['blog/coast.html']);
        expect(assets['trips/coast.html']).toContain('<title>Coast &amp; mountains — rsmb</title>');
        expect(assets['trips/coast.html']).toContain('href="https://rsmb.tv/trips/coast"');
        expect(assets['trips/coast.html']).toContain(`content="https://rsmb.tv${manifest.photos.find(photo => photo.id === manifest.hero)!.src}"`);
        if (mode === 'development') {
            for (const [, html] of Object.entries(assets).filter(([filename]) => filename.endsWith('.html'))) {
                expect(html).toMatch(/name="robots" content="noindex, nofollow"/);
            }
            expect(assets['trips/unfinished.html']).toBe(assets['blog/unfinished.html']);
            expect(assets['trips/unfinished.html']).toContain('content="https://rsmb.tv/og/blog/unfinished.png"');
        } else {
            expect(assets['index.html']).not.toContain('noindex');
            expect(assets).not.toHaveProperty('trips/unfinished.html');
            expect(JSON.stringify(result.output)).not.toContain('Unfinished journey');
        }
    });

    it('includes incomplete unpublished metadata only in explicitly built development previews', () => {
        const posts = [
            { slug: 'draft-without-manifest', title: 'Unfinished journey', format: 'trip', tripId: 'missing', development: { published: false, contentAvailable: false } },
            { slug: 'draft-without-id', title: 'Unconfigured journey', format: 'trip', development: { published: false, contentAvailable: false } },
        ];
        const preview = loadPostRegistry(posts, 'build', [], 'virtual:post-content', { mode: 'development' });
        expect(preview).toContain('draft-without-manifest');
        expect(preview).toContain('draft-without-id');
        expect(preview).toContain('"contentAvailable":false');
        const production = loadPostRegistry(posts, 'build');
        expect(production).toContain('export const metadata = []');
        expect(production).not.toContain('Unfinished journey');
        expect(production).not.toContain('draft-without-id');
    });

    it('keeps only valid preview summaries and preserves CDN asset URLs in hosted development builds', () => {
        const remote = `https://data.rsmb.tv/trips/${manifest.id}/geo/route.geojson`;
        const valid = { ...manifest, route: { ...manifest.route, geoJson: remote } };
        const invalid = { ...manifest, id: 'broken-draft', hero: 'missing-photo' };
        const output = loadPostRegistry([
            { slug: 'coast', format: 'trip', tripId: manifest.id },
            { slug: 'broken', format: 'trip', tripId: invalid.id, development: { published: false } },
        ], 'build', [], 'virtual:trip-content', { mode: 'development', manifests: [valid, invalid] });
        const summaries = JSON.parse(String(output).match(/^export const summaries = (.*?); export const issues/)![1]);
        expect(Object.keys(summaries)).toEqual([manifest.id]);
        expect(summaries[manifest.id].route.geoJson).toBe(remote);
        expect(output).toContain('Hero references unknown photo');
        expect(output).not.toContain('import("/src/content/trips/broken-draft.json")');
    });

    it.each([
        { countries: [{ code: 'us' }] },
        { countries: [{ code: 'USA' }] },
        { countries: [{ code: 'US' }, { code: 'US', regions: ['Oregon'] }] },
        { countries: [{ code: 'US', regions: ['Oregon', ' Oregon '] }] },
        { countries: [{ code: 'US', regions: [' '] }] },
        { regions: ['Oregon', ' Oregon '] },
        { regions: [' '] },
    ])('rejects invalid or duplicate trip geography: %j', geography => {
        expect(tripManifestSchema.safeParse({ ...manifest, ...geography }).success).toBe(false);
    });

    it('accepts unique country groups and trims region names', () => {
        const countries = [{ code: 'US', regions: [' Oregon '] }, { code: 'CA' }];
        expect(tripManifestSchema.parse({ ...manifest, regions: undefined, countries }).countries)
            .toEqual([{ code: 'US', regions: ['Oregon'] }, { code: 'CA' }]);
        expect(tripManifestSchema.parse({ ...manifest, countries: [], regions: [' Oregon '] }).regions)
            .toEqual(['Oregon']);
        expect(tripManifestSchema.parse({ ...manifest, countries: [
            { code: 'US', regions: ['Shared name'] }, { code: 'CA', regions: ['Shared name'] },
        ] }).countries).toHaveLength(2);
    });

    it.each([
        ['virtual:post-content', false],
        ['virtual:trip-content', false],
        ['virtual:trip-content', true],
    ] as const)('transforms %s without a post registry (trip directory: %s)', async (moduleId, hasTrips) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-content-vite-test-'));
        temporaryRoots.push(root);
        if (hasTrips) {
            const directory = path.join(root, 'src/content/trips');
            fs.mkdirSync(directory, { recursive: true });
            fs.writeFileSync(path.join(directory, `${manifest.id}.json`), JSON.stringify(manifest));
        }
        const server = await createServer({
            configFile: false,
            root,
            plugins: [tripContentPlugin()],
            server: { middlewareMode: true, hmr: false, ws: false, watch: null },
            optimizeDeps: { noDiscovery: true, include: [] },
        });
        try {
            // Module runners (including Vitest) create the graph entry before loading.
            await server.environments.client.moduleGraph.ensureEntryFromUrl(moduleId);
            const result = await server.transformRequest(moduleId);
            expect(result?.code).toContain(moduleId === 'virtual:post-content'
                ? 'export const metadata = []'
                : hasTrips ? `"${manifest.id}"` : 'export const summaries = {}');
        } finally {
            await server.close();
        }
    });

    it.each(['virtual:post-content', 'virtual:trip-content'])('rejects a production build of %s without the post registry', moduleId => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-registry-missing-test-'));
        temporaryRoots.push(root);
        const plugin = tripContentPlugin();
        const configure = plugin.configResolved;
        const load = plugin.load;
        if (typeof configure !== 'function' || typeof load !== 'function') throw new Error('Expected function hooks.');
        configure.call({} as never, { root, mode: 'production', command: 'build' } as ResolvedConfig);
        expect(() => load.call({ addWatchFile: vi.fn() } as never, `\0${moduleId}`)).toThrow(/Missing post registry/);
    });

    it('rejects article generation without the post registry', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-bundle-missing-test-'));
        temporaryRoots.push(root);
        const plugin = tripContentPlugin();
        const configure = plugin.configResolved;
        const generate = plugin.generateBundle;
        if (typeof configure !== 'function' || !generate || typeof generate === 'function') throw new Error('Expected ordered bundle hook.');
        configure.call({} as never, { root, mode: 'production', command: 'build' } as ResolvedConfig);
        expect(() => generate.handler.call({ emitFile: vi.fn() } as never, {} as never, {
            'index.html': { type: 'asset', source: '<head></head>' },
        } as never, false)).toThrow(/Missing post registry/);
    });

    it('includes fact tags in summaries without embedding the full manifest', () => {
        const trip = tripManifestSchema.parse({
            ...manifest, motorcycle: 'Honda CB500X', regions: ['New Mexico'],
            countries: [{ code: 'US', regions: ['New Mexico'] }, { code: 'CA' }],
        });
        const output = loadPostRegistry([{ slug: 'coast', format: 'trip', tripId: trip.id }], 'build', [], 'virtual:trip-content', { manifests: [trip] });
        expect(output).toContain('"motorcycle":"Honda CB500X"');
        expect(output).toContain('"regions":["New Mexico"]');
        expect(output).toContain('"countries":[{"code":"US","regions":["New Mexico"]},{"code":"CA"}]');
        expect(output).not.toContain('"stops"');
        expect(output).not.toContain('"photos"');
    });

    it.each(['build', 'serve'] as const)('includes lightweight route metadata with the correct %s URLs', command => {
        const trip = tripManifestSchema.parse({
            ...manifest,
            route: {
                geoJson: 'https://data.rsmb.tv/trips/coastal-test/geo/route.geojson',
                alt: 'The complete available coastal route.',
                staticImage: 'https://data.rsmb.tv/trips/coastal-test/geo/preview.webp',
                tracks: [{ id: 'day-one', name: 'First day' }],
            },
        });
        const output = loadPostRegistry([{ slug: 'coast', format: 'trip', tripId: trip.id }], command, [], 'virtual:trip-content', { manifests: [trip] });
        if (typeof output !== 'string') throw new Error('Expected generated summary source.');
        const json = output.slice('export const summaries = '.length, output.indexOf('; export const issues'));
        const summaries = JSON.parse(json);
        expect(summaries[trip.id].route).toEqual({
            geoJson: command === 'serve'
                ? '/data/trips/coastal-test/geo/route.geojson'
                : 'https://data.rsmb.tv/trips/coastal-test/geo/route.geojson',
            alt: 'The complete available coastal route.',
        });
        expect(summaries[trip.id]).not.toHaveProperty('photos');
        expect(summaries[trip.id]).not.toHaveProperty('days');
        expect(summaries[trip.id]).not.toHaveProperty('galleries');
        expect(summaries[trip.id]).not.toHaveProperty('stops');
    });

    it('does not include unpublished route URLs in production summaries', () => {
        const output = loadPostRegistry([{ slug: 'coast', format: 'trip', tripId: manifest.id, development: { published: false } }], 'build', [], 'virtual:trip-content', { manifests: [manifest] });
        expect(output).toContain('export const summaries = {}');
        expect(output).not.toContain(manifest.route.geoJson);
    });

    it('reports a missing published manifest when the trip directory is absent', () => {
        expect(() => loadPostRegistry([{ slug: 'coast', format: 'trip', tripId: manifest.id }], 'build', [], 'virtual:trip-content', {
            createTripDirectory: false,
        })).toThrow(`Missing published trip manifest: ${manifest.id}`);
        expect(loadPostRegistry([], 'build', [], 'virtual:trip-content', { createTripDirectory: false })).toContain('export const summaries = {}');
    });

    it('reports invalid development manifests but rejects invalid published manifests', () => {
        const invalidTrip = { ...manifest, hero: 'missing-photo' };
        const posts = [{ slug: 'coast', format: 'trip', tripId: manifest.id }];
        const output = loadPostRegistry(posts, 'serve', [], 'virtual:trip-content', { manifests: [invalidTrip] });
        expect(output).toContain('export const summaries = {}');
        expect(output).toContain('Hero references unknown photo');
        expect(output).toContain('export const loaders = {}');
        expect(() => loadPostRegistry(posts, 'build', [], 'virtual:trip-content', { manifests: [invalidTrip] })).toThrow(/Hero references unknown photo/);
        expect(loadPostRegistry([{ ...posts[0], development: { published: false } }], 'build', [], 'virtual:trip-content', {
            manifests: [invalidTrip],
        })).not.toContain(manifest.id);
    });

    it('removes development metadata from published posts and watches existing bodies', () => {
        const posts = [{ slug: 'coast', development: { published: true, documentUrl: 'https://example.com/private-source' } }];
        const watchedFiles: string[] = [];
        const output = loadPostRegistry(posts, 'build', watchedFiles, 'virtual:post-content', { bodies: ['coast'] });
        expect(output).not.toContain('development');
        expect(output).not.toContain('private-source');
        expect(output).toContain('() => import("/src/content/blog/coast.mdx")');
        expect(watchedFiles.some(file => file.endsWith('/blog/coast.mdx'))).toBe(true);
        expect(loadPostRegistry(posts, 'serve', [], 'virtual:post-content', { bodies: ['coast'] })).toContain('private-source');
    });

    it('does not treat inherited object properties as published manifests', () => {
        expect(() => loadPostRegistry([{ slug: 'coast', format: 'trip', tripId: 'constructor' }], 'build', [], 'virtual:trip-content')).toThrow(/Missing published trip manifest: constructor/);
    });

    it.each(['../outside', '/absolute', 'trip/name', '', null, 42])('rejects unsafe trip IDs before registry or file generation: %j', tripId => {
        expect(() => loadPostRegistry([{ slug: 'trip', format: 'trip', tripId }], 'build')).toThrow(/Invalid trip ID/);
    });

    it('rejects published trips without a manifest reference', () => {
        expect(() => loadPostRegistry([{ slug: 'trip', format: 'trip' }], 'build')).toThrow(/Missing trip ID/);
        expect(loadPostRegistry([{ slug: 'trip', format: 'trip' }], 'serve')).toContain('trip');
    });

    it('rejects duplicate slugs before creating ambiguous routes', () => {
        expect(() => loadPostRegistry([{ slug: 'duplicate' }, { slug: 'duplicate' }], 'serve')).toThrow(/Duplicate post slug/);
    });

    it('excludes invalid unpublished trip references from a production registry', () => {
        expect(loadPostRegistry([{ slug: 'draft', tripId: '../private', development: { published: false } }], 'build')).not.toContain('private');
    });

    it('fails production when a published post has no MDX body', () => {
        expect(() => loadPostRegistry([{ slug: 'missing-body' }], 'build')).toThrow(/Missing published post content: missing-body/);
    });

    it('isolates unavailable drafts from production and permits development placeholders', () => {
        expect(loadPostRegistry([{ slug: 'missing-draft', development: { published: false } }], 'build')).not.toContain('missing-draft');
        const watchedFiles: string[] = [];
        expect(loadPostRegistry([{ slug: 'missing-draft' }], 'serve', watchedFiles)).toContain('missing-draft');
        expect(watchedFiles.some(file => file.endsWith('/posts.json'))).toBe(true);
        expect(watchedFiles.some(file => file.endsWith('.mdx'))).toBe(false);
    });

    it('rejects unsafe post slugs even when their MDX body is missing', () => {
        expect(() => loadPostRegistry([{ slug: '../escape' }], 'serve')).toThrow(/Invalid post slug/);
    });

    it.each([
        undefined, null, {},
        { type: 'LineString' },
        { type: 'LineString', coordinates: null },
        { type: 'LineString', coordinates: 'not-coordinates' },
        { type: 'LineString', coordinates: [[0, 0]] },
        { type: 'LineString', coordinates: [[0, 0], [181, 0]] },
        { type: 'MultiLineString', coordinates: [null] },
        { type: 'MultiLineString', coordinates: [[[0, 0]]] },
    ])('rejects malformed route geometry without throwing: %j', geometry => {
        expect(isRouteGeoJson({ type: 'Feature', properties: {}, geometry })).toBe(false);
    });

    it('validates feature properties and accepts valid line collections', () => {
        const geometry = { type: 'LineString', coordinates: [[0, 0], [1, 1]] };
        expect(isRouteGeoJson({ type: 'Feature', properties: [], geometry })).toBe(false);
        expect(isRouteGeoJson({ type: 'Feature', properties: 'invalid', geometry })).toBe(false);
        expect(isRouteGeoJson({ type: 'Feature', properties: null, geometry })).toBe(true);
        expect(isRouteGeoJson({ type: 'FeatureCollection', features: [
            { type: 'Feature', properties: {}, geometry },
            { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [geometry.coordinates] } },
        ] })).toBe(true);
    });

    it('escapes article metadata without breaking structured data', () => {
        const title = 'A "trip" </script><script>alert(1)</script>';
        const html = articleHtml('<head><title>Site</title><meta name="description" content="Site" /><link rel="canonical" href="/" /></head>', {
            slug: 'coastal-test', title, description: '<Coast> & mountains', date: '2026-05-01', tags: [], format: 'trip',
        });
        expect(html).toContain('&lt;Coast&gt; &amp; mountains');
        expect(html).toContain('href="https://rsmb.tv/trips/coastal-test"');
        expect(html.match(/<script/g)).toHaveLength(1);
        const schema = html.match(/data-prerendered>(.*?)<\/script>/s)?.[1];
        expect(JSON.parse(schema!)['@graph']).toEqual(expect.arrayContaining([expect.objectContaining({ headline: title, '@type': 'BlogPosting' })]));
    });

    it('updates photo URLs and dimensions while preserving authored captions and alt text', () => {
        const report = { tripId: manifest.id, photos: manifest.photos.map(photo => ({ id: photo.id, derivatives: [
            { filename: `${photo.id}-012345abcdef-1600.webp`, width: 1600, height: 1000 },
            { filename: `${photo.id}-012345abcdef-480.webp`, width: 480, height: 300 },
        ] })) };
        const result = updateManifestAssets(manifest, report);
        expect(result.photos[0]).toMatchObject({ alt: manifest.photos[0].alt, caption: manifest.photos[0].caption, width: 1600, height: 1000 });
        expect(result.photos[0].src).toMatch(/012345abcdef-1600.webp$/);
        expect(result.photos[0].srcSet).toMatch(/480.webp 480w, .*1600.webp 1600w$/);
        expect(() => updateManifestAssets(manifest, { ...report, tripId: 'different' })).toThrow(/IDs must match/);
        expect(() => updateManifestAssets(manifest, { ...report, photos: [] })).toThrow(/Missing prepared photo/);
    });

    it('rejects unknown day references and duplicate day IDs before publication', () => {
        const day = { id: 'first-day', title: 'Coastbound', headingId: 'coastbound', stopIds: ['missing-stop'] };
        expect(() => tripManifestSchema.parse({ ...manifest, days: [day, day] })).toThrow(/Duplicate day ID/);
        expect(() => tripManifestSchema.parse({ ...manifest, days: [day] })).toThrow(/unknown stop/);
        expect(tripManifestSchema.parse({ ...manifest, days: [{ ...day, stopIds: [] }] }).days).toHaveLength(1);
    });

    it.each([
        { filename: '../photo-012345abcdef-480.webp', width: 480, height: 300 },
        { filename: 'different-012345abcdef-480.webp', width: 480, height: 300 },
        { filename: 'photo-012345abcdef-960.webp', width: 480, height: 300 },
        { filename: 'photo-012345abcdef-480.webp', width: 480, height: 0 },
        { filename: 'photo-012345abcdef-480.webp', width: NaN, height: 300 },
    ])('rejects invalid prepared derivatives: %j', derivative => {
        const photo = { ...manifest.photos[0], id: 'photo' };
        const input = { ...manifest, hero: 'photo', photos: [photo], galleries: {} };
        expect(() => updateManifestAssets(input, { tripId: input.id, photos: [
            { id: 'photo', derivatives: [derivative] },
        ] })).toThrow(/Invalid prepared derivative/);
    });

    it('rejects duplicate derivative widths before creating a srcset', () => {
        const photo = manifest.photos[0];
        const derivative = { filename: `${photo.id}-012345abcdef-480.webp`, width: 480, height: 300 };
        expect(() => updateManifestAssets(manifest, { tripId: manifest.id, photos: [
            { id: photo.id, derivatives: [derivative, derivative] },
        ] })).toThrow(/Invalid prepared derivative/);
    });

    it('rejects derivatives from different source revisions before creating a srcset', () => {
        const report = { tripId: manifest.id, photos: manifest.photos.map(photo => (
            { id: photo.id, derivatives: [
                { filename: `${photo.id}-012345abcdef-480.webp`, width: 480, height: 300 },
                { filename: `${photo.id}-abcdef012345-1600.webp`, width: 1600, height: 1000 },
            ] }
        )) };
        expect(() => updateManifestAssets(manifest, report)).toThrow(/Invalid prepared derivative/);
    });
});
