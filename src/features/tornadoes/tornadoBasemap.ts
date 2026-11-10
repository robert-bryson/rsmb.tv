import type { Map } from '../../maps/maplibre';
import { cartoRasterStyle, cartoVectorStyle } from '../../maps/cartoBasemaps';
import { BASEMAP_TIMEOUT_MS, recoverBasemap, type BasemapState } from '../../maps/recoverBasemap';

export type TornadoBasemapState = BasemapState;
export const TORNADO_BASEMAP_TIMEOUT_MS = BASEMAP_TIMEOUT_MS;

const DATA_SOURCES = new Set([
    'tornado-tracks', 'tornado-track-points', 'tornado-points', 'selected-tornado-track', 'us-states',
]);

export function recoverTornadoBasemap(map: Map, onState: (state: TornadoBasemapState) => void) {
    return recoverBasemap(map, {
        dataSources: DATA_SOURCES,
        providerStyle: () => cartoVectorStyle('dark-matter'),
        neutralStyle: () => cartoRasterStyle('dark', ''),
    }, onState);
}
