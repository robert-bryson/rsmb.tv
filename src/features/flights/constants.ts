// Shared constants for the flights feature
import type { BasemapId } from './types';

// Basemap definitions
export interface BasemapConfig {
    id: BasemapId;
    label: string;
    image: string;
    bump: string | null;
    atmosphere: string;
    bg: string;
}

const base = import.meta.env.BASE_URL;

export const BASEMAPS: BasemapConfig[] = [
    {
        id: 'night',
        label: 'Night',
        image: `${base}basemaps/earth-night.webp`,
        bump: `${base}basemaps/earth-topology.webp`,
        atmosphere: 'lightskyblue',
        bg: 'rgba(0,0,17,1)',
    },
    {
        id: 'blue-marble',
        label: 'Blue Marble',
        image: `${base}basemaps/earth-blue-marble.webp`,
        bump: `${base}basemaps/earth-topology.webp`,
        atmosphere: 'lightskyblue',
        bg: 'rgba(0,0,17,1)',
    },
    {
        id: 'day',
        label: 'Natural',
        image: `${base}basemaps/earth-natural.webp`,
        bump: `${base}basemaps/earth-topology.webp`,
        atmosphere: 'lightskyblue',
        bg: 'rgba(0,0,20,1)',
    },
    {
        id: 'dark',
        label: 'Dark',
        image: `${base}basemaps/earth-dark.webp`,
        bump: null,
        atmosphere: 'rgb(100,100,150)',
        bg: 'rgba(0,0,8,1)',
    },
    {
        id: 'positron',
        label: 'Light',
        image: `${base}basemaps/basemap-positron.webp`,
        bump: null,
        atmosphere: 'rgb(180,200,220)',
        bg: 'rgba(220,220,220,1)',
    },
    {
        id: 'voyager',
        label: 'Voyager',
        image: `${base}basemaps/basemap-voyager.webp`,
        bump: null,
        atmosphere: 'rgb(150,180,210)',
        bg: 'rgba(200,210,220,1)',
    },
];

export const DEFAULT_BASEMAP_ID: BasemapId = 'night';

const VALID_BASEMAP_IDS = new Set<string>(BASEMAPS.map(b => b.id));

export function isValidBasemapId(id: unknown): id is BasemapId {
    return typeof id === 'string' && VALID_BASEMAP_IDS.has(id);
}

export function getBasemap(id: string): BasemapConfig {
    return BASEMAPS.find(b => b.id === id) ?? BASEMAPS[0];
}

// Geographic constants
export const EARTH_CIRCUMFERENCE_KM = 40075;
export const EARTH_RADIUS_KM = 6371;

// Default view (centered on USA)
export const DEFAULT_VIEW = {
    lat: 39.8283,
    lng: -98.5795,
    altitude: 2.0,
} as const;

// Animation timing
export const AUTO_ROTATION_DELAY_MS = 12000;
export const AUTO_ROTATION_SPEED = -0.25;
export const VIEW_TRANSITION_MS = 1000;
export const COPY_FEEDBACK_MS = 2000;

// Globe rendering
export const ARC_ALTITUDE_AUTOSCALE = 0.3;
export const LINE_HOVER_PRECISION = 3;
export const ATMOSPHERE_ALTITUDE = 0.15;

// Arc styling
export const MIN_ARC_STROKE = 0.2;
export const MAX_ARC_STROKE = 1.0;
export const MIN_STATIC_ARC_STROKE = 0.3;
export const CONNECTED_ARC_MULTIPLIER = 1.5;
export const DIM_ARC_MULTIPLIER = 0.7;

// Default arc color (more transparent for better legibility)
export const DEFAULT_ARC_COLOR = 'rgba(140, 120, 200, 0.35)';
export const CONNECTED_ARC_COLOR = 'rgba(0, 255, 255, 0.7)';
export const DIM_ARC_COLOR = 'rgba(140, 120, 200, 0.12)';

// Point sizing (using square root scaling for proportional symbols)
export const MIN_POINT_SIZE = 0.15;
export const MAX_POINT_SIZE = 0.6;
export const POINT_ALTITUDE = 0.025;
export const SELECTED_POINT_ALTITUDE = 0.05;

// Label styling
export const LABEL_SIZE = 0.6;
export const LABEL_ALTITUDE = 0.018;
export const LABEL_RESOLUTION = 3;
export const LABEL_MIN_VISITS = 3; // Only show labels for airports with this many visits or more

// Flight speed estimation (km/h average cruising speed)
export const AVERAGE_FLIGHT_SPEED_KMH = 800;
export const FLIGHT_OVERHEAD_HOURS = 1; // takeoff/landing time

// Minimum flight distance to consider valid (excludes data errors)
export const MIN_VALID_FLIGHT_DISTANCE_KM = 50;

