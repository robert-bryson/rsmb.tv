import type { Ref } from 'react';
import { columns, formatSkiStat, type SkiSort, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';

interface Props {
    areas: readonly SkiArea[];
    units: SkiUnits;
    sort: SkiSort;
    selected?: SkiArea;
    expanded: boolean;
    selectedButtonRef: Ref<HTMLButtonElement>;
    onSort: (key: SkiSort['key']) => void;
    onSelect: (id: string) => void;
}

export function SkiAreaTable({ areas, units, sort, selected, expanded, selectedButtonRef, onSort, onSelect }: Props) {
    if (!areas.length) return <p className="p-4 text-zinc-300">No ski areas match these filters.</p>;

    return <div role="region" aria-label="Ski area comparison table" tabIndex={0}
        className={`relative overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300 ${expanded ? 'h-full' : 'max-h-[min(53dvh,34rem)] lg:h-full lg:max-h-none'}`}>
        <table className="w-full border-separate border-spacing-0 whitespace-nowrap text-left text-sm">
            <caption className="sr-only">Compare ski areas</caption>
            <thead className="sticky top-0 z-10 bg-zinc-900 text-zinc-200"><tr>
                {columns.map(({ key, label }) => {
                    const direction = sort.key === key ? sort.direction : undefined;
                    return <th key={key} scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined}
                        className={`border-b border-zinc-700 px-3 ${key === 'name' ? 'sticky left-0 z-10 bg-zinc-900' : ''}`}>
                        <button type="button" onClick={() => onSort(key)} className="flex min-h-11 items-center gap-2 text-left hover:text-cyan-300">
                            {label}{direction && <span aria-hidden="true" className="text-xs font-normal text-cyan-300">{direction === 'asc' ? 'Asc' : 'Desc'}</span>}
                        </button>
                    </th>;
                })}
            </tr></thead>
            <tbody>{areas.map(area => {
                const active = area.id === selected?.id;
                return <tr key={area.id} data-selected={active || undefined} className={active ? 'bg-cyan-950/50' : ''}>
                    <th scope="row" className={`sticky left-0 z-5 max-w-[11rem] whitespace-normal border-b border-zinc-800 px-3 sm:max-w-none ${active ? 'bg-cyan-950' : 'bg-zinc-950'}`}>
                        <button type="button" ref={active ? selectedButtonRef : undefined} aria-pressed={active} onClick={() => onSelect(area.id)}
                            className={`min-h-11 w-full py-2 text-left ${active ? 'text-cyan-200' : 'text-zinc-100 hover:text-cyan-300'}`}>{area.name}</button>
                    </th>
                    {columns.slice(1).map(({ key }) => <td key={key} className="border-b border-zinc-800 px-3 py-2 tabular-nums text-zinc-300">
                        {formatSkiStat(area, key, units) ?? <><span aria-hidden="true">—</span><span className="sr-only">Unknown</span></>}
                    </td>)}
                </tr>;
            })}</tbody>
        </table>
    </div>;
}
