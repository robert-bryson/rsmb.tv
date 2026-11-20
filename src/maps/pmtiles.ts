import { PMTiles, Protocol } from 'pmtiles';
import { addProtocol } from './maplibre';

let protocol: Protocol | undefined;

export function pmtilesSourceUrl(asset: string, reload = false) {
    if (!protocol) {
        protocol = new Protocol();
        addProtocol('pmtiles', protocol.tile);
    }
    const url = new URL(asset, window.location.href).href;
    // The PMTiles promise cache retains failed header and directory reads.
    if (reload) protocol.add(new PMTiles(url));
    return `pmtiles://${url}`;
}
