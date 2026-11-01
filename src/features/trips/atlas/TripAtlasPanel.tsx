import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import type { BlogCountry } from '../../../content/blogRegions';
import { atlasFilterCount, type AtlasFilters, type AtlasPanelState, type AtlasResultsView, type AtlasSort } from './tripAtlasBrowser';
import { AtlasAppliedFilters, TripAtlasFilters } from './TripAtlasFilters';
import { TripAtlasSort } from './TripAtlasSort';
import { TripAtlasViewToggle } from './TripAtlasViewToggle';
import { useAtlasPanelDrag } from './useAtlasPanelDrag';

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
    const drawer = useRef<HTMLDivElement>(null);
    const panel = useRef<HTMLElement>(null);
    const anchor = useRef<{ id: string; offset: number } | undefined>(undefined);
    const open = props.state !== 'collapsed';
    const activeFilters = atlasFilterCount(props.filters) + Number(props.onlySelected);
    const rememberAnchor = () => {
        const list = listRef.current;
        if (!list || !open) return;
        const top = list.getBoundingClientRect().top;
        const first = [...list.querySelectorAll<HTMLElement>('[data-trip-id]')].find(element => element.getBoundingClientRect().bottom > top);
        if (first?.dataset.tripId) anchor.current = { id: first.dataset.tripId, offset: first.getBoundingClientRect().top - top };
    };
    useLayoutEffect(() => {
        const saved = anchor.current;
        const list = listRef.current;
        if (!open || !saved || !list) return;
        const result = document.getElementById(`atlas-card-${saved.id}`);
        if (result) {
            const top = list.getBoundingClientRect().top;
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
    const toggleFilters = () => {
        if (!filtersOpen && listRef.current) {
            listRef.current.scrollTop = 0;
            onScroll(0);
        }
        setFiltersOpen(value => !value);
    };
    const dragHandlers = useAtlasPanelDrag(drawer, props.state, changeState);
    const singleState = props.state === 'compact' ? 'collapsed' : 'compact';
    const doubleState = props.state === 'expanded' ? 'collapsed' : 'expanded';
    const singleLabel = props.state === 'collapsed' ? 'Show trips' : props.state === 'expanded' ? 'Use compact trip panel' : 'Collapse trip panel';
    const doubleLabel = props.state === 'expanded' ? 'Collapse trip panel' : 'Expand trip panel';
    return <div ref={drawer} className="atlas-drawer">
        <div role="group" aria-label="Trip panel size" className="atlas-panel-handle" {...dragHandlers}>
            <button ref={handle} id="atlas-panel-toggle" type="button" aria-expanded={open} aria-controls="atlas-trip-panel"
                aria-label={singleLabel} data-atlas-tooltip={`${props.state === 'collapsed' ? 'Open the compact trip list' : props.state === 'expanded' ? 'Switch to the compact trip list' : 'Hide the trip panel'}. Drag this tab to resize.`}
                className="atlas-panel-arrow" data-direction={open ? 'decrease' : 'increase'}
                onClick={() => { handle.current?.focus({ preventScroll: true }); changeState(singleState); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
            </button>
            <button type="button" aria-controls="atlas-trip-panel" aria-label={doubleLabel} data-atlas-tooltip={`${props.state === 'expanded' ? 'Hide the trip panel completely' : 'Open the fully expanded trip panel'}. Drag this tab to resize.`}
                className="atlas-panel-arrow" data-direction={props.state === 'expanded' ? 'decrease' : 'increase'}
                onClick={event => { event.currentTarget.focus({ preventScroll: true }); changeState(doubleState); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m11 6-6 6 6 6m8-12-6 6 6 6" /></svg>
            </button>
        </div>
        <aside ref={panel} id="atlas-trip-panel" aria-label="Trip reports" aria-hidden={!open} inert={!open} className="atlas-panel">
            <header className="atlas-browser-tools shrink-0 border-b border-zinc-700 px-4 py-3">
                <Link to="/projects" className="inline-flex min-h-6 items-center text-xs text-zinc-400 hover:text-violet-300">← Projects</Link>
                <h1 className="mt-1 text-xl font-semibold tracking-tight">ADV Atlas</h1>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-zinc-400">{props.count} of {props.total} trips</p>
                    <div role="group" aria-label="Trip browsing controls" className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
                        {props.state === 'expanded' && <TripAtlasViewToggle value={props.view} onChange={props.onView} />}
                        {props.selectedId && <button type="button" aria-label="Show only selected trip" aria-pressed={props.onlySelected}
                            aria-controls="atlas-trip-list" data-atlas-tooltip={props.onlySelected ? 'Show all matching trips again.' : 'Show only the selected trip on the map and in the list.'}
                            onClick={event => { event.currentTarget.focus({ preventScroll: true }); props.onOnlySelected(); }} className="atlas-control atlas-icon-control">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
                                {props.onlySelected && <path d="m3 3 18 18" />}
                            </svg>
                        </button>}
                        {activeFilters > 0 && <button type="button" aria-label="Reset filters" data-atlas-tooltip="Clear all filters, including selected-trip-only. Keep the selected trip and sort order."
                            onClick={() => { props.onClearFilters(); closeFilters(); }} className="atlas-control atlas-icon-control">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /><path d="m10 9 5 5m0-5-5 5" />
                            </svg>
                        </button>}
                        <TripAtlasSort value={props.sort} onChange={props.onSort} />
                        <button ref={filterButton} id="atlas-filters-toggle" type="button" aria-expanded={filtersOpen} aria-controls="atlas-filter-form"
                            aria-label={`Filters${activeFilters ? ` (${activeFilters} active)` : ''}`}
                            data-atlas-tooltip={`${filtersOpen ? 'Close filters without applying changes' : 'Filter trips by dates, riding days, distance, or location'}.${activeFilters ? ` ${activeFilters} active ${activeFilters === 1 ? 'filter' : 'filters'}.` : ''}`}
                            onClick={toggleFilters} className="atlas-control atlas-icon-control relative">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4 5h16l-6 7v6l-4 2v-8Z" />
                            </svg>
                            {activeFilters > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-violet-400 px-1 text-[10px] font-semibold leading-4 text-zinc-950">{activeFilters}</span>}
                        </button>
                    </div>
                </div>
                <span role="status" className="sr-only">{props.loadedRoutes}/{props.routeCount} routes</span>
            </header>
            <div id="atlas-trip-list" ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]"
                onClickCapture={event => { if (open) onScroll(event.currentTarget.scrollTop); }}
                onScroll={event => { if (open) props.onScroll(event.currentTarget.scrollTop); }}>
                {filtersOpen && <div id="atlas-filter-form"><TripAtlasFilters key={JSON.stringify(props.filters)} filters={props.filters} countries={props.countries}
                    onApply={filters => { props.onFilters(filters); closeFilters(); }} onCancel={closeFilters} /></div>}
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
