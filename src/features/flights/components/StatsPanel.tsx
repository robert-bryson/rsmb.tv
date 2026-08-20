import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { FlightStats, SelectedRouteInfo, SelectedCountryInfo, SelectedRegionInfo, FlightTypeFilter } from '../types';
import { EARTH_CIRCUMFERENCE_KM } from '../constants';
import { formatElevation, getFlightTypeLabel } from '../utils';
import { StatItem, CollapsibleSection, ClickableAirport, ClickableRoute, ClickableCountry, ClickableRegion, FlightCount, VirtualizedList, DistanceValue } from './shared';
import { AirlinesSection } from './AirlinesSection';
import { CountriesSection } from './CountriesSection';
import { RegionsSection } from './RegionsSection';
import { RoutesSection } from './RoutesSection';
import { usePersistedState } from '../../../hooks/usePersistedState';

const DEFAULT_PANEL_WIDTH = 320;
const MIN_PANEL_WIDTH = 272;
const MAX_PANEL_WIDTH = 520;

function clampPanelWidth(width: number): number {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(width)));
}

interface StatsPanelProps {
  stats: FlightStats;
  isOpen: boolean;
  onToggle: () => void;
  selectedYear: number | null;
  onClearAirport: () => void;
  selectedAirline: string | null;
  onAirlineSelect: (airline: string | null) => void;
  selectedFlightType: FlightTypeFilter | null;
  onFlightTypeSelect: (flightType: FlightTypeFilter | null) => void;
  onAirportClick: (code: string) => void;
  onRouteClick: (origin: string, destination: string) => void;
  onCountryClick: (countryCode: string) => void;
  onRegionClick: (regionCode: string) => void;
  validAirportCodes: Set<string>;
  airportNames: Map<string, string>;
  selectedRouteInfo: SelectedRouteInfo | null;
  onClearRoute: () => void;
  selectedCountryInfo: SelectedCountryInfo | null;
  onClearCountry: () => void;
  selectedRegionInfo: SelectedRegionInfo | null;
  onClearRegion: () => void;
  isMetric: boolean;
}