// Year color scale for temporal visualization
export const YEAR_COLORS: Record<number, string> = {
    2006: '#1e40af',
    2007: '#2563eb',
    2008: '#3b82f6',
    2009: '#6366f1',
    2010: '#8b5cf6',
    2011: '#a855f7',
    2012: '#c026d3',
    2013: '#d946ef',
    2014: '#e879f9',
    2015: '#f472b6',
    2016: '#fb7185',
    2017: '#f43f5e',
    2018: '#ef4444',
    2019: '#f97316',
    2020: '#fb923c',
    2021: '#fbbf24',
    2022: '#facc15',
    2023: '#a3e635',
    2024: '#4ade80',
    2025: '#22d3ee',
    2026: '#06b6d4',
};

// Get color for a given year
export function getYearColor(year: number): string {
    return YEAR_COLORS[year] || '#a855f7';
}

// Frequency color thresholds and colors
export const FREQUENCY_THRESHOLDS = {
    VERY_FREQUENT: 0.7,
    FREQUENT: 0.4,
    MODERATE: 0.2,
} as const;

export const FREQUENCY_COLORS = {
    VERY_FREQUENT: '#ef4444', // red
    FREQUENT: '#f97316', // orange
    MODERATE: '#facc15', // yellow
    OCCASIONAL: '#a855f7', // purple
} as const;

// Get color based on frequency ratio
export function getFrequencyColor(count: number, maxCount: number): string {
    const ratio = count / maxCount;
    if (ratio > FREQUENCY_THRESHOLDS.VERY_FREQUENT) return FREQUENCY_COLORS.VERY_FREQUENT;
    if (ratio > FREQUENCY_THRESHOLDS.FREQUENT) return FREQUENCY_COLORS.FREQUENT;
    if (ratio > FREQUENCY_THRESHOLDS.MODERATE) return FREQUENCY_COLORS.MODERATE;
    return FREQUENCY_COLORS.OCCASIONAL;
}

// Color mode options
export const COLOR_MODES = ['default', 'year', 'frequency', 'airline'] as const;

// Zoom calculation constants
export const ZOOM_ALTITUDE_MIN = 0.15;
export const ZOOM_ALTITUDE_MAX = 2.5;
export const DBLCLICK_ZOOM_FACTOR = 0.5; // Halve altitude on double-click
export const ZOOM_SPAN_DIVISOR = 50;
export const ZOOM_BASE_OFFSET = 0.3;

// ========================================
// All Airports Layer Constants
// ========================================

// Point sizes for all airports layer
export const ALL_AIRPORTS_POINT_SIZE = 0.08;
export const ALL_AIRPORTS_POINT_ALTITUDE = 0.008;

// Airport symbol mode colors
export const VISITED_COLOR = 'rgba(74, 222, 128, 0.9)'; // green-400
export const UNVISITED_COLOR = 'rgba(100, 116, 139, 0.5)'; // slate-500 with lower opacity

// Continent color palette
export const CONTINENT_COLORS: Record<string, string> = {
    AF: 'rgba(239, 68, 68, 0.8)', // Africa - red
    AN: 'rgba(209, 213, 219, 0.8)', // Antarctica - gray
    AS: 'rgba(249, 115, 22, 0.8)', // Asia - orange
    EU: 'rgba(59, 130, 246, 0.8)', // Europe - blue
    NA: 'rgba(34, 197, 94, 0.8)', // North America - green
    OC: 'rgba(168, 85, 247, 0.8)', // Oceania - purple
    SA: 'rgba(234, 179, 8, 0.8)', // South America - yellow
    default: 'rgba(100, 116, 139, 0.6)',
};

// Elevation thresholds (in feet)
export const ELEVATION_THRESHOLDS = {
    VERY_HIGH: 8000, // 8000+ ft
    HIGH: 4000, // 4000-8000 ft
    MEDIUM: 1000, // 1000-4000 ft
    LOW: 100, // 100-1000 ft
    SEA_LEVEL: 0, // 0-100 ft
} as const;

// Elevation colors
export const ELEVATION_COLORS = {
    VERY_HIGH: 'rgba(220, 38, 38, 0.8)', // red-600
    HIGH: 'rgba(249, 115, 22, 0.8)', // orange-500
    MEDIUM: 'rgba(234, 179, 8, 0.8)', // yellow-500
    LOW: 'rgba(34, 197, 94, 0.8)', // green-500
    SEA_LEVEL: 'rgba(59, 130, 246, 0.8)', // blue-500
} as const;

