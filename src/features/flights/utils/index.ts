export { fetchWithCache, clearCache, invalidateCache, preloadCache } from './fetchCache';
export { escapeHtml } from '../../../utils/escapeHtml';

import { EARTH_RADIUS_KM } from '../constants';
import type { FlightProperties, FlightTypeFilter } from '../types';

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

/** Parse M/D/YYYY date string into a Date object */
export function parseDateString(dateStr: string): Date {
    const parts = dateStr.split('/');
    return new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
}

/** Sort M/D/YYYY date strings newest-first */
export function sortDatesDescending(dates: string[]): string[] {
    return [...dates].sort((a, b) => parseDateString(b).getTime() - parseDateString(a).getTime());
}

/** Format a distance (given in km) using the selected unit system */
export function formatDistance(km: number, isMetric: boolean): string {
    if (isMetric) return `${Math.round(km).toLocaleString()} km`;
    const miles = Math.round(km * 0.621371);
    return `${miles.toLocaleString()} mi`;
}

/** Format an elevation using the selected unit system */
export function formatElevation(elevationFt: number, elevationM: number, isMetric: boolean): string {
    if (isMetric) return `${elevationM.toLocaleString()} m`;
    return `${elevationFt.toLocaleString()} ft`;
}

export function isValidFlightTypeFilter(value: string | null): value is FlightTypeFilter {
    return value === 'domestic' || value === 'international' || value === 'intercontinental';
}

export function getFlightTypeLabel(type: FlightTypeFilter): string {
    switch (type) {
        case 'domestic':
            return 'Domestic';
        case 'international':
            return 'International';
        case 'intercontinental':
            return 'Intercontinental';
    }
}

export function getFlightTypeColor(type: FlightTypeFilter): string {
    switch (type) {
        case 'domestic':
            return 'rgba(34, 211, 238, 0.92)';
        case 'international':
            return 'rgba(96, 165, 250, 0.92)';
        case 'intercontinental':
            return 'rgba(217, 70, 239, 0.92)';
    }
}

export function flightMatchesType(flight: FlightProperties, type: FlightTypeFilter): boolean {
    switch (type) {
        case 'domestic':
            return flight.origin_country === flight.destination_country;
        case 'international':
            return flight.origin_country !== flight.destination_country;
        case 'intercontinental':
            return flight.origin_continent !== flight.destination_continent;
    }
}
