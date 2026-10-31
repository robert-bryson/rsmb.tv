import { getAllBlogRegions, getCountryName, separatePostGeography } from '../../../content/blogRegions';
import { tripFactTag } from '../../../content/blogTags';
import type { TripAtlasEntry } from './tripAtlasEntries';

export const atlasSortOptions = [
    { value: 'newest', label: 'Trip date · newest first' },
    { value: 'oldest', label: 'Trip date · oldest first' },
    { value: 'days-desc', label: 'Riding days · most first' },
    { value: 'days-asc', label: 'Riding days · fewest first' },
    { value: 'miles-desc', label: 'Miles · longest first' },
    { value: 'miles-asc', label: 'Miles · shortest first' },
    { value: 'location-asc', label: 'Location · A–Z' },
    { value: 'location-desc', label: 'Location · Z–A' },
    { value: 'title-asc', label: 'Trip title · A–Z' },
    { value: 'title-desc', label: 'Trip title · Z–A' },
] as const;
export type AtlasSort = typeof atlasSortOptions[number]['value'];
export type AtlasPanelState = 'collapsed' | 'compact' | 'expanded';
export type AtlasResultsView = 'cards' | 'table';
export const atlasRangeKeys = ['from', 'to', 'daysMin', 'daysMax', 'milesMin', 'milesMax'] as const;
const atlasBrowseKeys = [...atlasRangeKeys, 'country', 'region', 'sort'] as const;
export interface AtlasFilters {
    from: string;
    to: string;
    daysMin: string;
    daysMax: string;
    milesMin: string;
    milesMax: string;
    countries: string[];
    regions: string[];
}
export interface AtlasFilterIssue { field: keyof AtlasFilters; message: string }

export function emptyAtlasFilters(): AtlasFilters {
    return { from: '', to: '', daysMin: '', daysMax: '', milesMin: '', milesMax: '', countries: [], regions: [] };
}

/** Camera and panel updates must not replace the map's result and geometry objects. */
export function atlasBrowseQuery(params: URLSearchParams): string {
    const query = new URLSearchParams();
    for (const key of atlasBrowseKeys) for (const value of params.getAll(key)) query.append(key, value);
    return query.toString();
}

export function readAtlasBrowse(params: URLSearchParams): { filters: AtlasFilters; sort: AtlasSort } {
    const filters = emptyAtlasFilters();
    for (const key of atlasRangeKeys) filters[key] = (params.get(key) ?? '').trim();
    filters.countries = [...new Set(params.getAll('country').map(value => value.trim().toUpperCase()).filter(Boolean))].sort();
    filters.regions = [...new Set(params.getAll('region').map(value => {
        const parts = value.trim().split('/');
        return parts.length === 2 ? atlasRegionKey(parts[0].toUpperCase(), parts[1]) : value.trim();
    }).filter(Boolean))].filter(key => !filters.countries.includes(key.split('/')[0])).sort();
    const sort = atlasSortOptions.find(option => option.value === params.get('sort'))?.value ?? 'newest';
    return { filters, sort };
}

export function writeAtlasBrowse(params: URLSearchParams, filters: AtlasFilters, sort: AtlasSort): URLSearchParams {
    const next = new URLSearchParams(params);
    for (const key of atlasBrowseKeys) next.delete(key);
    for (const key of atlasRangeKeys) if (filters[key].trim()) next.set(key, filters[key].trim());
    for (const code of [...new Set(filters.countries)].sort()) next.append('country', code);
    for (const key of [...new Set(filters.regions)].filter(key => !filters.countries.includes(key.split('/')[0])).sort()) next.append('region', key);
    if (sort !== 'newest') next.set('sort', sort);
    return next;
}

