import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getTripPosts } from '../content/posts';
import { getCountryName } from '../content/blogRegions';
import { getTripSummary } from '../features/trips/tripSummaries';
import { useTripRoute } from '../features/trips/useTripRoute';
import { buildTripAtlasEntries, type TripAtlasEntry } from '../features/trips/atlas/tripAtlasEntries';
import { TripAtlasMapBoundary } from '../features/trips/atlas/TripAtlasMapBoundary';
import {
    readAtlasSession, saveAtlasSession, TRIP_ATLAS_PATH, tripAtlasColor,
    type AtlasCamera, type AtlasRouteState, type AtlasSession,
} from '../features/trips/atlas/tripAtlasView';
import { formatDate } from '../utils/formatDate';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { absoluteUrl, AUTHOR_PERSON } from '../utils/siteMetadata';

const TripAtlasMap = lazy(() => import('../features/trips/atlas/TripAtlasMap'));

function RouteReader({ entry, onChange }: { entry: TripAtlasEntry; onChange: (id: string, state: AtlasRouteState) => void }) {
    const { route, error, retry } = useTripRoute(entry.summary.route.geoJson);
    useEffect(() => { onChange(entry.id, { route, error, retry }); }, [entry.id, route, error, retry, onChange]);
    return null;
}

function CardPhoto({ entry }: { entry: TripAtlasEntry }) {
    const [failed, setFailed] = useState(false);
    const photo = entry.summary.hero;
    return failed ? <div role="img" aria-label={photo.alt} className="grid aspect-[16/9] place-items-center bg-zinc-800 text-sm text-zinc-400">Photo unavailable</div> : (
        <img src={photo.src} srcSet={photo.srcSet} sizes="(min-width: 768px) 326px, calc(100vw - 3.5rem)"
            width={photo.width} height={photo.height} alt={photo.alt} loading="lazy" decoding="async"
            onError={() => setFailed(true)} className="aspect-[16/9] w-full object-cover" />
    );
}

function isCardControl(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('a, button, input, select, textarea, [role="button"], [contenteditable]'));
}

