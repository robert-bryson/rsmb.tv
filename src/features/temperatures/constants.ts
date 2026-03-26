import type { TimePeriod } from './types';

/** In production, serve temperature data from the CDN backed by S3. */
export const DATA_BASE_URL = import.meta.env.PROD
    ? 'https://data.rsmb.tv'
    : '/data/temperatures';

export const STATE_RECORDS_URL = `${DATA_BASE_URL}/stateRecords.json`;
export const COUNTY_RECORDS_URL = `${DATA_BASE_URL}/countyRecords.json`;
export const RECENT_RECORDS_URL = `${DATA_BASE_URL}/recentRecords.json`;
export const SUMMARY_URL = `${DATA_BASE_URL}/summary.json`;
export const CLIMATE_TRENDS_URL = `${DATA_BASE_URL}/climateTrends.json`;

/** Zoom level at which county-level data appears */
export const COUNTY_ZOOM_THRESHOLD = 5.5;

/** Map initial view — centered on CONUS */
export const INITIAL_CENTER: [number, number] = [-98.5, 39.8];
export const INITIAL_ZOOM = 3.5;
export const MIN_ZOOM = 2;
export const MAX_ZOOM = 12;

/** Temperature color scale — warm to cool */
export const HIGH_TEMP_COLOR = '#ef4444'; // red-500
export const LOW_TEMP_COLOR = '#3b82f6';  // blue-500

/** Circle radius by zoom level */
export const CIRCLE_RADIUS_STOPS: [number, number][] = [
    [3, 5],
    [6, 7],
    [9, 10],
];

export const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
    yesterday: 'Yesterday',
    last7Days: 'Last 7 Days',
};

export const TIME_PERIODS: TimePeriod[] = ['yesterday', 'last7Days'];

/** Freshness color scale — one color per decade, cool → warm gradient */
export const FRESHNESS_COLORS: [number, string][] = [
    [1890, '#1a2744'],  // 1890s — deep navy
    [1900, '#1e3a5f'],  // 1900s — dark blue
    [1910, '#1b4f6e'],  // 1910s — steel blue
    [1920, '#17635e'],  // 1920s — teal
    [1930, '#1e6f3a'],  // 1930s — forest green
    [1940, '#3d7a28'],  // 1940s — olive green
    [1950, '#5f8118'],  // 1950s — yellow-green
    [1960, '#7a7a14'],  // 1960s — dark yellow
    [1970, '#8b6914'],  // 1970s — amber
    [1980, '#9a5210'],  // 1980s — dark orange
    [1990, '#b13c0c'],  // 1990s — burnt orange
    [2000, '#c2410c'],  // 2000s — orange-red
    [2010, '#d42a1a'],  // 2010s — red
    [2020, '#dc2626'],  // 2020s — bright red
];

export function yearToColor(year: number): string {
    for (let i = FRESHNESS_COLORS.length - 1; i >= 0; i--) {
        if (year >= FRESHNESS_COLORS[i][0]) return FRESHNESS_COLORS[i][1];
    }
    return FRESHNESS_COLORS[0][1];
}

/** State centroids for fly-to from summary panel */
export const STATE_CENTERS: Record<string, [number, number]> = {
    AL: [-86.79, 32.81], AK: [-154.49, 63.59], AZ: [-111.09, 34.05], AR: [-91.83, 35.20],
    CA: [-119.42, 36.78], CO: [-105.78, 39.55], CT: [-73.09, 41.60], DE: [-75.53, 38.91],
    FL: [-81.52, 27.66], GA: [-82.91, 32.16], HI: [-155.67, 19.90], ID: [-114.74, 44.07],
    IL: [-89.40, 40.63], IN: [-85.60, 40.55], IA: [-93.10, 41.88], KS: [-98.48, 39.01],
    KY: [-84.27, 37.84], LA: [-92.15, 31.24], ME: [-69.45, 45.25], MD: [-76.64, 39.05],
    MA: [-71.38, 42.41], MI: [-85.60, 44.31], MN: [-94.69, 46.73], MS: [-89.40, 32.35],
    MO: [-91.83, 37.96], MT: [-110.36, 46.88], NE: [-99.90, 41.49], NV: [-116.42, 38.80],
    NH: [-71.57, 43.19], NJ: [-74.41, 40.06], NM: [-105.87, 34.52], NY: [-74.22, 43.30],
    NC: [-79.02, 35.76], ND: [-101.00, 47.55], OH: [-82.91, 40.42], OK: [-97.09, 35.01],
    OR: [-120.55, 43.80], PA: [-77.19, 41.20], RI: [-71.48, 41.58], SC: [-81.16, 33.84],
    SD: [-99.90, 43.97], TN: [-86.58, 35.52], TX: [-99.90, 31.97], UT: [-111.09, 39.32],
    VT: [-72.58, 44.56], VA: [-78.66, 37.43], WA: [-120.74, 47.75], WV: [-80.45, 38.60],
    WI: [-88.79, 43.78], WY: [-107.29, 43.08],
};
