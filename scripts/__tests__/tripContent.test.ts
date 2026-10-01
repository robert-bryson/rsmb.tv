// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer, type ResolvedConfig } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { articleHtml, tripContentPlugin } from '../trip-content-plugin';
import { updateManifestAssets } from '../update-trip-manifest-assets.js';
import { tripManifestSchema, type TripManifest } from '../../shared/tripManifestSchema';
import { isRouteGeoJson } from '../../shared/routeGeometry';
import manifest from '../../tests/fixtures/trip-content/trips/coastal-test.json';

const temporaryRoots: string[] = [];
afterEach(() => {
    for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function loadPostRegistry(posts: unknown[], command: 'build' | 'serve', watchedFiles: string[] = [], moduleId = 'virtual:post-content', {
    manifests = [], bodies = [], createTripDirectory = true,
}: { manifests?: TripManifest[]; bodies?: string[]; createTripDirectory?: boolean } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-registry-test-'));
    temporaryRoots.push(root);
    const directory = path.join(root, 'src/content');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'posts.json'), JSON.stringify(posts));
    if (createTripDirectory) fs.mkdirSync(path.join(directory, 'trips'));
    for (const trip of manifests) fs.writeFileSync(path.join(directory, 'trips', `${trip.id}.json`), JSON.stringify(trip));
    if (bodies.length) fs.mkdirSync(path.join(directory, 'blog'));
    for (const slug of bodies) fs.writeFileSync(path.join(directory, 'blog', `${slug}.mdx`), '# Story');
    const plugin = tripContentPlugin();
    const configure = plugin.configResolved;
    const load = plugin.load;
    if (typeof configure !== 'function' || typeof load !== 'function') throw new Error('Expected function hooks.');
    configure.call({} as never, { root, mode: 'production', command } as ResolvedConfig);
    return load.call({ addWatchFile: vi.fn((file: string) => watchedFiles.push(file)) } as never, `\0${moduleId}`);
}

describe('trip publication contracts', () => {
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
        const trip = tripManifestSchema.parse({ ...manifest, motorcycle: 'Honda CB500X', regions: ['New Mexico'] });
        const output = loadPostRegistry([{ slug: 'coast', format: 'trip', tripId: trip.id }], 'build', [], 'virtual:trip-content', { manifests: [trip] });
        expect(output).toContain('"motorcycle":"Honda CB500X"');
        expect(output).toContain('"regions":["New Mexico"]');
        expect(output).not.toContain('"stops"');
        expect(output).not.toContain('"photos"');
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
        expect(JSON.parse(schema!)).toMatchObject({ headline: title, '@type': 'BlogPosting' });
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
});
