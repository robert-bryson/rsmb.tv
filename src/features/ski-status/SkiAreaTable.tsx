import { formatSkiLocation, formatSkiStat, visibleSkiColumns, type ColumnKey, type SkiSort, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';
import type { Conditions } from './conditions';

interface Props {
    areas: readonly SkiArea[];
    units: SkiUnits;
    sort: SkiSort;
    selected?: SkiArea;
    conditions?: Conditions;
    columnPreference?: readonly ColumnKey[];
    onSort: (key: SkiSort['key']) => void;
    onSelect: (id: string, control: HTMLButtonElement) => void;
}

export function SkiAreaTable({ areas, units, sort, selected, conditions, columnPreference, onSort, onSelect }: Props) {
    const visibleColumns = visibleSkiColumns(columnPreference);
    return <div role="region" aria-label="Ski area comparison table" tabIndex={0}
        className="relative h-full overflow-auto scroll-pt-11 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300">
        <table className="w-full border-separate border-spacing-0 text-left text-sm whitespace-nowrap">
            <caption className="sr-only">Compare ski areas</caption>
            <thead className="sticky top-0 z-10 bg-[#152230] text-slate-100"><tr>
                {visibleColumns.map(({ key, label }) => {
                    const direction = sort.key === key ? sort.direction : undefined;
                    return <th key={key} scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined}
                        className={`border-b border-slate-700 px-2.5 ${key === 'name' ? 'sticky left-0 min-w-36 bg-[#152230] sm:min-w-44' : ''}`}>
                        <button type="button" onClick={() => onSort(key)} className="flex min-h-11 items-center gap-2 text-left hover:text-cyan-300">
                            {label}{direction && <span aria-hidden="true" className="text-xs font-normal text-cyan-200">{direction === 'asc' ? 'Asc' : 'Desc'}</span>}
                        </button>
                    </th>;
                })}
            </tr></thead>
            <tbody>{areas.map(area => {
                const active = area.id === selected?.id;
                return <tr key={area.id} data-selected={active || undefined} className={active ? 'bg-cyan-950/50' : ''}>
                    <th scope="row" className={`sticky left-0 z-5 max-w-[11rem] whitespace-normal border-b border-slate-800 px-2.5 sm:max-w-none ${active ? 'bg-cyan-950' : 'bg-[#0d1620]'}`}>
                        <button type="button" aria-pressed={active} aria-describedby={`ski-compare-${area.id}`}
                            onClick={event => onSelect(area.id, event.currentTarget)} className={`min-h-11 w-full py-2 text-left ${active ? 'text-cyan-200' : 'text-slate-100 hover:text-cyan-300'}`}>
                            {area.name}
                        </button>
                        <span id={`ski-compare-${area.id}`} className="sr-only">{formatSkiLocation(area)}</span>
                    </th>
                    {visibleColumns.slice(1).map(({ key }) => <td key={key} className="border-b border-slate-800 px-2.5 py-2 tabular-nums text-slate-300">
                        {formatSkiStat(area, key, units, conditions) ?? <><span aria-hidden="true">—</span><span className="sr-only">Unknown</span></>}
                    </td>)}
                </tr>;
            })}</tbody>
        </table>
    </div>;
}
