import { MAPLIBRE_STYLESHEET, moduleLoader } from '../../../navigation/moduleLoader';

export const loadTripAtlasMap = moduleLoader(() => import('./TripAtlasMap'), MAPLIBRE_STYLESHEET);
