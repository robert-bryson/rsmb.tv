import { Link } from 'react-router-dom';
import { useMemo, useState, type CSSProperties, type FocusEvent, type MouseEvent, type PointerEvent } from 'react';
import { formatDateRange } from '../../../utils/formatDate';
import type { TripAtlasEntry } from './tripAtlasEntries';
import { tripAtlasColor, type AtlasRouteState } from './tripAtlasView';
import { atlasLocationLabel, atlasLocations, atlasSortOptions, type AtlasResultsView, type AtlasSort } from './tripAtlasBrowser';
import { getCountryName } from '../../../content/blogRegions';
import { usePersistedState } from '../../../hooks/usePersistedState';
import { TripAtlasColumnSettings } from './TripAtlasColumnSettings';
import { atlasTableColumns, atlasTableColumnsStorageKey, defaultAtlasTableColumns, readAtlasTableColumns, type AtlasTableColumnId } from './tripAtlasTableColumns';

interface Props {
    entries: TripAtlasEntry[];
    routes: Record<string, AtlasRouteState>;
    selectedId?: string;
    highlightedId?: string;
    expanded: boolean;
    view: AtlasResultsView;
    sort: AtlasSort;
    development: boolean;
    returnUrl: string;
    returnKey: string;
    onSort: (sort: AtlasSort) => void;
    onSelect: (id: string) => void;
    onHover: (id?: string) => void;
    onFocus: (id?: string) => void;
}

function formatAtlasMiles(value?: number) {
    return value === undefined ? 'Not recorded' : value.toLocaleString('en', { maximumFractionDigits: 20 });
}

function CardPhoto({ entry, expanded }: { entry: TripAtlasEntry; expanded: boolean }) {
    const [failed, setFailed] = useState(false);
    const photo = entry.summary?.hero;
    if (!photo) return <div role="img" aria-label="Trip photo not available yet" className="atlas-trip-photo grid place-items-center bg-zinc-900 p-3 text-sm text-zinc-400">Photos not available yet</div>;
    return failed ? <div role="img" aria-label={photo.alt} className="atlas-trip-photo grid place-items-center bg-zinc-800 p-3 text-sm text-zinc-400">Photo unavailable</div> : (
        <img src={photo.src} srcSet={photo.srcSet} sizes={expanded ? '(min-width: 768px) 220px, 80px' : '(min-width: 768px) 326px, 80px'}
            width={photo.width} height={photo.height} alt={photo.alt} loading="lazy" decoding="async"
            onError={() => setFailed(true)} className="atlas-trip-photo w-full object-cover" />
    );
}

function ResultBadges({ entry, development }: { entry: TripAtlasEntry; development: boolean }) {
    if (!development) return null;
    const drafts = entry.reports.filter(report => report.draft).length;
    return <>
        {drafts > 0 && <p className="mt-2"><span className="inline-flex rounded border border-amber-800/70 bg-amber-950/40 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            DEV · {drafts === entry.reports.length ? 'Unpublished draft' : 'Includes drafts'}
        </span></p>}
        {(!entry.summary || entry.reports.some(report => !report.contentAvailable)) && <p className="mt-2 text-xs text-amber-300/90">DEV · Incomplete preview</p>}
    </>;
}

function ResultActions({ entry, props }: { entry: TripAtlasEntry; props: Props }) {
    const active = entry.id === props.selectedId;
    const state = props.routes[entry.id];
    return <>
        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
            <button id={`atlas-route-${entry.id}`} type="button" aria-pressed={active} disabled={!entry.summary}
                aria-label={`Show route: ${entry.title}`} onClick={() => props.onSelect(entry.id)}
                className="atlas-control px-3 py-2 transition-colors enabled:hover:text-[color:var(--trip-atlas-color)]">
                Show route
            </button>
            <div className="flex min-w-0 flex-col gap-2">
                {entry.reports.map(report => <Link key={report.slug} to={report.href} state={{ from: props.returnUrl, returnKey: props.returnKey }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--trip-atlas-color)] px-3 py-2 text-center text-sm font-semibold leading-snug text-zinc-950 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--trip-atlas-color)]">
                    <span className="min-w-0 break-words">
                        {entry.reports.length === 1 ? entry.summary && report.contentAvailable ? 'Read trip report' : 'Preview report' : report.title}
                        {props.development && report.draft && entry.reports.length > 1 && <span className="ml-1 inline-block rounded border border-amber-800 bg-amber-950 px-1.5 py-0.5 text-[11px] font-medium text-amber-300">Draft</span>}
                    </span><span aria-hidden="true" className="shrink-0">→</span>
                </Link>)}
            </div>
        </div>
        {!entry.summary ? <p className="mt-2 text-xs text-zinc-400">Route data not available yet.</p>
            : state?.error ? <p role="status" className="mt-2 text-xs text-amber-300">Route unavailable. <button type="button" onClick={state.retry} className="min-h-11 underline">Retry route</button></p>
                : !state?.route && <p role="status" className="mt-2 text-xs text-zinc-500">Loading route…</p>}
    </>;
}

