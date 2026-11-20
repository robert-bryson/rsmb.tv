import { containsPoint, type TooltipPoint, type TooltipRect } from '../../maps/screenGeometry';
import { normalizeSearch } from '../../utils/search';
import { isSpecialtySkiing, passFamilySchema, passNames, skiingSchema, type PassFamily, type SkiArea, type Skiing } from './catalog';
import { areaForecast, openPercent, reportStatus, reportStatusText, statusLabels, type Conditions } from './conditions';
import { evaluatePass, matchesPassProduct, type PassProduct } from './passRules';

export type SkiUnits = 'imperial' | 'metric';
export type PassFilter = PassFamily | 'indy-discounts';

export const passFilterOptions: Record<PassFilter, string> = { ...passNames, 'indy-discounts': 'Indy discounts' };

export function passFilterFamily(pass: PassFilter): PassFamily {
    return pass === 'indy-discounts' ? 'indy' : pass;
}

export function matchesPassFilter(membership: SkiArea['passes'][number], pass: PassFilter) {
    return membership.family === passFilterFamily(pass) && membership.access === (pass === 'indy-discounts' ? 'discount' : 'included');
}

const skiingLabels: Record<Skiing, string> = {
    downhill: 'Downhill',
    both: 'Downhill and cross-country',
    'cross-country': 'Cross-country',
    indoor: 'Indoor',
    'heli-skiing': 'Heli-skiing',
    'cat-skiing': 'Cat-skiing',
    'ski-touring': 'Ski touring',
    'dry-slope': 'Dry slope',
    freeride: 'Lift-served freeride',
};

type SkiingFilter = Skiing | 'specialty';
export const skiingFilterOptions: Record<SkiingFilter, string> = {
    specialty: 'Specialty skiing',
    ...skiingLabels,
    downhill: 'Conventional downhill',
    'cross-country': 'Cross-country only',
};

export function readSkiingFilter(params: URLSearchParams): SkiingFilter | undefined {
    const skiing = params.get('skiing');
    return skiing === 'specialty' ? skiing : skiingSchema.safeParse(skiing).data;
}

function matchesSkiingFilter(skiing: Skiing, filter: SkiingFilter) {
    if (filter === 'specialty') return isSpecialtySkiing(skiing);
    if (filter === 'downhill') return !isSpecialtySkiing(skiing);
    return skiing === filter;
}

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

export const mountainColumns = [
    { key: 'name', label: 'Ski area' },
    { key: 'region', label: 'Region' },
    { key: 'skiing', label: 'Skiing' },
    { key: 'acres', label: 'Skiable area' },
    { key: 'guidedTerrainAcres', label: 'Guided terrain' },
    { key: 'verticalFt', label: 'Vertical' },
    { key: 'liftCount', label: 'Lifts' },
    { key: 'trailCount', label: 'Trails' },
    { key: 'downhillKm', label: 'Downhill trail length' },
    { key: 'nordicKm', label: 'Nordic trail length' },
    { key: 'nightSkiing', label: 'Night skiing' },
    { key: 'nightAcres', label: 'Night area' },
    { key: 'terrainParks', label: 'Terrain parks' },
    { key: 'baseFt', label: 'Base' },
    { key: 'summitFt', label: 'Summit' },
    { key: 'lowestLiftTerminalFt', label: 'Lowest lift terminal' },
    { key: 'highestLiftTerminalFt', label: 'Highest lift terminal' },
    { key: 'mappedLifts', label: 'Mapped lifts' },
    { key: 'mappedDownhillKm', label: 'Mapped downhill' },
    { key: 'mappedNordicKm', label: 'Mapped Nordic' },
    { key: 'mappedNamedDownhillRuns', label: 'Mapped downhill names' },
    { key: 'mappedNamedNordicTrails', label: 'Mapped Nordic names' },
    { key: 'mappedLowM', label: 'Mapped low point' },
    { key: 'mappedHighM', label: 'Mapped high point' },
    { key: 'mappedElevationSpanM', label: 'Mapped elevation span' },
] as const;