export function StatsPanel({
  stats,
  isOpen,
  onToggle,
  selectedYear,
  onClearAirport,
  selectedAirline,
  onAirlineSelect,
  selectedFlightType,
  onFlightTypeSelect,
  onAirportClick,
  onRouteClick,
  onCountryClick,
  onRegionClick,
  validAirportCodes,
  airportNames,
  selectedRouteInfo,
  onClearRoute,
  selectedCountryInfo,
  onClearCountry,
  selectedRegionInfo,
  onClearRegion,
  isMetric,
}: StatsPanelProps) {
  const timesAroundEarth = (stats.totalDistance / EARTH_CIRCUMFERENCE_KM).toFixed(1);
  const domesticFlights = stats.totalFlights - stats.internationalFlights;
  const airportInfo = stats.selectedAirportInfo;

  // State to track which sections are open (for collapse all/expand all)
  const [allExpanded, setAllExpanded] = useState(true);
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>({});
  const [panelWidth, setPanelWidth] = usePersistedState<number>('flights-stats-panel-width', DEFAULT_PANEL_WIDTH);
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(panelWidth);

  useEffect(() => {
    if (panelWidth < MIN_PANEL_WIDTH || panelWidth > MAX_PANEL_WIDTH) {
      setPanelWidth(clampPanelWidth(panelWidth));
    }
  }, [panelWidth, setPanelWidth]);

  useEffect(() => {
    if (!isResizingPanel) return;

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - resizeStartXRef.current;
      setPanelWidth(clampPanelWidth(resizeStartWidthRef.current + deltaX));
    };

    const handlePointerStop = () => {
      setIsResizingPanel(false);
    };

    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerStop);
    window.addEventListener('pointercancel', handlePointerStop);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerStop);
      window.removeEventListener('pointercancel', handlePointerStop);
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
    };
  }, [isResizingPanel, setPanelWidth]);

  const startPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    if (event.button !== 0) return;

    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = panelWidth;
    setIsResizingPanel(true);
  };

  // Get the open state for a section
  const getSectionOpen = (sectionId: string, defaultOpen = true) => {
    if (sectionStates[sectionId] !== undefined) return sectionStates[sectionId];
    return allExpanded ? defaultOpen : false;
  };

  // Toggle a specific section.
  // Derive the current value from `prev` (not from the render-closure `sectionStates`)
  // so that the functional updater is self-contained and batched updates stay correct.
  const toggleSection = (sectionId: string, defaultOpen = true) => {
    setSectionStates((prev) => {
      const current = prev[sectionId] !== undefined ? prev[sectionId] : (allExpanded ? defaultOpen : false);
      return { ...prev, [sectionId]: !current };
    });
  };

  // Collapse all or expand all
  const toggleAll = () => {
    const newExpanded = !allExpanded;
    setAllExpanded(newExpanded);
    // Clear individual states so they follow the global state
    setSectionStates({});
  };

  return (
    <div
      className={`absolute top-16 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] left-4 z-20 max-w-[calc(100vw-2rem)] transition-transform duration-300 ease-out pointer-events-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      style={{ width: `${panelWidth}px` }}
    >
      {/* Panel content — always mounted so the slide-out transition carries visible content.
          `inert` makes the off-screen panel unreachable by keyboard/assistive tech. */}
      <div
        data-testid="stats-panel-content"
        data-state={isOpen ? 'open' : 'closed'}
        className={`flights-stats-panel relative h-full bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 p-4 text-sm pointer-events-auto shadow-xl ${isResizingPanel ? 'select-none' : ''}`}
        aria-hidden={!isOpen || undefined}
        inert={!isOpen || undefined}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize stats panel"
          onPointerDown={startPanelResize}
          className="absolute -right-1 top-0 hidden h-full w-3 cursor-col-resize md:block"
        >
          <div
            className={`mx-auto h-full w-px transition-colors ${isResizingPanel ? 'bg-violet-400/80' : 'bg-transparent hover:bg-zinc-600/80'}`}
          />
        </div>

        {/* Collapse All / Expand All Button */}
        <div className="flex justify-end mb-2">
          <button
            onClick={toggleAll}
            className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1 rounded hover:bg-gray-800 transition-colors flex items-center gap-1"
          >
            {allExpanded ? '▼ Collapse All' : '▶ Expand All'}
          </button>
        </div>

        {/* Airport-specific stats when an airport is selected */}
        {airportInfo ? (
          <AirportStats
            airportInfo={airportInfo}
            stats={stats}
            onClearAirport={onClearAirport}
            onAirportClick={onAirportClick}
            onCountryClick={onCountryClick}
            onRegionClick={onRegionClick}
            getSectionOpen={getSectionOpen}
            toggleSection={toggleSection}
            validAirportCodes={validAirportCodes}
            airportNames={airportNames}
            isMetric={isMetric}
          />
        ) : selectedRouteInfo ? (
          <RouteStatsView
            routeInfo={selectedRouteInfo}
            onClear={onClearRoute}
            onAirportClick={onAirportClick}
            onCountryClick={onCountryClick}
            validAirportCodes={validAirportCodes}
            airportNames={airportNames}
            isMetric={isMetric}
            getSectionOpen={getSectionOpen}
            toggleSection={toggleSection}
          />
        ) : selectedCountryInfo ? (
          <CountryStatsView
            countryInfo={selectedCountryInfo}
            onClear={onClearCountry}
            onAirportClick={onAirportClick}
            onCountryClick={onCountryClick}
            onRouteClick={onRouteClick}
            validAirportCodes={validAirportCodes}
            airportNames={airportNames}
            getSectionOpen={getSectionOpen}
            toggleSection={toggleSection}
          />
        ) : selectedRegionInfo ? (
          <RegionStatsView
            regionInfo={selectedRegionInfo}
            onClear={onClearRegion}
            onAirportClick={onAirportClick}
            onCountryClick={onCountryClick}
            onRouteClick={onRouteClick}
            validAirportCodes={validAirportCodes}
            airportNames={airportNames}
            getSectionOpen={getSectionOpen}
            toggleSection={toggleSection}
          />
        ) : (
          <OverallStats
            stats={stats}
            selectedYear={selectedYear}
            selectedAirline={selectedAirline}
            onAirlineSelect={onAirlineSelect}
            selectedFlightType={selectedFlightType}
            onFlightTypeSelect={onFlightTypeSelect}
            onAirportClick={onAirportClick}
            onRouteClick={onRouteClick}
            onCountryClick={onCountryClick}
            onRegionClick={onRegionClick}
            timesAroundEarth={timesAroundEarth}
            domesticFlights={domesticFlights}
            getSectionOpen={getSectionOpen}
            toggleSection={toggleSection}
            validAirportCodes={validAirportCodes}
            airportNames={airportNames}
            isMetric={isMetric}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="absolute left-full top-1/2 -translate-x-px -translate-y-1/2 h-24 w-10 bg-slate-900/95 backdrop-blur rounded-r-lg border border-l-0 border-slate-600/80 text-purple-200 hover:bg-slate-800/95 hover:text-white transition-colors pointer-events-auto flex flex-col items-center justify-center gap-2 shadow-xl ring-1 ring-white/10"
        title={isOpen ? 'Hide stats panel' : 'Show stats panel'}
        aria-label={isOpen ? 'Hide stats panel' : 'Show stats panel'}
        aria-expanded={isOpen}
      >
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

// Airport-specific stats
function AirportStats({
  airportInfo,
  stats,
  onClearAirport,
  onAirportClick,
  onCountryClick,
  onRegionClick,
  getSectionOpen,
  toggleSection,
  validAirportCodes,
  airportNames,
  isMetric,
}: {
  airportInfo: NonNullable<FlightStats['selectedAirportInfo']>;
  stats: FlightStats;
  onClearAirport: () => void;
  onAirportClick: (code: string) => void;
  onCountryClick: (code: string) => void;
  onRegionClick: (code: string) => void;
  getSectionOpen: (id: string, defaultOpen?: boolean) => boolean;
  toggleSection: (id: string) => void;
  validAirportCodes: Set<string>;
  airportNames: Map<string, string>;
  isMetric: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-cyan-400 font-semibold text-base">{airportInfo.code}</h3>
        <button
          onClick={onClearAirport}
          className="text-gray-500 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
        >
          ✕ Clear
        </button>
      </div>
      <div className="text-gray-300 text-sm mb-1">{airportInfo.name}</div>
      <div className="text-gray-500 text-xs mb-1">
        {airportInfo.municipality},{' '}
        <ClickableRegion code={airportInfo.region} name={airportInfo.regionName} onClick={onRegionClick} className="text-gray-500" />
      </div>
      <div className="text-gray-500 text-xs mb-1">
        <ClickableCountry code={airportInfo.country} name={airportInfo.countryName} onClick={onCountryClick} className="text-gray-500" />
        {' • '}{airportInfo.continentName}
      </div>
      <div className="text-gray-600 text-xs mb-3">
        📍 {formatElevation(airportInfo.elevationFt, airportInfo.elevationM, isMetric)}
      </div>

      {/* Visit Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-yellow-400 font-bold text-lg">{airportInfo.totalVisits}</div>
          <div className="text-gray-500 text-xs">visits</div>
        </div>
        <div className="text-center">
          <div className="text-green-400 font-bold text-lg">{airportInfo.arrivals}</div>
          <div className="text-gray-500 text-xs">arrivals</div>
        </div>
        <div className="text-center">
          <div className="text-blue-400 font-bold text-lg">{airportInfo.departures}</div>
          <div className="text-gray-500 text-xs">departures</div>
        </div>
      </div>

      {/* Timeline */}
      <CollapsibleSection
        title="Timeline"
        icon="📅"
        isOpen={getSectionOpen('airport-timeline')}
        onToggle={() => toggleSection('airport-timeline')}
      >
        {airportInfo.firstVisit && (
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">First visit:</span>
            <span className="text-gray-300">
              {airportInfo.firstVisit.date}{' '}
              <span className="text-gray-500">
                {airportInfo.firstVisit.direction === 'arrival' ? 'from ' : 'to '}
              </span>
              <ClickableAirport
                code={airportInfo.firstVisit.from}
                onClick={onAirportClick}
                className="text-gray-400"
                validAirports={validAirportCodes}
                airportNames={airportNames}
              />
            </span>
          </div>
        )}
        {airportInfo.lastVisit && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Last visit:</span>
            <span className="text-gray-300">
              {airportInfo.lastVisit.date}{' '}
              <span className="text-gray-500">
                {airportInfo.lastVisit.direction === 'arrival' ? 'from ' : 'to '}
              </span>
              <ClickableAirport
                code={airportInfo.lastVisit.to}
                onClick={onAirportClick}
                className="text-gray-400"
                validAirports={validAirportCodes}
                airportNames={airportNames}
              />
            </span>
          </div>
        )}
      </CollapsibleSection>

      {/* Connections */}
      <CollapsibleSection
        title="Connections"
        icon="🔗"
        isOpen={getSectionOpen('airport-connections')}
        onToggle={() => toggleSection('airport-connections')}
      >
        <div className="grid grid-cols-2 gap-3 mb-3">
          <StatItem icon="🛫" label="Connected Airports" value={airportInfo.connectedAirports.toString()} />
          <StatItem icon="🌍" label="Countries" value={airportInfo.connectedCountries.length.toString()} />
        </div>
        {airportInfo.connectedCountries.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {airportInfo.connectedCountries.slice(0, 8).map((country) => (
              <button
                key={country}
                onClick={() => onCountryClick(country)}
                className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-400 hover:text-emerald-400 hover:bg-gray-700 transition-colors cursor-pointer"
              >
                {country}
              </button>
            ))}
            {airportInfo.connectedCountries.length > 8 && (
              <span className="text-gray-600 text-xs">+{airportInfo.connectedCountries.length - 8} more</span>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* Top Destinations */}
      {airportInfo.topDestinations.length > 0 && (
        <CollapsibleSection
          title="Top Destinations"
          icon="🛬"
          isOpen={getSectionOpen('airport-destinations')}
          onToggle={() => toggleSection('airport-destinations')}
        >
          <div className="space-y-1">
            {airportInfo.topDestinations.map((d) => (
              <div key={d.code} className="flex justify-between text-xs">
                <ClickableAirport
                  code={d.code}
                  onClick={onAirportClick}
                  className="text-gray-300"
                  validAirports={validAirportCodes}
                  airportNames={airportNames}
                />
                <span className="text-blue-400">×{d.count}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Top Origins */}
      {airportInfo.topOrigins.length > 0 && (
        <CollapsibleSection
          title="Top Origins"
          icon="🛫"
          isOpen={getSectionOpen('airport-origins')}
          onToggle={() => toggleSection('airport-origins')}
        >
          <div className="space-y-1">
            {airportInfo.topOrigins.map((o) => (
              <div key={o.code} className="flex justify-between text-xs">
                <ClickableAirport
                  code={o.code}
                  onClick={onAirportClick}
                  className="text-gray-300"
                  validAirports={validAirportCodes}
                  airportNames={airportNames}
                />
                <span className="text-green-400">×{o.count}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Airlines */}
      {airportInfo.airlines.length > 0 && (
        <CollapsibleSection
          title={`Airlines (${airportInfo.airlines.length})`}
          icon="✈️"
          isOpen={getSectionOpen('airport-airlines')}
          onToggle={() => toggleSection('airport-airlines')}
        >
          <div className="flex flex-wrap gap-1">
            {airportInfo.airlines.slice(0, 6).map((airline) => (
              <span key={airline} className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-400">
                {airline}
              </span>
            ))}
            {airportInfo.airlines.length > 6 && (
              <span className="text-gray-600 text-xs">+{airportInfo.airlines.length - 6} more</span>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Distance Stats */}
      <CollapsibleSection
        title="Distance"
        icon="📏"
        isOpen={getSectionOpen('airport-distance')}
        onToggle={() => toggleSection('airport-distance')}
      >
        <div className="grid grid-cols-2 gap-3">
          <StatItem icon="📏" label="Total" value={<DistanceValue km={stats.totalDistance} isMetric={isMetric} />} />
          <StatItem icon="📐" label="Average" value={<DistanceValue km={stats.averageDistance} isMetric={isMetric} />} />
        </div>
      </CollapsibleSection>
    </>
  );
}

// Route-specific stats when a route is selected
function RouteStatsView({
  routeInfo,
  onClear,
  onAirportClick,
  onCountryClick,
  validAirportCodes,
  airportNames,
  isMetric,
  getSectionOpen,
  toggleSection,
}: {
  routeInfo: SelectedRouteInfo;
  onClear: () => void;
  onAirportClick: (code: string) => void;
  onCountryClick: (code: string) => void;
  validAirportCodes: Set<string>;
  airportNames: Map<string, string>;
  isMetric: boolean;
  getSectionOpen: (id: string, defaultOpen?: boolean) => boolean;
  toggleSection: (id: string, defaultOpen?: boolean) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-yellow-400 font-semibold text-base">
          {routeInfo.originCode} ↔ {routeInfo.destinationCode}
        </h3>
        <button
          onClick={onClear}
          className="text-gray-500 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
        >
          ✕ Clear
        </button>
      </div>

      {/* Origin */}
      <div className="mb-2">
        <div className="text-gray-300 text-sm">
          <ClickableAirport
            code={routeInfo.originCode}
            onClick={onAirportClick}
            className="text-cyan-400 font-medium"
            validAirports={validAirportCodes}
            airportNames={airportNames}
          />{' '}
          {routeInfo.originName}
        </div>
        <div className="text-gray-500 text-xs">
          {routeInfo.originMunicipality},{' '}
          <ClickableCountry code={routeInfo.originCountry} name={routeInfo.originCountryName} onClick={onCountryClick} className="text-gray-500" />
        </div>
      </div>

      <div className="text-gray-600 text-xs text-center mb-2">↕</div>

      {/* Destination */}
      <div className="mb-3">
        <div className="text-gray-300 text-sm">
          <ClickableAirport
            code={routeInfo.destinationCode}
            onClick={onAirportClick}
            className="text-cyan-400 font-medium"
            validAirports={validAirportCodes}
            airportNames={airportNames}
          />{' '}
          {routeInfo.destinationName}
        </div>
        <div className="text-gray-500 text-xs">
          {routeInfo.destinationMunicipality},{' '}
          <ClickableCountry code={routeInfo.destinationCountry} name={routeInfo.destinationCountryName} onClick={onCountryClick} className="text-gray-500" />
        </div>
      </div>

      {/* Flight Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center">
          <div className="text-yellow-400 font-bold text-lg">{routeInfo.totalFlights}</div>
          <div className="text-gray-500 text-xs">flights</div>
        </div>
        <div className="text-center">
          <DistanceValue
            km={routeInfo.distanceKm}
            isMetric={isMetric}
            className="text-purple-400 font-bold text-base leading-tight"
          />
          <div className="text-gray-500 text-xs">distance</div>
        </div>
      </div>

      {/* Route type badges */}
      <div className="flex flex-wrap gap-1 mb-4">
        {routeInfo.isIntercontinental && (
          <span className="bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded text-xs">Intercontinental</span>
        )}
        {routeInfo.isInternational && !routeInfo.isIntercontinental && (
          <span className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded text-xs">International</span>
        )}
        {!routeInfo.isInternational && (
          <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded text-xs">Domestic</span>
        )}
      </div>

      {/* Timeline */}
      <CollapsibleSection
        title="Timeline"
        icon="📅"
        isOpen={getSectionOpen('route-timeline')}
        onToggle={() => toggleSection('route-timeline')}
      >
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">First flight:</span>
            <span className="text-gray-300">{routeInfo.dates[routeInfo.dates.length - 1]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Last flight:</span>
            <span className="text-gray-300">{routeInfo.dates[0]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Years active:</span>
            <span className="text-gray-300">
              {routeInfo.years.length > 3
                ? `${routeInfo.years[0]}–${routeInfo.years[routeInfo.years.length - 1]} (${routeInfo.years.length})`
                : routeInfo.years.join(', ')}
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Airlines */}
      {routeInfo.airlines.length > 0 && (
        <CollapsibleSection
          title={`Airlines (${routeInfo.airlines.length})`}
          icon="✈️"
          isOpen={getSectionOpen('route-airlines')}
          onToggle={() => toggleSection('route-airlines')}
        >
          <div className="flex flex-wrap gap-1">
            {routeInfo.airlines.map((airline) => (
              <span key={airline} className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-400">
                {airline}
              </span>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* All Flights */}
      <CollapsibleSection
        title={`All Flights (${routeInfo.totalFlights})`}
        icon="📋"
        isOpen={getSectionOpen('route-all-flights', false)}
        onToggle={() => toggleSection('route-all-flights', false)}
      >
        <VirtualizedList
          items={routeInfo.dates}
          initialCount={8}
          incrementCount={8}
          keyExtractor={(date, index) => `${date}-${index}`}
          renderItem={(date, index) => (
            <div className="flex items-center gap-2 rounded-md border border-gray-700/70 bg-gray-800/60 px-2.5 py-1.5 text-xs">
              <span className="w-6 shrink-0 text-right font-mono text-[10px] text-gray-600">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400/80" aria-hidden="true" />
              <span className="font-medium tabular-nums text-gray-300">{date}</span>
              {index === 0 && (
                <span className="ml-auto rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-purple-300">
                  Latest
                </span>
              )}
              {index === routeInfo.dates.length - 1 && routeInfo.dates.length > 1 && (
                <span className="ml-auto rounded bg-gray-700/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400">
                  First
                </span>
              )}
            </div>
          )}
        />
      </CollapsibleSection>
    </>
  );
}

// Country-specific stats when a country is selected
function CountryStatsView({
  countryInfo,
  onClear,
  onAirportClick,
  onCountryClick,
  onRouteClick,
  validAirportCodes,
  airportNames,
  getSectionOpen,
  toggleSection,
}: {
  countryInfo: SelectedCountryInfo;
  onClear: () => void;
  onAirportClick: (code: string) => void;
  onCountryClick: (code: string) => void;
  onRouteClick: (origin: string, destination: string) => void;
  validAirportCodes: Set<string>;
  airportNames: Map<string, string>;
  getSectionOpen: (id: string, defaultOpen?: boolean) => boolean;
  toggleSection: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-emerald-400 font-semibold text-base">{countryInfo.name}</h3>
        <button
          onClick={onClear}
          className="text-gray-500 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
        >
          ✕ Clear
        </button>
      </div>
      <div className="text-gray-500 text-xs mb-3">
        {countryInfo.code} • {countryInfo.continentName}
      </div>

      {/* Flight Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-yellow-400 font-bold text-lg">{countryInfo.totalFlights}</div>
          <div className="text-gray-500 text-xs">flights</div>
        </div>
        <div className="text-center">
          <div className="text-green-400 font-bold text-lg">{countryInfo.arrivals}</div>
          <div className="text-gray-500 text-xs">arrivals</div>
        </div>
        <div className="text-center">
          <div className="text-blue-400 font-bold text-lg">{countryInfo.departures}</div>
          <div className="text-gray-500 text-xs">departures</div>
        </div>
      </div>

      {/* Airports */}
      {countryInfo.airports.length > 0 && (
        <CollapsibleSection
          title={`Airports (${countryInfo.airports.length})`}
          icon="🛫"
          isOpen={getSectionOpen('country-airports')}
          onToggle={() => toggleSection('country-airports')}
        >
          <div className="space-y-1">
            {countryInfo.airports.map((a) => (
              <div key={a.code} className="flex justify-between text-xs">
                <span>
                  <ClickableAirport
                    code={a.code}
                    onClick={onAirportClick}
                    className="text-gray-300"
                    validAirports={validAirportCodes}
                    airportNames={airportNames}
                  />{' '}
                  <span className="text-gray-500">{a.name}</span>
                </span>
                <span className="text-yellow-400">×{a.visitCount}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Timeline */}
      <CollapsibleSection
        title="Timeline"
        icon="📅"
        isOpen={getSectionOpen('country-timeline')}
        onToggle={() => toggleSection('country-timeline')}
      >
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Years active:</span>
            <span className="text-gray-300">
              {countryInfo.years.length > 3
                ? `${countryInfo.years[0]}–${countryInfo.years[countryInfo.years.length - 1]} (${countryInfo.years.length})`
                : countryInfo.years.join(', ')}
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Top Routes */}
      {countryInfo.topRoutes.length > 0 && (
        <CollapsibleSection
          title={`Top Routes (${countryInfo.topRoutes.length})`}
          icon="🛤️"
          isOpen={getSectionOpen('country-routes')}
          onToggle={() => toggleSection('country-routes')}
        >
          <div className="space-y-1">
            {countryInfo.topRoutes.map((r) => (
              <div key={`${r.origin}-${r.destination}`} className="flex justify-between text-xs">
                <ClickableRoute
                  origin={r.origin}
                  destination={r.destination}
                  onAirportClick={onAirportClick}
                  onRouteClick={onRouteClick}
                  validAirports={validAirportCodes}
                  airportNames={airportNames}
                />
                <span className="text-yellow-400">×{r.count}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Airlines */}
      {countryInfo.airlines.length > 0 && (
        <CollapsibleSection
          title={`Airlines (${countryInfo.airlines.length})`}
          icon="✈️"
          isOpen={getSectionOpen('country-airlines')}
          onToggle={() => toggleSection('country-airlines')}
        >
          <div className="flex flex-wrap gap-1">
            {countryInfo.airlines.slice(0, 8).map((airline) => (
              <span key={airline} className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-400">
                {airline}
              </span>
            ))}
            {countryInfo.airlines.length > 8 && (
              <span className="text-gray-600 text-xs">+{countryInfo.airlines.length - 8} more</span>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Connected Countries */}
      {countryInfo.connectedCountries.length > 0 && (
        <CollapsibleSection
          title={`Connected Countries (${countryInfo.connectedCountries.length})`}
          icon="🌍"
          isOpen={getSectionOpen('country-connected')}
          onToggle={() => toggleSection('country-connected')}
        >
          <div className="space-y-1">
            {countryInfo.connectedCountries.map((c) => (
              <div key={c.code} className="flex justify-between text-xs">
                <ClickableCountry code={c.code} name={c.name} onClick={onCountryClick} className="text-gray-300" />
                <span className="text-yellow-400">×{c.count}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </>
  );
}

// Region-specific stats when a region is selected
function RegionStatsView({
  regionInfo,
  onClear,
  onAirportClick,
  onCountryClick,
  onRouteClick,
  validAirportCodes,
  airportNames,
  getSectionOpen,
  toggleSection,
}: {
  regionInfo: SelectedRegionInfo;
  onClear: () => void;
  onAirportClick: (code: string) => void;
  onCountryClick: (code: string) => void;
  onRouteClick: (origin: string, destination: string) => void;
  validAirportCodes: Set<string>;
  airportNames: Map<string, string>;
  getSectionOpen: (id: string, defaultOpen?: boolean) => boolean;
  toggleSection: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-amber-400 font-semibold text-base">{regionInfo.name}</h3>
        <button
          onClick={onClear}
          className="text-gray-500 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
        >
          ✕ Clear
        </button>
      </div>
      <div className="text-gray-500 text-xs mb-3">
        {regionInfo.code} •{' '}
        <ClickableCountry code={regionInfo.country} name={regionInfo.countryName} onClick={onCountryClick} className="text-gray-500" />
      </div>

      {/* Flight Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-yellow-400 font-bold text-lg">{regionInfo.totalFlights}</div>
          <div className="text-gray-500 text-xs">flights</div>
        </div>
        <div className="text-center">
          <div className="text-green-400 font-bold text-lg">{regionInfo.arrivals}</div>
          <div className="text-gray-500 text-xs">arrivals</div>
        </div>
        <div className="text-center">
          <div className="text-blue-400 font-bold text-lg">{regionInfo.departures}</div>
          <div className="text-gray-500 text-xs">departures</div>
        </div>
      </div>

      {/* Airports */}
      {regionInfo.airports.length > 0 && (
        <CollapsibleSection
          title={`Airports (${regionInfo.airports.length})`}
          icon="🛫"
          isOpen={getSectionOpen('region-airports')}
          onToggle={() => toggleSection('region-airports')}
        >
          <div className="space-y-1">
            {regionInfo.airports.map((a) => (
              <div key={a.code} className="flex justify-between text-xs">
                <span>
                  <ClickableAirport
                    code={a.code}
                    onClick={onAirportClick}
                    className="text-gray-300"
                    validAirports={validAirportCodes}
                    airportNames={airportNames}
                  />{' '}
                  <span className="text-gray-500">{a.name}</span>
                </span>
                <span className="text-yellow-400">×{a.visitCount}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Timeline */}
      <CollapsibleSection
        title="Timeline"
        icon="📅"
        isOpen={getSectionOpen('region-timeline')}
        onToggle={() => toggleSection('region-timeline')}
      >
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Years active:</span>
            <span className="text-gray-300">
              {regionInfo.years.length > 3
                ? `${regionInfo.years[0]}–${regionInfo.years[regionInfo.years.length - 1]} (${regionInfo.years.length})`
                : regionInfo.years.join(', ')}
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Top Routes */}
      {regionInfo.topRoutes.length > 0 && (
        <CollapsibleSection
          title={`Top Routes (${regionInfo.topRoutes.length})`}
          icon="🛤️"
          isOpen={getSectionOpen('region-routes')}
          onToggle={() => toggleSection('region-routes')}
        >
          <div className="space-y-1">
            {regionInfo.topRoutes.map((r) => (
              <div key={`${r.origin}-${r.destination}`} className="flex justify-between text-xs">
                <ClickableRoute
                  origin={r.origin}
                  destination={r.destination}
                  onAirportClick={onAirportClick}
                  onRouteClick={onRouteClick}
                  validAirports={validAirportCodes}
                  airportNames={airportNames}
                />
                <span className="text-yellow-400">×{r.count}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Airlines */}
      {regionInfo.airlines.length > 0 && (
        <CollapsibleSection
          title={`Airlines (${regionInfo.airlines.length})`}
          icon="✈️"
          isOpen={getSectionOpen('region-airlines')}
          onToggle={() => toggleSection('region-airlines')}
        >
          <div className="flex flex-wrap gap-1">
            {regionInfo.airlines.slice(0, 8).map((airline) => (
              <span key={airline} className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-400">
                {airline}
              </span>
            ))}
            {regionInfo.airlines.length > 8 && (
              <span className="text-gray-600 text-xs">+{regionInfo.airlines.length - 8} more</span>
            )}
          </div>
        </CollapsibleSection>
      )}
    </>
  );
}

// Overall stats when no airport selected
function OverallStats({
  stats,
  selectedYear,
  selectedAirline,
  onAirlineSelect,
  selectedFlightType,
  onFlightTypeSelect,
  onAirportClick,
  onRouteClick,
  onCountryClick,
  onRegionClick,
  timesAroundEarth,
  domesticFlights,
  getSectionOpen,
  toggleSection,
  validAirportCodes,
  airportNames,
  isMetric,
}: {
  stats: FlightStats;
  selectedYear: number | null;
  selectedAirline: string | null;
  onAirlineSelect: (airline: string | null) => void;
  selectedFlightType: FlightTypeFilter | null;
  onFlightTypeSelect: (flightType: FlightTypeFilter | null) => void;
  onAirportClick: (code: string) => void;
  onRouteClick: (origin: string, destination: string) => void;
  onCountryClick: (countryCode: string) => void;
  onRegionClick: (regionCode: string) => void;
  timesAroundEarth: string;
  domesticFlights: number;
  getSectionOpen: (id: string, defaultOpen?: boolean) => boolean;
  toggleSection: (id: string) => void;
  validAirportCodes: Set<string>;
  airportNames: Map<string, string>;
  isMetric: boolean;
}) {
  return (
    <>
      <h3 className="text-white font-semibold mb-1 text-base">Flight Statistics</h3>
      {selectedYear && <div className="text-purple-400 text-xs mb-3">Filtered: {selectedYear}</div>}
      {selectedAirline && (
        <div className="text-orange-400 text-xs mb-3 flex items-center gap-2">
          <span>Airline: {selectedAirline}</span>
          <button
            type="button"
            onClick={() => onAirlineSelect(null)}
            className="text-gray-500 hover:text-white transition-colors"
            aria-label="Clear airline filter"
          >
            ✕
          </button>
        </div>
      )}
      {selectedFlightType && (
        <div className="text-cyan-300 text-xs mb-3 flex items-center gap-2">
          <span>Flight type: {getFlightTypeLabel(selectedFlightType)}</span>
          <button
            type="button"
            onClick={() => onFlightTypeSelect(null)}
            className="text-gray-500 hover:text-white transition-colors"
            aria-label="Clear flight type filter"
          >
            ✕
          </button>
        </div>
      )}
      {!selectedYear && !selectedAirline && !selectedFlightType && stats.firstFlight && stats.lastFlight && (
        <div className="text-gray-500 text-xs mb-3">
          {stats.firstFlight.date} — {stats.lastFlight.date}
        </div>
      )}

      {/* Overview Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatItem icon="✈️" label="Total Flights" value={stats.totalFlights.toLocaleString()} />
        <StatItem icon="🛬" label="Airports" value={stats.totalAirports.toString()} />
        <StatItem icon="🌍" label="Countries" value={stats.totalCountries.toString()} />
        <StatItem icon="🏢" label="Airlines" value={stats.totalAirlines.toString()} />
        <StatItem icon="🔀" label="Unique Routes" value={stats.uniqueRoutes.toString()} />
        <StatItem icon="⏱️" label="Est. Flight Time" value={`${stats.totalFlightTime.toLocaleString()}h`} />
      </div>

      {/* Distance Stats */}
      <CollapsibleSection
        title="Distance"
        icon="📏"
        isOpen={getSectionOpen('overall-distance')}
        onToggle={() => toggleSection('overall-distance')}
      >
        <StatItem
          icon="📏"
          label="Total Distance"
          value={<DistanceValue km={stats.totalDistance} isMetric={isMetric} />}
          className="mb-2"
        />
        <div className="grid grid-cols-2 gap-3">
          <StatItem icon="🔄" label="Around Earth" value={`${timesAroundEarth}×`} />
          <StatItem icon="📐" label="Avg Distance" value={<DistanceValue km={stats.averageDistance} isMetric={isMetric} />} />
        </div>
      </CollapsibleSection>

      {/* Flight Types */}
      <CollapsibleSection
        title="Flight Types"
        icon="🌐"
        isOpen={getSectionOpen('overall-flight-types')}
        onToggle={() => toggleSection('overall-flight-types')}
      >
        <div className="grid grid-cols-2 gap-3">
          <StatItem
            icon="🏠"
            label="Domestic"
            value={domesticFlights.toString()}
            onClick={() => onFlightTypeSelect(selectedFlightType === 'domestic' ? null : 'domestic')}
            isSelected={selectedFlightType === 'domestic'}
            ariaLabel={selectedFlightType === 'domestic' ? 'Clear domestic flight type filter' : 'Show domestic flights'}
            title="Highlight domestic flights"
          />
          <StatItem
            icon="🌐"
            label="International"
            value={stats.internationalFlights.toString()}
            onClick={() => onFlightTypeSelect(selectedFlightType === 'international' ? null : 'international')}
            isSelected={selectedFlightType === 'international'}
            ariaLabel={selectedFlightType === 'international' ? 'Clear international flight type filter' : 'Show international flights'}
            title="Highlight international flights"
          />
          <StatItem
            icon="🌏"
            label="Intercontinental"
            value={stats.intercontinentalFlights.toString()}
            onClick={() => onFlightTypeSelect(selectedFlightType === 'intercontinental' ? null : 'intercontinental')}
            isSelected={selectedFlightType === 'intercontinental'}
            ariaLabel={selectedFlightType === 'intercontinental' ? 'Clear intercontinental flight type filter' : 'Show intercontinental flights'}
            title="Highlight intercontinental flights"
          />
          {stats.mostVisitedCountry && (
            <StatItem
              icon="🏆"
              label="Top Country"
              value={stats.mostVisitedCountry.country}
              subValue={
                <>
                  <span className="text-yellow-400">{stats.mostVisitedCountry.count}</span>✈{' '}
                  <span className="text-green-400">{stats.mostVisitedCountry.arrivals}</span>↓{' '}
                  <span className="text-blue-400">{stats.mostVisitedCountry.departures}</span>↑
                </>
              }
            />
          )}
        </div>
      </CollapsibleSection>

      {/* Airlines */}
      {stats.airlineCounts.length > 0 && (
        <AirlinesSection
          airlineCounts={stats.airlineCounts}
          selectedAirline={selectedAirline}
          onAirlineSelect={onAirlineSelect}
          isOpen={getSectionOpen('overall-airlines')}
          onToggle={() => toggleSection('overall-airlines')}
        />
      )}

      {/* Countries */}
      {stats.topCountries.length > 0 && (
        <CountriesSection
          topCountries={stats.topCountries}
          onCountryClick={onCountryClick}
          isOpen={getSectionOpen('overall-countries')}
          onToggle={() => toggleSection('overall-countries')}
        />
      )}

      {/* Regions */}
      {stats.topRegions.length > 0 && (
        <RegionsSection
          topRegions={stats.topRegions}
          onRegionClick={onRegionClick}
          isOpen={getSectionOpen('overall-regions')}
          onToggle={() => toggleSection('overall-regions')}
        />
      )}

      {/* Continents */}
      {Object.keys(stats.continentCounts).length > 0 && (
        <CollapsibleSection
          title="Continents Visited"
          icon="🗺️"
          isOpen={getSectionOpen('overall-continents')}
          onToggle={() => toggleSection('overall-continents')}
        >
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.continentCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([continent, count]) => (
                <span key={continent} className="bg-gray-800 px-2 py-1 rounded text-xs">
                  <span className="text-gray-300">{continent}</span>
                  <span className="text-purple-400 ml-1">×{count}</span>
                </span>
              ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Notable Flights */}
      <CollapsibleSection
        title="Notable Flights"
        icon="🏆"
        isOpen={getSectionOpen('overall-notable')}
        onToggle={() => toggleSection('overall-notable')}
      >
        {stats.busiestAirport && (
          <div className="flex items-start gap-2 mb-2">
            <span className="text-lg">🏠</span>
            <div>
              <div className="text-gray-400 text-xs">Busiest Airport</div>
              <div className="text-white font-medium">
                <ClickableAirport
                  code={stats.busiestAirport.code}
                  onClick={onAirportClick}
                  className="text-gray-300"
                  validAirports={validAirportCodes}
                  airportNames={airportNames}
                />
              </div>
              <div className="text-gray-500 text-xs">
                <FlightCount
                  count={stats.busiestAirport.count}
                  showArrivals
                  showDepartures
                  arrivals={stats.busiestAirport.arrivals}
                  departures={stats.busiestAirport.departures}
                />
              </div>
            </div>
          </div>
        )}
        {stats.longestFlight && (
          <div className="flex items-start gap-2 mb-2">
            <span className="text-lg">🛫</span>
            <div>
              <div className="text-gray-400 text-xs">Longest Flight</div>
              <div className="text-white font-medium">
                <ClickableRoute
                  origin={stats.longestFlight.route.split(' → ')[0]}
                  destination={stats.longestFlight.route.split(' → ')[1]}
                  onAirportClick={onAirportClick}
                  onRouteClick={onRouteClick}
                  validAirports={validAirportCodes}
                  airportNames={airportNames}
                />
              </div>
              <div className="text-gray-500 text-xs">
                <DistanceValue km={stats.longestFlight.distance} isMetric={isMetric} />
              </div>
            </div>
          </div>
        )}
        {stats.shortestFlight && (
          <div className="flex items-start gap-2">
            <span className="text-lg">🛬</span>
            <div>
              <div className="text-gray-400 text-xs">Shortest Flight</div>
              <div className="text-white font-medium">
                <ClickableRoute
                  origin={stats.shortestFlight.route.split(' → ')[0]}
                  destination={stats.shortestFlight.route.split(' → ')[1]}
                  onAirportClick={onAirportClick}
                  onRouteClick={onRouteClick}
                  validAirports={validAirportCodes}
                  airportNames={airportNames}
                />
              </div>
              <div className="text-gray-500 text-xs">
                <DistanceValue km={stats.shortestFlight.distance} isMetric={isMetric} />
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Elevation Extremes */}
      {(stats.highestAirport || stats.lowestAirport) && (
        <CollapsibleSection
          title="Elevation Extremes"
          icon="⛰️"
          isOpen={getSectionOpen('overall-elevation')}
          onToggle={() => toggleSection('overall-elevation')}
        >
          {stats.highestAirport && (
            <div className="flex items-start gap-2 mb-2">
              <span className="text-lg">🔺</span>
              <div>
                <div className="text-gray-400 text-xs">Highest Airport</div>
                <div className="text-white font-medium">
                  <ClickableAirport
                    code={stats.highestAirport.code}
                    onClick={onAirportClick}
                    className="text-gray-300"
                    validAirports={validAirportCodes}
                    airportNames={airportNames}
                  />
                </div>
                <div className="text-gray-500 text-xs truncate max-w-[200px]" title={stats.highestAirport.name}>
                  {stats.highestAirport.name}
                </div>
                <div className="text-gray-500 text-xs">
                  {formatElevation(stats.highestAirport.elevationFt, stats.highestAirport.elevationM, isMetric)}
                </div>
              </div>
            </div>
          )}
          {stats.lowestAirport && (
            <div className="flex items-start gap-2">
              <span className="text-lg">🔻</span>
              <div>
                <div className="text-gray-400 text-xs">Lowest Airport</div>
                <div className="text-white font-medium">
                  <ClickableAirport
                    code={stats.lowestAirport.code}
                    onClick={onAirportClick}
                    className="text-gray-300"
                    validAirports={validAirportCodes}
                    airportNames={airportNames}
                  />
                </div>
                <div className="text-gray-500 text-xs truncate max-w-[200px]" title={stats.lowestAirport.name}>
                  {stats.lowestAirport.name}
                </div>
                <div className="text-gray-500 text-xs">
                  {formatElevation(stats.lowestAirport.elevationFt, stats.lowestAirport.elevationM, isMetric)}
                </div>
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Top Routes */}
      {stats.busiestRoutes.length > 0 && (
        <RoutesSection
          busiestRoutes={stats.busiestRoutes}
          onAirportClick={onAirportClick}
          onRouteClick={onRouteClick}
          isOpen={getSectionOpen('overall-routes')}
          onToggle={() => toggleSection('overall-routes')}
          validAirportCodes={validAirportCodes}
          airportNames={airportNames}
        />
      )}
    </>
  );
}
