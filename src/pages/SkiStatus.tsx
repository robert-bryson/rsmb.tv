import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { IntentLink } from '../components/IntentLink';
import { MapSkipLink } from '../components/MapSkipLink';
import {
    defaultSkiColumns, filterSkiAreas, passFilterOptions, readSkiResultsView, readSkiSort, skiingFilterOptions, sortSkiAreas,
    visibleSkiColumns, type ColumnKey, type SkiPassSelection, type SkiResultsView, type SkiSort, type SkiUnits,
} from '../features/ski-status/browse';
import { passFamilySchema, passNames, skiAreaMapPoint, skiAreas } from '../features/ski-status/catalog';
import { matchesOperatingStatus, skiDayStatus, statusFilterLabels, type ResortStatus } from '../features/ski-status/conditions';
import { readMarkerMode } from '../features/ski-status/mapAppearance';
import { resortTerrainGroups, type TerrainConvention } from '../features/ski-status/resortTerrainData';
import { SkiAreaDetails } from '../features/ski-status/SkiAreaDetails';
import { SkiAreaList } from '../features/ski-status/SkiAreaList';
import { SkiAreaTable } from '../features/ski-status/SkiAreaTable';
import { SkiColumnSettings } from '../features/ski-status/SkiColumnSettings';
import { SkiDialog, SkiFilterDialog, SkiLayerDialog, SkiTerrainKey } from '../features/ski-status/SkiControls';
import { SkiIcon, SkiIconButton } from '../features/ski-status/SkiIcon';
import { SkiPassIcon } from '../features/ski-status/SkiPassIcon';
import { SkiShareButton } from '../features/ski-status/SkiShareButton';
import { readSkiFilters, regionLabels, toggleSkiPassFilter, writeSkiPassProduct, type SkiStatusFilter } from '../features/ski-status/skiFilters';
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

    // Keep the filter set stable as the map camera settles.
    const filterParams = new URLSearchParams(searchParams);
    filterParams.delete('camera');
    const filterSearch = filterParams.toString();
    const filters = useMemo(() => readSkiFilters(new URLSearchParams(filterSearch)), [filterSearch]);
    const { region, passes, product, skiDate, homeArea, skiing, night, seasonMonth, status } = filters;
    const homeAreaId = homeArea?.id;
    const sort = readSkiSort(searchParams);
    const selected = areaById.get(searchParams.get('area') ?? '');
    const colorParam = searchParams.get('color');
    const defaultColors = status === 'today' ? 'operatingStatus' : 'default';
    const colors = colorParam === null ? defaultColors : readMarkerMode(colorParam);
    const terrain = searchParams.get('terrain') === '1';
    const resortTerrain = searchParams.get('skiTerrain') !== '0';
    const mapAreaParam = searchParams.get('mapArea');
    const searchedArea = useMemo(() => readSkiMapArea(mapAreaParam), [mapAreaParam]);
    const legacyArea = !searchedArea && searchParams.get('inView') === '1';
    const cameraParam = searchParams.get('camera');
    const camera = useMemo(() => readSkiMapCamera(cameraParam), [cameraParam]);
    const restoreHistoryCamera = navigation === 'POP' && new URLSearchParams(location.search).toString() === searchParams.toString();
    const passNow = product && !skiDate ? conditions.now : 0;
    const passSelection = useMemo<SkiPassSelection>(() => ({
        passes, product: product && { pass: product, date: skiDate, now: passNow, homeAreaId },
    }), [passes, product, skiDate, passNow, homeAreaId]);
    const catalogMatches = useMemo(() => filterSkiAreas(skiAreas, {
        query, region, night, skiing, seasonMonth, ...passSelection,
    }), [query, region, night, skiing, seasonMonth, passSelection]);
    const scoped = useMemo(() => {
        if (!searchedArea) return catalogMatches;
        const contains = skiMapAreaContains(searchedArea);
        return catalogMatches.filter(area => contains(skiAreaMapPoint(area))
            || (area.location.base && contains(area.location.coordinates)));
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
    const allResortsButton = useRef<HTMLButtonElement>(null);
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
    }, [selected, detailsOpen, showMap, terrainRequest]);

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
            params.delete('details');
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

    function removeFilter(key: string) {
        filterButton.current?.focus();
        updateSkiParams(params => {
            switch (key) {
                case 'product': writeSkiPassProduct(params, ''); break;
                case 'pass': toggleSkiPassFilter(params, 'indy-discounts'); break;
                case 'status': params.set('status', 'all'); break;
                case 'mapArea': params.delete('inView'); params.delete('mapArea'); break;
                default: params.delete(key);
            }
        });
    }

    function clearFilters() {
        filterButton.current?.focus();
        updateSkiParams(params => {
            for (const key of clearable) params.delete(key);
            if (status !== 'today') params.set('status', 'all');
        });
    }

    const chips = [
        { label: regionLabels.get(region), key: 'region' },
        { label: passes.includes('indy-discounts') && passFilterOptions['indy-discounts'], key: 'pass' },
        { label: product?.name, key: 'product' },
        { label: skiDate, key: 'skiDate' },
        { label: homeArea && `Home · ${homeArea.name}`, key: 'homeArea' },
        { label: skiing && skiingFilterOptions[skiing], key: 'skiing' },
        { label: seasonMonth && seasonMonths.find(({ month }) => month === seasonMonth)?.label, key: 'seasonMonth' },
        { label: night && 'Night skiing', key: 'night' },
        { label: status !== 'all' && status !== 'today' && statusFilterLabels[status], key: 'status' },
        { label: searchedArea && 'Map area', key: 'mapArea' },
    ].filter(chip => Boolean(chip.label));
    const additionalFilters = chips.filter(({ key }) => key !== 'mapArea').length;
    const coverageText = `${currentReports} of ${scoped.length} areas have current reports`;
    const resultText = status === 'today' ? `${matching.length} reporting skiing today` : `${matching.length} ski ${matching.length === 1 ? 'area' : 'areas'}`;
    const emptyResults = <div className="ski-empty">
        <p>{status === 'today' ? 'No resorts in this search have reported skiing today.' : 'No ski areas match these filters.'}</p>
        {status === 'today' && <button type="button" className="ski-control" onClick={() => {
            allResortsButton.current?.focus();
            setParam('status', 'all');
        }}>Show all statuses</button>}
    </div>;
    const canShowTerrain = selected && resortTerrainGroups([selected]).length > 0;

    return <main data-results-view={view} className="ski-status flex h-full min-w-0 flex-col overflow-hidden">
        <MapSkipLink targetId="ski-area-search" label="Skip to search" />
        {showMap && <MapSkipLink targetId="ski-results-map" label="Skip to map" />}
        {(showList || compare) && !detailsOpen && <MapSkipLink targetId="ski-results-pane" label="Skip to results" />}
        {detailsOpen && <MapSkipLink targetId="ski-area-details" label="Skip to resort details" />}
        <header className="ski-header">
            <div className="ski-topbar">
                <div className="ski-brand">
                    <IntentLink to="/projects" aria-label="Projects" title="Back to projects">
                        <SkiIcon name="back" /><span>Projects</span>
                    </IntentLink>
                    <h1>ski-status</h1>
                </div>
                <div className="ski-page-actions">
                    <div className="ski-search">
                        <label htmlFor="ski-area-search" className="sr-only">Search areas</label>
                        <SkiIcon name="search" />
                        <input ref={searchInput} className="ski-input" type="search" id="ski-area-search" value={query}
                            onChange={event => updateQuery(event.target.value, params => params.set('status', status))}
                            onBlur={commitQuery} onKeyDown={event => { if (event.key === 'Enter') commitQuery(); }} placeholder="Search areas" />
                        {query && <SkiIconButton className="ski-search-clear ski-quiet-button" icon="close" label="Clear search" onClick={() => {
                            searchInput.current?.focus({ preventScroll: true });
                            setParam('q');
                        }} />}
                    </div>
                    <SkiIconButton ref={filterButton} icon="filter" label="Filters" count={additionalFilters}
                        aria-haspopup="dialog" aria-controls="ski-filters" data-active={additionalFilters > 0 || undefined}
                        aria-description={additionalFilters > 0 ? `${additionalFilters} additional ${additionalFilters === 1 ? 'filter' : 'filters'} active` : undefined}
                        onClick={() => filterDialog.current?.showModal()} />
                </div>
                <div className="ski-pass-shortcuts" role="group" aria-label="Pass filters" aria-describedby="ski-pass-shortcuts-help">
                    <span className="ski-pass-caption" aria-hidden="true">Passes</span>
                    <span id="ski-pass-shortcuts-help" className="sr-only">Match any selected pass.</span>
                    <div className="ski-pass-buttons">
                        {passFamilySchema.options.map(family => <button key={family} type="button" className="ski-control ski-pass-button"
                            aria-pressed={passes.includes(family)} title={passNames[family]}
                            onClick={() => updateSkiParams(params => toggleSkiPassFilter(params, family))}>
                            <span className="ski-pass-mark">
                                <SkiPassIcon family={family} size={20} />
                                {passes.includes(family) && <span className="ski-pass-check"><SkiIcon name="check" /></span>}
                            </span>
                            <span className="ski-pass-name">{passNames[family]}</span>
                        </button>)}
                    </div>
                </div>
            </div>
            <div className="ski-toolbar">
                <div className="ski-segments ski-mode-switch" role="group" aria-label="Operating status shortcuts">
                    <button type="button" aria-pressed={status === 'today'} onClick={() => setParam('status', 'today')}>Ski today</button>
                    <button ref={allResortsButton} type="button" aria-pressed={status === 'all'} onClick={() => setParam('status', 'all')}>All resorts</button>
                </div>
                <nav aria-label="View" className="ski-segments ski-view-switch">
                    <button type="button" aria-pressed={showMap} onClick={() => setView('map')}><SkiIcon name="map" />Map</button>
                    <button type="button" className="ski-view-results" aria-pressed={!wide && view === 'results'} onClick={() => setView('results')}>
                        <SkiIcon name="results" />Results
                    </button>
                    <button type="button" aria-pressed={compare} onClick={() => setView('table')}><SkiIcon name="compare" />Compare</button>
                </nav>
                <div className="ski-context">
                    <div className="ski-context-filters">
                        <div className="ski-counts" aria-live="polite" aria-atomic="true">
                            <span>{resultText}</span>
                            {status !== 'all' && <span className="ski-coverage">{coverageText}</span>}
                        </div>
                        {chips.length > 0 && <div aria-label="Applied filters" role="group" className="ski-chips">
                            {chips.map(({ label, key }) => <button type="button" key={key} className="ski-chip"
                                aria-label={`Remove ${label}`} title={`Remove ${label}`} onClick={() => removeFilter(key)}>
                                <span>{label}</span><SkiIcon name="close" />
                            </button>)}
                        </div>}
                        {(chips.length > 0 || passes.length > 0) &&
                            <button type="button" className="ski-clear-filters" aria-label="Clear filters" onClick={clearFilters}>
                                Clear<span> filters</span>
                            </button>}
                    </div>
                    <SkiShareButton getUrl={getShareUrl} />
                </div>
            </div>
            {legacyArea && !showMap && <p className="text-sm text-slate-300">Open Map to set the area for this link.</p>}
        </header>
        <div className="ski-workspace" data-sidebar={wide && (showList || detailsOpen) || undefined}
            data-docked={!wide && detailsOpen && showMap || undefined}>
            <section ref={mapSection} id="ski-results-map" tabIndex={-1} aria-label="Map of ski areas" hidden={!showMap}
                className="flex min-h-0 min-w-0 flex-col">
                {selected && !detailsOpen && <div className="ski-pane-heading">
                    <p className="text-sm font-semibold">{selected.name}</p>
                    <button type="button" className="ski-control" onClick={() => {
                        nextFocus.current = 'details';
                        setParam('details');
                    }}>Resort details</button>
                </div>}
                <div className="min-h-0 flex-1">
                    {(mapOpened || showMap) && <ErrorBoundary fallback={<MapMessage failed />}><Suspense fallback={<MapMessage />}>
                        <SkiStatusMap areas={status === 'today' ? scoped : matching} fitResults={matching} cameraAreas={catalogMatches}
                            selected={selected} colors={colors} passSelection={passSelection} statuses={statuses} conditions={conditions}
                            terrain={terrain} resortTerrain={resortTerrain} visible={showMap} searchedArea={searchedArea}
                            layersModified={colors !== defaultColors || terrain || !resortTerrain}
                            searchedAreaKey={searchedArea ? mapAreaParam : null} initializeArea={legacyArea}
                            terrainRequest={terrainRequest}
                            camera={camera} navigationKey={location.key} restoreHistoryCamera={restoreHistoryCamera}
                            cameraReader={cameraReader} mapRegion={mapSection} onCameraChange={commitMapCamera}
                            onSearchArea={commitMapArea} onSelect={selectArea} onTerrainKey={setTerrainConventions}
                            onOpenLayers={() => layersDialog.current?.showModal()} />
                    </Suspense></ErrorBoundary>}
                </div>
            </section>
            {compare && <section id="ski-results-pane" tabIndex={-1} aria-label="Compare ski areas" hidden={!wide && detailsOpen} className="flex min-h-0 min-w-0 flex-col">
                <div className="ski-pane-heading">
                    <h2 className="text-sm font-semibold">Compare ski areas</h2>
                    <div className="ski-actions">
                        <button type="button" className="ski-control" aria-haspopup="dialog" aria-controls="ski-columns"
                            onClick={() => columnsDialog.current?.showModal()}><SkiIcon name="columns" />Columns</button>
                        <button type="button" className="ski-control" disabled={legacyArea || !sorted.length}
                            onClick={() => downloadSkiAreaCsv(skiAreaCsv(sorted, columnPreference, units, conditions))}><SkiIcon name="download" />Export CSV</button>
                    </div>
                </div>
                <div className="min-h-0 flex-1">
                    {sorted.length > 0 ? <SkiAreaTable areas={sorted} units={units} sort={sort} selected={selected} conditions={conditions}
                        columnPreference={columnPreference} reportsFirst={status !== 'all'} onSort={setSort} onSelect={selectArea} /> : emptyResults}
                </div>
            </section>}
            {!compare && <aside id="ski-results-pane" tabIndex={-1} aria-label="Resort results" hidden={!showList || detailsOpen} className="ski-sidebar flex min-h-0 min-w-0 flex-col">
                {sorted.length > 0 ? <SkiAreaList areas={sorted} selectedId={selected?.id} statuses={statuses} conditions={conditions} colors={colors}
                    units={units} passSelection={passSelection} sort={sort} onSort={setSort} onSelect={selectArea} /> : emptyResults}
            </aside>}
            {selected && detailsOpen && <aside key={selected.id} className="ski-sidebar min-h-0 min-w-0 overflow-auto">
                <SkiAreaDetails area={selected} sectionRef={detailSection} units={units} onClose={closeDetails} conditions={conditions}
                    product={product} skiDate={skiDate} homeAreaId={homeAreaId} onShowTerrain={canShowTerrain ? showTerrain : undefined} />
            </aside>}
        </div>
        <SkiFilterDialog dialog={filterDialog} filters={filters} resultCount={matching.length} units={units}
            onShowResults={() => { if (!wide && view === 'map') setView('results'); }}
            onUnitsChange={setUnits} setParam={setParam} updateParams={updateSkiParams} />
        <SkiLayerDialog dialog={layersDialog} colors={colors} units={units} indyDiscounts={passes.length === 1 && passes.includes('indy-discounts')} terrain={terrain}
            resortTerrain={resortTerrain} setParam={setParam} terrainKey={terrainConventions.length > 0 && <SkiTerrainKey conventions={terrainConventions} />} />
        <SkiDialog dialog={columnsDialog} id="ski-columns" title="Columns">
            <SkiColumnSettings columns={columnPreference} onChange={columns => {
                setColumns(columns);
                if (!columns.includes(sort.key)) setParam('sort', undefined);
            }} />
        </SkiDialog>
    </main>;
}