function TableLocation({ entry }: { entry: TripAtlasEntry }) {
    const locations = atlasLocations(entry);
    if (!locations.length) return <>Not recorded</>;
    const regions = locations.reduce((total, location) => total + location.regions.length, 0);
    return <>
        <p>{locations.map(location => getCountryName(location.code)).sort().join(' · ')}</p>
        {regions > 0 && <details className="mt-1 text-xs">
            <summary className="min-h-11 cursor-pointer py-3 text-violet-300">{regions} {regions === 1 ? 'region' : 'regions'}</summary>
            <p className="pb-2 leading-relaxed">{atlasLocationLabel(entry)}</p>
        </details>}
    </>;
}

export function TripAtlasResults(props: Props) {
    const [storedColumns, setStoredColumns] = usePersistedState<unknown>(atlasTableColumnsStorageKey, defaultAtlasTableColumns());
    const columnSettings = useMemo(() => readAtlasTableColumns(storedColumns), [storedColumns]);
    const columns = columnSettings.filter(setting => setting.visible).map(setting => atlasTableColumns.find(column => column.id === setting.id)!);
    const actionsVisible = columns.some(column => column.id === 'actions');
    const cellContent = (entry: TripAtlasEntry, column: Exclude<AtlasTableColumnId, 'trip'>) => {
        switch (column) {
            case 'motorcycle': return entry.summary?.motorcycle ?? 'Not recorded';
            case 'dates': return entry.summary ? formatDateRange(entry.summary.dates.start, entry.summary.dates.end) : 'Not recorded';
            case 'days': return entry.summary?.ridingDays ?? 'Not recorded';
            case 'miles': return formatAtlasMiles(entry.summary?.distanceMiles);
            case 'location': return <TableLocation entry={entry} />;
            case 'actions': return <ResultActions entry={entry} props={props} />;
        }
    };
    const attributes = (entry: TripAtlasEntry) => {
        const active = props.selectedId === entry.id;
        const highlighted = props.highlightedId === entry.id;
        const color = tripAtlasColor(entry.id);
        return {
            id: `atlas-card-${entry.id}`,
            'data-trip-id': entry.id,
            'data-selected': active || undefined,
            'data-highlighted': highlighted || undefined,
            onClick: (event: MouseEvent<HTMLElement>) => {
                if (entry.summary && !event.defaultPrevented && event.target instanceof Element
                    && !event.target.closest('a, button, input, select, textarea, summary, details, [role="button"], [contenteditable]')) props.onSelect(entry.id);
            },
            onPointerEnter: (event: PointerEvent<HTMLElement>) => { if (event.pointerType !== 'touch') props.onHover(entry.summary ? entry.id : undefined); },
            onPointerLeave: () => props.onHover(undefined),
            onFocusCapture: () => props.onFocus(entry.summary ? entry.id : undefined),
            onBlurCapture: (event: FocusEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget)) props.onFocus(undefined); },
            style: { '--trip-atlas-color': color, borderColor: active || highlighted ? color : '#27272a' } as CSSProperties,
        };
    };
    if (props.expanded && props.view === 'table') return <div className="atlas-table-shell">
        <TripAtlasColumnSettings columns={columnSettings} onChange={setStoredColumns} />
        <div role="region" aria-label="Trip comparison table" tabIndex={0}
            className="overflow-x-auto rounded-xl border border-zinc-700 focus-visible:outline-2 focus-visible:outline-violet-400">
        <table aria-label="Trip comparison" className="w-full border-separate border-spacing-0 text-left text-sm"
            style={{ minWidth: columns.reduce((width, column) => width + column.minWidth, 0) }}>
            <thead className="bg-zinc-900 text-xs text-zinc-200"><tr>
                {columns.map(column => <th key={column.id} scope="col" style={{ minWidth: column.minWidth }} className={`px-3 ${column.id === 'trip' ? 'sticky left-0 z-2 bg-zinc-900' : ''}`}
                    aria-sort={'ascending' in column ? props.sort === column.ascending ? 'ascending' : props.sort === column.descending ? 'descending' : undefined : undefined}>
                    {'ascending' in column ? <button type="button" className="flex min-h-11 items-center gap-2 whitespace-nowrap text-left"
                        data-atlas-tooltip={`Sort by ${atlasSortOptions.find(option => option.value === (props.sort === column.ascending ? column.descending : column.ascending))?.label.toLowerCase()}.`}
                        onClick={() => props.onSort(props.sort === column.ascending ? column.descending : column.ascending)}>
                        {column.name}<span aria-hidden="true">{props.sort === column.ascending ? '↑' : props.sort === column.descending ? '↓' : '↕'}</span>
                    </button> : column.name}
                </th>)}
            </tr></thead>
            <tbody>{props.entries.map(entry => <tr key={entry.id} {...attributes(entry)} className={`atlas-table-row align-top ${entry.summary ? 'cursor-pointer' : ''}`}>
                {columns.map(column => column.id === 'trip' ? <th key={column.id} scope="row" style={{ minWidth: column.minWidth }}
                    className="sticky left-0 z-1 bg-zinc-950 p-3 font-normal">
                    <h2 className="font-semibold text-zinc-100"><button type="button" id={actionsVisible ? `atlas-title-${entry.id}` : `atlas-route-${entry.id}`}
                        disabled={!entry.summary} aria-pressed={entry.id === props.selectedId} onClick={() => props.onSelect(entry.id)}
                        className="min-h-11 text-left enabled:hover:text-violet-300 focus-visible:outline-2 focus-visible:outline-violet-400">
                        {entry.title}
                    </button></h2>
                    {entry.id === props.selectedId && <span className="text-xs text-violet-300">Selected</span>}
                    <ResultBadges entry={entry} development={props.development} />
                </th> : <td key={column.id} style={{ minWidth: column.minWidth }} className="p-3 tabular-nums text-zinc-300">
                    {cellContent(entry, column.id)}
                </td>)}
            </tr>)}</tbody>
        </table>
        </div>
    </div>;

    return <ol className="space-y-3">{props.entries.map(entry => {
        const summary = entry.summary;
        const geography = atlasLocationLabel(entry);
        return <li key={entry.id} {...attributes(entry)} data-detailed={props.expanded || undefined}
            className={`atlas-trip-card overflow-hidden rounded-xl border-2 ${summary ? 'cursor-pointer' : ''} ${props.selectedId === entry.id || props.highlightedId === entry.id ? 'bg-zinc-900' : 'bg-zinc-950'}`}>
            <CardPhoto entry={entry} expanded={props.expanded} />
            <div className="atlas-trip-content min-w-0 p-3">
                <div className="atlas-trip-heading min-w-0">
                <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tripAtlasColor(entry.id) }} />
                    <span>{summary ? formatDateRange(summary.dates.start, summary.dates.end) : 'Trip dates not set'}</span>
                    {props.selectedId === entry.id && <span className="ml-auto text-zinc-100">Selected</span>}
                </div>
                <h2 className="text-base font-semibold leading-snug">{entry.title}</h2>
                <ResultBadges entry={entry} development={props.development} />
                </div>
                <p className="atlas-trip-description mt-2 text-sm leading-relaxed text-zinc-400">{entry.description}</p>
                {props.expanded ? <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div><dt className="text-zinc-500">Distance</dt><dd className="mt-0.5 text-zinc-200">{formatAtlasMiles(summary?.distanceMiles)}{summary?.distanceMiles !== undefined && ' mi'}</dd></div>
                    <div><dt className="text-zinc-500">Riding days</dt><dd className="mt-0.5 text-zinc-200">{summary?.ridingDays ?? 'Not recorded'}</dd></div>
                    <div className="col-span-2"><dt className="text-zinc-500">Motorcycle</dt><dd className="mt-0.5 text-zinc-200">{summary?.motorcycle ?? 'Not recorded'}</dd></div>
                </dl> : <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-300">
                    {summary?.distanceMiles !== undefined && <span>{formatAtlasMiles(summary.distanceMiles)} mi</span>}
                    {summary?.ridingDays !== undefined && <span>{summary.ridingDays} riding days</span>}
                    {summary?.motorcycle && <span>{summary.motorcycle}</span>}
                </p>}
                {(geography || props.expanded) && <p className="mt-2 text-xs leading-relaxed text-zinc-400">{geography || 'Location not recorded'}</p>}
                <ResultActions entry={entry} props={props} />
            </div>
        </li>;
    })}</ol>;
}
