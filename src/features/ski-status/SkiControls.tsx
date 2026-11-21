import type { ReactNode, RefObject } from 'react';
import { passFilterKeys, passFilterOptions, skiingFilterOptions, type SkiUnits } from './browse';
import { statusFilterLabels } from './conditions';
import { markerLegend, markerModes, passBadgeTextColor, type MarkerMode } from './mapAppearance';
import { passProducts, readSkiDate } from './passRules';
import { skiRunLegend, skiTerrainLegend, type TerrainConvention } from './resortTerrainData';
import { countries, indyHomeAreas, regions, toggleSkiPassFilter, writeSkiPassProduct, type SkiFilters } from './skiFilters';
import { seasonMonths } from './seasons';
import { SkiIconButton } from './SkiIcon';
import { SkiPassIcon } from './SkiPassIcon';

interface DialogProps {
    dialog: RefObject<HTMLDialogElement | null>;
    id: string;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    onClose?: () => void;
}

export function SkiDialog({ dialog, id, title, children, footer, onClose }: DialogProps) {
    return <dialog ref={dialog} id={id} aria-labelledby={`${id}-title`} className="ski-dialog" onClose={onClose}>
        <div className="ski-dialog-heading">
            <h2 id={`${id}-title`} className="text-lg font-semibold">{title}</h2>
            <SkiIconButton className="ski-quiet-button" icon="close" label="Close" onClick={() => dialog.current?.close()} />
        </div>
        <div className="ski-dialog-content">{children}</div>
        {footer && <div className="ski-dialog-footer">{footer}</div>}
    </dialog>;
}

