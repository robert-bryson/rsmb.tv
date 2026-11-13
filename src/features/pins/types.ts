import type { FeatureCollection } from 'geojson';
import type { DisplayBoundaries, MapPin } from '../../../shared/worldPins';
import type { RadiusLines } from './radii';

export interface ViewRequest { bounds: [number, number, number, number]; key: number }
export interface PinsMapProps {
    pins: MapPin[];
    states: DisplayBoundaries | null;
    counties: DisplayBoundaries | null;
    stateFips: string;
    showCounties: boolean;
    circles: boolean;
    zoom: number;
    selected: MapPin | null;
    view: ViewRequest | null;
    unit: 'mi' | 'km';
    reducedMotion: boolean;
    showRegions?: boolean;
    dataState: 'loading' | 'ready' | 'error';
    onSelect: (id: string) => void;
    onZoom: (zoom: number) => void;
}

export interface PinsMapData {
    points: FeatureCollection;
    circles: FeatureCollection;
    selection: FeatureCollection;
    radii: RadiusLines;
}
