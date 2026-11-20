import { columnGroups, defaultSkiColumns, type ColumnKey } from './browse';

export function SkiColumnSettings({ columns, onChange }: {
    columns: readonly ColumnKey[];
    onChange: (columns: ColumnKey[]) => void;
}) {
    return <div className="text-sm">
        <div className="flex flex-wrap gap-5">
            {columnGroups.map(group => <fieldset key={group.label} className="grid content-start gap-y-1">
                <legend className="mb-1 font-medium">{group.label}</legend>
                {group.columns.map(({ key, label }) => <label key={key} className="flex min-h-11 items-center gap-2 text-slate-200">
                    <input type="checkbox" aria-label={`Show ${label} column`} checked={columns.includes(key)} onChange={event =>
                        onChange(event.target.checked ? [...columns, key] : columns.filter(column => column !== key))}
                        className="size-4 accent-cyan-400" />
                    {label}
                </label>)}
            </fieldset>)}
            <button type="button" className="ski-control self-start" onClick={() => onChange(defaultSkiColumns)}>
                Reset columns
            </button>
        </div>
    </div>;
}
