import { atlasFilterFields, type AtlasFilters } from './tripAtlasBrowser';
import type { TripAtlasEntry } from './tripAtlasEntries';

export type AtlasFilterRange = keyof typeof atlasFilterFields;
export interface AtlasFilterChoice { min: string; max: string; label: string }
export type AtlasFilterOptions = Record<AtlasFilterRange, AtlasFilterChoice[]>;
export const atlasFilterGroups = [
    { id: 'year', label: 'Trip year' }, { id: 'days', label: 'Riding days' }, { id: 'miles', label: 'Distance' },
] as const;

export function atlasFilterChoiceValue(min: string, max: string) { return `${min}/${max}`; }

const numberLabel = (value: string) => Number.isFinite(Number(value))
    ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 20 }) : value;

/** Keep precise shared bounds intact, even when they do not match a suggested range. */
export function atlasRangeLabel(group: AtlasFilterRange, min: string, max: string): string {
    if (group === 'year') {
        const year = min.slice(0, 4);
        return min === `${year}-01-01` && max === `${year}-12-31` ? year : `${min || 'Any'} – ${max || 'Any'}`;
    }
    const unit = `${group === 'days' ? 'day' : 'mile'}${Number(max) === 1 && (!min || Number(min) === 1) ? '' : 's'}`;
    if (!min) return `Up to ${numberLabel(max)} ${unit}`;
    if (!max) return `${numberLabel(min)}+ ${unit}`;
    return `${numberLabel(min)}${Number(min) === Number(max) ? '' : `–${numberLabel(max)}`} ${unit}`;
}

/** Offer familiar ranges only when they contain a trip in this publication's collection. */
export function buildAtlasFilterOptions(entries: readonly TripAtlasEntry[]): AtlasFilterOptions {
    const years = new Set<number>();
    for (const entry of entries) {
        if (!entry.summary) continue;
        const start = Number(entry.summary.dates.start.slice(0, 4));
        const end = Number(entry.summary.dates.end.slice(0, 4));
        for (let year = start; year <= end; year++) years.add(year);
    }
    const ranges = (group: 'days' | 'miles', bounds: [string, string][]): AtlasFilterChoice[] => bounds
        .filter(([min, max]) => entries.some(entry => {
            const value = group === 'days' ? entry.summary?.ridingDays : entry.summary?.distanceMiles;
            return value !== undefined && (!min || value >= Number(min)) && (!max || value <= Number(max));
        }))
        .map(([min, max]) => ({ min, max, label: atlasRangeLabel(group, min, max) }));
    return {
        year: [{ min: '', max: '', label: 'Any year' }, ...[...years].sort((a, b) => b - a)
            .map(year => {
                const value = String(year).padStart(4, '0');
                return { min: `${value}-01-01`, max: `${value}-12-31`, label: value };
            })],
        days: [{ min: '', max: '', label: 'Any number of days' }, ...ranges('days', [['1', '3'], ['4', '7'], ['8', '14'], ['15', '']])],
        miles: [{ min: '', max: '', label: 'Any distance' }, ...ranges('miles', [['', '500'], ['500', '1500'], ['1500', '3000'], ['3000', '5000'], ['5000', '']])],
    };
}

export function atlasRangeChoice(group: AtlasFilterRange, filters: AtlasFilters): string {
    const [min, max] = atlasFilterFields[group];
    return atlasFilterChoiceValue(filters[min], filters[max]);
}
