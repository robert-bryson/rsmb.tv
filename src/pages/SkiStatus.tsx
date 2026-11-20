import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { IntentLink } from '../components/IntentLink';
import { MapSkipLink } from '../components/MapSkipLink';
import {
    defaultSkiColumns, filterSkiAreas, passFilterOptions, readSkiResultsView, readSkiSort, skiingFilterOptions, sortSkiAreas,
    visibleSkiColumns, type ColumnKey, type SkiResultsView, type SkiSort, type SkiUnits,
} from '../features/ski-status/browse';
import { locationAttribution, locationLicense, passFamilySchema, passNames, skiAreas } from '../features/ski-status/catalog';
import { matchesOperatingStatus, skiDayStatus, statusFilterLabels, type ResortStatus } from '../features/ski-status/conditions';
import { readMarkerMode } from '../features/ski-status/mapAppearance';
import { resortTerrainGroups, type TerrainConvention } from '../features/ski-status/resortTerrain';
import { SkiAreaDetails } from '../features/ski-status/SkiAreaDetails';
import { SkiAreaList } from '../features/ski-status/SkiAreaList';
import { SkiAreaTable } from '../features/ski-status/SkiAreaTable';
import { SkiColumnSettings } from '../features/ski-status/SkiColumnSettings';
import { SkiDialog, SkiFilterDialog, SkiLayerDialog, SkiTerrainKey } from '../features/ski-status/SkiControls';
import { SkiPassIcon } from '../features/ski-status/SkiPassIcon';
import { SkiShareButton } from '../features/ski-status/SkiShareButton';
import { readSkiFilters, regionLabels, writeSkiPassFilter, type SkiStatusFilter } from '../features/ski-status/skiFilters';
import { readSkiMapArea, readSkiMapCamera, skiMapAreaContains } from '../features/ski-status/skiMapArea';
import { seasonMonths } from '../features/ski-status/seasons';
import { downloadSkiAreaCsv, skiAreaCsv } from '../features/ski-status/skiCsv';
import { useSkiConditions } from '../features/ski-status/useSkiConditions';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { usePersistedState } from '../hooks/usePersistedState';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { MAPLIBRE_STYLESHEET, moduleLoader } from '../navigation/moduleLoader';
import { staticPageMetadata } from '../utils/pageMetadata';
import locationDownload from '../../projects/ski-status/data/locations.json?url';
import terrainDownload from '../../projects/ski-status/data/resort-terrain.pmtiles?url';
import '../features/ski-status/skiStatus.css';

const SkiStatusMap = lazy(moduleLoader(() => import('../features/ski-status/SkiStatusMap'), MAPLIBRE_STYLESHEET));
const areaById = new Map(skiAreas.map(area => [area.id, area]));
const clearable = ['q', 'region', 'pass', 'product', 'skiDate', 'homeArea', 'skiing', 'night', 'inView', 'mapArea', 'seasonMonth'];

function MapMessage({ failed = false }: { failed?: boolean }) {
    return <div className="grid h-full place-items-center p-5 text-center text-sm text-slate-300" role={failed ? 'alert' : 'status'}>
        {failed ? <div><p>Map unavailable. Browse ski areas in Results or Compare.</p>
            <button type="button" onClick={() => window.location.reload()} className="ski-control mt-2">Reload map</button>
        </div> : 'Loading map…'}
    </div>;
}

function matchesStatus(filter: SkiStatusFilter, status: ResortStatus) {
    return filter === 'all' || matchesOperatingStatus(status, filter === 'today' ? 'open' : filter);
}

