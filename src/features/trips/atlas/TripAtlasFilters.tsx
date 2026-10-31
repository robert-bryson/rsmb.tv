import { useRef, useState } from 'react';
import { getCountryName, type BlogCountry } from '../../../content/blogRegions';
import {
    atlasRangeKeys, atlasRegionKey, validateAtlasFilters, type AtlasFilters, type AtlasFilterIssue,
} from './tripAtlasBrowser';

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

export function TripAtlasFilters({ filters, countries, onApply, onCancel }: {
    filters: AtlasFilters; countries: BlogCountry[]; onApply: (filters: AtlasFilters) => void; onCancel: () => void;
}) {
    const [draft, setDraft] = useState(() => ({ ...filters, countries: [...filters.countries], regions: [...filters.regions] }));
    const [issues, setIssues] = useState<AtlasFilterIssue[]>([]);
    const form = useRef<HTMLFormElement>(null);
    const ranges = [
        { legend: 'Trip dates', help: 'Trips that overlap these dates, including both endpoints.', type: 'date', fields: ['from', 'to'], labels: ['From date', 'To date'] },
        { legend: 'Riding days', help: 'Whole riding days. Leave an endpoint blank for no limit.', type: 'number', fields: ['daysMin', 'daysMax'], labels: ['Minimum days', 'Maximum days'] },
        { legend: 'Distance in miles', help: 'Exact trip mileage, including both endpoints.', type: 'number', fields: ['milesMin', 'milesMax'], labels: ['Minimum miles', 'Maximum miles'] },
    ] as const;
    return <form ref={form} noValidate aria-label="Filter trips" className="mb-4 space-y-4 rounded-xl border border-zinc-700 bg-zinc-950 p-3"
        onSubmit={event => {
            event.preventDefault();
            const errors = validateAtlasFilters(draft);
            for (const input of form.current?.querySelectorAll<HTMLInputElement>('input') ?? []) {
                if (input.validity.badInput && atlasRangeKeys.some(key => key === input.name)) {
                    errors.push({ field: input.name as typeof atlasRangeKeys[number], message: 'Complete this date or number before applying filters.' });
                }
            }
            setIssues(errors);
            if (errors.length) form.current?.querySelector<HTMLInputElement>(`[name="${errors[0].field}"]`)?.focus();
            else onApply(draft);
        }}>
        {ranges.map(range => <fieldset key={range.legend}>
            <legend className="text-sm font-semibold text-zinc-200">{range.legend}</legend>
            <p className="mb-2 mt-1 text-xs leading-relaxed text-zinc-400">{range.help}</p>
            <div className="grid grid-cols-2 gap-2">
                {range.fields.map((field, index) => <label key={field} className="min-w-0 text-xs text-zinc-300">
                    <span className="mb-1 block">{range.labels[index]}</span>
                    <input name={field} type={range.type} value={draft[field]} min={range.type === 'number' ? 0 : undefined}
                        step={field.startsWith('miles') ? 'any' : range.type === 'number' ? 1 : undefined}
                        className={inputClass} aria-invalid={issues.some(issue => issue.field === field) || undefined}
                        aria-describedby={issues.some(issue => issue.field === field) ? 'atlas-filter-errors' : undefined}
                        onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} />
                </label>)}
            </div>
        </fieldset>)}
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
            <button type="button" onClick={onCancel} className="atlas-control px-3">Cancel</button>
        </div>
    </form>;
}

export function AtlasAppliedFilters({ filters, countries, onlySelected, onChange, onClearSelected, onClear }: {
    filters: AtlasFilters; countries: BlogCountry[]; onlySelected: boolean;
    onChange: (filters: AtlasFilters) => void; onClearSelected: () => void; onClear: () => void;
}) {
    const names = { from: 'From', to: 'To', daysMin: 'Days ≥', daysMax: 'Days ≤', milesMin: 'Miles ≥', milesMax: 'Miles ≤' };
    const chips = [
        ...atlasRangeKeys.filter(key => filters[key]).map(key => ({ id: key, label: `${names[key]} ${filters[key]}`, remove: () => onChange({ ...filters, [key]: '' }) })),
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
        {chips.map(chip => <button key={chip.id} type="button" aria-label={`Remove filter: ${chip.label}`} onClick={chip.remove}
            className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-violet-800 bg-violet-950/50 px-2 text-left text-xs text-violet-200">
            <span className="min-w-0 break-words">{chip.label}</span><span aria-hidden="true">×</span>
        </button>)}
        <button type="button" onClick={onClear} className="min-h-11 px-2 text-xs text-zinc-300 underline">Clear filters</button>
    </div>;
}
