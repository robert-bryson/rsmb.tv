import { z } from 'zod';
import { geodesicDestination } from './geography/geodesy';
import { lineDistanceKilometers } from './routeGeometry';

export const longitude = z.number().finite().min(-180).max(180);
export const latitude = z.number().finite().min(-90).max(90);
export const position = z.tuple([longitude, latitude]);
export const geographicName = z.string().trim().min(1).max(200);

function samePosition(a: number[], b: number[], toleranceMeters = 1) {
    return lineDistanceKilometers([a, b]) * 1000 <= toleranceMeters;
}

function insideBounds(bounds: number[], point: number[]) {
    const [west, south, east, north] = bounds;
    const lng = point[0] + 360 * Math.round(((west + east) / 2 - point[0]) / 360);
    const tolerance = 0.00002; // The published bounds use five decimal places.
    return lng >= west - tolerance && lng <= east + tolerance && point[1] >= south - tolerance && point[1] <= north + tolerance;
}

export const pinGeometryFields = {
    id: z.string().min(1).max(100), name: geographicName,
    level: z.enum(['country', 'state', 'county']),
    lng: longitude, lat: latitude.min(-85).max(85), radiusMeters: z.number().finite().positive(),
    nearestBoundary: position,
    boundaryContacts: z.array(z.object({
        coordinates: position, distanceMeters: z.number().finite().positive(),
        bearingDegrees: z.number().finite().min(-180).max(180),
    })).min(1).max(4),
    bounds: z.tuple([longitude, latitude, z.number().finite().min(-180).max(540), latitude])
        .refine(([w, s, e, n]) => w < e && e - w <= 360 && s < n, 'Invalid geographic bounds'),
};
export const pinGeometrySchema = z.object(pinGeometryFields);
export type PinGeometry = z.infer<typeof pinGeometrySchema>;

export function validatePinGeometry(pin: PinGeometry, ctx: z.RefinementCtx, maxRadiusMeters: number) {
    if (pin.radiusMeters > maxRadiusMeters) return;
    if (pin.boundaryContacts.some(contact => Math.abs(contact.distanceMeters - pin.radiusMeters) > Math.min(100, pin.radiusMeters * 0.01) + 2)) {
        ctx.addIssue({ code: 'custom', message: 'Boundary contact is not near the circle radius' });
    }
    const primary = pin.boundaryContacts[0];
    if (!primary || !samePosition(primary.coordinates, pin.nearestBoundary) || Math.abs(primary.distanceMeters - pin.radiusMeters) > 1) {
        ctx.addIssue({ code: 'custom', message: 'Primary boundary contact disagrees with the radius' });
    }
    if (!insideBounds(pin.bounds, [pin.lng, pin.lat]) || !insideBounds(pin.bounds, pin.nearestBoundary)) {
        ctx.addIssue({ code: 'custom', message: 'Pin or boundary point is outside its jurisdiction bounds' });
    }
    for (const [index, contact] of pin.boundaryContacts.entries()) {
        const endpoint = geodesicDestination(pin.lng, pin.lat, contact.bearingDegrees, contact.distanceMeters);
        if (!samePosition(endpoint, contact.coordinates) || !insideBounds(pin.bounds, contact.coordinates)) {
            ctx.addIssue({ code: 'custom', message: 'Boundary contact has inconsistent coordinates, bearing, or distance' });
        }
        if (pin.boundaryContacts.slice(0, index).some(previous => Math.abs((previous.bearingDegrees - contact.bearingDegrees + 540) % 360 - 180) < 24.99999)) {
            ctx.addIssue({ code: 'custom', message: 'Duplicate boundary contact direction' });
        }
    }
}

const ring = z.array(position).min(4).refine(points => {
    if (points[0][0] !== points.at(-1)![0] || points[0][1] !== points.at(-1)![1]
        || points.some((point, index) => index > 0 && Math.abs(point[0] - points[index - 1][0]) > 180)) return false;
    const [originX, originY] = points[0];
    const area = points.slice(1).reduce((total, point, index) => total
        + (points[index][0] - originX) * (point[1] - originY) - (point[0] - originX) * (points[index][1] - originY), 0);
    return Math.abs(area) > 1e-14;
}, 'Ring is unclosed or has no area');
const polygon = z.array(ring).min(1);
export const polygonGeometrySchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('Polygon'), coordinates: polygon }),
    z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(polygon).min(1) }),
]);
