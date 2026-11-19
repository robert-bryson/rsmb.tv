import { normalizeSearch } from '../../utils/search';
import { passFamilySchema, type PassFamily, type SkiArea } from './catalog';

export type SkiUnits = 'imperial' | 'metric';

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
    { key: 'acres', label: 'Skiable area' },
    { key: 'verticalFt', label: 'Vertical' },
    { key: 'liftCount', label: 'Lifts' },
    { key: 'trailCount', label: 'Trails' },
    { key: 'nightSkiing', label: 'Night skiing' },
    { key: 'nightAcres', label: 'Night area' },
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

export function readPassFilter(params: URLSearchParams): PassFamily | undefined {
    return passFamilySchema.safeParse(params.get('pass')).data;
}

const countryNames = new Intl.DisplayNames('en', { type: 'region' });

export function filterSkiAreas(areas: readonly SkiArea[], query: string, region: string, pass?: PassFamily, night?: boolean) {
    const words = normalizeSearch(query).split(' ').filter(Boolean);
    return areas.filter(area => {
        if (region && !area.region.split('/').includes(region)) return false;
        if (pass && !area.passes.some(membership => membership.family === pass && membership.access === 'included')) return false;
        if (night && area.nightSkiing !== true) return false;
        if (!words.length) return true;
        const searchable = normalizeSearch([area.name, area.locality, area.region, area.country, countryNames.of(area.country), ...(area.aliases ?? [])].join(' '));
        return words.every(word => searchable.includes(word));
    });
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function sortSkiAreas(areas: readonly SkiArea[], sort: SkiSort) {
    return [...areas].sort((first, second) => {
        const a = first[sort.key];
        const b = second[sort.key];
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
    const value = area[key];
    if (value === undefined) return;
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key === 'acres' || key === 'nightAcres') {
        return formatArea(value, units, key === 'acres' && area.acresQualifier === 'lower-bound');
    }
    if (key.endsWith('Ft')) return formatElevation(value, units);
    return `${integer.format(value)}${key === 'trailCount' && area.trailCountQualifier ? '+' : ''}`;
}
