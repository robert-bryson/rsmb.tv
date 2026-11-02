import data from './atlasGeographyBounds.json';
import { atlasGeographyName } from '../../../../shared/atlasGeography';
import { atlasRegionKey, type AtlasFilters } from './tripAtlasBrowser';

export interface AtlasLocation { country: string; region?: string }
export type AtlasBounds = [number, number, number, number];

/** Name normalization applies to map lookup only; filter keys retain the authored region. */
export function atlasLocationBounds(location: AtlasLocation): AtlasBounds | undefined {
    const countries: Record<string, number[]> = data.countries;
    const regions: Record<string, number[]> = data.regions;
    const name = location.region && atlasGeographyName(location.region);
    const result = name ? regions[`${location.country}/${name}`] : countries[location.country];
    return result ? [result[0], result[1], result[2], result[3]] : undefined;
}

export function atlasLocationFilters(filters: AtlasFilters, location: AtlasLocation): AtlasFilters {
    return { ...filters, countries: location.region ? [] : [location.country],
        regions: location.region ? [atlasRegionKey(location.country, location.region)] : [] };
}
