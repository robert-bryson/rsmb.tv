import { z } from 'zod';

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
    ridingDays: z.number().int().positive().optional(),
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
    days: z.array(z.object({
        id: slugSchema, title: z.string().min(1), date: dateSchema.optional(),
        headingId: slugSchema, trackIds: z.array(slugSchema).optional(),
        stopIds: z.array(slugSchema).optional(), galleryId: slugSchema.optional(),
    })).optional(),
    series: z.object({ id: slugSchema, title: z.string().min(1), order: z.number().int().positive() }).optional(),
    galleries: z.record(slugSchema, z.array(slugSchema).min(1)).optional(),
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

    const dayIds = new Set<string>();
    for (const day of manifest.days ?? []) {
        if (dayIds.has(day.id)) context.addIssue({ code: 'custom', message: `Duplicate day ID: ${day.id}` });
        dayIds.add(day.id);
        for (const id of day.trackIds ?? []) if (!trackIds.has(id)) context.addIssue({ code: 'custom', message: `Day ${day.id} references unknown track: ${id}` });
        for (const id of day.stopIds ?? []) if (!stopIds.has(id)) context.addIssue({ code: 'custom', message: `Day ${day.id} references unknown stop: ${id}` });
        if (day.galleryId && (!manifest.galleries || !Object.hasOwn(manifest.galleries, day.galleryId))) {
            context.addIssue({ code: 'custom', message: `Day ${day.id} references unknown gallery: ${day.galleryId}` });
        }
    }

    for (const [galleryId, galleryPhotoIds] of Object.entries(manifest.galleries ?? {})) {
        if (new Set(galleryPhotoIds).size !== galleryPhotoIds.length) {
            context.addIssue({ code: 'custom', message: `Gallery "${galleryId}" contains duplicate photo IDs.` });
        }
        for (const photoId of galleryPhotoIds) {
            if (!photoIds.has(photoId)) {
                context.addIssue({ code: 'custom', message: `Gallery "${galleryId}" references unknown photo: ${photoId}` });
            }
        }
    }
});


export type TripManifest = z.infer<typeof tripManifestSchema>;
