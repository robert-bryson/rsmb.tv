import type { TornadoColorMode, TornadoRegionPreset, TornadoScaleFilter } from './types';

export const DATA_BASE_URL = '/data/tornadoes';

export const TORNADO_ANNUAL_SUMMARY_URL = `${DATA_BASE_URL}/annual-summary.json`;
export const TORNADO_STATE_SUMMARY_URL = `${DATA_BASE_URL}/state-summary.json`;
export const TORNADO_NOTABLE_EVENTS_URL = `${DATA_BASE_URL}/notable-events.json`;

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
    ef1plus: 'EF1+',
    ef2plus: 'EF2+',
    ef3plus: 'EF3+',
};

export const COLOR_MODE_LABELS: Record<TornadoColorMode, string> = {
    scale: 'Scale',
    year: 'Year',
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

export function minScaleForFilter(filter: TornadoScaleFilter): number {
    if (filter === 'ef1plus') return 1;
    if (filter === 'ef2plus') return 2;
    if (filter === 'ef3plus') return 3;
    return -1;
}