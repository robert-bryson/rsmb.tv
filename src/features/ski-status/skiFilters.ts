import { matchesPassFilter, passFilterKeys, readPassFilters, readSkiingFilter, skiRegionOptions, sortSkiAreas, type PassFilter } from './browse';
import { skiAreas } from './catalog';
import { readStatusFilter, type StatusFilter } from './conditions';
import { passProducts, readSkiDate } from './passRules';
import { readSeasonMonth } from './seasons';

export type SkiStatusFilter = 'today' | 'all' | StatusFilter;
export const { countries, regions } = skiRegionOptions(skiAreas);
export const regionLabels = new Map([...countries.map(({ value, label }) => [value, label] as const), ...regions.map(code => [code, code] as const)]);
export const indyHomeAreas = sortSkiAreas(skiAreas.filter(area => area.skiing !== 'cross-country' && area.passes.some(pass => matchesPassFilter(pass, 'indy'))),
    { key: 'name', direction: 'asc' });

const legacyFilters = ['q', 'region', 'pass', 'product', 'area', 'skiing', 'night', 'seasonMonth', 'inView', 'color', 'sort', 'terrain', 'skiTerrain'];

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

export function readSkiFilters(params: URLSearchParams) {
    const region = params.get('region') ?? '';
    const product = passProducts.get(params.get('product') ?? '');
    const statusParam = params.get('status');
    // Catalog links shared before Ski today still open in the catalog. All new edits record the mode explicitly.
    const legacyView = params.get('view') === 'table' || params.get('view') === 'split';
    const defaultStatus = legacyView || legacyFilters.some(key => params.has(key)) ? 'all' : 'today';
    const status: SkiStatusFilter = statusParam === 'today' || statusParam === 'all' ? statusParam : readStatusFilter(statusParam) ?? defaultStatus;
    return {
        region: regionLabels.has(region) ? region : '',
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
