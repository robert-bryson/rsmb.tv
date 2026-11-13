import type { FeatureCollection } from 'geojson';
import type { DisplayBoundaries, MapPin } from '../../../shared/worldPins';
import type { RadiusLines } from './radii';
import type { CountyMode } from './geometry';

export interface ViewRequest { bounds: [number, number, number, number]; key: number | string }
export interface PinsMapProps {
    pins: MapPin[];
    contextPins?: MapPin[];
    states: DisplayBoundaries | null;
    counties: DisplayBoundaries | null;
    stateFips: string;
    countyMode: CountyMode;
    circles: boolean;
    zoom: number;
    selected: MapPin | null;
    view: ViewRequest | null;
    navigationKey?: string;
    unit: 'mi' | 'km';
    reducedMotion: boolean;
    showRegions?: boolean;
    dataState: 'loading' | 'ready' | 'error';
    onSelect: (id: string) => void;
    onNavigateUp?: () => void;
    onZoom: (zoom: number) => void;
}

export interface PinsMapData {
    points: FeatureCollection;
    circles: FeatureCollection;
    countyCircles: FeatureCollection;
    selection: FeatureCollection;
    radii: RadiusLines;
}
