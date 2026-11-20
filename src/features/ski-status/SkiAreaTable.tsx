import { useRef, useState } from 'react';
import { formatSkiLocation, formatSkiStat, visibleSkiColumns, type ColumnKey, type SkiSort, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';
import type { Conditions } from './conditions';
import { SkiIcon } from './SkiIcon';

const mountainOverview = new Set<ColumnKey>(['acres', 'verticalFt', 'liftCount', 'trailCount', 'baseFt', 'summitFt']);
const leadsCatalogComparison = (key: ColumnKey) => key === 'name' || key === 'region' || mountainOverview.has(key);
const pageSize = 50;

interface Props {
    areas: readonly SkiArea[];
    units: SkiUnits;
    sort: SkiSort;
    selected?: SkiArea;
    conditions?: Conditions;
    columnPreference?: readonly ColumnKey[];
    reportsFirst?: boolean;
    onSort: (key: SkiSort['key']) => void;
    onSelect: (id: string, control: HTMLButtonElement) => void;
}

export function SkiAreaTable({ areas, units, sort, selected, conditions, columnPreference, reportsFirst, onSort, onSelect }: Props) {
    const scroller = useRef<HTMLDivElement>(null);
    const [requestedPage, setPage] = useState(() => Math.max(0, Math.floor(areas.findIndex(area => area.id === selected?.id) / pageSize)));
    const lastPage = Math.max(0, Math.ceil(areas.length / pageSize) - 1);
    const page = Math.min(requestedPage, lastPage);
    const start = page * pageSize;
    const end = Math.min(start + pageSize, areas.length);
    const columns = visibleSkiColumns(columnPreference);
    const visibleColumns = reportsFirst ? columns : [
        ...columns.filter(({ key }) => leadsCatalogComparison(key)),
        ...columns.filter(({ key }) => !leadsCatalogComparison(key)),
    ];
    function changePage(next: number) {
        setPage(next);
        if (scroller.current) scroller.current.scrollTop = 0;
    }

    return <div className="ski-comparison">
        {lastPage > 0 && <nav className="ski-compare-pages" aria-label="Comparison pages">
            <button type="button" className="ski-control" aria-disabled={page === 0} onClick={() => {
                if (page > 0) changePage(page - 1);
            }}>Previous</button>
            <span role="status">{start + 1}–{end} of {areas.length} areas</span>
            <button type="button" className="ski-control" aria-disabled={page === lastPage} onClick={() => {
                if (page < lastPage) changePage(page + 1);
            }}>Next</button>
        </nav>}
        <div ref={scroller} role="region" aria-label="Ski area comparison table" tabIndex={0} className="ski-compare">
            <table>
                <caption className="sr-only">Compare ski areas</caption>
                <thead><tr>
                    {visibleColumns.map(({ key, label }) => {
                        const direction = sort.key === key ? sort.direction : undefined;
                        return <th key={key} scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined}
                            className={key === 'name' ? 'ski-compare-name' : undefined} data-numeric={mountainOverview.has(key) || undefined}>
                            <button type="button" onClick={() => { changePage(0); onSort(key); }}>
                                {label}{direction && <SkiIcon name={direction === 'asc' ? 'ascending' : 'descending'} />}
                            </button>
                        </th>;
                    })}
                </tr></thead>
                <tbody>{areas.slice(start, end).map(area => {
                    const active = area.id === selected?.id;
                    return <tr key={area.id} data-selected={active || undefined}>
                        <th scope="row" className="ski-compare-name">
                            <button type="button" aria-pressed={active} aria-describedby={`ski-compare-${area.id}`}
                                onClick={event => onSelect(area.id, event.currentTarget)}>
                                {area.name}
                            </button>
                            <span id={`ski-compare-${area.id}`} className="sr-only">{formatSkiLocation(area)}</span>
                        </th>
                        {visibleColumns.slice(1).map(({ key }) => <td key={key}
                            className={key === 'region' ? 'ski-compare-region' : undefined} data-numeric={mountainOverview.has(key) || undefined}>
                            {formatSkiStat(area, key, units, conditions) ?? <><span aria-hidden="true" className="ski-compare-missing">—</span><span className="sr-only">Unknown</span></>}
                        </td>)}
                    </tr>;
                })}</tbody>
            </table>
        </div>
    </div>;
}