export const conditionColumns = [
    { key: 'operatingStatus', label: 'Operating status' },
    { key: 'reportLifts', label: 'Lifts open / total' },
    { key: 'reportTrails', label: 'Trails open / total' },
    { key: 'reportAcres', label: 'Area open / total' },
    { key: 'trailsOpenPct', label: 'Trails open %' },
    { key: 'acresOpenPct', label: 'Acres open %' },
    { key: 'baseSnow', label: 'Base snow depth' },
    { key: 'measuredSnow', label: 'Reported new snow' },
    { key: 'forecastSnow', label: 'Forecast snow' },
    { key: 'forecastTemperature', label: 'Forecast start temperature' },
    { key: 'forecastPrecipitation', label: 'Peak hourly precipitation chance' },
] as const;

const seasonColumns = [{ key: 'seasonWindow', label: 'Season window' }, { key: 'opensOn', label: 'Planned opening' }] as const;
export const columnGroups = [
    { label: 'Mountain statistics', columns: mountainColumns.slice(1) },
    { label: 'Conditions', columns: conditionColumns },
    { label: 'Season dates', columns: seasonColumns },
] as const;
export const columns = [...mountainColumns, ...conditionColumns, ...seasonColumns] as const;
export type ColumnKey = typeof columns[number]['key'];
export type SkiSort = { key: ColumnKey; direction: 'asc' | 'desc' };

export const defaultSkiColumns: ColumnKey[] = [...mountainColumns.map(({ key }) => key), 'operatingStatus', 'measuredSnow', 'forecastSnow', 'seasonWindow'];

export function visibleSkiColumns(preference: unknown) {
    const keys = Array.isArray(preference) ? preference : defaultSkiColumns;
    return columns.filter(({ key }) => key === 'name' || keys.includes(key));
}

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

interface SkiAreaFilters {
    query?: string;
    region?: string;
    pass?: PassFilter;
    night?: boolean;
    skiing?: SkiingFilter;
    product?: { pass: PassProduct; date?: string; now: number; homeAreaId?: string };
}

