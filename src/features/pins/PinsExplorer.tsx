import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentLink } from '../../components/IntentLink';
import { usePersistedState } from '../../hooks/usePersistedState';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { Pin } from '../../../shared/pins';
import { usStatesAndTerritories } from '../../../shared/geography/usStates';
import { usePinsData } from './data';
import { PinsMap } from './PinsMap';
import type { ViewRequest } from './types';
import { countiesVisible, COUNTY_ZOOM, focusBounds, formatRadius, OVERVIEW_BOUNDS, rankPins, type CountyMode } from './geometry';
import './pins.css';

const EMPTY_PINS: Pin[] = [];
const JURISDICTIONS = [...usStatesAndTerritories].sort((a, b) => a.name.localeCompare(b.name));
const REGION_SHORTCUTS = [
    ['overview', 'Lower 48'], ['country-US', 'U.S. pole'], ['02', 'Alaska'], ['15', 'Hawaii'], ['72', 'Puerto Rico'],
    ['66', 'Guam'], ['60', 'American Samoa'], ['69', 'Northern Mariana Islands'], ['78', 'U.S. Virgin Islands'],
];

function PinIcon({ small = false }: { small?: boolean }) {
    return <svg aria-hidden="true" width={small ? 18 : 32} height={small ? 18 : 32} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1" />
        <circle cx="16" cy="16" r="3" fill="currentColor" />
        <path d="M16 1v8m0 14v8M1 16h8m14 0h8" stroke="currentColor" strokeWidth="1" />
    </svg>;
}

