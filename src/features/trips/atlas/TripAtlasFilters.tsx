import { useRef, useState } from 'react';
import { getCountryName, type BlogCountry } from '../../../content/blogRegions';
import {
    atlasFilterFields, atlasRegionKey, validateAtlasFilters, type AtlasFilters, type AtlasFilterIssue,
} from './tripAtlasBrowser';
import { atlasFilterChoiceValue, atlasFilterGroups, atlasRangeChoice, atlasRangeLabel, type AtlasFilterOptions } from './tripAtlasFilterOptions';

const inputClass = 'atlas-input w-full';

function CountryChoices({ country, filters, onChange }: {
    country: BlogCountry; filters: AtlasFilters; onChange: (filters: AtlasFilters) => void;
}) {
    const [open, setOpen] = useState(() => filters.regions.some(key => key.startsWith(`${country.code}/`)));
    const countryWide = filters.countries.includes(country.code);
    return <fieldset className="rounded-lg border border-zinc-700 p-3">
        <legend className="px-1 text-sm font-medium text-zinc-200">{country.name}</legend>
        {country.code && <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={countryWide} className="size-4 accent-violet-400"
                onChange={event => onChange({ ...filters,
                    countries: event.target.checked ? [...filters.countries, country.code] : filters.countries.filter(code => code !== country.code),
                    regions: event.target.checked ? filters.regions.filter(key => !key.startsWith(`${country.code}/`)) : filters.regions,
                })} />
            Any region in {country.name}
        </label>}
        {country.regions.length > 0 && <>
            <button type="button" aria-expanded={open} aria-controls={`atlas-regions-${country.code || 'other'}`}
                data-atlas-tooltip={`${open ? 'Hide' : 'Show'} the states and provinces available in ${country.name}.`}
                onClick={() => setOpen(value => !value)} className="flex min-h-11 w-full items-center justify-between text-left text-sm text-violet-300">
                States and provinces <span aria-hidden="true">{open ? '−' : '+'}</span>
            </button>
            <div id={`atlas-regions-${country.code || 'other'}`} hidden={!open} className="border-t border-zinc-700 pt-1">
                {country.regions.map(region => {
                    const key = atlasRegionKey(country.code, region.name);
                    return <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-zinc-300">
                        <input type="checkbox" checked={filters.regions.includes(key)} className="size-4 accent-violet-400"
                            onChange={event => onChange({ ...filters,
                                countries: event.target.checked ? filters.countries.filter(code => code !== country.code) : filters.countries,
                                regions: event.target.checked ? [...filters.regions, key] : filters.regions.filter(value => value !== key),
                            })} />
                        {region.name}
                    </label>;
                })}
            </div>
        </>}
    </fieldset>;
}