export default function MotorcycleTrips() {
    const entries = useMemo(() => buildTripAtlasEntries(getTripPosts(), getTripSummary, { includeDrafts: import.meta.env.DEV }), []);
    const location = useLocation();
    const [params, setParams] = useSearchParams();
    const requestedId = params.get('trip');
    const selectedId = entries.find(entry => entry.id === requestedId)?.id;
    const invalidSelection = Boolean(requestedId && !selectedId);
    const url = location.pathname + location.search;
    const [initialSession] = useState(() => readAtlasSession(location.key, (location.state as { restoreScroll?: boolean } | null)?.restoreScroll ? url : undefined));
    const [panelOpen, setPanelOpen] = useState(() => initialSession?.panelOpen ?? (Boolean(requestedId) || window.matchMedia('(min-width: 768px)').matches));
    const session = useRef<AtlasSession>({ ...(initialSession ?? { panelOpen, scrollTop: 0 }) });
    const [routes, setRoutes] = useState<Record<string, AtlasRouteState>>({});
    const [fitVersion, setFitVersion] = useState(0);
    const [hoveredId, setHoveredId] = useState<string>();
    const [focusedId, setFocusedId] = useState<string>();
    const highlightedId = hoveredId ?? focusedId;
    const [reveal, setReveal] = useState(() => !initialSession && selectedId ? { id: selectedId, version: 0 } : undefined);
    const listRef = useRef<HTMLDivElement>(null);

    const description = 'Explore motorcycle journeys on a map, browse photographs and trip facts, and read the reports.';
    useDocumentHead({ title: 'Motorcycle Trips', description, ogImage: absoluteUrl('/og/motorcycle-trips.svg') });
    useJsonLd({
        '@context': 'https://schema.org', '@type': 'WebPage', name: 'Motorcycle Trips Map', description,
        url: absoluteUrl(TRIP_ATLAS_PATH), author: AUTHOR_PERSON,
        mainEntity: {
            '@type': 'SoftwareApplication', '@id': absoluteUrl('/projects/motorcycle-trips#application'),
            name: 'Motorcycle Trips', url: absoluteUrl(TRIP_ATLAS_PATH), applicationCategory: 'TravelApplication', operatingSystem: 'Web',
        },
    });

    const onRouteChange = useCallback((id: string, state: AtlasRouteState) => {
        setRoutes(current => ({ ...current, [id]: state }));
    }, []);
    const onCameraChange = useCallback((camera: AtlasCamera) => { session.current.camera = camera; }, []);
    const changePanel = (open: boolean) => {
        session.current.panelOpen = open;
        setPanelOpen(open);
    };
    const selectTrip = (id: string | undefined, reveal = false) => {
        const next = new URLSearchParams(params);
        if (id) next.set('trip', id); else next.delete('trip');
        setParams(next, { replace: true });
        setFitVersion(version => version + 1);
        if (reveal && id) {
            changePanel(true);
            setReveal(current => ({ id, version: (current?.version ?? 0) + 1 }));
        }
    };
    const deselectTrip = () => {
        if (params.has('trip')) {
            const next = new URLSearchParams(params);
            next.delete('trip');
            setParams(next, { replace: true });
        }
        setHoveredId(undefined);
        setFocusedId(undefined);
        setReveal(undefined);
    };

    useEffect(() => () => saveAtlasSession(location.key, url, session.current), [location.key, url]);
    useEffect(() => {
        const dismiss = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { setHoveredId(undefined); setFocusedId(undefined); }
        };
        document.addEventListener('keydown', dismiss);
        return () => document.removeEventListener('keydown', dismiss);
    }, []);
    useLayoutEffect(() => {
        if (panelOpen && listRef.current) listRef.current.scrollTop = session.current.scrollTop;
    }, [panelOpen]);
    useEffect(() => {
        if (reveal && panelOpen) document.getElementById(`atlas-card-${reveal.id}`)?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
    }, [reveal, panelOpen]);

    const loadedCount = entries.filter(entry => routes[entry.id]?.route).length;
    return (
        <main className="relative h-full w-full overflow-hidden bg-zinc-950 text-zinc-100">
            <a href="#atlas-panel-toggle" className="sr-only z-50 rounded bg-violet-600 p-3 focus:not-sr-only focus:absolute focus:left-3 focus:top-3">Skip to trip list</a>
            {entries.map(entry => <RouteReader key={entry.id} entry={entry} onChange={onRouteChange} />)}
            <TripAtlasMapBoundary>
                <Suspense fallback={<p role="status" className="absolute inset-0 grid place-items-center text-sm text-zinc-400">Loading trip map…</p>}>
                    <TripAtlasMap entries={entries} routes={routes} selectedId={selectedId} highlightedId={highlightedId}
                        fitVersion={fitVersion} panelOpen={panelOpen} initialCamera={initialSession?.camera}
                        onSelect={id => id ? selectTrip(id, true) : deselectTrip()} onHover={setHoveredId} onCameraChange={onCameraChange} />
                </Suspense>
            </TripAtlasMapBoundary>

            <header className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2 md:inset-x-4 md:top-4">
                <div className="pointer-events-auto min-w-0 rounded-xl border border-zinc-700/80 bg-zinc-950/95 px-4 py-3 shadow-xl backdrop-blur md:w-[360px]">
                    <Link to="/projects" className="inline-flex min-h-6 items-center text-xs text-zinc-400 hover:text-violet-300">← Projects</Link>
                    <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">Motorcycle Trips</h1>
                    <p className="mt-0.5 text-xs text-zinc-400">{entries.length} trips · Routes, photographs &amp; stories</p>
                </div>
                <button type="button" onClick={() => selectTrip(undefined)} aria-label="Show all trips"
                    className="pointer-events-auto min-h-11 shrink-0 rounded-xl border border-zinc-600 bg-zinc-950/95 px-3 text-sm text-zinc-100 shadow-lg hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400">
                    Show all<span className="hidden sm:inline"> trips</span>
                </button>
            </header>

            <aside aria-label="Trip reports" className={`absolute inset-x-3 bottom-8 z-20 flex max-h-[55dvh] flex-col overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950/95 shadow-2xl backdrop-blur md:inset-x-auto md:left-4 md:top-32 md:w-[360px] md:max-h-none ${panelOpen ? 'md:bottom-4' : 'md:bottom-auto'}`}>
                <button id="atlas-panel-toggle" type="button" aria-expanded={panelOpen} aria-controls="atlas-trip-list"
                    onClick={() => changePanel(!panelOpen)}
                    className="flex min-h-12 w-full shrink-0 items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-zinc-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-400">
                    <span>{panelOpen ? 'Hide trips' : 'Browse trips'} <span className="ml-1 text-zinc-400">({entries.length})</span></span>
                    <span className="text-xs text-zinc-400">{loadedCount}/{entries.length} routes <span aria-hidden="true">{panelOpen ? '▾' : '▴'}</span></span>
                </button>
                <div id="atlas-trip-list" ref={listRef} hidden={!panelOpen} inert={!panelOpen}
                    onScroll={event => { if (panelOpen) session.current.scrollTop = event.currentTarget.scrollTop; }}
                    className="min-h-0 overflow-y-auto overscroll-contain border-t border-zinc-800 p-3 [scrollbar-gutter:stable]">
                    {invalidSelection && <p role="status" className="mb-3 rounded-lg bg-zinc-800 p-3 text-sm">That trip is not available in this collection. Browse the available trips below.</p>}
                    {entries.length === 0 && <p className="p-3 text-sm text-zinc-400">No trip reports are available yet.</p>}
                    <ol className="space-y-3">
                        {entries.map(entry => {
                            const active = selectedId === entry.id;
                            const highlighted = highlightedId === entry.id;
                            const color = tripAtlasColor(entry.id);
                            const state = routes[entry.id];
                            const draftCount = entry.reports.filter(report => report.draft).length;
                            const geography = [...new Set([
                                ...(entry.summary.countries ?? []).flatMap(country => country.regions?.length ? country.regions : [getCountryName(country.code)]),
                                ...(entry.summary.regions ?? []),
                            ])];
                            return <li key={entry.id} id={`atlas-card-${entry.id}`} data-trip-id={entry.id} data-highlighted={highlighted || undefined}
                                onClick={event => { if (!event.defaultPrevented && !isCardControl(event.target)) selectTrip(entry.id); }}
                                onPointerEnter={event => { if (event.pointerType !== 'touch') setHoveredId(entry.id); }} onPointerLeave={() => setHoveredId(undefined)}
                                onFocusCapture={() => setFocusedId(entry.id)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusedId(undefined); }}
                                className={`cursor-pointer overflow-hidden rounded-lg border-2 ${active || highlighted ? 'bg-zinc-900' : 'bg-zinc-950'}`}
                                style={{ borderColor: active || highlighted ? color : '#27272a', boxShadow: highlighted ? `inset 0 0 0 1px ${color}` : undefined }}>
                                <CardPhoto entry={entry} />
                                <div className="p-3">
                                    <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                                        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                        <span>{formatDate(entry.summary.dates.start)} – {formatDate(entry.summary.dates.end)}</span>
                                        {active && <span className="ml-auto text-zinc-100">Selected</span>}
                                    </div>
                                    <h2 className="text-base font-semibold leading-snug">{entry.title}</h2>
                                    {import.meta.env.DEV && draftCount > 0 && <p className="mt-2"><span className="inline-flex rounded border border-amber-800/70 bg-amber-950/40 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                                        DEV · {draftCount === entry.reports.length ? 'Unpublished draft' : 'Includes drafts'}
                                    </span></p>}
                                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{entry.description}</p>
                                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-300">
                                        {entry.summary.distanceMiles && <span>{entry.summary.distanceMiles.toLocaleString()} mi</span>}
                                        {entry.summary.ridingDays && <span>{entry.summary.ridingDays} riding days</span>}
                                        {entry.summary.motorcycle && <span>{entry.summary.motorcycle}</span>}
                                    </p>
                                    {geography.length ? <p className="mt-1 text-xs text-zinc-400">{geography.join(' · ')}</p> : null}
                                    <button type="button" aria-pressed={active} aria-label={`Show route: ${entry.title}`} onClick={() => selectTrip(entry.id)}
                                        className="mt-3 min-h-11 rounded-md border border-zinc-600 px-3 text-sm text-zinc-100 hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400">Show route</button>
                                    <div className="mt-1 flex flex-col">
                                        {entry.reports.map(report => <Link key={report.slug} to={report.href} state={{ from: url }}
                                            className="inline-flex min-h-11 flex-wrap items-center gap-2 text-sm text-violet-300 hover:text-violet-200 hover:underline">{entry.reports.length === 1 ? 'Read trip report →' : `${report.title} →`}
                                            {import.meta.env.DEV && report.draft && entry.reports.length > 1 && <span className="rounded border border-amber-800/70 bg-amber-950/40 px-1.5 py-0.5 text-[11px] text-amber-300">Draft</span>}
                                        </Link>)}
                                    </div>
                                    {state?.error ? <p role="status" className="mt-2 text-xs text-amber-300">Route unavailable. <button type="button" onClick={state.retry} className="min-h-11 underline">Retry route</button></p>
                                        : !state?.route && <p role="status" className="mt-2 text-xs text-zinc-500">Loading route…</p>}
                                </div>
                            </li>;
                        })}
                    </ol>
                </div>
            </aside>
        </main>
    );
}