export function validateAtlasFilters(filters: AtlasFilters): AtlasFilterIssue[] {
    const issues: AtlasFilterIssue[] = [];
    for (const field of ['from', 'to'] as const) {
        const value = filters[field];
        const date = new Date(`${value}T00:00:00Z`);
        if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)) {
            issues.push({ field, message: 'Enter a valid calendar date.' });
        }
    }
    if (!issues.length && filters.from && filters.to && filters.from > filters.to) issues.push({ field: 'to', message: 'The end date must be on or after the start date.' });
    for (const [min, max, label, whole] of [
        ['daysMin', 'daysMax', 'Riding days', true], ['milesMin', 'milesMax', 'Miles', false],
    ] as const) {
        for (const field of [min, max]) {
            const value = Number(filters[field]);
            if (filters[field] && (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(filters[field]) || !Number.isFinite(value) || value < 0 || (whole && !Number.isSafeInteger(value)))) {
                issues.push({ field, message: `${label} must be ${whole ? 'a whole number' : 'a number'} of zero or more.` });
            }
        }
        if (!issues.some(issue => issue.field === min || issue.field === max) && filters[min] && filters[max] && Number(filters[min]) > Number(filters[max])) {
            issues.push({ field: max, message: `${label}: maximum must be at least the minimum.` });
        }
    }
    if (filters.countries.some(code => !/^[A-Z]{2}$/.test(code))) issues.push({ field: 'countries', message: 'Country filters must use two-letter country codes.' });
    if (filters.regions.some(key => !/^(?:[A-Z]{2})?\/[^/\s]+$/.test(key))) issues.push({ field: 'regions', message: 'Choose a region within its country.' });
    return issues;
}

export function atlasLocations(entry: TripAtlasEntry) {
    return separatePostGeography([], entry.summary?.countries ?? entry.countries ?? [], entry.summary?.regions ?? []).countries;
}

export function atlasLocationCatalog(entries: readonly TripAtlasEntry[]) {
    return getAllBlogRegions(entries.map(entry => ({ countries: atlasLocations(entry) })))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(country => ({ ...country, regions: [...country.regions].sort((a, b) => a.name.localeCompare(b.name)) }));
}

export function atlasRegionKey(code: string, region: string) { return `${code}/${tripFactTag(region)}`; }

export function atlasLocationLabel(entry: TripAtlasEntry) {
    return atlasLocations(entry).map(country => [getCountryName(country.code), ...[...country.regions].sort()].join(' · ')).sort().join('; ');
}

export function atlasFilterCount(filters: AtlasFilters) {
    return atlasRangeKeys.filter(key => filters[key]).length + filters.countries.length + filters.regions.length;
}

export function filterAtlasEntries(entries: readonly TripAtlasEntry[], filters: AtlasFilters): TripAtlasEntry[] {
    if (validateAtlasFilters(filters).length) return [];
    return entries.filter(entry => {
        const summary = entry.summary;
        if (filters.from && (!summary || summary.dates.end < filters.from)) return false;
        if (filters.to && (!summary || summary.dates.start > filters.to)) return false;
        for (const [value, min, max] of [
            [summary?.ridingDays, filters.daysMin, filters.daysMax], [summary?.distanceMiles, filters.milesMin, filters.milesMax],
        ] as const) {
            if ((min || max) && (value === undefined || (min && value < Number(min)) || (max && value > Number(max)))) return false;
        }
        if (filters.countries.length || filters.regions.length) {
            return atlasLocations(entry).some(country => filters.countries.includes(country.code)
                || country.regions.some(region => filters.regions.includes(atlasRegionKey(country.code, region))));
        }
        return true;
    });
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function sortAtlasEntries(entries: readonly TripAtlasEntry[], sort: AtlasSort): TripAtlasEntry[] {
    const descending = sort === 'newest' || sort.endsWith('-desc');
    const value = (entry: TripAtlasEntry): number | string | undefined => {
        if (sort === 'newest' || sort === 'oldest') return entry.summary?.dates.start;
        if (sort.startsWith('days-')) return entry.summary?.ridingDays;
        if (sort.startsWith('miles-')) return entry.summary?.distanceMiles;
        if (sort.startsWith('location-')) return atlasLocationLabel(entry) || undefined;
        return entry.title;
    };
    return [...entries].sort((a, b) => {
        const first = value(a);
        const second = value(b);
        if (first === undefined && second !== undefined) return 1;
        if (second === undefined && first !== undefined) return -1;
        const order = typeof first === 'number' && typeof second === 'number' ? first - second
            : first !== undefined && second !== undefined ? collator.compare(String(first), String(second)) : 0;
        return (descending ? -order : order) || collator.compare(a.title, b.title) || a.id.localeCompare(b.id);
    });
}
