import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { getTripPosts } from '../content/posts';
import { getTripSummary } from '../features/trips/tripSummaries';
import { useTripRoute } from '../features/trips/useTripRoute';
import { buildTripAtlasEntries } from '../features/trips/atlas/tripAtlasEntries';
import { TripAtlasMapBoundary } from '../features/trips/atlas/TripAtlasMapBoundary';
import { TripAtlasPanel } from '../features/trips/atlas/TripAtlasPanel';
import { TripAtlasResults } from '../features/trips/atlas/TripAtlasResults';
import { TripAtlasShare } from '../features/trips/atlas/TripAtlasShare';
import { useAtlasUrlState } from '../features/trips/atlas/useAtlasUrlState';
import { encodeAtlasCamera, readAtlasCamera, readAtlasPresentation } from '../features/trips/atlas/tripAtlasUrlState';
import { TRIP_ATLAS_PATH, type AtlasRouteState } from '../features/trips/atlas/tripAtlasView';
import {
    atlasBrowseQuery, atlasFilterCount, atlasLocationCatalog, emptyAtlasFilters, filterAtlasEntries, readAtlasBrowse, sortAtlasEntries,
    validateAtlasFilters, writeAtlasBrowse, type AtlasFilters, type AtlasPanelState, type AtlasResultsView, type AtlasSort,
} from '../features/trips/atlas/tripAtlasBrowser';
import { readAtlasSession, saveAtlasSession, type AtlasCamera, type AtlasSession } from '../features/trips/atlas/tripAtlasSession';
import { isDevelopmentContent } from '../utils/developmentContent';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { absoluteUrl, AUTHOR_PERSON } from '../utils/siteMetadata';
import '../features/trips/atlas/tripAtlasBrowser.css';

const TripAtlasMap = lazy(() => import('../features/trips/atlas/TripAtlasMap'));

function RouteReader({ id, url, onChange }: { id: string; url: string; onChange: (id: string, state: AtlasRouteState) => void }) {
    const { route, error, retry } = useTripRoute(url);
    useEffect(() => { onChange(id, { route, error, retry }); }, [id, route, error, retry, onChange]);
    return null;
}