export default function PinsExplorer() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [level, setLevel] = useState<'state' | 'county'>('state');
    const [countyMode, setCountyMode] = useState<CountyMode>('auto');
    const [zoom, setZoom] = useState(3);
    const [stateFips, setStateFips] = useState('');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<'largest' | 'smallest' | 'name'>('largest');
    const [limit, setLimit] = useState(30);
    const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 768);
    const [storedCircles, setCircles] = usePersistedState('pins-radius-circles', true);
    const [storedUnit, setUnit] = usePersistedState<'mi' | 'km'>('pins-distance-unit', 'mi');
    const circles = storedCircles === true;
    const unit = storedUnit === 'km' ? 'km' : 'mi';
    const reducedMotion = useReducedMotion();
    const showCounties = countiesVisible(countyMode, zoom);
    const resources = usePinsData(showCounties);
    const pins = resources.pins.data?.pins ?? EMPTY_PINS;
    const metadata = resources.pins.data?.metadata;
    const nationalPin = pins.find(pin => pin.level === 'country');
    const selectedId = searchParams.get('pin');
    const selected = pins.find(pin => pin.id === selectedId) ?? null;
    const [view, setView] = useState<ViewRequest | null>(null);
    const viewKey = useRef(0);
    const focusedId = useRef<string | null>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const selectionRef = useRef<HTMLElement>(null);
    const ranked = useMemo(() => rankPins(pins, level, stateFips, query, sort), [pins, level, stateFips, query, sort]);
    const extremes = useMemo(() => [...ranked].sort((a, b) => b.radiusMeters - a.radiusMeters), [ranked]);
    const largest = extremes[0], smallest = extremes.at(-1);
    const filteredState = JURISDICTIONS.find(state => state.fips === stateFips);

    const requestView = useCallback((bounds: ViewRequest['bounds']) => setView({ bounds, key: ++viewKey.current }), []);
    const selectPin = useCallback((id: string) => {
        const pin = pins.find(pin => pin.id === id);
        if (!pin) return;
        focusedId.current = id;
        if (pin.level === 'county') {
            setLevel('county');
            setCountyMode(previous => previous === 'off' ? 'auto' : previous);
        }
        // Reveal a selected pin even when it falls outside the current scope.
        setStateFips(previous => previous && previous !== pin.stateFips ? '' : previous);
        setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('pin', id); return next; }, { replace: true });
        requestView(focusBounds(pin));
        setPanelOpen(true);
    }, [pins, requestView, setSearchParams]);

    useEffect(() => {
        if (selected && focusedId.current !== selected.id) selectPin(selected.id);
    }, [selected, selectPin]);

    useEffect(() => {
        if (selected) selectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }, [selected]);

    const clearSelection = () => {
        focusedId.current = null;
        setSearchParams(previous => { const next = new URLSearchParams(previous); next.delete('pin'); return next; }, { replace: true });
    };
    const setScope = (fips: string) => {
        setStateFips(fips);
        setQuery('');
        setLimit(30);
        clearSelection();
        const state = pins.find(pin => pin.level === 'state' && pin.fips === fips);
        requestView(state?.bounds ?? OVERVIEW_BOUNDS);
    };
    const jumpTo = (fips: string) => {
        if (fips === 'country-US') { selectPin('country-US'); return; }
        setStateFips('');
        clearSelection();
        const state = pins.find(pin => pin.level === 'state' && pin.fips === fips);
        requestView(state?.bounds ?? OVERVIEW_BOUNDS);
    };
    const changeLevel = (next: 'state' | 'county') => {
        setLevel(next);
        setLimit(30);
        if (next === 'county' && countyMode === 'off') setCountyMode('auto');
    };
    const closePanel = () => { setPanelOpen(false); toggleRef.current?.focus({ preventScroll: true }); };

    return <div className={`pins-app ${panelOpen ? 'pins-panel-open' : ''}`}>
        <header className="pins-header">
            <IntentLink to="/projects" className="pins-back" aria-label="Back to projects">← <span>Projects</span></IntentLink>
            <div className="pins-brand"><PinIcon /><div><p className="pins-eyebrow">An exploration of the interior</p><h1>Pins of Inaccessibility</h1></div></div>
            <div className="pins-header-actions" id="pins-controls" tabIndex={-1}>
                <IntentLink to="/projects/pins-of-inaccessibility" className="pins-about-link">About</IntentLink>
                <button type="button" ref={toggleRef} className="pins-button" aria-expanded={panelOpen} aria-controls="pins-sidebar"
                    onClick={() => setPanelOpen(value => !value)}>{panelOpen ? 'Hide panel' : 'Explore pins'}</button>
            </div>
        </header>

        <div className="pins-workspace">
            <aside className="pins-sidebar" id="pins-sidebar" aria-label="Pin explorer" hidden={!panelOpen}
                onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closePanel(); } }}>
                <div className="pins-panel-intro">
                    <p className="pins-eyebrow">How far inside can you go?</p>
                    <h2>The farthest point<br />from every edge.</h2>
                    <p>A national pin, plus one for each state, territory, and county. Each marks the center of its largest possible boundary-free circle.</p>
                    <div className="pins-coverage"><span><strong>{metadata?.stateCount ?? '56'}</strong> jurisdictions</span><span><strong>{metadata?.countyCount.toLocaleString() ?? '—'}</strong> counties & equivalents</span></div>
                </div>

                {nationalPin && <section className="pins-national-summary" aria-label="U.S. pole">
                    <button type="button" onClick={() => selectPin(nationalPin.id)}>
                        <span><i className="pins-national-dot" />U.S. pole <span aria-hidden="true">↗</span></span>
                        <strong>{formatRadius(nationalPin.radiusMeters, unit)}</strong>
                        <small>To the nearest national boundary</small>
                    </button>
                </section>}

                <div className="pins-filter-section">
                    <div className="pins-tabs" role="group" aria-label="Rank pins by geography">
                        <button type="button" aria-pressed={level === 'state'} onClick={() => changeLevel('state')}>States & territories</button>
                        <button type="button" aria-pressed={level === 'county'} onClick={() => changeLevel('county')}>Counties</button>
                    </div>
                    <label className="pins-field-label" htmlFor="pins-scope">Within</label>
                    <select id="pins-scope" className="pins-input" value={stateFips} onChange={event => setScope(event.target.value)}>
                        <option value="">All states & territories</option>
                        {JURISDICTIONS.map(state => <option key={state.fips} value={state.fips}>{state.name}</option>)}
                    </select>
                    <label className="sr-only" htmlFor="pins-search">Search pins</label>
                    <div className="pins-search"><span aria-hidden="true">⌕</span><input id="pins-search" type="search" value={query} placeholder="Search by name, abbreviation, or FIPS…"
                        onChange={event => { setQuery(event.target.value); setLimit(30); }} /></div>
                </div>

                {resources.pins.loading && <p className="pins-loading" role="status">Calculations complete. Loading the pins…</p>}
                {resources.pins.error && <div className="pins-data-error" role="alert">Pin data could not be loaded.<button type="button" onClick={resources.pins.retry}>Retry pin data</button></div>}

                {selected && <section ref={selectionRef} className="pins-selection" aria-label="Selected pin">
                    <div className="pins-selection-heading"><p className="pins-eyebrow">Selected {selected.kind}</p><button type="button" onClick={clearSelection} aria-label="Clear selected pin">×</button></div>
                    <h3>{selected.name}{selected.level === 'county' && <span>, {selected.stateAbbr}</span>}</h3>
                    <p className="pins-selected-radius">{formatRadius(selected.radiusMeters, unit)}<span>to the nearest boundary</span></p>
                    <dl><div><dt>Coordinates</dt><dd>{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</dd></div><div><dt>Land area</dt><dd>{Math.round(selected.landAreaKm2).toLocaleString()} km²</dd></div></dl>
                    <button type="button" className="pins-text-button" onClick={() => requestView(focusBounds(selected))}>Zoom to pin ↗</button>
                    <p className="pins-selected-note">The dashed lines reach the nearest boundary contacts. Their labels show the distances. The selected circle stays visible.</p>
                    {selected.level === 'country' && <p className="pins-selected-note">International borders and coastal jurisdiction limits count. Internal state borders do not.</p>}
                </section>}

                {largest && smallest && <section className="pins-extremes" aria-label="Radius extremes">
                    {([{ pin: largest, label: 'Largest radius' }, { pin: smallest, label: 'Smallest radius' }]).map(({ pin, label }) => {
                        return <button key={label} type="button" onClick={() => selectPin(pin.id)}>
                            <span>{label} <span aria-hidden="true">↗</span></span><strong>{formatRadius(pin.radiusMeters, unit)}</strong><small>{pin.name}{level === 'county' ? `, ${pin.stateAbbr}` : ''}</small>
                        </button>;
                    })}
                </section>}

                <div className="pins-results-heading"><div><h3>{filteredState?.abbr ?? 'All U.S.'} · {level === 'state' ? 'Jurisdictions' : 'Counties'}</h3><p aria-live="polite">{ranked.length.toLocaleString()} {ranked.length === 1 ? 'pin' : 'pins'}{query ? ' found' : sort === 'name' ? ' sorted by name' : ' ranked by radius'}</p></div>
                    <label className="sr-only" htmlFor="pins-sort">Sort pins</label><select id="pins-sort" value={sort} onChange={event => { setSort(event.target.value as typeof sort); setLimit(30); resultsRef.current?.scrollTo({ top: 0 }); }}>
                        <option value="largest">Largest first</option><option value="smallest">Smallest first</option><option value="name">A–Z</option>
                    </select>
                </div>
                <div className="pins-results" ref={resultsRef}>
                    <ol>
                        {ranked.slice(0, limit).map((pin, index) => <li key={pin.id}><button type="button" className={selected?.id === pin.id ? 'is-selected' : ''} aria-pressed={selected?.id === pin.id} onClick={() => selectPin(pin.id)}>
                            <span className="pins-rank">{String(index + 1).padStart(2, '0')}</span><span className="pins-result-name">{pin.name}<small>{pin.level === 'county' ? pin.stateAbbr : pin.kind === 'state' ? pin.stateAbbr : pin.kind === 'district' ? 'Federal district' : 'U.S. territory'}</small></span>
                            <span className="pins-result-radius">{formatRadius(pin.radiusMeters, unit)}<span aria-hidden="true"> ↗</span></span>
                        </button></li>)}
                    </ol>
                    {!ranked.length && !resources.pins.loading && !resources.pins.error && <p className="pins-empty">No pins match this selection. Try another name or jurisdiction.</p>}
                    {ranked.length > limit && <button type="button" className="pins-show-more" onClick={() => setLimit(value => value + 50)}>Show {Math.min(50, ranked.length - limit)} more · {ranked.length - limit} remaining</button>}
                </div>
                <footer className="pins-panel-footer"><details><summary>How the pins are calculated</summary><p>A pin maximizes the distance to its nearest administrative edge. Borders, coastal jurisdiction limits, and enclaves count. Inland lakes add no edges. Jurisdictional water is included, so a pin can be over water.</p><p>The U.S. pole uses the merged national extent. Internal state borders are removed; international borders and coastal jurisdiction limits remain.</p><p>Approximate WGS84 results from {metadata?.vintage ?? '2025'} Census TIGER/Line boundaries. The search uses a 25 m tolerance and 20 m boundary simplification. These describe the calculation, not the accuracy of the source survey.</p><p>Coverage includes the national pole, 50 states, DC, five inhabited territories, and their county equivalents. Minor outlying islands are absent from the Census files.</p><a href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html" target="_blank" rel="noreferrer">Census boundary data ↗</a></details></footer>
            </aside>

            <section className="pins-map-area" aria-label="Geographic map">
                <PinsMap pins={pins} states={resources.states.data} counties={resources.counties.data} stateFips={stateFips} showCounties={showCounties}
                    dataState={resources.pins.error || resources.states.error ? 'error' : resources.pins.loading || resources.states.loading ? 'loading' : 'ready'}
                    circles={circles} zoom={zoom} selected={selected} view={view} unit={unit} reducedMotion={reducedMotion} onSelect={selectPin} onZoom={setZoom} />
                <div className="pins-map-toolbar">
                    <div className="pins-region-control"><PinIcon small /><label className="sr-only" htmlFor="pins-region">Jump to region</label><select id="pins-region" value="" onChange={event => jumpTo(event.target.value)}>
                        <option value="" disabled>Jump to a region</option>{REGION_SHORTCUTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select></div>
                    <button type="button" className="pins-button pins-reset" onClick={() => jumpTo('overview')}>U.S. overview</button>
                </div>
                <div className="pins-layers" aria-label="Map layers">
                    <label className="pins-circle-toggle"><input type="checkbox" checked={circles} onChange={event => setCircles(event.target.checked)} /><span>All radius circles</span></label>
                    <div className="pins-layer-divider" />
                    <fieldset><legend>County layer</legend><div className="pins-segments">{(['off', 'auto', 'on'] as const).map(mode => <button type="button" key={mode} aria-pressed={countyMode === mode} onClick={() => setCountyMode(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div></fieldset>
                    <p aria-live="polite">{countyMode === 'auto' ? showCounties ? 'County pins visible' : `Zoom in to show counties · z${COUNTY_ZOOM}+` : countyMode === 'on' ? 'County pins always visible' : 'County pins hidden'}</p>
                    <p className="pins-radius-hint">Radius lines and distances appear as you zoom in.</p>
                </div>
                {(resources.states.error || resources.counties.error) && <div className="pins-boundary-error" role="alert">{resources.states.error ? 'State boundaries unavailable.' : 'County boundaries unavailable.'}<button type="button" onClick={resources.states.error ? resources.states.retry : resources.counties.retry}>Retry boundaries</button></div>}
                {showCounties && resources.counties.loading && <div className="pins-boundary-error" role="status">Loading county boundaries…</div>}
                <div className="pins-map-legend"><span><i className="pins-national-dot" />U.S. pole</span><span><i className="pins-state-dot" />States & territories</span><span><i className="pins-county-dot" />Counties</span><span className="pins-legend-circle"><i />Radius to nearest edge</span></div>
                <div className="pins-unit-control" role="group" aria-label="Distance units">{(['mi', 'km'] as const).map(value => <button type="button" key={value} aria-pressed={unit === value} onClick={() => setUnit(value)}>{value}</button>)}</div>
            </section>
        </div>
    </div>;
}
