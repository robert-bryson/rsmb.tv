import { containsPoint, type TooltipPoint, type TooltipRect } from '../../maps/screenGeometry';
import { normalizeSearch } from '../../utils/search';
import { passFamilySchema, passNames, type PassFamily, type SkiArea } from './catalog';

export type SkiUnits = 'imperial' | 'metric';
export type PassFilter = PassFamily | 'indy-discounts';

export const passFilterOptions: Record<PassFilter, string> = { ...passNames, 'indy-discounts': 'Indy discounts' };

export function passFilterFamily(pass: PassFilter): PassFamily {
    return pass === 'indy-discounts' ? 'indy' : pass;
}

export function matchesPassFilter(membership: SkiArea['passes'][number], pass: PassFilter) {
    return membership.family === passFilterFamily(pass) && membership.access === (pass === 'indy-discounts' ? 'discount' : 'included');
}

const skiingLabels: Record<SkiArea['skiing'], string> = {
    downhill: 'Downhill',
    'cross-country': 'Cross-country',
    both: 'Downhill and cross-country',
    'heli-skiing': 'Heli-skiing',
    indoor: 'Indoor training',
};

export const skiResultsViews = [
    { id: 'map', label: 'Map' },
    { id: 'split', label: 'Split' },
    { id: 'table', label: 'Table' },
] as const;
export type SkiResultsView = typeof skiResultsViews[number]['id'];

export function readSkiResultsView(params: URLSearchParams, wide: boolean): SkiResultsView {
    const view = params.get('view');
    return skiResultsViews.find(({ id }) => id === view)?.id ?? (wide ? 'split' : 'table');
}

export const columns = [
    { key: 'name', label: 'Ski area' },
    { key: 'region', label: 'Region' },
    { key: 'skiing', label: 'Skiing' },
    { key: 'acres', label: 'Skiable area' },
    { key: 'verticalFt', label: 'Vertical' },
    { key: 'liftCount', label: 'Lifts' },
    { key: 'trailCount', label: 'Trails' },
    { key: 'nightSkiing', label: 'Night skiing' },
    { key: 'nightAcres', label: 'Night area' },
    { key: 'terrainParks', label: 'Terrain parks' },
    { key: 'baseFt', label: 'Base' },
    { key: 'summitFt', label: 'Summit' },
    { key: 'lowestLiftTerminalFt', label: 'Lowest lift terminal' },
    { key: 'highestLiftTerminalFt', label: 'Highest lift terminal' },
] as const;

type ColumnKey = typeof columns[number]['key'];
export type SkiSort = { key: ColumnKey; direction: 'asc' | 'desc' };

export function readSkiSort(params: URLSearchParams): SkiSort {
    const [key, direction] = (params.get('sort') ?? '').split(':');
    const column = columns.find(candidate => candidate.key === key);
    return { key: column?.key ?? 'name', direction: column && direction === 'desc' ? 'desc' : 'asc' };
}

export function readPassFilter(params: URLSearchParams): PassFilter | undefined {
    const pass = params.get('pass');
    return pass === 'indy-discounts' ? pass : passFamilySchema.safeParse(pass).data;
}

const countryNames = new Intl.DisplayNames('en', { type: 'region' });
const countryPrefix = 'country:';

function countryName(country: string) {
    return countryNames.of(country) ?? country;
}

function areaCountries(area: SkiArea) {
    return [area.country, ...(area.otherCountries ?? [])];
}

function regionName(area: SkiArea) {
    if (area.otherCountries) return areaCountries(area).map(countryName).join(' / ');
    return area.region ?? countryName(area.country);
}

export function formatSkiLocation(area: SkiArea) {
    return `${area.locality}, ${regionName(area).replace(/\s*\/\s*/g, ' / ')}`;
}

export function skiRegionOptions(areas: readonly SkiArea[]) {
    const countries = [...new Set(areas.flatMap(areaCountries))].map(code => ({ value: `${countryPrefix}${code}`, label: countryName(code) }));
    const regions = [...new Set(areas.flatMap(area => area.region?.split('/') ?? []))].sort();
    return { countries: countries.sort((first, second) => first.label.localeCompare(second.label)), regions };
}

