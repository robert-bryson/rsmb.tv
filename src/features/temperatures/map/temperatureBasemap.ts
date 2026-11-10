import type { Map } from '../../../maps/maplibre';
import { cartoRasterStyle } from '../../../maps/cartoBasemaps';
import { recoverBasemap, type BasemapState } from '../../../maps/recoverBasemap';

const DATA_SOURCES = new Set([
    'state-records', 'county-records', 'county-labels-source', 'broken-records', 'freshness-records', 'state-detail-records',
]);

export function recoverTemperatureBasemap(map: Map, onState: (state: BasemapState) => void) {
    return recoverBasemap(map, {
        dataSources: DATA_SOURCES,
        providerStyle: () => cartoRasterStyle('dark'),
        neutralStyle: () => cartoRasterStyle('dark', ''),
    }, onState);
}
