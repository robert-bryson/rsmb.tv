// @vitest-environment node
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tripManifestSchema, type TripManifest } from '../../shared/tripManifestSchema';
import fixture from '../../tests/fixtures/trip-content/trips/coastal-test.json';
import pch from '../../src/content/trips/pch-2024.json';
import route66 from '../../src/content/trips/route-66ish-2025.json';
import river from '../../src/content/trips/river-wisco-2025.json';
import summer from '../../src/content/trips/on-qc-new-england-2026.json';
import inventory from '../../docs/trips/trip-source-inventory.json';
import { tripAtlasColorAssignments, tripAtlasPalette } from '../../src/features/trips/atlas/tripAtlasColors';
import { expandTripShortcodes } from '../sync-blogs.js';

const tripWithDays = tripManifestSchema.parse({
    ...fixture,
    route: {
        ...fixture.route,
        tracks: [{ id: 'outbound', name: 'Harbor to camp' }, { id: 'return', name: 'Camp to harbor' }],
    },
    days: [
        { id: 'day-one', title: 'Outbound', headingId: 'outbound', trackIds: ['outbound'], stopIds: ['start', 'camp'], galleryId: 'coast' },
        { id: 'day-two', title: 'Return', headingId: 'return', trackIds: ['return'], stopIds: ['camp'], galleryId: 'camp' },
    ],
});

describe('trip authoring references', () => {
    it('accepts shared overnight stops and overlapping galleries on separate days', () => {
        const trip = structuredClone(tripWithDays);
        trip.galleries!.camp = [...trip.galleries!.coast];
        expect(tripManifestSchema.parse(trip)).toEqual(trip);
    });

    const invalidEdits: [string, (trip: TripManifest) => void, RegExp][] = [
        ['reversed trip dates', trip => { trip.dates.end = '2023-12-31'; }, /end date must be on or after/],
        ['missing hero', trip => { trip.hero = 'missing'; }, /Hero references unknown photo/],
        ['duplicate photos', trip => { trip.photos.push({ ...trip.photos[0] }); }, /Duplicate photo ID/],
        ['duplicate stops', trip => { trip.stops.push({ ...trip.stops[0] }); }, /Duplicate stop ID/],
        ['duplicate tracks', trip => { trip.route.tracks!.push({ ...trip.route.tracks![0] }); }, /Duplicate track ID/],
        ['duplicate days', trip => { trip.days!.push({ ...trip.days![0] }); }, /Duplicate day ID/],
        ['missing day track', trip => { trip.days![0].trackIds = ['missing']; }, /unknown track/],
        ['track assigned to two days', trip => { trip.days![1].trackIds = ['outbound']; }, /assigned to more than one day/],
        ['track repeated within one day', trip => { trip.days![0].trackIds = ['outbound', 'outbound']; }, /repeated within a day/],
        ['stop repeated within one day', trip => { trip.days![0].stopIds = ['start', 'start']; }, /duplicate stop IDs/],
        ['missing day gallery', trip => { trip.days![0].galleryId = 'missing'; }, /unknown gallery/],
        ['inherited day gallery', trip => { trip.days![0].galleryId = 'constructor'; }, /unknown gallery/],
        ['missing gallery photo', trip => { trip.galleries!.coast = ['missing']; }, /references unknown photo/],
        ['repeated gallery photo', trip => { trip.galleries!.coast = ['photo-1', 'photo-1']; }, /duplicate photo IDs/],
    ];

    it.each(invalidEdits)('rejects %s before import', (_description, edit, message) => {
        const trip = structuredClone(tripWithDays);
        edit(trip);
        expect(() => tripManifestSchema.parse(trip)).toThrow(message);
    });
});