function SkiField({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
    return <div className="ski-field"><label htmlFor={id}>{label}</label>{children}</div>;
}

interface FilterProps {
    dialog: DialogProps['dialog'];
    filters: SkiFilters;
    resultCount: number;
    units: SkiUnits;
    onShowResults: () => void;
    onUnitsChange: (units: SkiUnits) => void;
    setParam: (key: string, value?: string) => void;
    updateParams: (update: (params: URLSearchParams) => void) => void;
}

export function SkiFilterDialog({ dialog, filters, resultCount, units, onShowResults, onUnitsChange, setParam, updateParams }: FilterProps) {
    const { region, passes, product, skiDate, homeArea, skiing, night, seasonMonth, status } = filters;
    const products = [...passProducts.values()].filter(option => !passes.length || passes.includes(option.family));
    const productFamilyHint = product && passes.length > 1 && `Product and ski date apply to ${passFilterOptions[product.family]}.`;

    return <SkiDialog dialog={dialog} id="ski-filters" title="Filters" footer={
        <button type="button" className="ski-control ski-primary" onClick={() => {
            dialog.current?.close();
            onShowResults();
        }}>
            Show {resultCount.toLocaleString()} {resultCount === 1 ? 'result' : 'results'}
        </button>
    }>
        <div className="ski-fields">
            <fieldset className="ski-pass-options" aria-describedby="ski-pass-help">
                <legend className="font-semibold">Passes</legend>
                <p id="ski-pass-help" className="mb-2 text-sm text-slate-300">Match any selected pass.</p>
                <div className="ski-pass-options-grid">
                    {passFilterKeys.map(pass => <label key={pass} className="ski-pass-option">
                        <input type="checkbox" checked={passes.includes(pass)}
                            onChange={() => updateParams(params => toggleSkiPassFilter(params, pass))} />
                        {pass !== 'indy-discounts' && <SkiPassIcon family={pass} size={18} />}
                        {passFilterOptions[pass]}
                    </label>)}
                </div>
            </fieldset>
            {products.length > 0 && <div className="col-span-full"><SkiField id="ski-pass-product" label="Pass product">
                <select id="ski-pass-product" className="ski-input" value={product?.id ?? ''}
                    aria-describedby={productFamilyHint ? 'ski-product-help' : undefined}
                    onChange={event => updateParams(params => writeSkiPassProduct(params, event.target.value))}>
                    <option value="">Any product</option>
                    {products.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
                {productFamilyHint && <p id="ski-product-help" className="text-sm text-slate-300">{productFamilyHint}</p>}
            </SkiField></div>}
            {product && <SkiField id="ski-ski-date" label="Ski date (local)">
                <input id="ski-ski-date" className="ski-input" type="date" value={skiDate ?? ''} aria-describedby={skiDate ? undefined : 'ski-date-help'}
                    onChange={event => setParam('skiDate', readSkiDate(event.target.value))} />
            </SkiField>}
            {product?.requiresHomeArea && <SkiField id="ski-home-area" label="Home ski area">
                <select id="ski-home-area" className="ski-input" value={homeArea?.id ?? ''} onChange={event => setParam('homeArea', event.target.value)}>
                    <option value="">Select your home ski area</option>
                    {indyHomeAreas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
            </SkiField>}
            {product && !skiDate && <p id="ski-date-help" className="col-span-full text-sm text-slate-300">A blank ski date uses today at each area.</p>}
            <SkiField id="ski-region" label="Region">
                <select id="ski-region" className="ski-input" value={region} onChange={event => setParam('region', event.target.value)}>
                    <option value="">All regions</option>
                    <optgroup label="Countries">{countries.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</optgroup>
                    <optgroup label="States and provinces">{regions.map(code => <option key={code} value={code}>{code}</option>)}</optgroup>
                </select>
            </SkiField>
            <SkiField id="ski-operating-status" label="Operating status">
                <select id="ski-operating-status" className="ski-input" value={status} onChange={event => setParam('status', event.target.value)}>
                    <option value="all">Any status</option>
                    <option value="today">Ski today</option>
                    {Object.entries(statusFilterLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </SkiField>
            <SkiField id="ski-type" label="Skiing type">
                <select id="ski-type" className="ski-input" value={skiing ?? ''} onChange={event => setParam('skiing', event.target.value)}>
                    <option value="">All skiing types</option>
                    {Object.entries(skiingFilterOptions).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                </select>
            </SkiField>
            <SkiField id="ski-season-month" label="Typical season in">
                <select id="ski-season-month" className="ski-input" value={seasonMonth ?? ''} onChange={event => setParam('seasonMonth', event.target.value)}>
                    <option value="">Any month</option>
                    {seasonMonths.map(({ month, label }) => <option key={month} value={month}>{label}</option>)}
                </select>
            </SkiField>
            <SkiField id="ski-units" label="Units">
                <select id="ski-units" className="ski-input" value={units} onChange={event => onUnitsChange(event.target.value === 'metric' ? 'metric' : 'imperial')}>
                    <option value="imperial">Acres / feet</option><option value="metric">Hectares / meters</option>
                </select>
            </SkiField>
            <label className="ski-check"><input type="checkbox" checked={night}
                onChange={event => setParam('night', event.target.checked ? '1' : undefined)} /> Night skiing</label>
        </div>
    </SkiDialog>;
}

interface LayersProps {
    dialog: DialogProps['dialog'];
    colors: MarkerMode;
    units: SkiUnits;
    indyDiscounts: boolean;
    terrain: boolean;
    resortTerrain: boolean;
    terrainKey: ReactNode;
    setParam: FilterProps['setParam'];
}

export function SkiLayerDialog({ dialog, colors, units, indyDiscounts, terrain, resortTerrain, terrainKey, setParam }: LayersProps) {
    const legend = markerLegend(colors, units, indyDiscounts);
    return <SkiDialog dialog={dialog} id="ski-map-layers" title="Map layers">
        <div className="ski-fields">
            <div className="col-span-full"><SkiField id="ski-marker-color" label="Color by">
                <select id="ski-marker-color" className="ski-input" value={colors} onChange={event => setParam('color', event.target.value)}>
                    {Object.entries(markerModes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
            </SkiField></div>
            <label className="ski-check"><input type="checkbox" checked={terrain}
                onChange={event => setParam('terrain', event.target.checked ? '1' : '0')} /> Terrain relief</label>
            <label className="ski-check"><input type="checkbox" checked={resortTerrain}
                onChange={event => setParam('skiTerrain', event.target.checked ? undefined : '0')} /> Ski terrain</label>
        </div>
        {legend.length > 0 && <ul aria-label="Resort map key" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-200">
            {legend.map(({ color, label, family, multiple, glyph }) => <li key={label} className="flex items-center gap-1.5">
                {family ? <SkiPassIcon family={family} size={20} />
                    : multiple ? <span aria-hidden="true" className="grid size-5 place-items-center rounded-full font-bold"
                        style={{ backgroundColor: color, color: passBadgeTextColor }}>+</span>
                    : <span aria-hidden="true" className={glyph ? 'w-4 text-center font-bold' : 'size-2.5 rounded-full'}
                        style={glyph ? { color } : { backgroundColor: color }}>{glyph}</span>}{label}
            </li>)}
        </ul>}
        <p className="mt-3 text-sm text-slate-300">{colors === 'operatingStatus'
            ? 'Map numbers count resorts reporting skiing today. Select a group to zoom in.'
            : 'Map numbers count grouped resorts. Select a group to zoom in.'}</p>
        {terrainKey}
    </SkiDialog>;
}

const conventionLabels: Record<TerrainConvention, string> = { default: 'Green and blue convention', europe: 'European convention', japan: 'Japanese convention' };

function TerrainLines({ entries }: { entries: readonly { label: string; color: string; dashed?: boolean }[] }) {
    return <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-200">
        {entries.map(({ label, color, dashed }) => <li key={label} className="flex items-center gap-2">
            <span aria-hidden="true" className="w-5 border-t-2" style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid',
                filter: color === '#18181b' ? 'drop-shadow(0 0 1px white)' : undefined }} />{label}
        </li>)}
    </ul>;
}

export function SkiTerrainKey({ conventions }: { conventions: readonly TerrainConvention[] }) {
    return <section aria-labelledby="ski-terrain-key-title" className="mt-4 space-y-2 border-t border-slate-700 pt-3">
        <h3 id="ski-terrain-key-title" className="font-semibold">Mapped runs and lifts</h3>
        {conventions.map(convention => <div key={convention} className="space-y-1">
            <p className="text-sm text-slate-300">{conventionLabels[convention]}</p>
            <TerrainLines entries={skiRunLegend(convention)} />
        </div>)}
        <TerrainLines entries={skiTerrainLegend} />
    </section>;
}
