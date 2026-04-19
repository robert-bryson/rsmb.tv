export { fetchWithCache, clearCache, invalidateCache, preloadCache } from './fetchCache';
export { escapeHtml } from '../../../utils/escapeHtml';

import { EARTH_RADIUS_KM } from '../constants';

/** Haversine formula: great-circle distance between two lat/lon points in km */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
}

/** Parse M/D/YYYY date string to year number */
export function parseYear(dateStr: string): number {
    const parts = dateStr.split('/');
    return parseInt(parts[2], 10);
}

/** Create alphabetically sorted route key for consistent deduplication */
export function getRouteKey(origin: string, destination: string): string {
    return [origin, destination].sort().join('-');
}

/** Convert hex color (#RRGGBB) to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
