import type { ExpressionSpecification } from '../../maps/maplibre';

// Introduce one kind of detail at a time. Prepare expensive geometry one zoom
// before it draws, after the camera settles; paint expressions handle the fades.
export const COUNTY_ZOOM = 6;
export const COUNTY_BOUNDARY_ZOOM = 7;
export const COUNTY_CIRCLE_ZOOM = 8;
export const COUNTY_LABEL_ZOOM = 9;
export const PIN_MAX_ZOOM = 16;
export const ZOOM_FADE = 0.75;

export function zoomFade(minimumZoom: number, opacity: number | ExpressionSpecification): ExpressionSpecification {
    return ['interpolate', ['linear'], ['zoom'], minimumZoom, 0, minimumZoom + ZOOM_FADE, opacity];
}
