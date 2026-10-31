import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import type { BlogCountry } from '../../../content/blogRegions';
import { atlasFilterCount, atlasSortOptions, type AtlasFilters, type AtlasPanelState, type AtlasResultsView, type AtlasSort } from './tripAtlasBrowser';
import { AtlasAppliedFilters, TripAtlasFilters } from './TripAtlasFilters';

interface Props {
    state: AtlasPanelState;
    view: AtlasResultsView;
    sort: AtlasSort;
    filters: AtlasFilters;
    countries: BlogCountry[];
    selectedId?: string;
    onlySelected: boolean;
    count: number;
    total: number;
    loadedRoutes: number;
    routeCount: number;
    listRef: RefObject<HTMLDivElement | null>;
    onState: (state: AtlasPanelState) => void;
    onView: (view: AtlasResultsView) => void;
    onSort: (sort: AtlasSort) => void;
    onFilters: (filters: AtlasFilters) => void;
    onOnlySelected: () => void;
    onClearFilters: () => void;
    onScroll: (scrollTop: number) => void;
    children: React.ReactNode;
}

export function TripAtlasPanel({ listRef, ...props }: Props) {
    const { onScroll } = props;
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filterButton = useRef<HTMLButtonElement>(null);
    const handle = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLElement>(null);
    const tools = useRef<HTMLDivElement>(null);
    const anchor = useRef<{ id: string; offset: number } | undefined>(undefined);
    const open = props.state !== 'collapsed';
    const activeFilters = atlasFilterCount(props.filters) + Number(props.onlySelected);
    const rememberAnchor = () => {
        const list = listRef.current;
        if (!list || !open) return;
        const top = list.getBoundingClientRect().top + (tools.current?.getBoundingClientRect().height ?? 0);
        const first = [...list.querySelectorAll<HTMLElement>('[data-trip-id]')].find(element => element.getBoundingClientRect().bottom > top);
        if (first?.dataset.tripId) anchor.current = { id: first.dataset.tripId, offset: first.getBoundingClientRect().top - top };
    };
    useLayoutEffect(() => {
        const saved = anchor.current;
        const list = listRef.current;
        if (!open || !saved || !list) return;
        const result = document.getElementById(`atlas-card-${saved.id}`);
        if (result) {
            const top = list.getBoundingClientRect().top + (tools.current?.getBoundingClientRect().height ?? 0);
            list.scrollTop += result.getBoundingClientRect().top - top - saved.offset;
            onScroll(list.scrollTop);
        }
        anchor.current = undefined;
    }, [open, props.state, props.view, onScroll, listRef]);
    const changeState = (state: AtlasPanelState) => {
        if (state === props.state) return;
        const tableVisible = props.state === 'expanded' && props.view === 'table';
        const nextTableVisible = state === 'expanded' && props.view === 'table';
        if (tableVisible !== nextTableVisible) {
            anchor.current = undefined;
            if (listRef.current) listRef.current.scrollTop = 0;
            onScroll(0);
        } else rememberAnchor();
        if (state === 'collapsed' && panel.current?.contains(document.activeElement)) handle.current?.focus({ preventScroll: true });
        props.onState(state);
    };
    const closeFilters = () => {
        setFiltersOpen(false);
        filterButton.current?.focus({ preventScroll: true });
    };
    return <div className="atlas-drawer">
        <button ref={handle} id="atlas-panel-toggle" type="button" aria-expanded={open} aria-controls="atlas-trip-panel"
            aria-label={open ? 'Collapse trip panel' : 'Show trips'} title={open ? 'Collapse trip panel' : 'Show trips'}
            className="atlas-panel-handle" onClick={() => { handle.current?.focus({ preventScroll: true }); changeState(open ? 'collapsed' : 'compact'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <aside ref={panel} id="atlas-trip-panel" aria-label="Trip reports" aria-hidden={!open} inert={!open} className="atlas-panel">
            <header className="shrink-0 border-b border-zinc-700 px-4 py-3">
                <Link to="/projects" className="inline-flex min-h-6 items-center text-xs text-zinc-400 hover:text-violet-300">← Projects</Link>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">ADV Atlas</h1>
                    <div role="group" aria-label="Trip panel size" className="inline-flex rounded-lg border border-zinc-700 p-0.5">
                        <button type="button" aria-label="Use compact trip panel" aria-pressed={props.state === 'compact'} onClick={() => changeState('compact')}
                            className="atlas-control px-2 text-xs">Compact</button>
                        <button type="button" aria-label="Expand trip panel" aria-pressed={props.state === 'expanded'} onClick={() => changeState('expanded')}
                            className="atlas-control px-2 text-xs">Expand</button>
                    </div>
                </div>
                <p className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-zinc-400">
                    <span>{props.count} of {props.total} trips</span><span>{props.loadedRoutes}/{props.routeCount} routes</span>
                </p>
            </header>
            <div id="atlas-trip-list" ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]"
                onClickCapture={event => { if (open) onScroll(event.currentTarget.scrollTop); }}
                onScroll={event => { if (open) props.onScroll(event.currentTarget.scrollTop); }}>
                <div ref={tools} className="atlas-browser-tools sticky top-0 z-10 -mx-1 mb-3 bg-zinc-950 px-1 pb-1">
                <div className="mb-2 flex flex-wrap items-end gap-2">
                    <label className="min-w-0 flex-1 text-xs text-zinc-400">
                        <span className="mb-1 block">Sort trips</span>
                        <select value={props.sort} onChange={event => props.onSort(event.target.value as AtlasSort)}
                            className="atlas-input w-full">
                            {atlasSortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </label>
                    <button ref={filterButton} id="atlas-filters-toggle" type="button" aria-expanded={filtersOpen} aria-controls="atlas-filter-form"
                        onClick={() => setFiltersOpen(value => !value)} className="atlas-control px-3">
                        Filters{activeFilters ? ` (${activeFilters})` : ''}
                    </button>
                </div>
                {props.state === 'expanded' && <fieldset className="mb-3 flex items-center gap-1 rounded-lg border border-zinc-700 p-1">
                    <legend className="sr-only">Trip results view</legend>
                    {(['cards', 'table'] as const).map(view => <label key={view} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md text-sm ${props.view === view ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400'}`}>
                        <input type="radio" name="atlas-results-view" value={view} checked={props.view === view} onChange={() => props.onView(view)} className="size-3.5 accent-violet-400" />
                        {view === 'cards' ? 'Cards' : 'Table'}
                    </label>)}
                </fieldset>}
                </div>
                {filtersOpen && <div id="atlas-filter-form"><TripAtlasFilters key={JSON.stringify(props.filters)} filters={props.filters} countries={props.countries}
                    onApply={filters => { props.onFilters(filters); closeFilters(); }} onCancel={closeFilters} /></div>}
                {props.selectedId && <button type="button" aria-pressed={props.onlySelected} onClick={props.onOnlySelected}
                    className="atlas-control mb-3 flex w-full items-center justify-between gap-2 px-3 text-left text-xs">
                    <span>Show only selected trip</span><span aria-hidden="true">{props.onlySelected ? 'On' : 'Off'}</span>
                </button>}
                <AtlasAppliedFilters filters={props.filters} countries={props.countries} onlySelected={props.onlySelected}
                    onChange={filters => { props.onFilters(filters); filterButton.current?.focus({ preventScroll: true }); }}
                    onClearSelected={() => { props.onOnlySelected(); filterButton.current?.focus({ preventScroll: true }); }}
                    onClear={() => { props.onClearFilters(); closeFilters(); }} />
                <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{props.count} of {props.total} trips</p>
                {props.children}
            </div>
        </aside>
    </div>;
}
