import { columnGroups, defaultSkiColumns, type ColumnKey } from './browse';

export function SkiColumnSettings({ columns, onChange }: {
    columns: readonly ColumnKey[];
    onChange: (columns: ColumnKey[]) => void;
}) {
    return <details className="px-3 text-sm sm:px-4">
        <summary className="w-fit cursor-pointer py-2 text-zinc-300 underline underline-offset-4">Columns</summary>
        <div className="flex flex-wrap gap-5 pb-3">
            {columnGroups.map(group => <fieldset key={group.label} className="grid content-start gap-y-1">
                <legend className="mb-1 font-medium">{group.label}</legend>
                {group.columns.map(({ key, label }) => <label key={key} className="flex min-h-7 items-center gap-2 text-zinc-300">
                    <input type="checkbox" aria-label={`Show ${label} column`} checked={columns.includes(key)} onChange={event =>
                        onChange(event.target.checked ? [...columns, key] : columns.filter(column => column !== key))}
                        className="size-4 accent-cyan-400" />
                    {label}
                </label>)}
            </fieldset>)}
            <button type="button" className="self-start py-2 text-cyan-300 underline underline-offset-4" onClick={() => onChange(defaultSkiColumns)}>
                Reset columns
            </button>
        </div>
    </details>;
}
