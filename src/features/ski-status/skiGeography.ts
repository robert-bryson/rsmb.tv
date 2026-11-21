import countryContinents from '../../../projects/ski-status/data/country-continents.json';
import { usStatesAndTerritories } from '../../../shared/geography/usStates';
import type { SkiArea } from './catalog';

type LocationArea = Pick<SkiArea, 'country' | 'otherCountries' | 'locality' | 'region'>;

export interface SkiPlace {
    value: string;
    label: string;
}

export interface SkiLocationFilters {
    include: readonly string[];
    exclude: readonly string[];
}

const countryNames = new Intl.DisplayNames('en', { type: 'region' });
const continents: Readonly<Record<string, string | undefined>> = countryContinents;
const regionNames: Readonly<Record<string, Readonly<Record<string, string>> | undefined>> = {
    US: Object.fromEntries(usStatesAndTerritories.map(({ abbr, name }) => [abbr, name])),
    CA: {
        AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador',
        NS: 'Nova Scotia', NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island',
        QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon',
    },
};

export function skiCountryName(code: string) {
    return countryNames.of(code) ?? code;
}

export function skiRegionName(country: string, code: string) {
    return regionNames[country]?.[code] ?? code;
}

export function skiAreaCountries(area: LocationArea) {
    return [area.country, ...(area.otherCountries ?? [])];
}

function skiAreaRegions(area: LocationArea) {
    return area.region?.split('/') ?? [];
}

export function skiLocationParts(area: LocationArea) {
    return {
        regions: skiAreaRegions(area).map(code => ({ value: `region:${area.country}:${code}`, label: skiRegionName(area.country, code), text: code })),
        countries: skiAreaCountries(area).map(code => {
            const label = skiCountryName(code);
            return { value: `country:${code}`, label, text: label };
        }),
    };
}

export function formatSkiLocation(area: LocationArea) {
    const { regions, countries } = skiLocationParts(area);
    return [area.locality, regions.map(({ text }) => text).join(' / '), countries.map(({ text }) => text).join(' / ')].filter(Boolean).join(', ');
}

export function skiLocationOptions(areas: readonly LocationArea[]) {
    const regions = new Map<string, SkiPlace>();
    const countries = new Map<string, SkiPlace>();
    const continentOptions = new Map<string, SkiPlace>();
    for (const area of areas) {
        for (const place of skiLocationParts(area).regions) regions.set(place.value, place);
        for (const code of skiAreaCountries(area)) {
            const country = `country:${code}`;
            countries.set(country, { value: country, label: skiCountryName(code) });
            const continent = continents[code];
            if (continent) {
                const value = `continent:${continent}`;
                continentOptions.set(value, { value, label: continent });
            }
        }
    }
    const alphabetical = (options: Map<string, SkiPlace>) => [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
    return [
        { label: 'Continents', options: alphabetical(continentOptions) },
        { label: 'Countries', options: alphabetical(countries) },
        { label: 'States and provinces', options: alphabetical(regions) },
    ];
}

export function matchesSkiLocation(area: LocationArea, place: string) {
    const [kind, country, code] = place.split(':');
    switch (kind) {
        case 'continent': return skiAreaCountries(area).some(code => continents[code] === country);
        case 'country': return skiAreaCountries(area).includes(country);
        case 'region': return area.country === country && skiAreaRegions(area).includes(code);
        default: return skiAreaRegions(area).includes(place); // Legacy state and province codes.
    }
}

export function matchesSkiLocations(area: LocationArea, { include, exclude }: SkiLocationFilters) {
    return (!include.length || include.some(place => matchesSkiLocation(area, place)))
        && !exclude.some(place => matchesSkiLocation(area, place));
}
