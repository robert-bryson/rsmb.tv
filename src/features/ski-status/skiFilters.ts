import { matchesPassFilter, passFilterKeys, readPassFilters, readSkiingFilter, sortSkiAreas, type PassFilter } from './browse';
import { skiAreas } from './catalog';
import { readStatusFilter, type StatusFilter } from './conditions';
import { passProducts, readSkiDate } from './passRules';
import { readSeasonMonth } from './seasons';
import { skiLocationOptions, type SkiLocationFilters } from './skiGeography';

export type SkiStatusFilter = 'today' | 'all' | StatusFilter;
export const skiLocationGroups = skiLocationOptions(skiAreas);
export const skiLocationLabels = new Map(skiLocationGroups.flatMap(group => group.options.map(({ value, label }) => [value, label] as const)));
export const indyHomeAreas = sortSkiAreas(skiAreas.filter(area => area.skiing !== 'cross-country' && area.passes.some(pass => matchesPassFilter(pass, 'indy'))),
    { key: 'name', direction: 'asc' });

const legacyFilters = ['q', 'region', 'pass', 'product', 'area', 'skiing', 'night', 'seasonMonth', 'inView', 'color', 'sort', 'terrain', 'skiTerrain'];

export const skiLocationParams = { include: 'region', exclude: 'excludeRegion' } as const;
export const skiLocationActions = { include: 'Include', exclude: 'Exclude' } as const;
export const skiLocationModes = ['include', 'exclude'] as const;

function readSkiLocations(values: unknown) {
    if (!Array.isArray(values)) return [];
    const valid = new Set<string>();
    for (const value of values) {
        if (typeof value !== 'string') continue;
        if (skiLocationLabels.has(value)) valid.add(value);
        // The old Region filter stored an unqualified state or province code.
        else if (/^[A-Z]{2}$/.test(value)) {
            for (const country of ['US', 'CA']) {
                const key = `region:${country}:${value}`;
                if (skiLocationLabels.has(key)) valid.add(key);
            }
        }
    }
    return [...valid];
}

export function updateSavedSkiExclusions(saved: unknown, place: string, exclude: boolean) {
    const places = readSkiLocations(saved);
    // A shared view can specify other exclusions. Save only the place that the user changes.
    return exclude ? readSkiLocations([...places, place]) : places.filter(value => value !== place);
}

export function writeSkiLocations(params: URLSearchParams, mode: keyof SkiLocationFilters, places: readonly string[]) {
    const key = skiLocationParams[mode];
    params.delete(key);
    for (const place of places) params.append(key, place);
    // An explicit empty list lets a shared view override saved exclusions.
    if (mode === 'exclude' && !places.length) params.set(key, '');
}

function clearSkiPassProduct(params: URLSearchParams) {
    for (const key of ['product', 'skiDate', 'homeArea']) params.delete(key);
}

function writeSkiPasses(params: URLSearchParams, passes: readonly PassFilter[]) {
    params.delete('pass');
    for (const pass of passFilterKeys) {
        if (passes.includes(pass)) params.append('pass', pass);
    }
    const product = passProducts.get(params.get('product') ?? '');
    if (!product || !passes.includes(product.family)) clearSkiPassProduct(params);
}

export function toggleSkiPassFilter(params: URLSearchParams, pass: PassFilter) {
    const product = passProducts.get(params.get('product') ?? '');
    const passes = readPassFilters(params, product?.family);
    writeSkiPasses(params, passes.includes(pass) ? passes.filter(value => value !== pass) : [...passes, pass]);
}

export function writeSkiPassProduct(params: URLSearchParams, value: string) {
    const previous = passProducts.get(params.get('product') ?? '');
    const passes = readPassFilters(params, previous?.family);
    const product = passProducts.get(value);
    if (product) {
        params.set('product', product.id);
        if (!product.requiresHomeArea) params.delete('homeArea');
        writeSkiPasses(params, [...passes, product.family]);
    } else {
        clearSkiPassProduct(params);
        writeSkiPasses(params, passes);
    }
}

export function readSkiFilters(params: URLSearchParams, savedExclusions?: unknown) {
    const product = passProducts.get(params.get('product') ?? '');
    const statusParam = params.get('status');
    // Catalog links shared before Ski today still open in the catalog. All new edits record the mode explicitly.
    const legacyView = params.get('view') === 'table' || params.get('view') === 'split';
    const defaultStatus = legacyView || legacyFilters.some(key => params.has(key)) ? 'all' : 'today';
    const status: SkiStatusFilter = statusParam === 'today' || statusParam === 'all' ? statusParam : readStatusFilter(statusParam) ?? defaultStatus;
    return {
        locations: {
            include: readSkiLocations(params.getAll(skiLocationParams.include)),
            exclude: readSkiLocations(params.has(skiLocationParams.exclude) ? params.getAll(skiLocationParams.exclude) : savedExclusions),
        },
        passes: readPassFilters(params, product?.family),
        product,
        skiDate: product && readSkiDate(params.get('skiDate')),
        homeArea: product?.requiresHomeArea ? indyHomeAreas.find(area => area.id === params.get('homeArea')) : undefined,
        skiing: readSkiingFilter(params),
        night: params.get('night') === '1',
        seasonMonth: readSeasonMonth(params.get('seasonMonth')),
        status,
    };
}

export type SkiFilters = ReturnType<typeof readSkiFilters>;
