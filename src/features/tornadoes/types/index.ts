import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

export type TornadoMode = 'tracks' | 'density' | 'trends';
export type TornadoColorMode = 'scale' | 'year' | 'decade';
export type TornadoScaleFilter = 'all' | 'ef0' | 'ef1' | 'ef2' | 'ef3' | 'ef4' | 'ef5' | 'ef1plus' | 'ef2plus' | 'ef3plus';
export type TornadoRegionPreset = 'conus' | 'midwest' | 'plains' | 'dixie';

export interface TornadoTrackProperties {
    id: string;
    eventId: string;
    episodeId: string;
    year: number;
    month: number;
    date: string;
    beginTime: string;
    endTime: string;
    timezone: string;
    state: string;
    stateName: string;
    county: string;
    countyFips: string;
    wfo: string;
    scale: number;
    scaleLabel: string;
    lengthMiles: number;
    widthYards: number;
    deaths: number;
    injuries: number;
    propertyDamage: number;
    cropDamage: number;
    source: string;
    dataSource: string;
    narrative?: string;
    episodeNarrative?: string;
}

export interface TornadoPointProperties {
    id: string;
    year: number;
    month: number;
    state: string;
    stateName: string;
    scale: number;
    scaleLabel: string;
    lengthMiles: number;
    deaths: number;
    injuries: number;
}

export type TornadoTrackFeature = Feature<LineString, TornadoTrackProperties>;
export type TornadoTrackCollection = FeatureCollection<LineString, TornadoTrackProperties> & {
    metadata?: {
        source: string;
        generatedAt: string;
        count: number;
    };
};
export type TornadoPointCollection = FeatureCollection<Point, TornadoPointProperties> & {
    metadata?: {
        source: string;
        generatedAt: string;
        count: number;
    };
};

export interface AnnualTornadoSummary {
    year: number;
    count: number;
    unknown: number;
    ef0: number;
    ef1: number;
    ef2: number;
    ef3: number;
    ef4: number;
    ef5: number;
    ef1Plus: number;
    ef2Plus: number;
    deaths: number;
    injuries: number;
    trackMiles: number;
    medianWidthYards: number;
}

export interface StateTornadoSummary {
    state: string;
    stateName: string;
    year: number;
    count: number;
    ef2Plus: number;
    deaths: number;
    injuries: number;
    trackMiles: number;
}

export interface NotableTornadoEvent extends TornadoTrackProperties {
    coordinates: [number, number][];
}

export interface TornadoFilters {
    startYear: number;
    endYear: number;
    scaleFilter: TornadoScaleFilter;
    region: TornadoRegionPreset;
    mode: TornadoMode;
    colorMode: TornadoColorMode;
    /** Currently-selected track ID (URL param `track`). */
    selectedTrackId: string | null;
    /** Map viewport longitude (URL param `lng`). */
    mapLng: number;
    /** Map viewport latitude (URL param `lat`). */
    mapLat: number;
    /** Map viewport zoom level (URL param `zoom`). */
    mapZoom: number;
}

export interface FilteredTornadoStats {
    count: number;
    deaths: number;
    injuries: number;
    trackMiles: number;
    ef2Plus: number;
    strongestScale: number;
}

export interface StateAggregateSummary {
    state: string;
    stateName: string;
    count: number;
    ef2Plus: number;
    deaths: number;
    ef2Pct: number;
}