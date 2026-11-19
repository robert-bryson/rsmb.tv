import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { IntentLink } from '../components/IntentLink';
import { MapSkipLink } from '../components/MapSkipLink';
import {
    filterSkiAreas, readPassFilter, readSkiResultsView, readSkiSort, skiResultsViews, sortSkiAreas, type SkiResultsView, type SkiSort, type SkiUnits,
} from '../features/ski-status/browse';
import { locationAttribution, locationLicense, passNames, passSeason, skiAreas } from '../features/ski-status/catalog';
import { markerLegend, markerModes, readMarkerMode } from '../features/ski-status/mapAppearance';
import { SkiAreaDetails } from '../features/ski-status/SkiAreaDetails';
import { SkiAreaTable } from '../features/ski-status/SkiAreaTable';
import { SkiPassIcon } from '../features/ski-status/SkiPassIcon';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { usePersistedState } from '../hooks/usePersistedState';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { MAPLIBRE_STYLESHEET, moduleLoader } from '../navigation/moduleLoader';
import { staticPageMetadata } from '../utils/pageMetadata';
import locationDownload from '../../projects/ski-status/data/locations.json?url';

const SkiStatusMap = lazy(moduleLoader(() => import('../features/ski-status/SkiStatusMap'), MAPLIBRE_STYLESHEET));
const regions = [...new Set(skiAreas.flatMap(area => area.region.split('/')))].sort();
const inputClass = 'min-h-11 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 text-base text-zinc-100 focus-visible:border-cyan-300 focus-visible:outline-1 focus-visible:outline-cyan-300';
const filterClass = 'grid min-w-0 gap-1 text-xs text-zinc-300';
const layouts: Record<SkiResultsView, string> = {
    map: 'grid-rows-[minmax(14rem,1fr)_auto] lg:grid-cols-[clamp(16rem,24vw,24rem)_minmax(0,1fr)]',
    split: 'grid-rows-[minmax(17rem,1fr)_minmax(17rem,1fr)] lg:grid-cols-2',
    table: 'grid-rows-[minmax(14rem,1fr)] lg:grid-cols-[minmax(0,1fr)_clamp(16rem,24vw,24rem)]',
};

function MapMessage({ failed = false }: { failed?: boolean }) {
    return <div className="grid h-full place-items-center p-5 text-center text-sm text-zinc-300" role={failed ? 'alert' : 'status'}>
        {failed ? <div><p>Map unavailable. Browse areas in the table.</p>
            <button type="button" onClick={() => window.location.reload()} className="min-h-11 text-cyan-300 underline">Reload map</button>
        </div> : 'Loading map…'}
    </div>;
}

