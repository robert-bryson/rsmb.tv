import { atlasRegionKey, type AtlasFilters } from './tripAtlasBrowser';

export interface AtlasLocation { country: string; region?: string }
export { administrativeBounds as atlasLocationBounds, type GeographicBounds as AtlasBounds } from '../../../../shared/geography/administrativeBounds';

export function atlasLocationFilters(filters: AtlasFilters, location: AtlasLocation): AtlasFilters {
    return { ...filters, countries: location.region ? [] : [location.country],
        regions: location.region ? [atlasRegionKey(location.country, location.region)] : [] };
}
