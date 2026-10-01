// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ResolvedConfig } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { articleHtml, tripContentPlugin } from '../trip-content-plugin';
import { updateManifestAssets } from '../update-trip-manifest-assets.js';
import { tripManifestSchema } from '../../shared/tripManifestSchema';
import { isRouteGeoJson } from '../../shared/routeGeometry';
import manifest from '../../tests/fixtures/trip-content/trips/coastal-test.json';

const temporaryRoots: string[] = [];
afterEach(() => {
    for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function loadPostRegistry(posts: unknown[], command: 'build' | 'serve', watchedFiles: string[] = []) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-registry-test-'));
    temporaryRoots.push(root);
    const directory = path.join(root, 'src/content');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'posts.json'), JSON.stringify(posts));
    const plugin = tripContentPlugin();
    const configure = plugin.configResolved;
    const load = plugin.load;
    if (typeof configure !== 'function' || typeof load !== 'function') throw new Error('Expected function hooks.');
    configure.call({} as never, { root, mode: 'production', command } as ResolvedConfig);
    return load.call({ addWatchFile: vi.fn((file: string) => watchedFiles.push(file)) } as never, '\0virtual:post-content');
}

describe('trip publication contracts', () => {
    it('fails production when a published post has no MDX body', () => {
        expect(() => loadPostRegistry([{ slug: 'missing-body' }], 'build')).toThrow(/Missing published post content: missing-body/);
    });

    it('isolates unavailable drafts from production and permits development placeholders', () => {
        expect(loadPostRegistry([{ slug: 'missing-draft', development: { published: false } }], 'build')).not.toContain('missing-draft');
        const watchedFiles: string[] = [];
        expect(loadPostRegistry([{ slug: 'missing-draft' }], 'serve', watchedFiles)).toContain('missing-draft');
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
