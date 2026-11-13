import { MAPLIBRE_STYLESHEET, moduleLoader } from '../../navigation/moduleLoader';

export const loadPinsMap = moduleLoader(() => import('./PinsExplorer'), MAPLIBRE_STYLESHEET);
