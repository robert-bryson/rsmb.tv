import type { TornadoColorMode, TornadoRegionPreset, TornadoScaleFilter } from './types';

/** Serve generated tornado data from the S3-backed CDN by default. */
export const DATA_BASE_URL = (import.meta.env.VITE_TORNADO_DATA_BASE_URL || 'https://data.rsmb.tv/tornadoes').replace(/\/+$/, '');

export const TORNADO_ANNUAL_SUMMARY_URL = `${DATA_BASE_URL}/annual-summary.json`;
export const TORNADO_NOTABLE_EVENTS_URL = `${DATA_BASE_URL}/notable-events.json`;
export const TORNADO_WARNING_SUMMARY_URL = `${DATA_BASE_URL}/warning-summary.json`;

export const MIN_DATA_YEAR = 1950;
export const DEFAULT_START_YEAR = new Date().getFullYear() - 1;
export const DEFAULT_END_YEAR = DEFAULT_START_YEAR;

export function tornadoTracksYearUrl(year: number) {
    return `${DATA_BASE_URL}/tracks/${year}.geojson`;
}

export function tornadoPointsYearUrl(year: number) {
    return `${DATA_BASE_URL}/track-points/${year}.geojson`;
}

export const INITIAL_CENTER: [number, number] = [-96.5, 38.7];
export const INITIAL_ZOOM = 3.35;
export const MIN_ZOOM = 2;
export const MAX_ZOOM = 11;

export const SCALE_FILTER_LABELS: Record<TornadoScaleFilter, string> = {
    all: 'All',
    ef0: 'EF0',
    ef1: 'EF1',
    ef2: 'EF2',
    ef3: 'EF3',
    ef4: 'EF4',
    ef5: 'EF5',
    ef1plus: 'EF1+',
    ef2plus: 'EF2+',
    ef3plus: 'EF3+',
};

export const COLOR_MODE_LABELS: Record<TornadoColorMode, string> = {
    scale: 'Scale',
    year: 'Year',
    decade: 'Decade',
};

/** One colour per decade 1950–2020, used for the decade color mode. */
export const DECADE_COLORS: Record<number, string> = {
    1950: '#94a3b8',
    1960: '#38bdf8',
    1970: '#34d399',
    1980: '#a3e635',
    1990: '#facc15',
    2000: '#fb923c',
    2010: '#f87171',
    2020: '#e879f9',
};

export const REGION_LABELS: Record<TornadoRegionPreset, string> = {
    conus: 'CONUS',
    midwest: 'Midwest',
    plains: 'Plains',
    dixie: 'Dixie Alley',
};

export const REGION_STATES: Record<TornadoRegionPreset, string[]> = {
    conus: [],
    midwest: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
    plains: ['CO', 'KS', 'MT', 'NE', 'NM', 'ND', 'OK', 'SD', 'TX', 'WY'],
    dixie: ['AL', 'AR', 'GA', 'LA', 'MS', 'TN'],
};

export const SCALE_COLORS: Record<number, string> = {
    [-1]: '#71717a',
    0: '#38bdf8',
    1: '#22c55e',
    2: '#eab308',
    3: '#f97316',
    4: '#ef4444',
    5: '#f0abfc',
};

export const SCALE_LABELS: Record<number, string> = {
    [-1]: 'Unknown',
    0: 'EF0/F0',
    1: 'EF1/F1',
    2: 'EF2/F2',
    3: 'EF3/F3',
    4: 'EF4/F4',
    5: 'EF5/F5',
};

/** Ordered color stops for the year-based color mode, matching YEAR_COLOR_EXPRESSION in TornadoMap. */
export const YEAR_COLOR_STOPS: { year: number; color: string }[] = [
    { year: 1950, color: '#38bdf8' },
    { year: 1975, color: '#2dd4bf' },
    { year: 1995, color: '#a3e635' },
    { year: 2010, color: '#facc15' },
    { year: 2020, color: '#fb7185' },
    { year: new Date().getFullYear(), color: '#f0abfc' },
];

export interface ScaleFilterBounds {
    min: number;
    max: number;
}

/** Returns the inclusive [min, max] EF scale range for a given filter. */
export function scaleFilterBounds(filter: TornadoScaleFilter): ScaleFilterBounds {
    switch (filter) {
        case 'ef0': return { min: 0, max: 0 };
        case 'ef1': return { min: 1, max: 1 };
        case 'ef2': return { min: 2, max: 2 };
        case 'ef3': return { min: 3, max: 3 };
        case 'ef4': return { min: 4, max: 4 };
        case 'ef5': return { min: 5, max: 5 };
        case 'ef1plus': return { min: 1, max: 5 };
        case 'ef2plus': return { min: 2, max: 5 };
        case 'ef3plus': return { min: 3, max: 5 };
        default: return { min: -1, max: 5 }; // 'all'
    }
}

export function minScaleForFilter(filter: TornadoScaleFilter): number {
    return scaleFilterBounds(filter).min;
}

export function maxScaleForFilter(filter: TornadoScaleFilter): number {
    return scaleFilterBounds(filter).max;
}