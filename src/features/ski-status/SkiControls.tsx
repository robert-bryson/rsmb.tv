import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { passFilterKeys, passFilterOptions, skiingFilterOptions, type SkiUnits } from './browse';
import { statusFilterLabels } from './conditions';
import { passProducts, readSkiDate } from './passRules';
import { indyHomeAreas, skiLocationActions, skiLocationGroups, skiLocationLabels, skiLocationModes, toggleSkiPassFilter, writeSkiPassProduct, type SkiFilters } from './skiFilters';
import type { SkiLocationFilters } from './skiGeography';
import { seasonMonths } from './seasons';
import { SkiIcon, SkiIconButton } from './SkiIcon';
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

type ChangeLocationFilter = (mode: keyof SkiLocationFilters, place: string) => void;

function SkiLocationFields({ locations, onChange }: { locations: SkiLocationFilters; onChange: ChangeLocationFilter }) {
    const [place, setPlace] = useState('');
    const select = useRef<HTMLSelectElement>(null);
    return <fieldset className="ski-location-fields" aria-describedby="ski-location-help">
        <legend className="font-semibold">Location</legend>
        <p id="ski-location-help" className="text-sm text-slate-300">Match any included place. Exclusions take priority. The browser remembers exclusions you add.</p>
        <div className="ski-location-controls">
            <label className="sr-only" htmlFor="ski-location-filter">Choose a location</label>
            <select ref={select} id="ski-location-filter" className="ski-input" value={place} onChange={event => setPlace(event.target.value)}>
                <option value="">Choose a location</option>
                {skiLocationGroups.map(group => <optgroup key={group.label} label={group.label}>
                    {group.options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </optgroup>)}
            </select>
            {skiLocationModes.map(mode => <button key={mode} type="button" className="ski-control" disabled={!place || locations[mode].includes(place)}
                onClick={() => { onChange(mode, place); select.current?.focus(); }}>{skiLocationActions[mode]}</button>)}
        </div>
        {skiLocationModes.some(mode => locations[mode].length > 0) && <div className="ski-location-chips" role="group" aria-label="Selected locations">
            {skiLocationModes.flatMap(mode => locations[mode].map(value => {
                const label = `${skiLocationActions[mode]} ${skiLocationLabels.get(value)}`;
                return <button key={`${mode}:${value}`} type="button" className="ski-chip" aria-label={`Remove ${label}`}
                    onClick={() => { onChange(mode, value); select.current?.focus(); }}>
                    <span>{label}</span><SkiIcon name="close" />
                </button>;
            }))}
        </div>}
    </fieldset>;
}

interface FilterProps {
    dialog: DialogProps['dialog'];
    filters: SkiFilters;
    resultCount: number;
    units: SkiUnits;
    onShowResults: () => void;
    onUnitsChange: (units: SkiUnits) => void;
    onChangeLocation: ChangeLocationFilter;
    setParam: (key: string, value?: string) => void;
    updateParams: (update: (params: URLSearchParams) => void) => void;
}

export function SkiFilterDialog({ dialog, filters, resultCount, units, onShowResults, onUnitsChange, onChangeLocation, setParam, updateParams }: FilterProps) {
    const { locations, passes, product, skiDate, homeArea, skiing, night, seasonMonth, status } = filters;
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
            <SkiLocationFields locations={locations} onChange={onChangeLocation} />
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
