import { useState } from 'react';
import type { TimePeriod } from '../types';
import { TIME_PERIOD_LABELS, TIME_PERIODS } from '../constants';

type ScopeFilter = 'all' | 'daily' | 'monthly';

interface RecentRecordFiltersProps {
    states: string[];
    state: string;
    scope: ScopeFilter;
    minimumMargin: number;
    activePeriod: TimePeriod;
    onPeriodChange: (period: TimePeriod) => void;
    onClear: () => void;
    onChange: (key: string, value: string, defaultValue?: string) => void;
}

export function RecentRecordFilters({ states, state, scope, minimumMargin, onChange, activePeriod, onPeriodChange, onClear }: RecentRecordFiltersProps) {
    const [expanded, setExpanded] = useState(false);
    const hasFilters = Boolean(state || scope !== 'all' || minimumMargin);
    return (
        <div className="space-y-1.5">
            <div className="flex gap-1 rounded-lg bg-zinc-900/90 border border-zinc-700/50 p-0.5 text-xs" aria-label="Observation period">
                {TIME_PERIODS.map(period => (
                    <button key={period} type="button" aria-pressed={activePeriod === period} onClick={() => onPeriodChange(period)}
                        className={`min-h-11 flex-1 px-2 rounded ${activePeriod === period ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}>
                        {TIME_PERIOD_LABELS[period]}
                    </button>
                ))}
                <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="recent-record-filters"
                    className="min-h-11 px-2 text-zinc-200">Filters{hasFilters ? ' •' : ''}</button>
            </div>
            <div id="recent-record-filters" className={`${expanded ? 'flex' : 'hidden'} flex-wrap gap-1.5 bg-zinc-900/80 backdrop-blur rounded-lg border border-zinc-700/50 p-1.5 text-xs`}>
                <select aria-label="State filter" value={state} onChange={event => onChange('state', event.target.value)} className="bg-zinc-800 text-zinc-200 rounded px-2 py-1 min-h-11 border border-zinc-700">
                    <option value="">All states</option>
                    {states.map(abbreviation => <option key={abbreviation} value={abbreviation}>{abbreviation}</option>)}
                </select>
                <select aria-label="Record scope filter" value={scope} onChange={event => onChange('scope', event.target.value, 'all')} className="bg-zinc-800 text-zinc-200 rounded px-2 py-1 min-h-11 border border-zinc-700">
                    <option value="all">All scopes</option>
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                </select>
                <label className="flex items-center gap-1.5 text-zinc-400 px-1">
                    Min margin
                    <input aria-label="Minimum record margin" type="number" min="0" max="50" step="1" value={minimumMargin} onChange={event => onChange('margin', event.target.value, '0')} className="w-12 bg-zinc-800 text-zinc-200 rounded px-1.5 py-1 min-h-11 border border-zinc-700" />
                    °F
                </label>
                {hasFilters && <button type="button" onClick={onClear} className="min-h-11 px-2 text-violet-300 hover:text-white underline">Clear filters</button>}
            </div>
        </div>
    );
}
