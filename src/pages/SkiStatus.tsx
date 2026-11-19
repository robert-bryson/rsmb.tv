import { lazy, Suspense, useMemo, useRef } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { IntentLink } from '../components/IntentLink';
import { MapSkipLink } from '../components/MapSkipLink';
import { filterSkiAreas, readPassFilter, readSkiSort, sortSkiAreas, type SkiSort, type SkiUnits } from '../features/ski-status/browse';
import { locationAttribution, locationLicense, passNames, passSeason, skiAreas } from '../features/ski-status/catalog';
import { SkiAreaDetails } from '../features/ski-status/SkiAreaDetails';
import { SkiAreaTable } from '../features/ski-status/SkiAreaTable';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { usePersistedState } from '../hooks/usePersistedState';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { MAPLIBRE_STYLESHEET, moduleLoader } from '../navigation/moduleLoader';
import { staticPageMetadata } from '../utils/pageMetadata';
import locationDownload from '../../projects/ski-status/data/pilot-locations.json?url';

const SkiStatusMap = lazy(moduleLoader(() => import('../features/ski-status/SkiStatusMap'), MAPLIBRE_STYLESHEET));
const regions = [...new Set(skiAreas.flatMap(area => area.region.split('/')))].sort();
const inputClass = 'min-h-11 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-base text-zinc-100 focus-visible:border-cyan-300 focus-visible:outline-1 focus-visible:outline-cyan-300';
const panelClass = 'min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950';

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
    const smallScreen = useMediaQuery('(max-width: 1023px)');
    const mobileMap = searchParams.get('view') === 'map';
    const regionParam = searchParams.get('region') ?? '';
    const region = regions.includes(regionParam) ? regionParam : '';
    const pass = readPassFilter(searchParams);
    const night = searchParams.get('night') === '1';
    const sort = readSkiSort(searchParams);
    const selectedId = searchParams.get('area');
    const areas = useMemo(() => filterSkiAreas(skiAreas, query, region, pass, night), [query, region, pass, night]);
    const selected = areas.find(area => area.id === selectedId);
    const sorted = useMemo(() => sortSkiAreas(areas, { key: sort.key, direction: sort.direction }), [areas, sort.key, sort.direction]);
    const selectedButton = useRef<HTMLButtonElement>(null);
    const mapViewButton = useRef<HTMLButtonElement>(null);
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

    function closeDetails() {
        (selectedButton.current ?? mapViewButton.current ?? searchInput.current)?.focus();
        setParam('area');
    }

    const hasFilters = Boolean(query || region || pass || night);
    return <main className="h-full w-full overflow-y-auto bg-zinc-950 text-zinc-100">
        <MapSkipLink targetId="ski-area-search" />
        <div className="mx-auto max-w-[112rem] space-y-3 p-3 sm:p-5">
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-zinc-800 pb-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">ski-status</h1>
                    <p className="text-sm text-zinc-400">Pilot catalog · {passSeason} pass season</p>
                </div>
                <IntentLink to="/projects" className="inline-flex min-h-11 items-center text-sm text-zinc-300 underline underline-offset-4 hover:text-cyan-300">Projects</IntentLink>
            </header>
            <section aria-label="Ski area filters" className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
                <label className="col-span-2 grid min-w-0 gap-1 text-sm text-zinc-300 sm:min-w-48 sm:flex-1">Search areas
                    <input ref={searchInput} type="search" id="ski-area-search" value={query} onChange={event => updateQuery(event.target.value)} onBlur={commitQuery}
                        onKeyDown={event => { if (event.key === 'Enter') commitQuery(); }} placeholder="Name or location" className={inputClass} />
                </label>
                <div className="grid min-w-0 gap-1 text-sm text-zinc-300">
                    <label htmlFor="ski-region">Region</label>
                    <select id="ski-region" value={region} onChange={event => setParam('region', event.target.value)} className={inputClass}>
                        <option value="">All regions</option>{regions.map(code => <option key={code} value={code}>{code}</option>)}
                    </select>
                </div>
                <div className="grid min-w-0 gap-1 text-sm text-zinc-300">
                    <label htmlFor="ski-pass">Pass</label>
                    <select id="ski-pass" value={pass ?? ''} onChange={event => setParam('pass', event.target.value)} className={inputClass}>
                        <option value="">All ski areas</option>{Object.entries(passNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                    </select>
                </div>
                <div className="grid min-w-0 gap-1 text-sm text-zinc-300">
                    <label htmlFor="ski-units">Units</label>
                    <select id="ski-units" value={units} onChange={event => setUnits(event.target.value === 'metric' ? 'metric' : 'imperial')} className={inputClass}>
                        <option value="imperial">Acres / feet</option><option value="metric">Hectares / meters</option>
                    </select>
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={night} onChange={event => setParam('night', event.target.checked ? '1' : undefined)}
                        className="size-4 accent-cyan-400" /> Night skiing
                </label>
            </section>
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <p aria-live="polite" className="tabular-nums text-zinc-300">{areas.length} of {skiAreas.length} ski areas</p>
                    {hasFilters && <button type="button" onClick={() => updateParams(params => {
                        for (const key of ['q', 'region', 'pass', 'night']) params.delete(key);
                    })} className="min-h-11 text-cyan-300 underline underline-offset-4">Clear filters</button>}
                    {selected && <a href="#ski-area-details" aria-label={`${selected.name} details`}
                        className="inline-flex min-h-11 items-center text-cyan-300 underline underline-offset-4">Details</a>}
                </div>
                {smallScreen && <div role="group" aria-label="Results view" className="flex rounded-md border border-zinc-700">
                    {(['Table', 'Map'] as const).map(view => {
                        const active = mobileMap === (view === 'Map');
                        return <button key={view} type="button" ref={view === 'Map' ? mapViewButton : undefined} aria-pressed={active}
                            onClick={() => setParam('view', view === 'Map' ? 'map' : undefined)}
                            className={`min-h-11 px-3 ${active ? 'bg-cyan-950 text-cyan-100' : 'text-zinc-300 hover:text-white'}`}>{view}</button>;
                    })}
                </div>}
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                {(!smallScreen || mobileMap) && <section className={`${panelClass} h-[min(53dvh,34rem)] min-h-[20rem]`} aria-label="Map of ski areas">
                    <ErrorBoundary fallback={<MapMessage failed />}><Suspense fallback={<MapMessage />}>
                        <SkiStatusMap areas={areas} selected={selected} onSelect={selectArea} />
                    </Suspense></ErrorBoundary>
                </section>}
                {(!smallScreen || !mobileMap) && <section className={`${panelClass} lg:h-[min(53dvh,34rem)] lg:min-h-[20rem]`} aria-label="Ski area statistics">
                    <SkiAreaTable areas={sorted} units={units} sort={sort} selected={selected} selectedButtonRef={selectedButton} onSort={setSort} onSelect={selectArea} />
                </section>}
            </div>
            {selected && <SkiAreaDetails area={selected} units={units} onClose={closeDetails} />}
            <footer className="flex flex-wrap gap-x-2 text-xs leading-6 text-zinc-400">
                <span>Locations</span>
                {Object.entries(locationAttribution).map(([name, url]) => <a key={name} href={url} className="underline underline-offset-2 hover:text-zinc-200">{name}</a>)}
                <a href={locationDownload} download="ski-status-locations.json" className="underline underline-offset-2 hover:text-zinc-200">Marker data</a>
                <a href={locationLicense} className="underline underline-offset-2 hover:text-zinc-200">ODbL</a>
            </footer>
        </div>
    </main>;
}
