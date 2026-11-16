import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import ThroughRoutes from '../../src/pages/ThroughRoutes';
import FlightsAbout from '../../src/pages/FlightsAbout';
import AnkiArtisan from '../../src/pages/AnkiArtisan';
import Bookend from '../../src/pages/Bookend';
import TemperatureRecordsAbout from '../../src/pages/TemperatureRecordsAbout';
import TornadoTracksAbout from '../../src/pages/TornadoTracksAbout';
import Route2Gpx from '../../src/pages/Route2Gpx';
import Parc from '../../src/pages/Parc';
import StatusDashboard from '../../src/pages/StatusDashboard';
import PinsOfInaccessibilityAbout from '../../src/pages/PinsOfInaccessibilityAbout';
import { projects } from '../../src/content/projects';
import previews from '../../src/content/project-previews.json';
import { hasMatchingImageAspectRatio } from '../../shared/responsiveImage';
import { renderWithRouter } from '../../src/test/helpers/router';

const publicRoot = path.resolve('public');

function imagePath(url: string) {
    expect(url).toMatch(/^\/images\/[a-z0-9/-]+\.(?:webp|avif)$/);
    return path.join(publicRoot, url);
}

describe('committed project galleries', () => {
    it.each([
        { Page: ThroughRoutes, slug: 'through-routes', count: 3 },
        { Page: FlightsAbout, slug: 'flights', count: 3 },
        { Page: AnkiArtisan, slug: 'anki-artisan', count: 3 },
        { Page: Bookend, slug: 'bookend', count: 4 },
        { Page: TemperatureRecordsAbout, slug: 'temperature-records', count: 3 },
        { Page: TornadoTracksAbout, slug: 'tornado-tracks', count: 3 },
        { Page: Route2Gpx, slug: 'route2gpx', count: 3 },
        { Page: Parc, slug: 'parc', count: 1 },
        { Page: StatusDashboard, slug: 'status-dashboard', count: 3 },
        { Page: PinsOfInaccessibilityAbout, slug: 'pins-of-inaccessibility', count: 3 },
    ])('$slug declares the dimensions of its real image files', async ({ Page, slug, count }) => {
        const { container } = renderWithRouter(<Page />, { route: `/projects/${slug}` });
        const images = [...container.querySelectorAll<HTMLImageElement>('figure img')];
        expect(images).toHaveLength(count);
        for (const [index, image] of images.entries()) {
            const source = image.getAttribute('src')!;
            const metadata = await sharp(imagePath(source)).metadata();
            expect(metadata.format, source).toBe('webp');
            expect([image.width, image.height], source).toEqual([metadata.width, metadata.height]);
            expect(image.getAttribute('loading')).toBe(index === 0 ? 'eager' : 'lazy');
            expect(image.alt.trim(), source).not.toBe('');
            const caption = image.closest('figure')!.querySelector('figcaption')!.textContent!.trim();
            expect(caption, source).not.toBe('');
            expect(caption, source).not.toBe(image.alt);
        }
    });

    it.each([
        ['adv-atlas.webp', 1600, 900],
        ['selected-trip.webp', 1600, 900],
        ['trip-comparison.webp', 1800, 1000],
    ] as const)('keeps the documented atlas capture %s at its declared size', async (file, width, height) => {
        expect(await sharp(imagePath(`/images/adv-atlas/${file}`)).metadata())
            .toMatchObject({ format: 'webp', width, height });
    });
});

describe('committed project previews', () => {
    it('has exactly one manifest record for each illustrated project', () => {
        expect(Object.keys(previews).sort()).toEqual(projects.flatMap(project => project.previewImage ?? []).sort());
    });

    it.each(Object.entries(previews))('matches the current source and every encoded variant for %s', async (source, preview) => {
        const original = await fs.readFile(imagePath(source));
        expect(preview.sourceHash, 'Run npm run prepare-project-previews after replacing a screenshot')
            .toBe(createHash('sha256').update(original).digest('hex'));
        expect(await sharp(original).metadata()).toMatchObject({ width: preview.width, height: preview.height });
        const expectedWidths = [...new Set([480, 960, 1440].map(width => Math.min(width, preview.width)))];
        const expectedDefaultWidth = expectedWidths.find(width => width >= 960) ?? expectedWidths.at(-1)!;

        for (const [format, srcSet] of [['webp', preview.srcSet], ['avif', preview.avifSrcSet]] as const) {
            const candidates = srcSet.split(', ').map(candidate => {
                const [url, descriptor] = candidate.split(' ');
                expect(descriptor).toMatch(/^\d+w$/);
                return { url, width: Number(descriptor.slice(0, -1)) };
            });
            expect(candidates.map(candidate => candidate.width)).toEqual(expectedWidths);
            if (format === 'webp') expect(preview.src).toBe(candidates.find(candidate => candidate.width === expectedDefaultWidth)!.url);

            for (const candidate of candidates) {
                const bytes = await fs.readFile(imagePath(candidate.url));
                const hash = createHash('sha256').update(format === 'avif' ? 'avif-v2:' : '').update(bytes).digest('hex').slice(0, 12);
                expect(candidate.url.endsWith(`-${candidate.width}-${hash}.${format}`)).toBe(true);
                const metadata = await sharp(bytes).metadata();
                expect(metadata.format).toBe(format === 'avif' ? 'heif' : 'webp');
                if (format === 'avif') expect(metadata.compression).toBe('av1');
                expect(metadata.width).toBe(candidate.width);
                expect(hasMatchingImageAspectRatio({ width: metadata.width!, height: metadata.height! }, preview)).toBe(true);
                await expect(sharp(bytes).stats()).resolves.toHaveProperty('channels');
            }
        }
    });

    it('leaves no unreferenced generated variants in the committed directory', async () => {
        const referenced = new Set(Object.values(previews).flatMap(preview =>
            [preview.srcSet, preview.avifSrcSet].flatMap(srcSet => srcSet.split(', ').map(candidate => path.basename(candidate.split(' ')[0])))));
        const files = await fs.readdir(path.join(publicRoot, 'images/previews'));
        expect(files.filter(file => /\.(?:webp|avif)$/.test(file)).sort()).toEqual([...referenced].sort());
    });
});
