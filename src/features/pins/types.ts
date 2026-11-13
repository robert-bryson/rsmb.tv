import type { FeatureCollection } from 'geojson';
import type { Boundaries, Pin } from '../../../shared/pins';
import type { RadiusLines } from './radii';

export interface ViewRequest { bounds: [number, number, number, number]; key: number }
export interface PinsMapProps {
    pins: Pin[];
    states: Boundaries | null;
    counties: Boundaries | null;
    stateFips: string;
    showCounties: boolean;
    circles: boolean;
    zoom: number;
    selected: Pin | null;
    view: ViewRequest | null;
    unit: 'mi' | 'km';
    reducedMotion: boolean;
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
