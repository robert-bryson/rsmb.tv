import { useLayoutEffect, useRef, useState } from 'react';
import { columns, formatSkiStat, matchesSkiPass, passFilterOptions, selectedSkiPasses,
    type SkiPassSelection, type SkiSort, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';
import type { Conditions, ResortReport, ResortStatus } from './conditions';
import { markerModes, passAccessAppearance, type MarkerMode } from './mapAppearance';
import { SkiIconButton } from './SkiIcon';
import { SkiLocation } from './SkiLocation';
import { SkiPassIcon } from './SkiPassIcon';
import { SkiStatusLabel } from './SkiStatusLabel';

const pageSize = 40;
const sortOptions = columns.map(({ key, label }) => ({ key, label: key === 'name' ? 'Name' : label }));
const visibleSortFields = new Set<SkiSort['key']>(['name', 'region', 'operatingStatus']);

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
    onZoomLocation?: (place: string) => void;
}

export function SkiAreaList({ areas, selectedId, statuses, conditions, colors, passSelection, units, sort, onSort, onSelect, onZoomLocation }: ListProps) {
    const [visibleCount, setVisibleCount] = useState(pageSize);
    const list = useRef<HTMLUListElement>(null);
    const nextResult = useRef<number>(undefined);
    const sortField = visibleSortFields.has(sort.key) ? undefined : sortOptions.find(({ key }) => key === sort.key);
    const mapMetric = colors === 'default' || colors === 'operatingStatus' || colors === 'pass' || colors === sort.key ? undefined : colors;
    const appliedPasses = selectedSkiPasses(passSelection);
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
                <SkiIconButton icon={sort.direction === 'asc' ? 'sortAscending' : 'sortDescending'} label={sortAction}
                    onClick={() => onSort(sort.key)} />
            </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
            <ul ref={list} className="divide-y divide-slate-700/60">
                {areas.slice(0, visibleCount).map(area => {
                    const status = statuses.get(area.id) ?? 'unknown';
                    const report = conditions.reports.get(area.id);
                    const selection = selectedId === area.id;
                    const counts = status === 'unknown' ? [] : [
                        sort.key === 'reportLifts' ? undefined : openCount('lifts', report?.lifts),
                        sort.key === 'reportTrails' ? undefined : openCount('trails', report?.trails),
                    ].filter(count => count !== undefined);
                    const matchingPasses = appliedPasses.length > 1
                        ? appliedPasses.filter(pass => matchesSkiPass(area, pass, passSelection?.product)) : [];
                    const access = colors === 'pass' && !matchingPasses.length ? passAccessAppearance(area, passSelection) : undefined;
                    const metaId = `ski-result-${area.id}`;
                    const sortId = `${metaId}-sort`;
                    return <li key={area.id} className="ski-result" data-selected={selection || undefined}>
                        <button type="button" aria-describedby={sortField ? `${metaId} ${sortId}` : metaId} aria-pressed={selection}
                            className="ski-result-select" onClick={event => onSelect(area.id, event.currentTarget)}>
                            {area.name}
                        </button>
                        <div id={metaId} className="ski-result-meta">
                            <span className="ski-result-location">
                                <SkiLocation area={area} onZoom={onZoomLocation} />
                                {matchingPasses.length > 0 && <span className="ski-result-passes">
                                    {matchingPasses.map(pass => <span key={pass}>
                                        {pass !== 'indy-discounts' && <SkiPassIcon family={pass} size={14} />}
                                        {passFilterOptions[pass]}
                                    </span>)}
                                </span>}
                            </span>
                            <span className="flex flex-wrap items-baseline gap-x-2"><SkiStatusLabel status={status} report={report} now={conditions.now} />
                                {counts.map(count => <span key={count}>{count}</span>)}</span>
                            {mapMetric && <span>{markerModes[mapMetric]} · {formatSkiStat(area, mapMetric, units, conditions) ?? 'Unknown'}</span>}
                            {access && <span className="flex items-center gap-1.5">
                                {access.family && <SkiPassIcon family={access.family} />}{access.label}{access.multiple && ' + other passes'}</span>}
                        </div>
                        {sortField && <dl id={sortId} className="ski-result-sort-stat">
                            <dt>{sortField.label}</dt>
                            <dd>{formatSkiStat(area, sortField.key, units, conditions) ?? 'Unknown'}</dd>
                        </dl>}
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