export function filterSkiAreas(areas: readonly SkiArea[], query: string, region: string, pass?: PassFilter, night?: boolean) {
    const words = normalizeSearch(query).split(' ').filter(Boolean);
    const country = region.startsWith(countryPrefix) ? region.slice(countryPrefix.length) : '';
    return areas.filter(area => {
        if (country ? !areaCountries(area).includes(country) : region && !area.region?.split('/').includes(region)) return false;
        if (pass && !area.passes.some(membership => matchesPassFilter(membership, pass))) return false;
        if (night && area.nightSkiing !== true) return false;
        if (!words.length) return true;
        const countries = areaCountries(area);
        const searchable = normalizeSearch([
            area.name, area.locality, area.region, ...countries, ...countries.map(countryName), skiingLabels[area.skiing], ...(area.aliases ?? []),
        ].join(' '));
        return words.every(word => searchable.includes(word));
    });
}

export function skiAreaIdsInViewport(
    areas: readonly SkiArea[],
    viewport: TooltipRect,
    project: (coordinates: SkiArea['location']['coordinates']) => TooltipPoint | undefined,
): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const area of areas) {
        const point = project(area.location.coordinates);
        if (point && containsPoint(viewport, point)) ids.add(area.id);
    }
    return ids;
}

export function skiAreaBounds(areas: readonly SkiArea[]): [number, number, number, number] | undefined {
    if (!areas.length) return;
    const coordinates = areas.map(area => area.location.coordinates);
    const longitudes = coordinates.map(([longitude]) => longitude).sort((a, b) => a - b);
    const latitudes = coordinates.map(([, latitude]) => latitude);
    let west = longitudes[0];
    let east = longitudes[longitudes.length - 1];
    let largestGap = west + 360 - east;
    // Leave the largest gap outside the bounds, including the gap that crosses the date line.
    for (let index = 1; index < longitudes.length; index++) {
        const gap = longitudes[index] - longitudes[index - 1];
        if (gap <= largestGap) continue;
        largestGap = gap;
        west = longitudes[index];
        east = longitudes[index - 1] + 360;
    }
    return [west, Math.min(...latitudes), east, Math.max(...latitudes)];
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function skiStat(area: SkiArea, key: ColumnKey) {
    if (key === 'region') return regionName(area);
    if (key === 'skiing') return skiingLabels[area.skiing];
    return area[key];
}

export function sortSkiAreas(areas: readonly SkiArea[], sort: SkiSort) {
    return [...areas].sort((first, second) => {
        const a = skiStat(first, sort.key);
        const b = skiStat(second, sort.key);
        if (a === undefined && b !== undefined) return 1;
        if (b === undefined && a !== undefined) return -1;
        const comparison = typeof a === 'string' && typeof b === 'string' ? collator.compare(a, b)
            : a !== undefined && b !== undefined ? Number(a) - Number(b) : 0;
        return comparison * (sort.direction === 'asc' ? 1 : -1) || collator.compare(first.name, second.name);
    });
}

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const areaNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function formatArea(acres: number, units: SkiUnits, lowerBound = false) {
    const value = units === 'metric' ? acres * 0.40468564224 : acres;
    const shown = lowerBound ? Math.floor(value * 10) / 10 : value;
    return `${areaNumber.format(shown)}${lowerBound ? '+' : ''} ${units === 'metric' ? 'ha' : 'ac'}`;
}

export function formatElevation(feet: number, units: SkiUnits) {
    return units === 'metric' ? `${integer.format(feet * 0.3048)} m` : `${integer.format(feet)} ft`;
}

export function formatSkiStat(area: SkiArea, key: ColumnKey, units: SkiUnits): string | undefined {
    const value = skiStat(area, key);
    if (value === undefined) return;
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key === 'acres' || key === 'nightAcres') {
        return formatArea(value, units, key === 'acres' && area.acresQualifier === 'lower-bound');
    }
    if (key.endsWith('Ft')) return formatElevation(value, units);
    return `${integer.format(value)}${key === 'trailCount' && area.trailCountQualifier ? '+' : ''}`;
}