export default function AdvAtlas() {
    const development = isDevelopmentContent();
    const entries = useMemo(() => buildTripAtlasEntries(getTripPosts(), getTripSummary, { includeDrafts: development, includeIncomplete: development }), [development]);
    const location = useLocation();
    const navigationType = useNavigationType();
    const { params, getParams, updateParams } = useAtlasUrlState();
    const requestedId = params.get('trip');
    const selectedEntry = entries.find(entry => entry.id === requestedId);
    const selectedId = selectedEntry?.id;
    const onlySelected = Boolean(selectedId) && params.get('view') === 'selected';
    const invalidSelection = Boolean(requestedId && !selectedId);
    const url = location.pathname + location.search;
    const browseQuery = atlasBrowseQuery(params);
    const { filters, sort } = useMemo(() => readAtlasBrowse(new URLSearchParams(browseQuery)), [browseQuery]);
    const filterIssues = useMemo(() => validateAtlasFilters(filters), [filters]);
    const activeFilters = atlasFilterCount(filters) + Number(onlySelected);
    const countries = useMemo(() => atlasLocationCatalog(entries), [entries]);
    const matchingEntries = useMemo(() => sortAtlasEntries(filterAtlasEntries(entries, filters), sort), [entries, filters, sort]);
    const visibleEntries = useMemo(() => onlySelected ? matchingEntries.filter(entry => entry.id === selectedId) : matchingEntries, [matchingEntries, onlySelected, selectedId]);
    const mapEntries = useMemo(() => visibleEntries.filter(entry => entry.summary), [visibleEntries]);
    const mapSelectedId = mapEntries.find(entry => entry.id === selectedId)?.id;
    const [initialSession] = useState(() => {
        const state = location.state as { restoreScroll?: boolean; returnKey?: unknown } | null;
        return readAtlasSession(location.key, state?.restoreScroll ? url : undefined,
            state?.restoreScroll && typeof state.returnKey === 'string' ? state.returnKey : undefined);
    });
    const presentation = readAtlasPresentation(params);
    const panelState = presentation.panel ?? initialSession?.panelState
        ?? (initialSession ? initialSession.panelOpen ? 'compact' : 'collapsed' : 'compact');
    const resultsView = presentation.results ?? initialSession?.resultsView ?? 'cards';
    const cameraValue = params.get('camera');
    const sharedCamera = useMemo(() => readAtlasCamera(cameraValue), [cameraValue]);
    const [initialCamera] = useState(() => {
        if (!sharedCamera) return initialSession?.camera;
        const saved = initialSession?.camera;
        // Keep full precision on report returns when the shared link describes that same view.
        return saved && encodeAtlasCamera(saved) === encodeAtlasCamera(sharedCamera) ? saved : sharedCamera;
    });
    const panelOpen = panelState !== 'collapsed';
    const session = useRef<AtlasSession>({ ...(initialSession ?? { scrollTop: 0 }), ...(initialCamera ? { camera: initialCamera } : {}), panelOpen, panelState, resultsView });
    const [routes, setRoutes] = useState<Record<string, AtlasRouteState>>({});
    const [fitRequest, setFitRequest] = useState<{ tripId?: string; version: number; cancelled?: boolean }>(() => ({
        tripId: mapEntries.some(entry => entry.id === selectedId) ? selectedId : undefined, version: 0,
    }));
    const [cameraChanged, setCameraChanged] = useState(false);
    const [hoveredId, setHoveredId] = useState<string>();
    const [focusedId, setFocusedId] = useState<string>();
    const highlightedId = hoveredId ?? focusedId;
    const [reveal, setReveal] = useState(() => !initialSession && selectedId ? { id: selectedId, version: 0, focusCard: false } : undefined);
    const focusedReveal = useRef(reveal);
    const listRef = useRef<HTMLDivElement>(null);
    const fullscreenContainer = useRef<HTMLElement>(null);
    const cameraUrlSuspended = useRef(false);
    const committedHistoryKey = useRef(location.key);
    const visibleRoutes = useMemo(() => Object.fromEntries(Object.entries(routes).filter(([id]) => mapEntries.some(entry => entry.id === id))), [routes, mapEntries]);
    const selectedOutsideFilters = Boolean(selectedId && !visibleEntries.some(entry => entry.id === selectedId));

    const description = 'Explore motorcycle journeys on a map, compare trip facts, and read the reports.';
    useDocumentHead({ title: 'ADV Atlas', description, ogImage: absoluteUrl('/og/adv-atlas.svg') });
    useJsonLd({
        '@context': 'https://schema.org', '@type': 'WebPage', name: 'ADV Atlas Map', description,
        url: absoluteUrl(TRIP_ATLAS_PATH), author: AUTHOR_PERSON,
        mainEntity: {
            '@type': 'SoftwareApplication', '@id': absoluteUrl('/projects/adv-atlas#application'),
            name: 'ADV Atlas', url: absoluteUrl(TRIP_ATLAS_PATH), applicationCategory: 'TravelApplication', operatingSystem: 'Web',
        },
    });

    const onRouteChange = useCallback((id: string, state: AtlasRouteState) => setRoutes(current => ({ ...current, [id]: state })), []);
    const onCameraChange = useCallback((camera: AtlasCamera) => { session.current.camera = camera; }, []);
    const onCameraIdle = useCallback((camera: AtlasCamera) => {
        const browserKey: unknown = window.history.state?.key;
        if (cameraUrlSuspended.current || (typeof browserKey === 'string' && browserKey !== committedHistoryKey.current)) return;
        const value = encodeAtlasCamera(camera);
        if (value) updateParams(next => {
            next.set('camera', value);
            // A completed fit can precede the router's panel or presentation commit.
            const pending = readAtlasPresentation(next);
            if (!pending.panel) next.set('panel', panelState);
            if (!pending.results) next.set('results', resultsView);
        });
    }, [updateParams, panelState, resultsView]);
    const onListScroll = useCallback((scrollTop: number) => { session.current.scrollTop = scrollTop; }, []);
    const clearPreviews = () => { setHoveredId(undefined); setFocusedId(undefined); };
    const resetScroll = () => {
        session.current.scrollTop = 0;
        if (listRef.current) listRef.current.scrollTop = 0;
        setReveal(undefined);
        clearPreviews();
    };
    const changePanel = (state: AtlasPanelState) => {
        session.current.panelState = state;
        session.current.panelOpen = state !== 'collapsed';
        updateParams(next => { next.set('panel', state); });
        clearPreviews();
    };
    const changeView = (view: AtlasResultsView) => {
        session.current.resultsView = view;
        updateParams(next => { next.set('results', view); });
        resetScroll();
    };
    const selectTrip = (id: string, options: { reveal?: boolean; focusCard?: boolean } = {}) => {
        updateParams(next => { next.set('trip', id); next.delete('camera'); });
        setFitRequest(current => ({ tripId: id, version: current.version + 1 }));
        if (options.reveal) {
            if (!panelOpen) changePanel('compact');
            setReveal(current => ({ id, version: (current?.version ?? 0) + 1, focusCard: Boolean(options.focusCard) }));
        }
    };
    const deselectTrip = () => {
        updateParams(next => { next.delete('trip'); next.delete('view'); });
        setFitRequest(current => ({ ...current, cancelled: true }));
        setReveal(undefined);
        clearPreviews();
    };
    const changeOnlySelected = () => {
        updateParams(next => {
            if (!onlySelected && selectedId) next.set('view', 'selected'); else next.delete('view');
        });
        resetScroll();
    };
    const changeFilters = (next: AtlasFilters) => {
        updateParams(current => writeAtlasBrowse(current, next, sort), false);
        setFitRequest(current => ({ ...current, cancelled: true }));
        resetScroll();
    };
    const clearFilters = () => {
        updateParams(current => {
            const next = writeAtlasBrowse(current, emptyAtlasFilters(), sort);
            next.delete('view');
            return next;
        }, false);
        setFitRequest(current => ({ ...current, cancelled: true }));
        resetScroll();
    };
    const changeSort = (next: AtlasSort) => { updateParams(current => writeAtlasBrowse(current, filters, next)); resetScroll(); };
    const fitResults = () => {
        updateParams(next => { next.delete('trip'); next.delete('view'); next.delete('camera'); });
        setFitRequest(current => ({ version: current.version + 1 }));
        setReveal(undefined);
        clearPreviews();
    };
    const getShareUrl = () => {
        const next = getParams();
        const pending = readAtlasPresentation(next);
        next.set('panel', pending.panel ?? panelState);
        next.set('results', pending.results ?? resultsView);
        const camera = session.current.camera && encodeAtlasCamera(session.current.camera);
        if (camera) next.set('camera', camera);
        updateParams(() => next);
        return new URL(`${location.pathname}?${next}${location.hash}`, window.location.origin).href;
    };

    useLayoutEffect(() => {
        session.current.panelOpen = panelOpen;
        session.current.panelState = panelState;
        session.current.resultsView = resultsView;
    }, [panelOpen, panelState, resultsView]);
    useLayoutEffect(() => {
        committedHistoryKey.current = location.key;
        cameraUrlSuspended.current = location.pathname !== TRIP_ATLAS_PATH;
    }, [location.key, location.pathname]);

    useEffect(() => {
        const remember = () => {
            if (listRef.current && session.current.panelOpen) session.current.scrollTop = listRef.current.scrollTop;
            saveAtlasSession(location.key, url, session.current);
        };
        window.addEventListener('pagehide', remember);
        return () => { remember(); window.removeEventListener('pagehide', remember); };
    }, [location.key, url]);
    useEffect(() => {
        const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') { setHoveredId(undefined); setFocusedId(undefined); } };
        document.addEventListener('keydown', dismiss);
        return () => document.removeEventListener('keydown', dismiss);
    }, []);
    useLayoutEffect(() => {
        if (panelOpen && listRef.current) listRef.current.scrollTop = session.current.scrollTop;
    }, [panelOpen]);
    useEffect(() => {
        if (!reveal || !panelOpen || reveal.id !== selectedId) return;
        document.getElementById(`atlas-card-${reveal.id}`)?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
        if (reveal.focusCard && focusedReveal.current !== reveal) {
            focusedReveal.current = reveal;
            const control = document.getElementById(`atlas-route-${reveal.id}`);
            control?.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'instant' });
            control?.focus({ preventScroll: true });
        }
    }, [reveal, panelOpen, selectedId]);

    const loadedCount = mapEntries.filter(entry => routes[entry.id]?.route).length;
    return <main ref={fullscreenContainer} data-panel-state={panelState} data-results-view={resultsView}
        className="atlas-explorer relative h-full w-full overflow-hidden bg-zinc-950 text-zinc-100"
        onClickCapture={event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
            const link = event.target.closest<HTMLAnchorElement>('a[href]');
            if (link && (!link.target || link.target === '_self') && !link.hasAttribute('download')
                && new URL(link.href).pathname !== location.pathname) cameraUrlSuspended.current = true;
        }}>
        <a href="#atlas-panel-toggle" className="sr-only z-50 rounded bg-violet-600 p-3 focus:not-sr-only focus:absolute focus:left-3 focus:top-3">Skip to trip list</a>
        {entries.map(entry => entry.summary && <RouteReader key={entry.id} id={entry.id} url={entry.summary.route.geoJson} onChange={onRouteChange} />)}
        <section className="atlas-map-viewport" aria-label="Trip map" data-testid="atlas-map-viewport">
            <TripAtlasMapBoundary><Suspense fallback={<p role="status" className="absolute inset-0 grid place-items-center text-sm text-zinc-400">Loading trip map…</p>}>
                <TripAtlasMap entries={mapEntries} routes={visibleRoutes} selectedId={mapSelectedId}
                    highlightedId={highlightedId} fitVersion={fitRequest.version} fitRequest={fitRequest} panelOpen={panelOpen}
                    initialCamera={initialCamera} cameraTarget={sharedCamera} urlKey={location.key}
                    cameraRevision={navigationType === 'POP' ? location.key : undefined} fullscreenContainer={fullscreenContainer}
                    onSelect={(id, options) => id ? selectTrip(id, { reveal: true, ...options }) : deselectTrip()}
                    onHover={setHoveredId} onCameraChange={onCameraChange} onCameraIdle={onCameraIdle} onViewChange={setCameraChanged} />
            </Suspense></TripAtlasMapBoundary>
            <TripAtlasShare getUrl={getShareUrl} />
            {(selectedId || cameraChanged || activeFilters > 0 || fitRequest.cancelled) && <button type="button" onClick={fitResults}
                data-testid="atlas-overview-control" disabled={loadedCount === 0}
                aria-label={atlasFilterCount(filters) ? 'Fit results' : 'Zoom to all trips'} title={atlasFilterCount(filters) ? 'Fit results' : 'Zoom to all trips'}
                className="atlas-control atlas-icon-control atlas-overview-control">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />
                </svg>
            </button>}
            {!panelOpen && activeFilters > 0 && <p className="pointer-events-none absolute bottom-8 right-3 z-10 rounded-lg bg-zinc-950/90 px-3 py-2 text-xs text-zinc-300">{visibleEntries.length} of {entries.length} trips · {activeFilters} filters</p>}
        </section>
        <TripAtlasPanel state={panelState} view={resultsView} sort={sort} filters={filters} countries={countries}
            selectedId={selectedId} onlySelected={onlySelected} count={visibleEntries.length} total={entries.length}
            loadedRoutes={loadedCount} routeCount={mapEntries.length} listRef={listRef}
            onState={changePanel} onView={changeView} onSort={changeSort} onFilters={changeFilters}
            onOnlySelected={changeOnlySelected} onClearFilters={clearFilters} onScroll={onListScroll}>
            {invalidSelection && <p role="status" className="mb-3 rounded-lg bg-zinc-800 p-3 text-sm">That trip is not available in this collection. Browse the available trips below.</p>}
            {filterIssues.length > 0 && <p role="alert" className="mb-3 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">Some filters are invalid. Edit or clear them to see results. {filterIssues[0].message}</p>}
            {selectedOutsideFilters && <div className="mb-3 rounded-lg border border-violet-900 bg-violet-950/30 p-3 text-sm text-violet-200">
                <p>Selected trip is outside these filters.</p>
                <button type="button" onClick={() => { deselectTrip(); document.getElementById('atlas-filters-toggle')?.focus({ preventScroll: true }); }} className="min-h-11 underline">Clear selection</button>
            </div>}
            {visibleEntries.length === 0 && <p className="rounded-lg bg-zinc-900 p-4 text-sm text-zinc-400">{entries.length ? 'No trips match these filters. Clear a filter or choose a wider range.' : 'No trip reports are available yet.'}</p>}
            <TripAtlasResults entries={visibleEntries} routes={routes} selectedId={selectedId} highlightedId={highlightedId}
                expanded={panelState === 'expanded'} view={resultsView} sort={sort} development={development}
                returnUrl={url} returnKey={location.key} onSort={changeSort} onSelect={selectTrip} onHover={setHoveredId} onFocus={setFocusedId} />
        </TripAtlasPanel>
    </main>;
}
