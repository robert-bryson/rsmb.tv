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
    hero: photoSchema,
    route: z.object({
        geoJson: z.string().min(1),
        staticImage: z.string().min(1).optional(),
        alt: z.string().min(1).optional(),
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
    for (const photo of [manifest.hero, ...manifest.photos]) {
        if (photoIds.has(photo.id)) {
            context.addIssue({ code: 'custom', message: `Duplicate photo ID: ${photo.id}` });
        }
        photoIds.add(photo.id);
    }

    const stopIds = new Set<string>();
    for (const stop of manifest.stops) {
        if (stopIds.has(stop.id)) {
            context.addIssue({ code: 'custom', message: `Duplicate stop ID: ${stop.id}` });
        }
        stopIds.add(stop.id);
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
    return tripManifestSchema.parse(value);
}

const manifestModules = import.meta.glob<unknown>('../../content/trips/*.json', {
    eager: true,
    import: 'default',
});

const manifests = new Map(
    Object.values(manifestModules).map((value) => {
        const manifest = parseTripManifest(value);
        return [manifest.id, manifest];
    }),
);

export function getTripManifest(id: string | undefined): TripManifest | undefined {
    return id ? manifests.get(id) : undefined;
}