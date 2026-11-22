import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { drivingAreaProviders, type DrivingApproach } from '../../shared/skiDrivingCatalog';
import { approachLine } from '../features/ski-status/drivingView';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { IntentLink } from '../components/IntentLink';
import { MapSkipLink } from '../components/MapSkipLink';
import {
    defaultSkiColumns, filterSkiAreas, filterSkiAreasInMapArea, passFilterOptions, readSkiResultsView, readSkiSort, skiingFilterOptions, sortSkiAreas,
    visibleSkiColumns, type ColumnKey, type SkiPassSelection, type SkiResultsView, type SkiSort, type SkiUnits,
} from '../features/ski-status/browse';
import { passFamilySchema, passNames, skiAreas } from '../features/ski-status/catalog';
import { matchesOperatingStatus, skiDayStatus, statusFilterLabels, type ResortStatus } from '../features/ski-status/conditions';
import { readMarkerMode } from '../features/ski-status/mapAppearance';
import { resortTerrainGroups } from '../features/ski-status/resortTerrainData';
import { SkiAreaDetails } from '../features/ski-status/SkiAreaDetails';
import { SkiAreaList } from '../features/ski-status/SkiAreaList';
import { SkiAreaTable } from '../features/ski-status/SkiAreaTable';
import { SkiColumnSettings } from '../features/ski-status/SkiColumnSettings';
import { SkiDialog, SkiFilterDialog } from '../features/ski-status/SkiControls';
import { SkiIcon, SkiIconButton } from '../features/ski-status/SkiIcon';
import { SkiPassIcon } from '../features/ski-status/SkiPassIcon';
import { SkiProjectInfo } from '../features/ski-status/SkiProjectInfo';
import { SkiShareButton } from '../features/ski-status/SkiShareButton';
import type { SkiDrivingRequest, SkiTerrainRequest } from '../features/ski-status/SkiStatusMap';
import { readSkiFilters, skiLocationActions, skiLocationLabels, skiLocationModes, skiLocationParams,
    toggleSkiPassFilter, updateSavedSkiExclusions, writeSkiLocations, writeSkiPassProduct, type SkiStatusFilter } from '../features/ski-status/skiFilters';
import { matchesSkiLocations, type SkiLocationFilters } from '../features/ski-status/skiGeography';
import { readSkiMapArea, readSkiMapCamera } from '../features/ski-status/skiMapArea';
import { seasonMonths } from '../features/ski-status/seasons';
import { downloadSkiAreaCsv, skiAreaCsv } from '../features/ski-status/skiCsv';
import { useSkiArchive } from '../features/ski-status/useSkiArchive';
import { useSkiConditions } from '../features/ski-status/useSkiConditions';
import { useSkiDriving } from '../features/ski-status/useSkiDriving';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { usePersistedState } from '../hooks/usePersistedState';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { MAPLIBRE_STYLESHEET, moduleLoader } from '../navigation/moduleLoader';
import { staticPageMetadata } from '../utils/pageMetadata';
import { SITE_URL } from '../utils/siteMetadata';
import '../features/ski-status/skiStatus.css';