// Get color based on elevation
export function getElevationColor(elevationFt: number): string {
    if (elevationFt >= ELEVATION_THRESHOLDS.VERY_HIGH) return ELEVATION_COLORS.VERY_HIGH;
    if (elevationFt >= ELEVATION_THRESHOLDS.HIGH) return ELEVATION_COLORS.HIGH;
    if (elevationFt >= ELEVATION_THRESHOLDS.MEDIUM) return ELEVATION_COLORS.MEDIUM;
    if (elevationFt >= ELEVATION_THRESHOLDS.LOW) return ELEVATION_COLORS.LOW;
    return ELEVATION_COLORS.SEA_LEVEL;
}

// Country color generator (deterministic based on country code)
const countryColorCache = new Map<string, string>();
export function getCountryColor(countryCode: string): string {
    if (countryColorCache.has(countryCode)) {
        return countryColorCache.get(countryCode)!;
    }

    // Generate a hue based on country code hash
    let hash = 0;
    for (let i = 0; i < countryCode.length; i++) {
        hash = countryCode.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    const color = `hsla(${hue}, 70%, 55%, 0.8)`;

    countryColorCache.set(countryCode, color);
    return color;
}

// Symbol mode labels for UI
export const AIRPORT_SYMBOL_MODE_LABELS: Record<string, string> = {
    visited: 'Visited / Unvisited',
    continent: 'By Continent',
    country: 'By Country',
    elevation: 'By Elevation',
};

// Continent name labels for legend
export const CONTINENT_LABELS: Record<string, string> = {
    AF: 'Africa',
    AN: 'Antarctica',
    AS: 'Asia',
    EU: 'Europe',
    NA: 'North America',
    OC: 'Oceania',
    SA: 'South America',
};

// ========================================
// US States Layer Constants
// ========================================

// State polygon styling
export const STATE_POLYGON_ALTITUDE = 0.006;
export const STATE_POLYGON_SIDE_COLOR = 'rgba(100, 116, 139, 0.3)';

// State visited/unvisited colors
export const STATE_VISITED_COLOR = 'rgba(74, 222, 128, 0.5)'; // green with transparency
export const STATE_UNVISITED_COLOR = 'rgba(100, 116, 139, 0.2)'; // slate with low opacity
export const STATE_HOVER_COLOR = 'rgba(59, 130, 246, 0.6)'; // blue on hover

// Visit count color scale (gradient from low to high visits)
export const VISIT_COUNT_COLORS = [
    { threshold: 0, color: 'rgba(100, 116, 139, 0.2)' }, // not visited
    { threshold: 1, color: 'rgba(187, 247, 208, 0.5)' }, // 1 visit - light green
    { threshold: 3, color: 'rgba(134, 239, 172, 0.5)' }, // 2-3 visits
    { threshold: 5, color: 'rgba(74, 222, 128, 0.5)' }, // 4-5 visits
    { threshold: 10, color: 'rgba(34, 197, 94, 0.5)' }, // 6-10 visits
    { threshold: 20, color: 'rgba(22, 163, 74, 0.5)' }, // 11-20 visits
    { threshold: Infinity, color: 'rgba(21, 128, 61, 0.6)' }, // 20+ visits - dark green
];

// Flight count color scale (based on total flights to/from state)
export const FLIGHT_COUNT_COLORS = [
    { threshold: 0, color: 'rgba(100, 116, 139, 0.2)' }, // no flights
    { threshold: 1, color: 'rgba(254, 215, 170, 0.5)' }, // 1 flight - light orange
    { threshold: 5, color: 'rgba(253, 186, 116, 0.5)' }, // 2-5 flights
    { threshold: 10, color: 'rgba(251, 146, 60, 0.5)' }, // 6-10 flights
    { threshold: 25, color: 'rgba(249, 115, 22, 0.5)' }, // 11-25 flights
    { threshold: 50, color: 'rgba(234, 88, 12, 0.5)' }, // 26-50 flights
    { threshold: Infinity, color: 'rgba(194, 65, 12, 0.6)' }, // 50+ flights - dark orange
];

// Generic color threshold lookup (shared by visit count and flight count)
function getThresholdColor(count: number, thresholds: readonly { threshold: number; color: string }[]): string {
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (count >= thresholds[i].threshold) {
            return thresholds[i].color;
        }
    }
    return thresholds[0].color;
}

// Get color based on visit count
export function getVisitCountColor(count: number): string {
    return getThresholdColor(count, VISIT_COUNT_COLORS);
}

// Get color based on flight count
export function getFlightCountColor(count: number): string {
    return getThresholdColor(count, FLIGHT_COUNT_COLORS);
}

// State symbol mode labels for UI
export const STATE_SYMBOL_MODE_LABELS: Record<string, string> = {
    visited: 'Visited / Not Visited',
    visitCount: 'Airports Visited',
    flightCount: 'Flight Count',
};

// State symbol mode icons
export const STATE_SYMBOL_MODE_ICONS: Record<string, string> = {
    visited: '✓',
    visitCount: '#',
    flightCount: '✈',
};
