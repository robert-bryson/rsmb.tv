import { mapCameraCodec } from '../../../maps/mapCamera';
import type { AtlasPanelState, AtlasResultsView } from './tripAtlasBrowser';

export const { encode: encodeAtlasCamera, read: readAtlasCamera } = mapCameraCodec(-2, 22);

export function readAtlasPresentation(params: URLSearchParams): { panel?: AtlasPanelState; results?: AtlasResultsView } {
    const panel = params.get('panel');
    const results = params.get('results');
    return {
        panel: panel === 'collapsed' || panel === 'compact' || panel === 'expanded' ? panel : undefined,
        results: results === 'cards' || results === 'table' ? results : undefined,
    };
}