describe('tracked trip content', () => {
    it('accepts each committed trip manifest through the production schema', () => {
        const directory = new URL('../../src/content/trips/', import.meta.url);
        const filenames = fs.readdirSync(directory).filter(filename => filename.endsWith('.json'));
        expect(filenames.length).toBeGreaterThan(0);
        for (const filename of filenames) {
            const manifest = tripManifestSchema.parse(JSON.parse(fs.readFileSync(new URL(filename, directory), 'utf8')));
            expect(manifest.id, filename).toBe(filename.slice(0, -5));
            expect(Object.hasOwn(tripAtlasColorAssignments, manifest.id), `Assign an atlas color for ${manifest.id} in tripAtlasColors.ts`).toBe(true);
        }
        const colors = Object.values(tripAtlasColorAssignments).map(token => tripAtlasPalette[token]);
        expect(new Set(colors).size, 'Atlas trips must have distinct explicit colors').toBe(colors.length);
    });

    it('assigns every selected photo to its capture day exactly once', () => {
        const manifest = tripManifestSchema.parse(pch);
        expect(manifest.days!.map(day => day.date)).toEqual([
            '2024-10-03', '2024-10-04', '2024-10-05', '2024-10-06', '2024-10-07',
        ]);
        const photos = new Map(manifest.photos.map(photo => [photo.id, photo]));
        const assigned = manifest.days!.flatMap(day => {
            const ids = manifest.galleries![day.galleryId!];
            for (const id of ids) expect(photos.get(id)?.date, id).toBe(day.date);
            return ids;
        });
        expect(assigned.length).toBe(photos.size);
        expect(new Set(assigned)).toEqual(new Set(photos.keys()));
        expect(manifest.galleries!['day-two'].at(-1)).toBe('20241004-183101');
    });

    it.each([pch, route66, river, summer])('uses matching fingerprints and widths for every responsive photo in $id', trip => {
        for (const photo of trip.photos) {
            const candidates = photo.srcSet.split(', ').map(candidate => {
                const [src, descriptor] = candidate.split(' ');
                expect(descriptor, photo.id).toMatch(/^[1-9]\d*w$/);
                const width = Number(descriptor.replace(/w$/, ''));
                const url = new URL(src);
                expect(url.origin, photo.id).toBe('https://data.rsmb.tv');
                expect(url.username + url.password, photo.id).toBe('');
                expect(url.search + url.hash, photo.id).toBe('');
                expect(url.pathname.startsWith(`/trips/${trip.id}/photos/`), photo.id).toBe(true);
                const match = url.pathname.match(/\/photos\/(.+)-([a-f0-9]{12})-(\d+)\.webp$/);
                expect(match, photo.id).not.toBeNull();
                expect(match![1]).toBe(photo.id);
                expect(Number(match![3])).toBe(width);
                return { src, width, fingerprint: match![2] };
            });
            const widths = candidates.map(candidate => candidate.width);
            expect(widths, photo.id).toEqual([...new Set(widths)].sort((a, b) => a - b));
            expect(new Set(candidates.map(candidate => candidate.fingerprint)).size, photo.id).toBe(1);
            expect(candidates.at(-1), photo.id).toMatchObject({ src: photo.src, width: photo.width });
            const expectedWidths = [480, 960, 1600, 2400, 3200].filter(width => width < photo.width).concat(photo.width);
            expect(widths, photo.id).toEqual(expectedWidths);
        }
    });

    it.each([pch, route66])('keeps the $id gallery reference table consistent with the importer', trip => {
        const guide = fs.readFileSync(new URL(`../../docs/trips/${trip.id}-galleries.md`, import.meta.url), 'utf8');
        const rows = [...guide.matchAll(/^\| `\{\{trip-gallery:([a-z0-9-]+)\}\}` \| (\d+) \|/gm)];
        expect(new Set(rows.map(row => row[1]))).toEqual(new Set(Object.keys(trip.galleries)));
        const manifest = tripManifestSchema.parse(trip);
        const post = { format: 'trip', tripId: manifest.id };
        for (const [, id, count] of rows) {
            expect(manifest.galleries![id].length, id).toBe(Number(count));
            expect(expandTripShortcodes(`{{trip-gallery:${id}}}`, post, manifest)).toBe(`<TripGallery galleryId="${id}" />`);
        }
        for (const day of manifest.days!.filter(day => day.trackIds?.length)) {
            expect(expandTripShortcodes(`{{trip-map:day:${day.id}}}`, post, manifest)).toBe(`<TripMap dayId="${day.id}" />`);
        }
    });

    it('keeps PCH panoramas separate from scene galleries', () => {
        const manifest = tripManifestSchema.parse(pch);
        const post = { format: 'trip', tripId: manifest.id };
        for (const id of manifest.galleries!.panoramas) {
            expect(expandTripShortcodes(`{{trip-photo-pano:${id}}}`, post, manifest)).toBe(`<TripPhoto photoId="${id}" layout="pano" />`);
        }
        const separatePanoramas = new Set(manifest.galleries!.panoramas);
        for (const galleryId of ['port-orford', 'sierra-crossing', 'eastern-sierra-valleys']) {
            for (const id of manifest.galleries![galleryId]) expect(separatePanoramas.has(id), id).toBe(false);
        }
    });

    it('assigns Route 66 recordings and photos to their capture days and uses every selected photo once in the outline', () => {
        const manifest = tripManifestSchema.parse(route66);
        const tracks = new Map(manifest.route.tracks!.map(track => [track.id, track]));
        const photos = new Map(manifest.photos.map(photo => [photo.id, photo]));
        const assignedTracks: string[] = [];
        const assignedPhotos: string[] = [];
        for (const day of manifest.days!) {
            for (const id of day.trackIds ?? []) {
                expect(tracks.get(id)?.date, id).toBe(day.date);
                assignedTracks.push(id);
            }
            for (const id of day.galleryId ? manifest.galleries![day.galleryId] : []) {
                expect(photos.get(id)?.date, id).toBe(day.date);
                assignedPhotos.push(id);
            }
        }
        expect(assignedTracks).toHaveLength(tracks.size);
        expect(new Set(assignedTracks)).toEqual(new Set(tracks.keys()));
        expect(assignedPhotos).toHaveLength(photos.size);
        expect(new Set(assignedPhotos)).toEqual(new Set(photos.keys()));

        const outline = fs.readFileSync(new URL('../../docs/trips/route-66ish-2025-outline.md', import.meta.url), 'utf8');
        const placements = [...outline.matchAll(/^\{\{trip-(gallery|photo|photo-pano):([a-z0-9-]+)\}\}$/gm)];
        const placedPhotos = placements.flatMap(([, type, id]) => type === 'gallery' ? manifest.galleries![id] : [id]);
        expect(placedPhotos).toHaveLength(photos.size);
        expect(new Set(placedPhotos)).toEqual(new Set(photos.keys()));
        const post = { format: 'trip', tripId: manifest.id };
        expect(() => expandTripShortcodes(outline, post, manifest)).not.toThrow();
    });
});

