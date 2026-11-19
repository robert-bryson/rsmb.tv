import { Protocol } from 'pmtiles';
import { addProtocol } from './maplibre';

let registered = false;

export function pmtilesSourceUrl(asset: string) {
    if (!registered) {
        addProtocol('pmtiles', new Protocol().tile);
        registered = true;
    }
    return `pmtiles://${new URL(asset, window.location.href).href}`;
}
