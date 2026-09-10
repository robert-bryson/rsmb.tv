import { z } from 'zod';
import type { TripManifest } from './types';

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const dateSchema = z.iso.date();
const photoSchema = z.object({
    id: slugSchema,
    src: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    alt: z.string(),
    caption: z.string().optional(),
    location: z.string().optional(),
    date: dateSchema.optional(),
    srcSet: z.string().optional(),
    sizes: z.string().optional(),
});

export const tripManifestSchema = z.object({
    id: slugSchema,
    dates: z.object({ start: dateSchema, end: dateSchema }),
    distanceMiles: z.number().positive().optional(),
    motorcycle: z.string().min(1).optional(),
    regions: z.array(z.string().min(1)).optional(),
    hero: slugSchema,
    route: z.object({
        geoJson: z.string().min(1),
        staticImage: z.string().min(1).optional(),
        alt: z.string().min(1).optional(),
        tracks: z.array(z.object({
            id: slugSchema,
            name: z.string().min(1),
            date: dateSchema.optional(),
        })).optional(),
    }),
    stops: z.array(z.object({
        id: slugSchema,
        name: z.string().min(1),
        coordinates: z.tuple([
            z.number().min(-180).max(180),
            z.number().min(-90).max(90),
        ]),
        date: dateSchema.optional(),
        description: z.string().optional(),
    })),
    photos: z.array(photoSchema),
    galleries: z.record(z.string(), z.array(slugSchema)).optional(),
}).superRefine((manifest, context) => {
    if (manifest.dates.end < manifest.dates.start) {
        context.addIssue({
            code: 'custom',
            path: ['dates', 'end'],
            message: 'Trip end date must be on or after the start date.',
        });
    }

    const photoIds = new Set<string>();
    for (const photo of manifest.photos) {
        if (photoIds.has(photo.id)) {
            context.addIssue({ code: 'custom', message: `Duplicate photo ID: ${photo.id}` });
        }
        photoIds.add(photo.id);
    }
    if (!photoIds.has(manifest.hero)) {
        context.addIssue({ code: 'custom', path: ['hero'], message: `Hero references unknown photo: ${manifest.hero}` });
    }

    const stopIds = new Set<string>();
    for (const stop of manifest.stops) {
        if (stopIds.has(stop.id)) {
            context.addIssue({ code: 'custom', message: `Duplicate stop ID: ${stop.id}` });
        }
        stopIds.add(stop.id);
    }

    const trackIds = new Set<string>();
    for (const track of manifest.route.tracks ?? []) {
        if (trackIds.has(track.id)) {
            context.addIssue({ code: 'custom', message: `Duplicate track ID: ${track.id}` });
        }
        trackIds.add(track.id);
    }

    for (const [galleryId, galleryPhotoIds] of Object.entries(manifest.galleries ?? {})) {
        for (const photoId of galleryPhotoIds) {
            if (!photoIds.has(photoId)) {
                context.addIssue({ code: 'custom', message: `Gallery "${galleryId}" references unknown photo: ${photoId}` });
            }
        }
    }
});

export function parseTripManifest(value: unknown): TripManifest {
    const manifest = tripManifestSchema.parse(value);
    if (!import.meta.env.DEV) return manifest;

    const localUrl = (url: string) => url.replace(/^https:\/\/data\.rsmb\.tv(?=\/trips\/)/, '/data');
    const localPhoto = (photo: TripManifest['photos'][number]) => ({
        ...photo,
        src: localUrl(photo.src),
        srcSet: photo.srcSet?.replaceAll('https://data.rsmb.tv', '/data'),
    });

    return {
        ...manifest,
        route: {
            ...manifest.route,
            geoJson: localUrl(manifest.route.geoJson),
            staticImage: manifest.route.staticImage ? localUrl(manifest.route.staticImage) : undefined,
        },
        photos: manifest.photos.map(localPhoto),
    };
}

const manifestModules = import.meta.glob<unknown>('../../content/trips/*.json', {
    eager: true,
    import: 'default',
});

const manifests = new Map<string, TripManifest>();
const manifestIssues = new Map<string, string>();

for (const value of Object.values(manifestModules)) {
    try {
        const manifest = parseTripManifest(value);
        manifests.set(manifest.id, manifest);
    } catch (error) {
        if (!import.meta.env.DEV) throw error;
        const id = value && typeof value === 'object' && 'id' in value && typeof value.id === 'string'
            ? value.id
            : 'unknown-manifest';
        manifestIssues.set(id, error instanceof Error ? error.message : 'Manifest validation failed.');
    }
}

export function getTripManifest(id: string | undefined): TripManifest | undefined {
    return id ? manifests.get(id) : undefined;
}

export function getTripManifestIssue(id: string | undefined): string | undefined {
    return id ? manifestIssues.get(id) : undefined;
}