describe('review regressions: recovered trip authoring', () => {
    it('expands all three 2026 reports and places each selected photo once across the series', () => {
        const manifest = tripManifestSchema.parse(summer);
        const post = { format: 'trip', tripId: manifest.id };
        const placedPhotos: string[] = [];
        for (const part of [1, 2, 3]) {
            const outline = fs.readFileSync(new URL(`../../docs/trips/on-qc-new-england-2026-part-${part}-outline.md`, import.meta.url), 'utf8');
            const expanded = expandTripShortcodes(outline, post, manifest);
            expect(expanded).not.toMatch(/\{\{trip-/);
            const placements = [...outline.matchAll(/^\{\{trip-(gallery|photo|photo-pano):([a-z0-9-]+)\}\}$/gm)];
            placedPhotos.push(...placements.flatMap(([, type, id]) => type === 'gallery' ? manifest.galleries![id] : [id]));
            if (part === 2) expect(expanded).toContain('<TripGallery galleryId="jul-17" />');
        }
        expect(placedPhotos).toHaveLength(manifest.photos.length);
        expect(new Set(placedPhotos)).toEqual(new Set(manifest.photos.map(photo => photo.id)));
    });

    it('loads the 2026 manifest with its author-selected July 17 hero', () => {
        const manifest = tripManifestSchema.parse(summer);
        expect(manifest.photos.find(photo => photo.id === manifest.hero)).toMatchObject({
            id: '20260717-135454', date: '2026-07-17', width: 1600, height: 1200,
        });
    });

    it.each([river, summer])('assigns every recovered track and photo once on its capture date in $id', trip => {
        const tracks = new Map(trip.route.tracks!.map(track => [track.id, track]));
        const photos = new Map(trip.photos.map(photo => [photo.id, photo]));
        const assignedTracks: string[] = [];
        const assignedPhotos: string[] = [];
        for (const day of trip.days!) {
            expect(day.date! >= trip.dates.start && day.date! <= trip.dates.end, day.id).toBe(true);
            for (const id of day.trackIds ?? []) {
                expect(tracks.get(id)?.date, id).toBe(day.date);
                assignedTracks.push(id);
            }
            for (const id of day.galleryId ? trip.galleries![day.galleryId] : []) {
                expect(photos.get(id)?.date, id).toBe(day.date);
                assignedPhotos.push(id);
            }
        }
        expect(assignedTracks).toHaveLength(tracks.size);
        expect(new Set(assignedTracks)).toEqual(new Set(tracks.keys()));
        expect(assignedPhotos).toHaveLength(photos.size);
        expect(new Set(assignedPhotos)).toEqual(new Set(photos.keys()));
    });

    it('covers every 2026 calendar day in exactly one chapter with matching map anchors', () => {
        const outlines = [1, 2, 3].map(part => fs.readFileSync(new URL(`../../docs/trips/on-qc-new-england-2026-part-${part}-outline.md`, import.meta.url), 'utf8'));
        const placements = outlines.flatMap(outline => [...outline.matchAll(/^\{\{trip-map:day:([a-z0-9-]+)\}\}$/gm)].map(match => match[1]));
        const recordedDays = summer.days!.filter(day => day.trackIds?.length);
        expect(placements).toHaveLength(recordedDays.length);
        expect(new Set(placements)).toEqual(new Set(recordedDays.map(day => day.id)));
        const headings = outlines.flatMap(outline => [...outline.matchAll(/^## ((?:July|August) \d+)$/gm)].map(match => match[1].toLowerCase().replace(' ', '-')));
        expect(headings).toEqual(summer.days!.map(day => day.headingId));
        const dates = summer.days!.map(day => day.date!);
        const expectedDates: string[] = [];
        for (let date = Date.parse(summer.dates.start); date <= Date.parse(summer.dates.end); date += 86_400_000) {
            expectedDates.push(new Date(date).toISOString().slice(0, 10));
        }
        expect(dates).toEqual(expectedDates);
    });

    it('expands the Mississippi–Wisconsin outline and places every selected photo once', () => {
        const trip = tripManifestSchema.parse(river);
        const outline = fs.readFileSync(new URL('../../docs/trips/river-wisco-2025-outline.md', import.meta.url), 'utf8');
        expect(() => expandTripShortcodes(outline, { format: 'trip', tripId: trip.id }, trip)).not.toThrow();
        const placedPhotos = [...outline.matchAll(/^\{\{trip-gallery:([a-z0-9-]+)\}\}$/gm)].flatMap(([, id]) => trip.galleries![id]);
        expect(placedPhotos).toHaveLength(trip.photos.length);
        expect(new Set(placedPhotos)).toEqual(new Set(trip.photos.map(photo => photo.id)));
        const headings = [...outline.matchAll(/^## (October \d+)$/gm)].map(match => match[1].toLowerCase().replace(' ', '-'));
        expect(headings).toEqual(trip.days!.map(day => day.headingId));
    });

    it('keeps inventory totals, facts, and route references consistent with tracked manifests', () => {
        expect(inventory.sheet.distinctTrips).toBe(inventory.trips.length);
        expect(inventory.sheet.tripRows).toBe(inventory.trips.flatMap(trip => trip.reports).length);
        for (const entry of inventory.trips) {
            const trip = JSON.parse(fs.readFileSync(new URL(`../../${entry.manifest.path}`, import.meta.url), 'utf8')) as Omit<TripManifest, 'hero'> & { hero: string | null };
            expect(trip.id).toBe(entry.id);
            expect(trip.dates, entry.id).toEqual(entry.manifest.dates);
            expect(trip.hero, entry.id).toBe(entry.manifest.hero);
            expect(trip.photos, entry.id).toHaveLength(entry.photos.manifestCount);
            expect(new Set(trip.route.tracks?.map(track => track.id)), entry.id).toEqual(new Set(entry.gps.tracks.map(track => track.id)));
            if (entry.estimatedFacts) {
                expect(trip.ridingDays).toBe(entry.estimatedFacts.ridingDates.length);
                expect(trip.ridingDays).toBe(entry.estimatedFacts.ridingDays);
                expect(trip.distanceMiles).toBe(entry.estimatedFacts.distanceMiles);
                expect(trip.distanceMiles).toBe(entry.gps.recordedDistanceMiles);
                expect(trip.days!.filter(day => !day.trackIds?.length).map(day => day.date)).toEqual(entry.missingRecordingDates);
            }
        }
    });
});