const SkiStatusMap = lazy(moduleLoader(() => import('../features/ski-status/SkiStatusMap'), MAPLIBRE_STYLESHEET));
const SkiDrivingDetails = lazy(() => import('../features/ski-status/SkiDrivingDetails'));
const areaById = new Map(skiAreas.map(area => [area.id, area]));
const clearable = ['q', ...Object.values(skiLocationParams), 'pass', 'product', 'skiDate', 'homeArea', 'skiing', 'night', 'inView', 'mapArea', 'seasonMonth'];

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
    const [savedExclusions, setExclusions] = usePersistedState<unknown>('ski-status-excluded-locations', []);
    const conditions = useSkiConditions();
    const archive = useSkiArchive();
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
    const filters = useMemo(() => readSkiFilters(new URLSearchParams(filterSearch), savedExclusions), [filterSearch, savedExclusions]);
    const { locations, passes, product, skiDate, homeArea, skiing, night, seasonMonth, status } = filters;
    const homeAreaId = homeArea?.id;
    const sort = readSkiSort(searchParams);
    const selectedArea = areaById.get(searchParams.get('area') ?? '');
    const selected = selectedArea && matchesSkiLocations(selectedArea, locations) ? selectedArea : undefined;
    const colorParam = searchParams.get('color');
    const defaultColors = status === 'today' ? 'operatingStatus' : 'default';
    const colors = colorParam === null ? defaultColors : readMarkerMode(colorParam);
    const terrain = searchParams.get('terrain') === '1';
    const snowDepth = searchParams.get('snowDepth') === '1';
    const resortTerrain = searchParams.get('skiTerrain') !== '0';
    const peaks = searchParams.get('peaks') !== '0';
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
    const discoveryFilters = useMemo(() => ({ query, locations, night, skiing, seasonMonth }),
        [query, locations, night, skiing, seasonMonth]);
    const cameraFitKey = JSON.stringify(discoveryFilters);
    const catalogMatches = useMemo(() => filterSkiAreas(skiAreas, { ...discoveryFilters, ...passSelection }), [discoveryFilters, passSelection]);
    const scoped = useMemo(() => searchedArea ? filterSkiAreasInMapArea(catalogMatches, searchedArea) : catalogMatches,
        [catalogMatches, searchedArea]);
    const statuses = useMemo(() => new Map(skiAreas.map(area => [area.id,
        skiDayStatus(conditions.reports.get(area.id), conditions.now, area.location.timeZone)])), [conditions.reports, conditions.now]);
    const searchResults = useMemo(() => status === 'all' ? catalogMatches
        : catalogMatches.filter(area => matchesStatus(status, statuses.get(area.id) ?? 'unknown')), [catalogMatches, status, statuses]);
    const matching = useMemo(() => {
        if (!searchedArea) return searchResults;
        return status === 'all' ? scoped : filterSkiAreasInMapArea(searchResults, searchedArea);
    }, [scoped, searchedArea, searchResults, status]);
    const sorted = useMemo(() => sortSkiAreas(matching, { key: sort.key, direction: sort.direction }, conditions),
        [matching, sort.key, sort.direction, conditions]);
    const currentReports = scoped.filter(area => statuses.get(area.id) !== 'unknown').length;
    const [terrainRequest, setTerrainRequest] = useState<SkiTerrainRequest>();
    const [locationRequest, setLocationRequest] = useState<{ place: string }>();
    const [drivingRequest, setDrivingRequest] = useState<SkiDrivingRequest>();
    const detailsOpen = Boolean(selected && searchParams.get('details') !== '0');
    const driving = searchParams.get('driving') === '1';
    const approachId = searchParams.get('approach') ?? undefined;
    const [drivingDisclosure, setDrivingDisclosure] = useState<{ area: string; open: boolean }>();
    const drivingExpanded = drivingDisclosure && drivingDisclosure.area === selected?.id
        ? drivingDisclosure.open : Boolean(approachId);
    const drivingVisible = driving && showMap;
    const drivingData = useSkiDriving(drivingVisible || detailsOpen && drivingExpanded,
        drivingVisible ? 'all' : selected && drivingAreaProviders[selected.id]);
    const drivingApproach = drivingVisible && selected ? drivingData.catalog?.approaches[selected.id]?.find(route => route.id === approachId) : undefined;
    const searchInput = useRef<HTMLInputElement>(null);
    const cameraReader = useRef<(() => string | undefined) | null>(null);
    const mapSection = useRef<HTMLElement>(null);
    const detailSection = useRef<HTMLElement>(null);
    const allResortsButton = useRef<HTMLButtonElement>(null);
    const filterButton = useRef<HTMLButtonElement>(null);
    const filterDialog = useRef<HTMLDialogElement>(null);
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
    }, [selected, detailsOpen, showMap, terrainRequest, locationRequest, drivingRequest]);

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

    function zoomToLocation(place: string) {
        setTerrainRequest(undefined);
        setDrivingRequest(undefined);
        setLocationRequest({ place });
        nextFocus.current = 'map';
        setView('map');
    }

    function selectArea(id?: string, control?: HTMLElement) {
        setTerrainRequest(undefined);
        setLocationRequest(undefined);
        setDrivingRequest(undefined);
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
            if (id !== selected?.id) params.delete('approach');
            params.delete('details');
        });
    }

    function closeDetails() {
        nextFocus.current = 'opener';
        selectArea();
    }

    function showTerrain(request: SkiTerrainRequest, control?: HTMLElement) {
        if (control) sourceControl.current = control;
        setLocationRequest(undefined);
        setDrivingRequest(undefined);
        setTerrainRequest(request);
        nextFocus.current = 'map';
        updateSkiParams(params => {
            params.set('area', request.id);
            if (request.id !== selected?.id) params.delete('approach');
            params.set('view', 'map');
            params.delete('details');
            params.delete('skiTerrain');
        });
    }

    function showDrivingApproach(approach: DrivingApproach) {
        const points = approachLine(approach, drivingData.catalog?.arrivals).flat();
        if (!points.length) return;
        const [lon, lat] = points[0];
        const bounds = points.reduce<SkiDrivingRequest['bounds']>(([west, south, east, north], [x, y]) =>
            [Math.min(west, x), Math.min(south, y), Math.max(east, x), Math.max(north, y)], [lon, lat, lon, lat]);
        setTerrainRequest(undefined);
        setLocationRequest(undefined);
        setDrivingRequest({ id: approach.id, bounds });
        nextFocus.current = 'map';
        updateSkiParams(params => {
            params.set('view', 'map');
            params.set('driving', '1');
            params.set('approach', approach.id);
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

    function clearMapArea() {
        updateSkiParams(params => {
            params.delete('mapArea');
            params.delete('inView');
            writeVisibleCamera(params);
        });
    }

    function getShareUrl() {
        const url = new URL(location.pathname + location.hash, window.location.origin);
        const visibleCamera = showMap && cameraReader.current?.();
        const writeView = (params: URLSearchParams) => {
            params.set('status', status);
            params.set('view', view);
            writeSkiLocations(params, 'exclude', locations.exclude);
            if (visibleCamera) params.set('camera', visibleCamera);
        };
        const params = new URLSearchParams(searchParams);
        writeView(params);
        url.search = params.toString();
        updateParams(writeView, { replace: true });
        commitQuery();
        return url.href;
    }

    function toggleLocationFilter(mode: keyof SkiLocationFilters, place: string) {
        if (!skiLocationLabels.has(place)) return;
        const current = locations[mode];
        const next = { ...locations };
        if (current.includes(place)) next[mode] = current.filter(value => value !== place);
        else {
            next[mode] = [...current, place];
            const other = mode === 'include' ? 'exclude' : 'include';
            if (locations[other].includes(place)) next[other] = locations[other].filter(value => value !== place);
        }
        if (next.exclude !== locations.exclude) {
            setExclusions((saved: unknown) => updateSavedSkiExclusions(saved, place, next.exclude.includes(place)));
        }
        updateSkiParams(params => {
            for (const group of skiLocationModes) {
                if (next[group] !== locations[group]) writeSkiLocations(params, group, next[group]);
            }
            if (selectedArea && !matchesSkiLocations(selectedArea, next)) {
                params.delete('area');
                params.delete('details');
            }
        });
    }

    function removeFilter(key: string, place?: string) {
        filterButton.current?.focus();
        if (key === 'mapArea') {
            clearMapArea();
            return;
        }
        if (place && (key === 'include' || key === 'exclude')) {
            toggleLocationFilter(key, place);
            return;
        }
        updateSkiParams(params => {
            switch (key) {
                case 'product': writeSkiPassProduct(params, ''); break;
                case 'pass': toggleSkiPassFilter(params, 'indy-discounts'); break;
                case 'status': params.set('status', 'all'); break;
                default: params.delete(key);
            }
        });
    }

    function clearFilters() {
        filterButton.current?.focus();
        setExclusions([]);
        updateSkiParams(params => {
            for (const key of clearable) params.delete(key);
            if (status !== 'today') params.set('status', 'all');
        });
    }

    const chips: { label: string | boolean | undefined; key: string; place?: string }[] = [
        { label: searchedArea && 'Map area', key: 'mapArea' },
        ...skiLocationModes.flatMap(mode => locations[mode].map(place => ({
            label: `${skiLocationActions[mode]} ${skiLocationLabels.get(place)}`, key: mode, place,
        }))),
        { label: passes.includes('indy-discounts') && passFilterOptions['indy-discounts'], key: 'pass' },
        { label: product?.name, key: 'product' },
        { label: skiDate, key: 'skiDate' },
        { label: homeArea && `Home · ${homeArea.name}`, key: 'homeArea' },
        { label: skiing && skiingFilterOptions[skiing], key: 'skiing' },
        { label: seasonMonth ? seasonMonths.find(({ month }) => month === seasonMonth)?.label : undefined, key: 'seasonMonth' },
        { label: night && 'Night skiing', key: 'night' },
        { label: status !== 'all' && status !== 'today' && statusFilterLabels[status], key: 'status' },
    ].filter(chip => Boolean(chip.label));
    const additionalFilters = chips.filter(({ key }) => key !== 'mapArea').length;
    const checkingReports = status === 'today' && scoped.length > 0 && currentReports === 0 && conditions.reportsLoading;
    const coverageText = `${currentReports} of ${scoped.length} areas have current operating reports`;
    const resultText = status === 'today' ? `${matching.length} reporting skiing today` : `${matching.length} ski ${matching.length === 1 ? 'area' : 'areas'}`;
    let emptyMessage = searchedArea ? 'No ski areas match your filters in this map area.' : 'No ski areas match these filters.';
    if (status === 'today' && scoped.length > 0) {
        emptyMessage = currentReports > 0 ? 'No resorts in this search have reported skiing today.'
            : 'No current operating reports are available for this search.';
    }
    const emptyResults = <div className="ski-empty">
        <p>{checkingReports ? 'Checking today’s resort reports…' : emptyMessage}</p>
        {searchedArea && <button type="button" className="ski-control" onClick={event => {
            event.currentTarget.closest<HTMLElement>('#ski-results-pane')?.focus({ preventScroll: true });
            clearMapArea();
        }}>Clear map area</button>}
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
                    <IntentLink to={SITE_URL} title="rsmb.tv home">rsmb.tv</IntentLink>
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
                            {!checkingReports && <>
                                <span>{resultText}</span>
                                {searchedArea && <span className="sr-only">In the selected map area</span>}
                                {status !== 'all' && <span className="ski-coverage">{coverageText}</span>}
                            </>}
                        </div>
                        {chips.length > 0 && <div aria-label="Applied filters" role="group" className="ski-chips">
                            {chips.map(({ label, key, place }) => <button type="button" key={place ? `${key}:${place}` : key} className="ski-chip"
                                aria-label={`Remove ${label}`} title={`Remove ${label}`} onClick={() => removeFilter(key, place)}>
                                <span>{label}</span><SkiIcon name="close" />
                            </button>)}
                        </div>}
                        {(chips.length > 0 || passes.length > 0) &&
                            <button type="button" className="ski-clear-filters" aria-label="Clear filters" onClick={clearFilters}>
                                Clear<span> filters</span>
                            </button>}
                    </div>
                    <div className="ski-context-actions">
                        <SkiShareButton getUrl={getShareUrl} />
                        <SkiProjectInfo conditions={conditions} />
                    </div>
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
                        <SkiStatusMap areas={status === 'today' ? scoped : matching} fitResults={matching}
                            searchResults={searchResults} searchReportsPending={status !== 'all' && conditions.reportsLoading}
                            cameraAreas={catalogMatches} cameraFitKey={cameraFitKey}
                            selected={selected} colors={colors} units={units} passSelection={passSelection} statuses={statuses} conditions={conditions}
                            archive={archive}
                            terrain={terrain} snowDepth={snowDepth} resortTerrain={resortTerrain} peaks={peaks} visible={showMap} searchedArea={searchedArea}
                            layersModified={colors !== defaultColors || terrain || snowDepth || !resortTerrain || !peaks || driving}
                            searchedAreaKey={searchedArea ? mapAreaParam : null} initializeArea={legacyArea}
                            terrainRequest={terrainRequest} locationRequest={locationRequest} willDockDetails={!wide && !detailsOpen}
                            driving={driving} drivingData={drivingData} drivingApproach={drivingApproach} drivingRequest={drivingRequest}
                            camera={camera} navigationKey={location.key} restoreHistoryCamera={restoreHistoryCamera}
                            cameraReader={cameraReader} mapRegion={mapSection} onCameraChange={commitMapCamera}
                            onSearchArea={commitMapArea} onClearArea={clearMapArea} onSelect={selectArea} onShowTerrain={showTerrain}
                            onZoomLocation={zoomToLocation} onLayerChange={setParam} />
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
                        columnPreference={columnPreference} reportsFirst={status !== 'all'} onSort={setSort} onSelect={selectArea} onZoomLocation={zoomToLocation} /> : emptyResults}
                </div>
            </section>}
            {!compare && <aside id="ski-results-pane" tabIndex={-1} aria-label="Resort results" hidden={!showList || detailsOpen} className="ski-sidebar flex min-h-0 min-w-0 flex-col">
                {sorted.length > 0 ? <SkiAreaList areas={sorted} selectedId={selected?.id} statuses={statuses} conditions={conditions} colors={colors} archive={archive}
                    units={units} passSelection={passSelection} sort={sort} onSort={setSort} onSelect={selectArea} onZoomLocation={zoomToLocation} /> : emptyResults}
            </aside>}
            {selected && detailsOpen && <aside key={selected.id} className="ski-sidebar min-h-0 min-w-0 overflow-auto">
                <SkiAreaDetails area={selected} sectionRef={detailSection} units={units} onClose={closeDetails} conditions={conditions}
                    archive={archive?.get(selected.id)}
                    product={product} skiDate={skiDate} homeAreaId={homeAreaId} onShowTerrain={canShowTerrain ? () => showTerrain({ id: selected.id }) : undefined}
                    onZoomLocation={zoomToLocation} driving={<details className="ski-driving-disclosure" open={drivingExpanded} onToggle={event => {
                        if (event.target === event.currentTarget) {
                            const open = event.currentTarget.open;
                            if (open !== drivingExpanded) setDrivingDisclosure({ area: selected.id, open });
                        }
                    }}>
                        <summary>Driving access</summary>
                        {drivingExpanded && <ErrorBoundary fallback={<p>Driving information unavailable.</p>}>
                            <Suspense fallback={<p role="status">Loading driving information…</p>}>
                                <SkiDrivingDetails area={selected} units={units} data={drivingData} approachId={approachId}
                                    onApproach={id => { setDrivingRequest(undefined); setParam('approach', id); }} onFit={showDrivingApproach} />
                            </Suspense>
                        </ErrorBoundary>}
                    </details>} />
            </aside>}
        </div>
        <SkiFilterDialog dialog={filterDialog} filters={filters} resultCount={matching.length} units={units}
            onShowResults={() => { if (!wide && view === 'map') setView('results'); }}
            onUnitsChange={setUnits} onChangeLocation={toggleLocationFilter} setParam={setParam} updateParams={updateSkiParams} />
        <SkiDialog dialog={columnsDialog} id="ski-columns" title="Columns">
            <SkiColumnSettings columns={columnPreference} onChange={columns => {
                setColumns(columns);
                if (!columns.includes(sort.key)) setParam('sort', undefined);
            }} />
        </SkiDialog>
    </main>;
}