export function filterSkiAreas(areas: readonly SkiArea[], { query = '', region = '', pass, night, skiing, product }: SkiAreaFilters = {}) {
    const words = normalizeSearch(query).split(' ').filter(Boolean);
    const country = region.startsWith(countryPrefix) ? region.slice(countryPrefix.length) : '';
    return areas.filter(area => {
        if (country ? !areaCountries(area).includes(country) : region && !area.region?.split('/').includes(region)) return false;
        if (product) {
            const { status } = evaluatePass(product.pass, area, product.now, product.date, product.homeAreaId);
            if (!matchesPassProduct(status)) return false;
        } else if (pass && !area.passes.some(membership => matchesPassFilter(membership, pass))) return false;
        if (night && area.nightSkiing !== true) return false;
        if (skiing && !matchesSkiingFilter(area.skiing, skiing)) return false;
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

function skiStat(area: SkiArea, key: ColumnKey, conditions?: Conditions) {
    if (key === 'region') return regionName(area);
    if (key === 'skiing') return skiingLabels[area.skiing];
    const mapped = area.location.mappedTerrain;
    if (key === 'mappedLifts') return mapped?.lifts;
    if (key === 'mappedDownhillKm') return mapped?.downhillKm;
    if (key === 'mappedNordicKm') return mapped?.nordicKm;
    if (key === 'mappedNamedDownhillRuns') return mapped?.namedDownhillRuns;
    if (key === 'mappedNamedNordicTrails') return mapped?.namedNordicTrails;
    if (key === 'mappedLowM') return mapped?.elevationM?.[0];
    if (key === 'mappedHighM') return mapped?.elevationM?.[1];
    if (key === 'mappedElevationSpanM') return mapped?.elevationM && mapped.elevationM[1] - mapped.elevationM[0];
    if (key === 'forecastSnow') return areaForecast(conditions, area.id)?.snowfallCm;
    if (key === 'forecastTemperature') return areaForecast(conditions, area.id)?.temperatureC;
    if (key === 'forecastPrecipitation') return areaForecast(conditions, area.id)?.precipitationPct;
    const report = conditions?.reports.get(area.id);
    if (key === 'operatingStatus') {
        const status = reportStatus(report, conditions?.now ?? 0);
        return status === 'unknown' ? undefined : statusLabels[status];
    }
    if (key === 'reportLifts') return report?.lifts?.open;
    if (key === 'reportTrails') return report?.trails?.open;
    if (key === 'reportAcres') return report?.acres?.open;
    if (key === 'trailsOpenPct') return openPercent(report?.trails);
    if (key === 'acresOpenPct') return openPercent(report?.acres);
    if (key === 'baseSnow') return Array.isArray(report?.baseCm) ? report.baseCm[0] : report?.baseCm;
    if (key === 'measuredSnow') return Array.isArray(report?.snowfallCm) ? report.snowfallCm[0] : report?.snowfallCm;
    if (key === 'opensOn') return report?.opensOn;
    return area[key];
}

export function sortSkiAreas(areas: readonly SkiArea[], sort: SkiSort, conditions?: Conditions) {
    return [...areas].sort((first, second) => {
        const a = skiStat(first, sort.key, conditions);
        const b = skiStat(second, sort.key, conditions);
        if (a === undefined && b !== undefined) return 1;
        if (b === undefined && a !== undefined) return -1;
        const comparison = typeof a === 'string' && typeof b === 'string' ? collator.compare(a, b)
            : a !== undefined && b !== undefined ? Number(a) - Number(b) : 0;
        return comparison * (sort.direction === 'asc' ? 1 : -1) || collator.compare(first.name, second.name);
    });
}

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const metersPerFoot = 0.3048;

export function formatArea(acres: number, units: SkiUnits, lowerBound = false) {
    const value = units === 'metric' ? acres * 0.40468564224 : acres;
    const shown = lowerBound ? Math.floor(value * 10) / 10 : value;
    return `${decimal.format(shown)}${lowerBound ? '+' : ''} ${units === 'metric' ? 'ha' : 'ac'}`;
}

export function formatElevation(feet: number, units: SkiUnits) {
    return units === 'metric' ? `${integer.format(feet * metersPerFoot)} m` : `${integer.format(feet)} ft`;
}

function snowDepth(cm: number | [number, number], units: SkiUnits) {
    const format = (value: number) => decimal.format(units === 'metric' ? value : value / 2.54);
    const value = Array.isArray(cm) ? cm.map(format).join('–') : format(cm);
    return `${value} ${units === 'metric' ? 'cm' : 'in'}`;
}

export function formatSkiStat(area: SkiArea, key: ColumnKey, units: SkiUnits, conditions?: Conditions): string | undefined {
    const report = conditions?.reports.get(area.id);
    if (key === 'operatingStatus') return reportStatusText(report, conditions?.now ?? 0);
    if (key === 'baseSnow' && report?.baseCm !== undefined) return snowDepth(report.baseCm, units);
    if (key === 'measuredSnow' && report?.snowfallCm !== undefined) {
        const period = report.snowfallHours ? `${report.snowfallHours} h` : report.snowfallOn;
        return `${snowDepth(report.snowfallCm, units)} · ${period}`;
    }
    if (key === 'reportAcres' || key === 'reportLifts' || key === 'reportTrails') {
        const counts = key === 'reportLifts' ? report?.lifts : key === 'reportTrails' ? report?.trails : report?.acres;
        if (!counts) return;
        const format = (value: number | undefined) => value === undefined ? 'Unknown' :
            key === 'reportAcres' ? formatArea(value, units) : integer.format(value);
        return `${format(counts.open)} / ${format(counts.total)}`;
    }
    const value = skiStat(area, key, conditions);
    if (value === undefined) return;
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key === 'acres') return formatArea(value, units, area.acresQualifier === 'lower-bound');
    if (key === 'nightAcres') return formatArea(value, units, area.nightAcresQualifier === 'lower-bound');
    if (key === 'guidedTerrainAcres') return formatArea(value, units);
    if (key === 'forecastSnow') return snowDepth(value, units);
    if (key === 'forecastTemperature') return units === 'metric' ? `${integer.format(value)} °C` : `${integer.format(value * 1.8 + 32)} °F`;
    if (key === 'forecastPrecipitation' || key.endsWith('Pct')) return `${decimal.format(value)}%`;
    if (key.endsWith('Ft')) return formatElevation(value, units);
    if (key.endsWith('M')) return formatElevation(value / metersPerFoot, units);
    if (key.endsWith('Km')) {
        return units === 'metric' ? `${decimal.format(value)} km` : `${decimal.format(value / 1.609344)} mi`;
    }
    return `${integer.format(value)}${key === 'trailCount' && area.trailCountQualifier ? '+' : ''}`;
}
