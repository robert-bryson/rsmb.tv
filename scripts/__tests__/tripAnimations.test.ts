// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { tripManifestSchema } from '../../shared/tripManifestSchema';
import { validateBundledTripMedia } from '../trip-media-assets';
import coastal from '../../tests/fixtures/trip-content/trips/coastal-test.json';

const animation = {
    id: 'speeders', src: '/media/trips/coastal-test/speeders-012345abcdef.mp4',
    poster: '/media/trips/coastal-test/speeders-012345abcdef.webp',
    width: 480, height: 208, alt: 'A rider races through a forest.',
};
const trip = tripManifestSchema.parse({ ...coastal, introAnimation: animation.id, animations: [animation] });
const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

describe('animation publication contracts', () => {
    it('rejects duplicate animation IDs and missing intro references', () => {
        expect(() => tripManifestSchema.parse({ ...trip, animations: [animation, animation] })).toThrow(/Duplicate animation ID/);
        expect(() => tripManifestSchema.parse({ ...trip, introAnimation: 'absent' })).toThrow(/unknown animation/);
        expect(tripManifestSchema.parse(trip).introAnimation).toBe('speeders');
    });

    it.each(['javascript:alert(1)', '//example.com/movie.mp4', '/media/trips/coastal-test/../movie.mp4',
        '/media/trips/coastal-test/unversioned.mp4', '/media/trips/other-trip/speeders-012345abcdef.mp4'])(
    'rejects unsafe, unversioned, or mismatched bundled media paths: %s', src => {
        expect(tripManifestSchema.safeParse({ ...trip, animations: [{ ...animation, src }] }).success).toBe(false);
    });

    it('requires both the video and poster to exist before publishing', () => {
        const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmb-animation-'));
        directories.push(repoRoot);
        const fingerprint = (content: string) => createHash('sha256').update(content).digest('hex').slice(0, 12);
        const clip = {
            ...animation,
            src: `/media/trips/coastal-test/speeders-${fingerprint('video')}.mp4`,
            poster: `/media/trips/coastal-test/speeders-${fingerprint('poster')}.webp`,
        };
        const prepared = { ...trip, animations: [clip] };
        expect(() => validateBundledTripMedia(prepared, { repoRoot })).toThrow(clip.src);
        const video = path.join(repoRoot, 'public', clip.src);
        fs.mkdirSync(path.dirname(video), { recursive: true });
        fs.writeFileSync(video, 'video');
        expect(() => validateBundledTripMedia(prepared, { repoRoot })).toThrow(clip.poster);
        fs.writeFileSync(path.join(repoRoot, 'public', clip.poster), 'poster');
        expect(validateBundledTripMedia(prepared, { repoRoot })).toHaveLength(2);
        fs.writeFileSync(video, 'changed video');
        expect(() => validateBundledTripMedia(prepared, { repoRoot })).toThrow(/mismatched fingerprint/);
    });
});

describe('review regressions: animation media contracts', () => {
    it.each([
        { src: 'https://[' },
        { src: '' },
        { src: 'https://example.com/clip.mp4' },
        { poster: 'https://example.com/poster.webp' },
        { src: 'https://data.rsmb.tv/trips/other-trip/clip.mp4' },
        { src: 'https://data.rsmb.tv/trips/coastal-test/../other-trip/clip.mp4' },
        { src: 'https://data.rsmb.tv:444/trips/coastal-test/clip.mp4' },
        { src: 'https://user:secret@data.rsmb.tv/trips/coastal-test/clip.mp4' },
        { src: 'https://data.rsmb.tv/trips/coastal-test/clip.webp' },
        { poster: 'https://data.rsmb.tv/trips/coastal-test/poster.mp4' },
        { src: animation.poster },
        { poster: animation.src },
    ])('rejects media the production player cannot use: %j', overrides => {
        expect(tripManifestSchema.safeParse({ ...trip, animations: [{ ...animation, ...overrides }] }).success).toBe(false);
    });

    it('accepts video and poster assets in the trip CDN directory', () => {
        expect(tripManifestSchema.safeParse({ ...trip, animations: [{
            ...animation,
            src: 'https://data.rsmb.tv/trips/coastal-test/animations/clip.mp4',
            poster: 'https://data.rsmb.tv/trips/coastal-test/animations/poster.webp',
        }] }).success).toBe(true);
    });
});
