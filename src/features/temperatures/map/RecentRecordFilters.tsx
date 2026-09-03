type ScopeFilter = 'all' | 'daily' | 'monthly';

interface RecentRecordFiltersProps {
    states: string[];
    state: string;
    scope: ScopeFilter;
    minimumMargin: number;
    onChange: (key: string, value: string, defaultValue?: string) => void;
}

export function RecentRecordFilters({ states, state, scope, minimumMargin, onChange }: RecentRecordFiltersProps) {
    return (
        <div className="flex flex-wrap gap-1.5 bg-zinc-900/80 backdrop-blur rounded-lg border border-zinc-700/50 p-1.5 text-xs">
            <select aria-label="State filter" value={state} onChange={event => onChange('state', event.target.value)} className="bg-zinc-800 text-zinc-200 rounded px-2 py-1 border border-zinc-700">
                <option value="">All states</option>
                {states.map(abbreviation => <option key={abbreviation} value={abbreviation}>{abbreviation}</option>)}
            </select>
            <select aria-label="Record scope filter" value={scope} onChange={event => onChange('scope', event.target.value, 'all')} className="bg-zinc-800 text-zinc-200 rounded px-2 py-1 border border-zinc-700">
                <option value="all">All scopes</option>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
            </select>
            <label className="flex items-center gap-1.5 text-zinc-400 px-1">
                Min margin
                <input aria-label="Minimum record margin" type="number" min="0" max="50" step="1" value={minimumMargin} onChange={event => onChange('margin', event.target.value, '0')} className="w-12 bg-zinc-800 text-zinc-200 rounded px-1.5 py-1 border border-zinc-700" />
                °F
            </label>
        </div>
    );
}