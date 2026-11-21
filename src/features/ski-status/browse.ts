import { normalizeSearch } from '../../utils/search';
import { isSpecialtySkiing, passNames, skiAreaMapPoint, skiingSchema, type PassFamily, type SkiArea, type Skiing } from './catalog';
import {
    areaForecast, matchesOperatingStatus, openPercent, reportAgeLabel, reportStatusText, skiDayStatus, statusLabels,
    type Conditions, type ResortReport, type StatusFilter,
} from './conditions';
import { evaluatePass, matchesPassProduct, type PassProduct } from './passRules';
import { includesSeasonMonth, seasonViewDate, skiSeasonSchedule, typicalSkiSeason } from './seasons';
import { matchesSkiLocation, matchesSkiLocations, skiAreaCountries, skiCountryName, skiLocationParts, type SkiLocationFilters } from './skiGeography';

export type SkiUnits = 'imperial' | 'metric';
export type PassFilter = PassFamily | 'indy-discounts';

export const passFilterOptions: Record<PassFilter, string> = { ...passNames, 'indy-discounts': 'Indy discounts' };
export const passFilterKeys = Object.keys(passFilterOptions) as PassFilter[];

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

export type SkiResultsView = 'map' | 'results' | 'table';

export function readSkiResultsView(params: URLSearchParams): SkiResultsView {
    const view = params.get('view');
    return view === 'results' || view === 'table' ? view : 'map';
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

const seasonColumns = [
    { key: 'typicalOpening', label: 'Typical opening' },
    { key: 'typicalClosing', label: 'Typical closing' },
    { key: 'opensOn', label: 'Planned opening' },
    { key: 'plannedClosing', label: 'Planned closing' },
    { key: 'seasonWindow', label: 'Published season window' },
] as const;
export const columnGroups = [
    { label: 'Mountain statistics', columns: mountainColumns.slice(1) },
    { label: 'Conditions', columns: conditionColumns },
    { label: 'Season dates', columns: seasonColumns },
] as const;
const [nameColumn, regionColumn, ...additionalMountainColumns] = mountainColumns;
export const columns = [nameColumn, regionColumn, ...conditionColumns, ...seasonColumns, ...additionalMountainColumns] as const;
export type ColumnKey = typeof columns[number]['key'];
export type SkiSort = { key: ColumnKey; direction: 'asc' | 'desc' };

export const defaultSkiColumns: ColumnKey[] = [
    'name', 'region', 'acres', 'verticalFt', 'liftCount', 'trailCount', 'baseFt', 'summitFt',
    'operatingStatus', 'reportLifts', 'reportTrails', 'measuredSnow', 'forecastSnow', 'opensOn',
];

export function visibleSkiColumns(preference: unknown) {
    const keys = Array.isArray(preference) ? preference : defaultSkiColumns;
    return columns.filter(({ key }) => key === 'name' || keys.includes(key));
}

export function readSkiSort(params: URLSearchParams): SkiSort {
    const [key, direction] = (params.get('sort') ?? '').split(':');
    const column = columns.find(candidate => candidate.key === key);
    return { key: column?.key ?? 'name', direction: column && direction === 'desc' ? 'desc' : 'asc' };
}

export function readPassFilters(params: URLSearchParams, productFamily?: PassFamily): PassFilter[] {
    const selected = new Set(params.getAll('pass'));
    if (productFamily) selected.add(productFamily);
    return passFilterKeys.filter(pass => selected.has(pass));
}

function regionName(area: SkiArea) {
    if (area.otherCountries) return skiAreaCountries(area).map(skiCountryName).join(' / ');
    return area.region ?? skiCountryName(area.country);
}

export interface SkiPassSelection {
    passes?: readonly PassFilter[];
    product?: { pass: PassProduct; date?: string; now: number; homeAreaId?: string };
}

export function selectedSkiPasses({ passes = [], product }: SkiPassSelection = {}) {
    const family = product?.pass.family;
    return family && !passes.includes(family) ? [...passes, family] : passes;
}

interface SkiAreaFilters extends SkiPassSelection {
    query?: string;
    region?: string;
    locations?: SkiLocationFilters;
    night?: boolean;
    skiing?: SkiingFilter;
    operations?: { filter: StatusFilter; reports: Conditions['reports']; now: number };
    seasonMonth?: number;
}

export function matchesSkiPass(area: SkiArea, filter: PassFilter, product?: SkiPassSelection['product']) {
    if (filter === product?.pass.family) {
        const { status } = evaluatePass(product.pass, area, product.now, product.date, product.homeAreaId);
        return matchesPassProduct(status);
    }
    return area.passes.some(membership => matchesPassFilter(membership, filter));
}

export function filterSkiAreas(areas: readonly SkiArea[], {
    query = '', region, locations, passes = [], night, skiing, product, operations, seasonMonth,
}: SkiAreaFilters = {}) {
    const words = normalizeSearch(query).split(' ').filter(Boolean);
    const selectedPasses = selectedSkiPasses({ passes, product });
    return areas.filter(area => {
        if (region && !matchesSkiLocation(area, region)) return false;
        if (locations && !matchesSkiLocations(area, locations)) return false;
        if (selectedPasses.length && !selectedPasses.some(pass => matchesSkiPass(area, pass, product))) return false;
        if (night && area.nightSkiing !== true) return false;
        if (skiing && !matchesSkiingFilter(area.skiing, skiing)) return false;
        if (operations) {
            const status = skiDayStatus(operations.reports.get(area.id), operations.now, area.location.timeZone);
            if (!matchesOperatingStatus(status, operations.filter)) return false;
        }
        if (seasonMonth && !includesSeasonMonth(typicalSkiSeason(area), seasonMonth)) return false;
        if (!words.length) return true;
        const { regions, countries } = skiLocationParts(area);
        const searchable = normalizeSearch([
            area.name, area.locality, area.region, ...regions.map(place => place.label), ...skiAreaCountries(area),
            ...countries.map(place => place.label), skiingLabels[area.skiing], ...(area.aliases ?? []),
        ].join(' '));
        return words.every(word => searchable.includes(word));
    });
}

export function skiAreaBounds(areas: readonly SkiArea[]): [number, number, number, number] | undefined {
    if (!areas.length) return;
    const coordinates = areas.map(skiAreaMapPoint);
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

export function plannedOpening(area: SkiArea, conditions?: Conditions) {
    const date = seasonViewDate(area, conditions?.now);
    const { scheduled, reportedOpen } = skiSeasonSchedule(area, date, conditions);
    if (reportedOpen) return reportedOpen;
    if (scheduled?.opensOn) return { date: scheduled.opensOn, source: undefined };
}

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
        const status = skiDayStatus(report, conditions?.now ?? 0, area.location.timeZone);
        return status === 'unknown' ? undefined : statusLabels[status];
    }
    if (key === 'reportLifts') return report?.lifts?.open;
    if (key === 'reportTrails') return report?.trails?.open;
    if (key === 'reportAcres') return report?.acres?.open;
    if (key === 'trailsOpenPct') return openPercent(report?.trails);
    if (key === 'acresOpenPct') return openPercent(report?.acres);
    if (key === 'baseSnow') return Array.isArray(report?.baseCm) ? report.baseCm[0] : report?.baseCm;
    if (key === 'measuredSnow') return Array.isArray(report?.snowfallCm) ? report.snowfallCm[0] : report?.snowfallCm;
    if (key === 'opensOn') return plannedOpening(area, conditions)?.date;
    if (key === 'plannedClosing') {
        return skiSeasonSchedule(area, seasonViewDate(area, conditions?.now), conditions).scheduled?.closesOn;
    }
    if (key === 'typicalOpening' || key === 'typicalClosing') {
        const typical = typicalSkiSeason(area);
        return key === 'typicalOpening' ? typical?.openingRank : typical?.closingRank;
    }
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

export function snowDepthValue(cm: number, units: SkiUnits) {
    return units === 'metric' ? cm : cm / 2.54;
}

export function formatSnowDepth(cm: number | [number, number], units: SkiUnits) {
    const format = (value: number) => decimal.format(snowDepthValue(value, units));
    const value = Array.isArray(cm) ? cm.map(format).join('–') : format(cm);
    return `${value} ${units === 'metric' ? 'cm' : 'in'}`;
}

export function formatTemperature(celsius: number, units: SkiUnits) {
    return units === 'metric' ? `${integer.format(celsius)} °C` : `${integer.format(celsius * 1.8 + 32)} °F`;
}

function formatReportedTerrain(value: string, report: ResortReport | undefined, now: number, timeZone?: string) {
    const age = report && reportAgeLabel(report, now, timeZone);
    return age ? `${value} (${age})` : value;
}

export function formatSkiStat(area: SkiArea, key: ColumnKey, units: SkiUnits, conditions?: Conditions): string | undefined {
    const report = conditions?.reports.get(area.id);
    if (key === 'operatingStatus') return reportStatusText(report, conditions?.now ?? 0, area.location.timeZone);
    if (key === 'typicalOpening' || key === 'typicalClosing') {
        const typical = typicalSkiSeason(area);
        return key === 'typicalOpening' ? typical?.opening : typical?.closing;
    }
    if (key === 'baseSnow' && report?.baseCm !== undefined) return formatSnowDepth(report.baseCm, units);
    if (key === 'measuredSnow' && report?.snowfallCm !== undefined) {
        const period = report.snowfallHours ? `${report.snowfallHours} h` : report.snowfallOn;
        return `${formatSnowDepth(report.snowfallCm, units)} · ${period}`;
    }
    if (key === 'reportAcres' || key === 'reportLifts' || key === 'reportTrails') {
        const counts = key === 'reportLifts' ? report?.lifts : key === 'reportTrails' ? report?.trails : report?.acres;
        if (!counts) return;
        const format = (value: number | undefined) => value === undefined ? 'Unknown' :
            key === 'reportAcres' ? formatArea(value, units) : integer.format(value);
        return formatReportedTerrain(`${format(counts.open)} / ${format(counts.total)}`, report, conditions?.now ?? 0, area.location.timeZone);
    }
    const value = skiStat(area, key, conditions);
    if (value === undefined) return;
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key === 'acres') return formatArea(value, units, area.acresQualifier === 'lower-bound');
    if (key === 'nightAcres') return formatArea(value, units, area.nightAcresQualifier === 'lower-bound');
    if (key === 'guidedTerrainAcres') return formatArea(value, units);
    if (key === 'forecastSnow') return formatSnowDepth(value, units);
    if (key === 'forecastTemperature') return formatTemperature(value, units);
    if (key === 'trailsOpenPct' || key === 'acresOpenPct') {
        return formatReportedTerrain(`${decimal.format(value)}%`, report, conditions?.now ?? 0, area.location.timeZone);
    }
    if (key === 'forecastPrecipitation') return `${decimal.format(value)}%`;
    if (key.endsWith('Ft')) return formatElevation(value, units);
    if (key.endsWith('M')) return formatElevation(value / metersPerFoot, units);
    if (key.endsWith('Km')) {
        return units === 'metric' ? `${decimal.format(value)} km` : `${decimal.format(value / 1.609344)} mi`;
    }
    return `${integer.format(value)}${key === 'trailCount' && area.trailCountQualifier ? '+' : ''}`;
}
