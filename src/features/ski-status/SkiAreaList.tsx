import { useLayoutEffect, useRef, useState } from 'react';
import { columns, formatSkiLocation, formatSkiStat, type SkiPassSelection, type SkiSort, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';
import type { Conditions, ResortReport, ResortStatus } from './conditions';
import { markerModes, passAccessAppearance, type MarkerMode } from './mapAppearance';
import { SkiIcon } from './SkiIcon';
import { SkiPassIcon } from './SkiPassIcon';
import { SkiStatusLabel } from './SkiStatusLabel';

const pageSize = 40;
const sortOptions = columns.map(({ key, label }) => ({ key, label: key === 'name' ? 'Name' : label }));

function openCount(label: string, values: ResortReport['lifts']) {
    if (values?.open === undefined) return;
    return `${values.open.toLocaleString()}${values.total === undefined ? '' : ` / ${values.total.toLocaleString()}`} ${label} open`;
}

interface ListProps {
    areas: readonly SkiArea[];
    selectedId?: string;
    statuses: ReadonlyMap<string, ResortStatus>;
    conditions: Conditions;
    colors: MarkerMode;
    passSelection?: SkiPassSelection;
    units: SkiUnits;
    sort: SkiSort;
    onSort: (key: SkiSort['key']) => void;
    onSelect: (id: string, control: HTMLButtonElement) => void;
}

export function SkiAreaList({ areas, selectedId, statuses, conditions, colors, passSelection, units, sort, onSort, onSelect }: ListProps) {
    const [visibleCount, setVisibleCount] = useState(pageSize);
    const list = useRef<HTMLUListElement>(null);
    const nextResult = useRef<number>(undefined);
    const metric = colors === 'default' || colors === 'operatingStatus' || colors === 'pass' ? undefined : colors;
    const sortAction = sort.direction === 'asc' ? 'Sort descending' : 'Sort ascending';

    useLayoutEffect(() => {
        if (nextResult.current === undefined) return;
        list.current?.querySelector<HTMLButtonElement>(`li:nth-child(${nextResult.current + 1}) button`)?.focus();
        nextResult.current = undefined;
    }, [visibleCount]);

    return <section aria-label="Ski area list" className="flex min-h-0 flex-1 flex-col">
        <div className="ski-pane-heading">
            <h2 className="text-sm font-semibold">Results</h2>
            <div className="ski-actions ski-result-sort">
                <label className="sr-only" htmlFor="ski-result-sort">Sort results</label>
                <select id="ski-result-sort" className="ski-input" value={sort.key}
                    onChange={event => onSort(sortOptions.find(({ key }) => key === event.target.value)?.key ?? 'name')}>
                    {sortOptions.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                </select>
                <button type="button" className="ski-control ski-icon-button" aria-label={sortAction} title={sortAction}
                    onClick={() => onSort(sort.key)}><SkiIcon name={sort.direction === 'asc' ? 'sortAscending' : 'sortDescending'} /></button>
            </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
            <ul ref={list} className="divide-y divide-slate-700/60">
                {areas.slice(0, visibleCount).map(area => {
                    const status = statuses.get(area.id) ?? 'unknown';
                    const report = conditions.reports.get(area.id);
                    const selection = selectedId === area.id;
                    const counts = status === 'unknown' ? [] : [openCount('lifts', report?.lifts), openCount('trails', report?.trails)].filter(Boolean);
                    const value = metric && formatSkiStat(area, metric, units, conditions);
                    const access = colors === 'pass' ? passAccessAppearance(area, passSelection) : undefined;
                    return <li key={area.id}>
                        <button type="button" aria-label={area.name} aria-describedby={`ski-result-${area.id}`} aria-pressed={selection}
                            className="ski-result" onClick={event => onSelect(area.id, event.currentTarget)}>
                            <span className="block font-semibold text-slate-100">{area.name}</span>
                            <span id={`ski-result-${area.id}`} className="ski-result-meta">
                                <span>{formatSkiLocation(area)}</span>
                                <span className="flex flex-wrap items-baseline gap-x-2"><SkiStatusLabel status={status} report={report} now={conditions.now} />
                                    {counts.map(count => <span key={count}>{count}</span>)}</span>
                                {metric && <span>{markerModes[metric]} · {value ?? 'Unknown'}</span>}
                                {access && <span className="flex items-center gap-1.5">
                                    {access.family && <SkiPassIcon family={access.family} />}{access.label}{access.multiple && ' + other passes'}</span>}
                            </span>
                        </button>
                    </li>;
                })}
            </ul>
            {visibleCount < areas.length && <button type="button" className="ski-control m-3"
                onClick={() => {
                    nextResult.current = visibleCount;
                    setVisibleCount(count => count + pageSize);
                }}>Show {Math.min(pageSize, areas.length - visibleCount)} more</button>}
        </div>
    </section>;
}
