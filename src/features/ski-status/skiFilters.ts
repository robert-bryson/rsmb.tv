import { matchesPassFilter, readPassFilter, readSkiingFilter, skiRegionOptions, sortSkiAreas } from './browse';
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

export function writeSkiPassFilter(params: URLSearchParams, value?: string) {
    if (value) params.set('pass', value);
    else params.delete('pass');
    for (const key of ['product', 'skiDate', 'homeArea']) params.delete(key);
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
        pass: product?.family ?? readPassFilter(params),
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