export function TripAtlasFilters({ filters, countries, options, onApply, onCancel }: {
    filters: AtlasFilters; countries: BlogCountry[]; options: AtlasFilterOptions; onApply: (filters: AtlasFilters) => void; onCancel: () => void;
}) {
    const [draft, setDraft] = useState(() => ({ ...filters, countries: [...filters.countries], regions: [...filters.regions] }));
    const [issues, setIssues] = useState<AtlasFilterIssue[]>([]);
    const form = useRef<HTMLFormElement>(null);
    return <form ref={form} noValidate aria-label="Filter trips" className="mb-4 space-y-4 rounded-xl border border-zinc-700 bg-zinc-950 p-3"
        onSubmit={event => {
            event.preventDefault();
            const errors = validateAtlasFilters(draft);
            setIssues(errors);
            if (errors.length) {
                const group = atlasFilterGroups.find(group => atlasFilterFields[group.id].some(field => field === errors[0].field));
                form.current?.querySelector<HTMLSelectElement>(`[name="${group?.id ?? errors[0].field}"]`)?.focus();
            }
            else onApply(draft);
        }}>
        {atlasFilterGroups.map(group => {
            const [min, max] = atlasFilterFields[group.id];
            const value = atlasRangeChoice(group.id, draft);
            const choices = options[group.id];
            const custom = !choices.some(choice => atlasFilterChoiceValue(choice.min, choice.max) === value);
            const invalid = issues.some(issue => issue.field === min || issue.field === max);
            return <div key={group.id} className="text-sm font-semibold text-zinc-200">
                <label htmlFor={`atlas-filter-${group.id}`} className="mb-2 block">{group.label}</label>
                <select id={`atlas-filter-${group.id}`} name={group.id} value={value} className={inputClass} aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? 'atlas-filter-errors' : undefined}
                    onChange={event => {
                        const choice = choices.find(choice => atlasFilterChoiceValue(choice.min, choice.max) === event.target.value);
                        if (choice) setDraft(current => ({ ...current, [min]: choice.min, [max]: choice.max }));
                    }}>
                    {choices.map(choice => <option key={atlasFilterChoiceValue(choice.min, choice.max)} value={atlasFilterChoiceValue(choice.min, choice.max)}>{choice.label}</option>)}
                    {custom && <option value={value}>{atlasRangeLabel(group.id, draft[min], draft[max])}</option>}
                </select>
            </div>;
        })}
        {countries.length > 0 && <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-zinc-200">Locations</legend>
            <p className="text-xs leading-relaxed text-zinc-400">Match any selected country or region. Choose a region to narrow its country.</p>
            {countries.map(country => <CountryChoices key={country.code} country={country} filters={draft} onChange={setDraft} />)}
        </fieldset>}
        {issues.length > 0 && <ul id="atlas-filter-errors" role="alert" className="space-y-1 text-sm text-amber-300">
            {issues.map(issue => <li key={issue.field}>{issue.message}</li>)}
        </ul>}
        <div className="flex flex-wrap gap-2">
            <button type="submit" className="min-h-11 rounded-lg bg-violet-400 px-4 text-sm font-semibold text-zinc-950 hover:bg-violet-300">Apply filters</button>
            <button type="button" data-atlas-tooltip="Discard unapplied changes and return to the trips." onClick={onCancel} className="atlas-control px-3">Cancel</button>
        </div>
    </form>;
}

export function AtlasAppliedFilters({ filters, countries, onlySelected, onChange, onClearSelected, onClear }: {
    filters: AtlasFilters; countries: BlogCountry[]; onlySelected: boolean;
    onChange: (filters: AtlasFilters) => void; onClearSelected: () => void; onClear: () => void;
}) {
    const chips = [
        ...atlasFilterGroups.flatMap(group => {
            const [min, max] = atlasFilterFields[group.id];
            if (!filters[min] && !filters[max]) return [];
            const range = atlasRangeLabel(group.id, filters[min], filters[max]);
            const label = group.id === 'year' ? `${/^\d{4}$/.test(range) ? 'Year' : 'Dates'}: ${range}` : range;
            return [{ id: group.id, label, remove: () => onChange({ ...filters, [min]: '', [max]: '' }) }];
        }),
        ...filters.countries.map(code => ({ id: `country:${code}`, label: /^[A-Z]{2}$/.test(code) ? getCountryName(code) : code,
            remove: () => onChange({ ...filters, countries: filters.countries.filter(value => value !== code) }) })),
        ...filters.regions.map(key => {
            const country = countries.find(country => country.regions.some(region => atlasRegionKey(country.code, region.name) === key));
            const region = country?.regions.find(region => atlasRegionKey(country.code, region.name) === key);
            return { id: `region:${key}`, label: country && region ? `${region.name}, ${country.name}` : key,
                remove: () => onChange({ ...filters, regions: filters.regions.filter(value => value !== key) }) };
        }),
        ...(onlySelected ? [{ id: 'selected', label: 'Selected trip only', remove: onClearSelected }] : []),
    ];
    if (!chips.length) return null;
    return <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Applied trip filters">
        {chips.map(chip => <button key={chip.id} type="button" aria-label={`Remove filter: ${chip.label}`} data-atlas-tooltip={`Remove only this filter: ${chip.label}.`} onClick={chip.remove}
            className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-violet-800 bg-violet-950/50 px-2 text-left text-xs text-violet-200">
            <span className="min-w-0 break-words">{chip.label}</span><span aria-hidden="true">×</span>
        </button>)}
        <button type="button" data-atlas-tooltip="Remove every applied filter, including selected-trip-only mode." onClick={onClear} className="min-h-11 px-2 text-xs text-zinc-300 underline">Clear filters</button>
    </div>;
}
