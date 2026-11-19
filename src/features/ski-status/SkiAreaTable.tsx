import type { Ref } from 'react';
import { columns, formatSkiLocation, formatSkiStat, type SkiSort, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';

interface Props {
    areas: readonly SkiArea[];
    units: SkiUnits;
    sort: SkiSort;
    selected?: SkiArea;
    compact: boolean;
    inView: boolean;
    selectedButtonRef: Ref<HTMLButtonElement>;
    onSort: (key: SkiSort['key']) => void;
    onSelect: (id: string) => void;
}

export function SkiAreaTable({ areas, units, sort, selected, compact, inView, selectedButtonRef, onSort, onSelect }: Props) {
    if (!areas.length) return <p className="p-4 text-zinc-300">{inView ? 'No matching ski areas in this map view.' : 'No ski areas match these filters.'}</p>;

    const secondary = sort.key === 'name' ? 'acres' : sort.key;
    const visibleColumns = compact ? columns.filter(({ key }) => key === 'name' || key === secondary) : columns;
    const nameColumn = `sticky left-0 z-10 bg-zinc-900 ${compact ? '' : 'min-w-36 sm:min-w-44'}`;

    return <div role="region" aria-label={compact ? 'Ski area list' : 'Ski area comparison table'} tabIndex={0}
        className="relative h-full overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300">
        <table className={`w-full border-separate border-spacing-0 text-left text-sm ${compact ? 'table-fixed' : 'whitespace-nowrap'}`}>
            <caption className="sr-only">{compact ? 'Browse ski areas' : 'Compare ski areas'}</caption>
            <thead className="sticky top-0 z-10 bg-zinc-900 text-zinc-200"><tr>
                {visibleColumns.map(({ key, label }) => {
                    const direction = sort.key === key ? sort.direction : undefined;
                    return <th key={key} scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined}
                        className={`border-b border-zinc-700 px-2.5 ${key === 'name' ? nameColumn : compact ? 'w-2/5' : ''}`}>
                        <button type="button" onClick={() => onSort(key)} className="flex min-h-11 items-center gap-2 text-left hover:text-cyan-300">
                            {label}{direction && <span aria-hidden="true" className="text-xs font-normal text-cyan-300">{direction === 'asc' ? 'Asc' : 'Desc'}</span>}
                        </button>
                    </th>;
                })}
            </tr></thead>
            <tbody>{areas.map(area => {
                const active = area.id === selected?.id;
                const descriptionId = compact ? `ski-area-place-${area.id}` : undefined;
                return <tr key={area.id} data-selected={active || undefined} className={active ? 'bg-cyan-950/50' : ''}>
                    <th scope="row" className={`sticky left-0 z-5 max-w-[11rem] whitespace-normal border-b border-zinc-800 px-2.5 sm:max-w-none ${active ? 'bg-cyan-950' : 'bg-zinc-950'}`}>
                        <button type="button" ref={active ? selectedButtonRef : undefined} aria-pressed={active} aria-label={compact ? area.name : undefined}
                            aria-describedby={descriptionId}
                            onClick={() => onSelect(area.id)} className={`min-h-11 w-full py-2 text-left ${active ? 'text-cyan-200' : 'text-zinc-100 hover:text-cyan-300'}`}>
                            {area.name}
                            {compact && <span id={descriptionId} className="mt-0.5 block text-xs font-normal text-zinc-400">{formatSkiLocation(area)}</span>}
                        </button>
                    </th>
                    {visibleColumns.slice(1).map(({ key }) => <td key={key} className="border-b border-zinc-800 px-2.5 py-2 tabular-nums text-zinc-300">
                        {formatSkiStat(area, key, units) ?? <><span aria-hidden="true">—</span><span className="sr-only">Unknown</span></>}
                    </td>)}
                </tr>;
            })}</tbody>
        </table>
    </div>;
}