export default function SkiStatus() {
    usePageMetadata(staticPageMetadata('/projects/ski-status/map'));
    const { query, updateQuery, commitQuery, searchParams, updateParams } = useSearchQuery();
    const [storedUnits, setUnits] = usePersistedState<SkiUnits>('ski-status-units', 'imperial');
    const units = storedUnits === 'metric' ? 'metric' : 'imperial';
    const wide = useMediaQuery('(min-width: 64rem)');
    const view = readSkiResultsView(searchParams, wide);
    const showMap = wide || view !== 'table';
    const showTable = wide || view !== 'map';
    const [mapOpened, setMapOpened] = useState(showMap);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [visibleAreaIds, setVisibleAreaIds] = useState<ReadonlySet<string>>();
    // Load the map when first visible. Keep its camera and renderer between views.
    if (showMap && !mapOpened) setMapOpened(true);

    const regionParam = searchParams.get('region') ?? '';
    const region = regions.includes(regionParam) ? regionParam : '';
    const pass = readPassFilter(searchParams);
    const night = searchParams.get('night') === '1';
    const inView = searchParams.get('inView') === '1';
    const sort = readSkiSort(searchParams);
    const selectedId = searchParams.get('area');
    const colors = readMarkerMode(searchParams.get('color'));
    const terrain = searchParams.get('terrain') === '1';
    const legend = markerLegend(colors, units);
    const areas = useMemo(() => filterSkiAreas(skiAreas, query, region, pass, night), [query, region, pass, night]);
    const selected = areas.find(area => area.id === selectedId);
    const viewportIds = inView ? visibleAreaIds : undefined;
    const tableAreas = useMemo(() => viewportIds ? areas.filter(area => viewportIds.has(area.id)) : areas, [areas, viewportIds]);
    const sorted = useMemo(() => sortSkiAreas(tableAreas, { key: sort.key, direction: sort.direction }), [tableAreas, sort.key, sort.direction]);
    const selectedButton = useRef<HTMLButtonElement>(null);
    const mapButton = useRef<HTMLButtonElement>(null);
    const searchInput = useRef<HTMLInputElement>(null);

    function setParam(key: string, value?: string) {
        updateParams(params => {
            if (value) params.set(key, value);
            else params.delete(key);
        });
    }

    function setSort(key: SkiSort['key']) {
        const direction = sort.key === key ? (sort.direction === 'asc' ? 'desc' : 'asc')
            : key === 'name' || key === 'region' ? 'asc' : 'desc';
        setParam('sort', `${key}:${direction}`);
    }

    function selectArea(id: string) {
        setParam('area', id);
    }

    function updateVisibleAreas(ids: ReadonlySet<string>) {
        setVisibleAreaIds(previous => previous && previous.size === ids.size && [...ids].every(id => previous.has(id)) ? previous : ids);
    }

    function closeDetails() {
        const target = showTable ? selectedButton.current : mapButton.current;
        (target ?? searchInput.current)?.focus();
        setParam('area');
    }

    const hasFilters = Boolean(query || region || pass || night || inView);
    const needsMapView = inView && !viewportIds;
    return <main data-results-view={view} className="flex h-full min-w-0 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
        <MapSkipLink targetId="ski-area-search" />
        <header className="max-h-[50dvh] shrink-0 overflow-y-auto border-b border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 sm:px-4">
                <div className="flex items-center gap-2 sm:gap-4">
                    <IntentLink to="/projects" className="inline-flex min-h-11 items-center text-xs text-zinc-300 underline underline-offset-4 hover:text-cyan-300">Projects</IntentLink>
                    <h1 className="text-xl font-semibold tracking-tight">ski-status</h1>
                    <p className="hidden text-xs text-zinc-400 sm:block">{passSeason} pass season</p>
                </div>
                <div role="group" aria-label="Results view" className="flex rounded-lg border border-zinc-700 p-0.5">
                    {skiResultsViews.map(({ id, label }) => <button key={id} type="button" ref={id === 'map' ? mapButton : undefined}
                        aria-pressed={view === id} onClick={() => { if (view !== id) setParam('view', id); }}
                        className={`min-h-10 rounded-md px-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-cyan-300 sm:px-4 ${view === id ? 'bg-cyan-950 text-cyan-100' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'}`}>
                        {label}
                    </button>)}
                </div>
            </div>
            <section aria-label="Ski area filters" className="flex flex-wrap items-end gap-2 px-3 pb-2 sm:gap-x-3 sm:px-4">
                <label className={`${filterClass} min-w-36 flex-1 sm:min-w-48`}>
                    <span className="sr-only sm:not-sr-only">Search areas</span>
                    <input ref={searchInput} type="search" id="ski-area-search" value={query} onChange={event => updateQuery(event.target.value)} onBlur={commitQuery}
                        onKeyDown={event => { if (event.key === 'Enter') commitQuery(); }} placeholder="Search by name or place" className={inputClass} />
                </label>
                <button type="button" aria-expanded={filtersOpen} aria-controls="ski-filter-options" onClick={() => setFiltersOpen(open => !open)}
                    className="min-h-11 rounded-md border border-zinc-700 px-3 text-sm text-zinc-200 hover:border-cyan-300 sm:hidden">Filters</button>
                <div id="ski-filter-options" className={`${filtersOpen ? 'grid' : 'hidden'} w-full grid-cols-2 flex-wrap items-end gap-2 sm:flex sm:w-auto sm:gap-x-3`}>
                    <div className={filterClass}>
                        <label htmlFor="ski-region">Region</label>
                        <select id="ski-region" value={region} onChange={event => setParam('region', event.target.value)} className={inputClass}>
                            <option value="">All regions</option>{regions.map(code => <option key={code} value={code}>{code}</option>)}
                        </select>
                    </div>
                    <div className={filterClass}>
                        <label htmlFor="ski-pass" className="flex items-center gap-1.5">
                            {pass && <SkiPassIcon family={pass} />}Pass
                        </label>
                        <select id="ski-pass" value={pass ?? ''} onChange={event => setParam('pass', event.target.value)} className={inputClass}>
                            <option value="">All ski areas</option>{Object.entries(passNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                        </select>
                    </div>
                    <div className={filterClass}>
                        <label htmlFor="ski-units">Units</label>
                        <select id="ski-units" value={units} onChange={event => setUnits(event.target.value === 'metric' ? 'metric' : 'imperial')} className={inputClass}>
                            <option value="imperial">Acres / feet</option><option value="metric">Hectares / meters</option>
                        </select>
                    </div>
                    <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-300">
                        <input type="checkbox" checked={night} onChange={event => setParam('night', event.target.checked ? '1' : undefined)}
                            className="size-4 accent-cyan-400" /> Night skiing
                    </label>
                </div>
            </section>
            <div className="flex min-h-8 flex-wrap items-center gap-x-4 px-3 pb-1 text-xs sm:px-4">
                <p aria-live="polite" className="tabular-nums text-zinc-300">{tableAreas.length} of {skiAreas.length} ski areas</p>
                <label className="inline-flex min-h-8 items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={inView} onChange={event => setParam('inView', event.target.checked ? '1' : undefined)}
                        aria-describedby={needsMapView ? 'ski-view-hint' : undefined} className="size-4 accent-cyan-400" /> In map view
                </label>
                {hasFilters && <button type="button" onClick={() => updateParams(params => {
                    for (const key of ['q', 'region', 'pass', 'night', 'inView']) params.delete(key);
                })} className="min-h-8 text-cyan-300 underline underline-offset-4">Clear filters</button>}
                {needsMapView && <span id="ski-view-hint" className="text-zinc-400">
                    {showMap ? 'Waiting for a map view.' : 'Open Map to set the area.'}
                </span>}
                {selected && <a href="#ski-area-details" aria-label={`${selected.name} details`}
                    className="inline-flex min-h-8 items-center text-cyan-300 underline underline-offset-4">{selected.name}</a>}
                {selected && viewportIds && !viewportIds.has(selected.id) && <span className="text-zinc-400">Selected area is outside the map view.</span>}
            </div>
        </header>
        <div className={`grid min-h-0 flex-1 gap-px overflow-auto bg-zinc-800 lg:grid-rows-[minmax(0,1fr)] ${layouts[view]}`}>
            <section aria-label="Ski area statistics" className={`min-h-0 min-w-0 flex-col bg-zinc-950 ${showTable || selected ? 'flex' : 'hidden'} ${view === 'map' ? 'max-lg:order-last' : ''}`}>
                <div className={showTable ? 'min-h-0 flex-1' : 'hidden'}>
                    <SkiAreaTable areas={sorted} units={units} sort={sort} selected={selected} compact={view === 'map'} inView={Boolean(viewportIds)}
                        selectedButtonRef={selectedButton} onSort={setSort} onSelect={selectArea} />
                </div>
                {selected && <div key={selected.id} className={`shrink-0 overflow-y-auto border-t border-zinc-700 ${showTable ? 'max-h-[min(42%,20rem)]' : 'max-h-[32dvh]'}`}>
                    <SkiAreaDetails area={selected} units={units} onClose={closeDetails} />
                </div>}
            </section>
            <section aria-label="Map of ski areas" className={`${showMap ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col bg-zinc-950`}>
                <div className="flex flex-wrap items-center gap-x-3 border-b border-zinc-800 px-2 text-sm text-zinc-300">
                    <div className="flex min-w-0 items-center gap-2 py-1">
                        <label htmlFor="ski-marker-color" className="shrink-0">Color by</label>
                        <select id="ski-marker-color" value={colors} onChange={event => setParam('color', event.target.value === 'default' ? undefined : event.target.value)} className={inputClass}>
                            {Object.entries(markerModes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </div>
                    <label className="flex min-h-11 items-center gap-2" title="Shows shaded elevation at zoom 8 and closer">
                        <input type="checkbox" checked={terrain} onChange={event => setParam('terrain', event.target.checked ? '1' : undefined)}
                            className="size-4 accent-cyan-400" /> Terrain relief
                    </label>
                </div>
                {legend.length > 0 && <ul aria-label="Resort dot legend" className="flex flex-wrap gap-x-3 gap-y-1 border-b border-zinc-800 px-3 py-2 text-xs text-zinc-300">
                    {legend.map(({ color, label, family }) => <li key={label} className="flex items-center gap-1.5">
                        {family ? <SkiPassIcon family={family} /> : <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: color }} />}{label}
                    </li>)}
                </ul>}
                <div className="min-h-0 flex-1">
                    {(showMap || mapOpened) && <ErrorBoundary fallback={<MapMessage failed />}><Suspense fallback={<MapMessage />}>
                        <SkiStatusMap areas={areas} selected={selected} colors={colors} terrain={terrain} visible={showMap} inView={inView}
                            onVisibleAreasChange={updateVisibleAreas} onSelect={selectArea} />
                    </Suspense></ErrorBoundary>}
                </div>
            </section>
        </div>
        <footer className="flex shrink-0 flex-wrap gap-x-2 border-t border-zinc-800 px-3 text-xs leading-5 text-zinc-400 sm:px-4 sm:leading-6">
            <span>Locations</span>
            {Object.entries(locationAttribution).map(([name, url]) => <a key={name} href={url} className="underline underline-offset-2 hover:text-zinc-200">{name}</a>)}
            <a href={locationDownload} download="ski-status-locations.json" className="underline underline-offset-2 hover:text-zinc-200">Marker data</a>
            <a href={locationLicense} className="underline underline-offset-2 hover:text-zinc-200">ODbL</a>
        </footer>
    </main>;
}
