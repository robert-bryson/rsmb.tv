import { z } from 'zod';

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const dateSchema = z.iso.date();
const regionsSchema = z.array(z.string().trim().min(1)).refine(
    regions => new Set(regions).size === regions.length,
    'Region names must be unique within each list.',
);
const photoSchema = z.object({
    id: slugSchema,
    src: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    alt: z.string().trim().min(1),
    caption: z.string().optional(),
    location: z.string().optional(),
    date: dateSchema.optional(),
    srcSet: z.string().optional(),
    sizes: z.string().optional(),
});

function mediaUrlSchema(extension: 'mp4' | 'webp') {
    const bundledPath = new RegExp(`^/media/trips/[a-z0-9]+(?:-[a-z0-9]+)*/[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{12}\\.${extension}$`);
    return z.string().refine(value => {
        if (value.startsWith('/')) return bundledPath.test(value);
        try {
            const url = new URL(value);
            return url.origin === 'https://data.rsmb.tv' && !url.username && !url.password
                && url.pathname.endsWith(`.${extension}`) && !url.search && !url.hash;
        } catch {
            return false;
        }
    }, `Use a fingerprinted bundled asset or a data.rsmb.tv HTTPS URL ending in .${extension}.`);
}
const animationSchema = z.object({
    id: slugSchema,
    src: mediaUrlSchema('mp4'),
    poster: mediaUrlSchema('webp'),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    alt: z.string().trim().min(1),
    caption: z.string().optional(),
    attribution: z.object({ label: z.string().trim().min(1), url: z.url({ protocol: /^https$/ }) }).optional(),
});

export const tripManifestSchema = z.object({
    id: slugSchema,
    dates: z.object({ start: dateSchema, end: dateSchema }),
    ridingDays: z.number().int().positive().optional(),
    distanceMiles: z.number().positive().optional(),
    motorcycle: z.string().min(1).optional(),
    countries: z.array(z.object({
        code: z.string().regex(/^[A-Z]{2}$/, 'Use a two-letter uppercase country code.'),
        regions: regionsSchema.optional(),
    })).refine(countries => new Set(countries.map(country => country.code)).size === countries.length,
        'Country codes must be unique.').optional(),
    regions: regionsSchema.optional(),
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
    animations: z.array(animationSchema).optional(),
    introAnimation: slugSchema.optional(),
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

    const animationIds = new Set<string>();
    for (const animation of manifest.animations ?? []) {
        if (animationIds.has(animation.id)) {
            context.addIssue({ code: 'custom', message: `Duplicate animation ID: ${animation.id}` });
        }
        animationIds.add(animation.id);
        for (const url of [animation.src, animation.poster]) {
            let pathname: string;
            try { pathname = new URL(url, 'https://rsmb.tv').pathname; }
            catch { continue; } // The field schema reports malformed URLs.
            const prefix = url.startsWith('/') ? `/media/trips/${manifest.id}/` : `/trips/${manifest.id}/`;
            if (!pathname.startsWith(prefix)) {
                context.addIssue({ code: 'custom', message: `Animation ${animation.id} must use this trip's media directory.` });
            }
        }
    }
    if (manifest.introAnimation && !animationIds.has(manifest.introAnimation)) {
        context.addIssue({ code: 'custom', path: ['introAnimation'], message: `Intro references unknown animation: ${manifest.introAnimation}` });
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
    const assignedTracks = new Set<string>();
    for (const day of manifest.days ?? []) {
        if (dayIds.has(day.id)) context.addIssue({ code: 'custom', message: `Duplicate day ID: ${day.id}` });
        dayIds.add(day.id);
        for (const id of day.trackIds ?? []) if (!trackIds.has(id)) context.addIssue({ code: 'custom', message: `Day ${day.id} references unknown track: ${id}` });
        for (const id of day.trackIds ?? []) {
            if (assignedTracks.has(id)) context.addIssue({ code: 'custom', message: `Track ${id} is assigned to more than one day or repeated within a day.` });
            assignedTracks.add(id);
        }
        if (new Set(day.stopIds).size !== (day.stopIds?.length ?? 0)) {
            context.addIssue({ code: 'custom', message: `Day ${day.id} contains duplicate stop IDs.` });
        }
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
