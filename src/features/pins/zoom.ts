import type { ExpressionSpecification } from '../../maps/maplibre';
import type { MapPin } from '../../../shared/worldPins';

// These are the earliest useful scales. Individual counties wait until their
// radius has enough screen space; small counties retain the previous cutoffs.
export const COUNTY_ZOOM = 4;
export const COUNTY_BOUNDARY_ZOOM = 6;
export const COUNTY_CIRCLE_ZOOM = 5;
export const COUNTY_LABEL_ZOOM = 6;
export const PIN_MAX_ZOOM = 16;
export const ZOOM_FADE = 0.75;

export function screenSizeZoom(pin: MapPin, pixels: number, minimum: number) {
    const metersPerPixelAtZero = 40_075_016.686 * Math.cos(pin.lat * Math.PI / 180) / 512;
    return Math.max(minimum, Math.ceil(Math.log2(pixels * metersPerPixelAtZero / pin.radiusMeters)));
}

export function countyDetailZooms(pin: MapPin) {
    return {
        countyPinZoom: Math.min(6, screenSizeZoom(pin, 8, COUNTY_ZOOM)),
        countyCircleZoom: Math.min(8, screenSizeZoom(pin, 22, COUNTY_CIRCLE_ZOOM)),
        countyLabelZoom: Math.min(9, screenSizeZoom(pin, 40, COUNTY_LABEL_ZOOM)),
    };
}

export function zoomFade(minimumZoom: number, opacity: number | ExpressionSpecification): ExpressionSpecification {
    return ['interpolate', ['linear'], ['zoom'], minimumZoom, 0, minimumZoom + ZOOM_FADE, opacity];
}

/** Composite stops keep zoom at the top level of a MapLibre paint expression.
 * Native filters cull each feature until its integer size threshold is met. */
export function featureZoomFade(minimumZoom: number, property: string, opacity: number | ExpressionSpecification): ExpressionSpecification {
    const stops: Array<number | ExpressionSpecification> = [];
    for (let zoom = minimumZoom; zoom < PIN_MAX_ZOOM; zoom++) {
        stops.push(zoom, ['case', ['<', ['get', property], zoom], opacity, 0],
            zoom + ZOOM_FADE, ['case', ['<=', ['get', property], zoom], opacity, 0]);
    }
    stops.push(PIN_MAX_ZOOM, ['case', ['<=', ['get', property], PIN_MAX_ZOOM], opacity, 0]);
    return ['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification;
}