export default function SkiStatus() {
    usePageMetadata(staticPageMetadata('/projects/ski-status/map'));
    const { query, updateQuery, commitQuery, searchParams, updateParams } = useSearchQuery();
    const location = useLocation();
    const navigation = useNavigationType();
    const [storedUnits, setUnits] = usePersistedState<SkiUnits>('ski-status-units', 'imperial');
    const [storedColumns, setColumns] = usePersistedState<ColumnKey[]>('ski-status-columns', defaultSkiColumns);
    const conditions = useSkiConditions();
    const units = storedUnits === 'metric' ? 'metric' : 'imperial';
    const columnPreference = visibleSkiColumns(storedColumns).map(({ key }) => key);
    const wide = useMediaQuery('(min-width: 64rem)');
    const view = readSkiResultsView(searchParams);
    const compare = view === 'table';
    const showMap = !compare && (wide || view === 'map');
    const showList = !compare && (wide || view === 'results');
    const [mapOpened, setMapOpened] = useState(showMap);
    if (showMap && !mapOpened) setMapOpened(true);

    const filters = readSkiFilters(searchParams);
    const { region, pass, product, skiDate, homeArea, skiing, night, seasonMonth, status } = filters;
    const homeAreaId = homeArea?.id;
    const sort = readSkiSort(searchParams);
    const selected = areaById.get(searchParams.get('area') ?? '');
    const colorParam = searchParams.get('color');
    const colors = colorParam === null && status === 'today' ? 'operatingStatus' : readMarkerMode(colorParam);
    const terrain = searchParams.get('terrain') === '1';
    const resortTerrain = searchParams.get('skiTerrain') !== '0';
    const mapAreaParam = searchParams.get('mapArea');
    const searchedArea = useMemo(() => readSkiMapArea(mapAreaParam), [mapAreaParam]);
    const legacyArea = !searchedArea && searchParams.get('inView') === '1';
    const cameraParam = searchParams.get('camera');
    const camera = useMemo(() => readSkiMapCamera(cameraParam), [cameraParam]);
    const restoreHistoryCamera = navigation === 'POP' && new URLSearchParams(location.search).toString() === searchParams.toString();
    const passNow = product && !skiDate ? conditions.now : 0;
    const catalogMatches = useMemo(() => filterSkiAreas(skiAreas, {
        query, region, pass, night, skiing, product: product && { pass: product, date: skiDate, now: passNow, homeAreaId }, seasonMonth,
    }), [query, region, pass, night, skiing, product, skiDate, passNow, homeAreaId, seasonMonth]);
    const scoped = useMemo(() => {
        if (!searchedArea) return catalogMatches;
        const contains = skiMapAreaContains(searchedArea);
        return catalogMatches.filter(area => contains(area.location.coordinates));
    }, [catalogMatches, searchedArea]);
    const statuses = useMemo(() => new Map(skiAreas.map(area => [area.id,
        skiDayStatus(conditions.reports.get(area.id), conditions.now, area.location.timeZone)])), [conditions.reports, conditions.now]);
    const matching = useMemo(() => scoped.filter(area => matchesStatus(status, statuses.get(area.id) ?? 'unknown')), [scoped, status, statuses]);
    const sorted = useMemo(() => sortSkiAreas(matching, { key: sort.key, direction: sort.direction }, conditions),
        [matching, sort.key, sort.direction, conditions]);
    const currentReports = scoped.filter(area => statuses.get(area.id) !== 'unknown').length;
    const [terrainRequest, setTerrainRequest] = useState<{ id: string }>();
    const [terrainConventions, setTerrainConventions] = useState<readonly TerrainConvention[]>([]);
    const detailsOpen = Boolean(selected && searchParams.get('details') !== '0');
    const searchInput = useRef<HTMLInputElement>(null);
    const cameraReader = useRef<(() => string | undefined) | null>(null);
    const mapSection = useRef<HTMLElement>(null);
    const detailSection = useRef<HTMLElement>(null);
    const filterButton = useRef<HTMLButtonElement>(null);
    const filterDialog = useRef<HTMLDialogElement>(null);
    const layersDialog = useRef<HTMLDialogElement>(null);
    const columnsDialog = useRef<HTMLDialogElement>(null);
    const sourceControl = useRef<HTMLElement | null>(null);
    const nextFocus = useRef<'details' | 'opener' | 'map' | undefined>(undefined);

    useLayoutEffect(() => {
        const request = nextFocus.current;
        if (request === 'details' && detailSection.current) {
            detailSection.current.focus({ preventScroll: true });
        } else if (request === 'opener' && !selected) {
            const opener = sourceControl.current;
            const canvas = showMap && mapSection.current?.querySelector<HTMLCanvasElement>('canvas');
            const target = opener?.isConnected && opener.checkVisibility?.() !== false ? opener : canvas || searchInput.current;
            target?.focus({ preventScroll: true });
            sourceControl.current = null;
        } else if (request === 'map' && showMap) {
            (mapSection.current?.querySelector<HTMLCanvasElement>('canvas') ?? mapSection.current)?.focus({ preventScroll: true });
        } else return;
        nextFocus.current = undefined;
    }, [selected, detailsOpen, showMap]);

    function updateSkiParams(update: (params: URLSearchParams) => void, replace = false) {
        updateParams(params => {
            params.set('status', status);
            update(params);
        }, { replace });
    }

    function setParam(key: string, value?: string) {
        updateSkiParams(params => {
            if (value) params.set(key, value);
            else params.delete(key);
        });
    }

    function setView(value: SkiResultsView) {
        if (view === value) return;
        updateSkiParams(params => {
            params.set('view', value);
            writeVisibleCamera(params);
        });
    }

    function setSort(key: SkiSort['key']) {
        const direction = sort.key === key ? (sort.direction === 'asc' ? 'desc' : 'asc')
            : key === 'name' || key === 'region' || key === 'skiing' ? 'asc' : 'desc';
        setParam('sort', `${key}:${direction}`);
    }

    function selectArea(id?: string, control?: HTMLElement) {
        setTerrainRequest(undefined);
        if (id) {
            sourceControl.current = control ?? null;
            nextFocus.current = 'details';
            if (selected?.id === id && detailsOpen) {
                detailSection.current?.focus({ preventScroll: true });
                nextFocus.current = undefined;
                return;
            }
        }
        if (id || selected) updateSkiParams(params => {
            if (id) params.set('area', id);
            else params.delete('area');
            params.delete('details');
        });
    }

    function closeDetails() {
        nextFocus.current = 'opener';
        selectArea();
    }

    function showTerrain() {
        if (!selected) return;
        setTerrainRequest({ id: selected.id });
        nextFocus.current = 'map';
        updateSkiParams(params => {
            params.set('view', 'map');
            params.set('details', '0');
            params.delete('skiTerrain');
        });
    }

    function writeVisibleCamera(params: URLSearchParams) {
        const value = showMap && cameraReader.current?.();
        if (value) params.set('camera', value);
    }

    function commitMapCamera(value: string) {
        // An animation can finish while Back or Forward is still reaching the router.
        const browserKey: unknown = window.history.state?.key;
        if (typeof browserKey === 'string' && browserKey !== location.key) return;
        if (navigation === 'POP' && !restoreHistoryCamera) return;
        updateParams(params => params.set('camera', value), { replace: true });
    }

    function commitMapArea(value: string) {
        updateSkiParams(params => {
            params.set('mapArea', value);
            params.delete('inView');
            writeVisibleCamera(params);
        }, legacyArea);
    }

    function getShareUrl() {
        const url = new URL(location.pathname + location.hash, window.location.origin);
        const visibleCamera = showMap && cameraReader.current?.();
        const writeView = (params: URLSearchParams) => {
            params.set('status', status);
            params.set('view', view);
            if (visibleCamera) params.set('camera', visibleCamera);
        };
        const params = new URLSearchParams(searchParams);
        writeView(params);
        url.search = params.toString();
        updateParams(writeView, { replace: true });
        commitQuery();
        return url.href;
    }

    const chips = [
        { label: regionLabels.get(region), keys: ['region'] },
        { label: product?.name ?? (pass && passFilterOptions[pass]), keys: product ? ['product', 'skiDate', 'homeArea'] : ['pass'] },
        { label: skiDate, keys: ['skiDate'] },
        { label: homeArea && `Home · ${homeArea.name}`, keys: ['homeArea'] },
        { label: skiing && skiingFilterOptions[skiing], keys: ['skiing'] },
        { label: seasonMonth && seasonMonths.find(({ month }) => month === seasonMonth)?.label, keys: ['seasonMonth'] },
        { label: night && 'Night skiing', keys: ['night'] },
        { label: status !== 'all' && status !== 'today' && statusFilterLabels[status], keys: ['status'] },
        { label: searchedArea && 'Searched map area', keys: ['mapArea', 'inView'] },
    ].filter(chip => Boolean(chip.label));
    const coverageText = `${currentReports} of ${scoped.length} areas have current reports`;
    const resultText = status === 'today' ? `${matching.length} reporting skiing today` : `${matching.length} ski ${matching.length === 1 ? 'area' : 'areas'}`;
    const emptyText = status === 'today' ? 'No resorts in this search have reported skiing today.' : 'No ski areas match these filters.';
    const canShowTerrain = selected && resortTerrainGroups([selected]).length > 0;

    return <main data-results-view={view} className="ski-status flex h-full min-w-0 flex-col overflow-hidden">
        <MapSkipLink targetId="ski-area-search" label="Skip to search" />
        {showMap && <MapSkipLink targetId="ski-results-map" label="Skip to map" />}
        {(showList || compare) && !detailsOpen && <MapSkipLink targetId="ski-results-pane" label="Skip to results" />}
        {detailsOpen && <MapSkipLink targetId="ski-area-details" label="Skip to resort details" />}
        <header className="z-10 shrink-0 border-b border-slate-700 bg-[#0d1620] px-3 py-2 sm:px-4">
            <div className="ski-topbar">
                <div className="ski-brand flex items-center gap-2 sm:gap-3">
                    <IntentLink to="/projects" className="inline-flex min-h-11 items-center text-xs text-slate-300 underline underline-offset-4 hover:text-cyan-200">Projects</IntentLink>
                    <h1 className="text-xl font-semibold tracking-tight">ski-status</h1>
                </div>
                <div className="ski-search">
                    <label htmlFor="ski-area-search" className="sr-only">Search areas</label>
                    <input ref={searchInput} className="ski-input w-full text-base" type="search" id="ski-area-search" value={query}
                        onChange={event => updateQuery(event.target.value, params => params.set('status', status))}
                        onBlur={commitQuery} onKeyDown={event => { if (event.key === 'Enter') commitQuery(); }} placeholder="Search by name or place" />
                    {query && <button type="button" className="ski-search-clear" aria-label="Clear search" onClick={() => {
                        searchInput.current?.focus({ preventScroll: true });
                        setParam('q');
                    }}>×</button>}
                </div>
                <div className="ski-pass-shortcuts" role="group" aria-label="Pass filters">
                    {passFamilySchema.options.map(family => <button key={family} type="button" className="ski-control ski-pass-button"
                        aria-label={passNames[family]} title={passNames[family]} aria-pressed={pass === family}
                        onClick={() => updateSkiParams(params => writeSkiPassFilter(params, pass === family ? undefined : family))}>
                        <SkiPassIcon family={family} size={24} />
                    </button>)}
                </div>
                <SkiShareButton getUrl={getShareUrl} />
            </div>
            <div className="ski-toolbar ski-actions mt-1">
                <div className="ski-actions">
                    <div className="ski-actions" role="group" aria-label="Operating status shortcuts">
                        <button type="button" className="ski-control" aria-pressed={status === 'today'} onClick={() => setParam('status', 'today')}>Ski today</button>
                        <button type="button" className="ski-control" aria-pressed={status === 'all'} onClick={() => setParam('status', 'all')}>All resorts</button>
                    </div>
                    <button type="button" ref={filterButton} className="ski-control" aria-haspopup="dialog" aria-controls="ski-filters"
                        onClick={() => filterDialog.current?.showModal()}>Filters</button>
                </div>
                <nav aria-label="View" className="ski-actions">
                    <button type="button" className="ski-control" aria-pressed={showMap} onClick={() => setView('map')}>Map</button>
                    <button type="button" className="ski-control lg:hidden" aria-pressed={view === 'results'} onClick={() => setView('results')}>
                        Results{!compare && <span aria-hidden="true"> {matching.length}</span>}
                    </button>
                    <button type="button" className="ski-control" aria-pressed={compare} onClick={() => setView('table')}>Compare</button>
                </nav>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-200" aria-live="polite" aria-atomic="true">
                <span className="font-semibold">{resultText}</span><span className="text-slate-300">{coverageText}</span>
            </div>
            {legacyArea && !showMap && <p className="mt-1 text-xs text-slate-300">Open Map to set the area for this link.</p>}
            {chips.length > 0 && <div aria-label="Applied filters" role="group" className="ski-actions mt-1 max-h-24 overflow-auto">
                {chips.map(({ label, keys }) => <button type="button" key={keys[0]} className="ski-chip text-sm text-cyan-100 underline decoration-slate-500 underline-offset-4"
                    aria-label={`Remove ${label}`} onClick={() => {
                        filterButton.current?.focus();
                        updateSkiParams(params => {
                            for (const key of keys) params.delete(key);
                            if (keys.includes('status')) params.set('status', 'all');
                        });
                    }}>{label} <span aria-hidden="true">×</span></button>)}
                <button type="button" className="ski-chip text-sm text-slate-300 underline underline-offset-4" onClick={() => {
                    filterButton.current?.focus();
                    updateSkiParams(params => {
                        for (const key of clearable) params.delete(key);
                        if (status !== 'today') params.set('status', 'all');
                    });
                }}>Clear filters</button>
            </div>}
        </header>
        <div className="ski-workspace" data-sidebar={wide && (showList || detailsOpen) || undefined}
            data-docked={!wide && detailsOpen && showMap || undefined}>
            <section ref={mapSection} id="ski-results-map" tabIndex={-1} aria-label="Map of ski areas" hidden={!showMap}
                className="flex min-h-0 min-w-0 flex-col">
                {selected && !detailsOpen && <div className="ski-actions justify-between border-b border-slate-700 px-3 py-1">
                    <p className="text-sm font-semibold">{selected.name}</p>
                    <button type="button" className="ski-control" onClick={() => {
                        nextFocus.current = 'details';
                        setParam('details');
                    }}>Resort details</button>
                </div>}
                <div className="min-h-0 flex-1">
                    {(mapOpened || showMap) && <ErrorBoundary fallback={<MapMessage failed />}><Suspense fallback={<MapMessage />}>
                        <SkiStatusMap areas={status === 'today' ? scoped : matching} fitResults={matching} cameraAreas={catalogMatches}
                            selected={selected} colors={colors} passFilter={pass} statuses={statuses} conditions={conditions}
                            terrain={terrain} resortTerrain={resortTerrain} visible={showMap} searchedArea={searchedArea}
                            searchedAreaKey={searchedArea ? mapAreaParam : null} initializeArea={legacyArea}
                            terrainRequest={detailsOpen ? undefined : terrainRequest}
                            camera={camera} navigationKey={location.key} restoreHistoryCamera={restoreHistoryCamera}
                            cameraReader={cameraReader} onCameraChange={commitMapCamera}
                            onSearchArea={commitMapArea} onSelect={selectArea} onTerrainKey={setTerrainConventions}
                            onOpenLayers={() => layersDialog.current?.showModal()} />
                    </Suspense></ErrorBoundary>}
                </div>
            </section>
            {compare && <section id="ski-results-pane" tabIndex={-1} aria-label="Compare ski areas" hidden={!wide && detailsOpen} className="flex min-h-0 min-w-0 flex-col">
                <div className="ski-actions justify-between border-b border-slate-700 px-3 py-1.5">
                    <h2 className="text-sm font-semibold">Compare ski areas</h2>
                    <div className="ski-actions">
                        <button type="button" className="ski-control" aria-haspopup="dialog" aria-controls="ski-columns"
                            onClick={() => columnsDialog.current?.showModal()}>Columns</button>
                        <button type="button" className="ski-control" disabled={legacyArea || !sorted.length}
                            onClick={() => downloadSkiAreaCsv(skiAreaCsv(sorted, columnPreference, units, conditions))}>Export CSV</button>
                    </div>
                </div>
                <div className="min-h-0 flex-1">
                    {sorted.length > 0 ? <SkiAreaTable areas={sorted} units={units} sort={sort} selected={selected} conditions={conditions}
                        columnPreference={columnPreference} onSort={setSort} onSelect={selectArea} /> : <p className="p-4 text-slate-300">{emptyText}</p>}
                </div>
            </section>}
            {!compare && <aside id="ski-results-pane" tabIndex={-1} aria-label="Resort results" hidden={!showList || detailsOpen} className="ski-sidebar flex min-h-0 min-w-0 flex-col">
                {sorted.length > 0 ? <SkiAreaList areas={sorted} selectedId={selected?.id} statuses={statuses} conditions={conditions} colors={colors}
                    units={units} passFilter={pass} sort={sort} onSort={setSort} onSelect={selectArea} /> : <p className="p-4 text-slate-300">{emptyText}</p>}
            </aside>}
            {selected && detailsOpen && <aside key={selected.id} className="ski-sidebar min-h-0 min-w-0 overflow-auto">
                <SkiAreaDetails area={selected} sectionRef={detailSection} units={units} onClose={closeDetails} conditions={conditions}
                    product={product} skiDate={skiDate} homeAreaId={homeAreaId} onShowTerrain={canShowTerrain ? showTerrain : undefined} />
            </aside>}
        </div>
        <footer className="shrink-0 border-t border-slate-700 px-3 text-xs text-slate-300 sm:px-4">
            <details className="relative">
                <summary className="w-fit cursor-pointer py-2">Map sources and data</summary>
                <div className="absolute bottom-full left-0 z-20 flex w-[min(32rem,calc(100vw-1.5rem))] flex-wrap gap-x-3 gap-y-2 rounded-t-lg border border-slate-700 bg-[#152230] p-3">
                    {Object.entries(locationAttribution).map(([name, url]) => <a key={name} href={url} className="underline underline-offset-2 hover:text-white">{name}</a>)}
                    <a href={locationDownload} download="ski-status-locations.json" className="underline underline-offset-2 hover:text-white">Marker data</a>
                    <a href={terrainDownload} download="ski-status-resort-terrain.pmtiles" className="underline underline-offset-2 hover:text-white">Terrain data</a>
                    <a href={locationLicense} className="underline underline-offset-2 hover:text-white">ODbL</a>
                </div>
            </details>
        </footer>
        <SkiFilterDialog dialog={filterDialog} filters={filters} units={units} onUnitsChange={setUnits} setParam={setParam} updateParams={updateSkiParams} />
        <SkiLayerDialog dialog={layersDialog} colors={colors} units={units} indyDiscounts={pass === 'indy-discounts'} terrain={terrain}
            resortTerrain={resortTerrain} setParam={setParam} terrainKey={terrainConventions.length > 0 && <SkiTerrainKey conventions={terrainConventions} />} />
        <SkiDialog dialog={columnsDialog} id="ski-columns" title="Columns">
            <SkiColumnSettings columns={columnPreference} onChange={columns => {
                setColumns(columns);
                if (!columns.includes(sort.key)) setParam('sort', undefined);
            }} />
        </SkiDialog>
    </main>;
}
