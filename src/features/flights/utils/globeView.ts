import type { GlobeViewState } from '../types';

/** Use the URL precision when comparing renderer coordinates with shared views. */
export function globeViewsEqual(first: GlobeViewState | null, second: GlobeViewState | null): boolean {
    if (first === null || second === null) return first === second;
    return Number(first.lat.toFixed(4)) === Number(second.lat.toFixed(4))
        && Number(first.lng.toFixed(4)) === Number(second.lng.toFixed(4))
        && Number(first.altitude.toFixed(3)) === Number(second.altitude.toFixed(3));
}
