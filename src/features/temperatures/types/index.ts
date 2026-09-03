export interface StateRecordProperties {
    state: string;
    stateName: string;
    type: 'high' | 'low';
    tempF: number;
    date: string;
    location: string;
    station: string;
}

export interface CountyRecordProperties {
    countyFips: string;
    countyName: string;
    state: string;
    type: 'high' | 'low';
    tempF: number;
    date: string;
    stationName: string;
    lat: number;
    lon: number;
}

export interface GeoJsonFeature<P> {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: P;
}

export interface GeoJsonCollection<P> {
    type: 'FeatureCollection';
    features: GeoJsonFeature<P>[];
}

export type StateRecordsCollection = GeoJsonCollection<StateRecordProperties>;
export type CountyRecordsCollection = GeoJsonCollection<CountyRecordProperties>;

export interface BrokenRecord {
    stationName: string;
    uid: number;
    state: string;
    stateName: string;
    county: string;
    lat: number;
    lon: number;
    elev: number | null;
    type: 'high' | 'low';
    tempF: number;
    prevRecordF: number;
    prevRecordDate: string;
    /** Mean for this calendar date from 1950 through the year before `date`. */
    normalF: number | null;
    date: string;
    /** Scope of the record: daily calendar-date, monthly, or promoted to county/state all-time on the client */
    recordScope?: RecordScope;
}

export interface RecentRecords {
    asOf: string;
    dates?: string[];
    yesterday: BrokenRecord[];
    last7Days: BrokenRecord[];
}

export interface TemperatureSummary {
    lastUpdated: string;
    stateRecordCount: number;
    countyRecordCount: number;
    statesProcessed: number;
}

export type TimePeriod = 'yesterday' | 'last7Days';

export type ViewMode = 'recent' | 'county' | 'state' | 'freshness';

export interface HighlightRange {
    startYear: number;
    endYear: number;
}

/** How significant a broken record is relative to historical context */
export type RecordScope = 'daily' | 'monthly' | 'county-alltime' | 'state-alltime';

export interface DecadeData {
    decade: number;
    label: string;
    highs: number;
    lows: number;
    ratio: number | null;
}

export interface YearData {
    year: number;
    highs: number;
    lows: number;
}

export interface RollingRatioData {
    year: number;
    ratio: number | null;
    highs10yr: number;
    lows10yr: number;
}

export interface ClimateTrends {
    source: string;
    description: string;
    totalHighs: number;
    totalLows: number;
    byDecade: DecadeData[];
    byYear: YearData[];
    rollingRatio: RollingRatioData[];
}
