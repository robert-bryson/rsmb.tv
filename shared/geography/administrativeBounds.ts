import data from './administrativeBounds.json';
import { atlasGeographyName } from '../atlasGeography';

export type GeographicBounds = [number, number, number, number];

export function administrativeBounds({ country, region }: { country: string; region?: string }): GeographicBounds | undefined {
    const countries: Readonly<Record<string, number[]>> = data.countries;
    const regions: Readonly<Record<string, number[]>> = data.regions;
    const name = region && atlasGeographyName(region);
    const records = name ? regions : countries;
    const key = name ? `${country}/${name}` : country;
    if (Object.hasOwn(records, key)) {
        const bounds = records[key];
        return [bounds[0], bounds[1], bounds[2], bounds[3]];
    }
}
