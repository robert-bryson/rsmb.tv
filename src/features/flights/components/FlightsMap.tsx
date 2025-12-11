import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { useGlobeData } from '../hooks/useFlightData';
import type { GlobeArc, GlobePoint, GlobeStaticArc, ColorMode, FlightStats } from '../types';

// Earth textures
const GLOBE_IMAGE = '//unpkg.com/three-globe/example/img/earth-night.jpg';
const BUMP_IMAGE = '//unpkg.com/three-globe/example/img/earth-topology.png';

// Collapsible Section Component
function CollapsibleSection({ 
  title, 
  icon,
  children, 
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onToggle,
}: { 
  title: string; 
  icon?: string;
  children: React.ReactNode; 
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen));
  
  return (
    <div className="mt-4 pt-3 border-t border-gray-700">
      <button
        onClick={handleToggle}
        className="flex items-center justify-between w-full text-left group"
      >
        <h4 className="text-gray-400 text-xs uppercase tracking-wide flex items-center gap-1.5">
          {icon && <span>{icon}</span>}
          {title}
        </h4>
        <span className="text-gray-500 group-hover:text-gray-300 transition-colors text-xs">
          {isOpen ? '▼' : '▶'}
        </span>
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  );
}

// Airlines Section with Show More/Less
function AirlinesSection({
  airlineCounts,
  selectedAirline,
  onAirlineSelect,
  isOpen,
  onToggle,
}: {
  airlineCounts: { airline: string; count: number }[];
  selectedAirline: string | null;
  onAirlineSelect: (airline: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  
  // Calculate how many airlines fit in ~2 rows (approximately 6-8 items)
  const INITIAL_VISIBLE = 6;
  const hasMore = airlineCounts.length > INITIAL_VISIBLE;
  const visibleAirlines = showAll ? airlineCounts : airlineCounts.slice(0, INITIAL_VISIBLE);
  
  return (
    <CollapsibleSection 
      title={`Airlines (${airlineCounts.length})`} 
      icon="✈️"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => onAirlineSelect(null)}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            selectedAirline === null
              ? 'bg-orange-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          All
        </button>
        {visibleAirlines.map(({ airline, count }) => (
          <button
            key={airline}
            onClick={() => onAirlineSelect(selectedAirline === airline ? null : airline)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              selectedAirline === airline
                ? 'bg-orange-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {airline || '(Unknown)'} <span className="text-orange-400">×{count}</span>
          </button>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          {showAll ? '← Show less' : `Show ${airlineCounts.length - INITIAL_VISIBLE} more →`}
        </button>
      )}
    </CollapsibleSection>
  );
}

// Countries Section with Show More/Less
function CountriesSection({
  topCountries,
  onCountryClick,
  isOpen,
  onToggle,
}: {
  topCountries: { code: string; name: string; count: number; departures: number; arrivals: number }[];
  onCountryClick: (countryCode: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  
  const INITIAL_VISIBLE = 5;
  const hasMore = topCountries.length > INITIAL_VISIBLE;
  const visibleCountries = showAll ? topCountries : topCountries.slice(0, INITIAL_VISIBLE);
  
  return (
    <CollapsibleSection 
      title={`Countries (${topCountries.length})`} 
      icon="🌍"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-1">
        {visibleCountries.map(({ code, name, count, arrivals, departures }) => (
          <div key={code} className="flex justify-between items-center text-xs">
            <button
              onClick={() => onCountryClick(code)}
              className="text-gray-300 hover:text-cyan-400 transition-colors text-left truncate max-w-[180px]"
              title={name}
            >
              {name}
            </button>
            <span className="text-gray-500 ml-2 whitespace-nowrap">
              <span className="text-yellow-400">{count}</span>
              <span className="text-gray-600 mx-1">•</span>
              <span className="text-green-400">{arrivals}</span>↓
              <span className="text-blue-400">{departures}</span>↑
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          {showAll ? '← Show less' : `Show ${topCountries.length - INITIAL_VISIBLE} more →`}
        </button>
      )}
    </CollapsibleSection>
  );
}

// Regions Section with Show More/Less
function RegionsSection({
  topRegions,
  onRegionClick,
  isOpen,
  onToggle,
}: {
  topRegions: { code: string; name: string; country: string; count: number }[];
  onRegionClick: (regionCode: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  
  const INITIAL_VISIBLE = 5;
  const hasMore = topRegions.length > INITIAL_VISIBLE;
  const visibleRegions = showAll ? topRegions : topRegions.slice(0, INITIAL_VISIBLE);
  
  return (
    <CollapsibleSection 
      title={`Regions (${topRegions.length})`} 
      icon="📍"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-1">
        {visibleRegions.map(({ code, name, country, count }) => (
          <div key={code} className="flex justify-between items-center text-xs">
            <button
              onClick={() => onRegionClick(code)}
              className="text-gray-300 hover:text-cyan-400 transition-colors text-left truncate max-w-[180px]"
              title={`${name}, ${country}`}
            >
              {name}
              <span className="text-gray-600 ml-1">({country})</span>
            </button>
            <span className="text-purple-400 ml-2">×{count}</span>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          {showAll ? '← Show less' : `Show ${topRegions.length - INITIAL_VISIBLE} more →`}
        </button>
      )}
    </CollapsibleSection>
  );
}

// Clickable Airport Code Component
function ClickableAirport({ 
  code, 
  onClick,
  className = ''
}: { 
  code: string; 
  onClick: (code: string) => void;
  className?: string;
}) {
  return (
    <button
      onClick={() => onClick(code)}
      className={`text-cyan-400 hover:text-cyan-300 hover:underline transition-colors cursor-pointer ${className}`}
    >
      {code}
    </button>
  );
}

// Clickable Route Component (origin ↔ destination)
function ClickableRoute({ 
  origin, 
  destination, 
  onAirportClick,
  onRouteClick,
  className = ''
}: { 
  origin: string; 
  destination: string; 
  onAirportClick: (code: string) => void;
  onRouteClick: (origin: string, destination: string) => void;
  className?: string;
}) {
  return (
    <span className={className}>
      <ClickableAirport code={origin} onClick={onAirportClick} className="text-gray-300" />
      <button
        onClick={() => onRouteClick(origin, destination)}
        className="text-gray-400 hover:text-purple-400 mx-1 transition-colors cursor-pointer"
        title="Zoom to route"
      >
        ↔
      </button>
      <ClickableAirport code={destination} onClick={onAirportClick} className="text-gray-300" />
    </span>
  );
}

// Flight count display with plane icon
function FlightCount({ count, showArrivals, showDepartures, arrivals, departures }: {
  count: number;
  showArrivals?: boolean;
  showDepartures?: boolean;
  arrivals?: number;
  departures?: number;
}) {
  return (
    <>
      <><span className="text-yellow-400">{count}</span>✈</>
      {showArrivals && arrivals !== undefined && (
        <> <span className="text-green-400">{arrivals}</span>↓</>
      )}
      {showDepartures && departures !== undefined && (
        <> <span className="text-blue-400">{departures}</span>↑</>
      )}
    </>
  );
}

// Stats Panel Component
function StatsPanel({ stats, isOpen, onToggle, selectedYear, onClearAirport, selectedAirline, onAirlineSelect, onAirportClick, onRouteClick, onCountryClick, onRegionClick }: { 
  stats: FlightStats; 
  isOpen: boolean; 
  onToggle: () => void;
  selectedYear: number | null;
  onClearAirport: () => void;
  selectedAirline: string | null;
  onAirlineSelect: (airline: string | null) => void;
  onAirportClick: (code: string) => void;
  onRouteClick: (origin: string, destination: string) => void;
  onCountryClick: (countryCode: string) => void;
  onRegionClick: (regionCode: string) => void;
}) {
  const earthCircumference = 40075;
  const timesAroundEarth = (stats.totalDistance / earthCircumference).toFixed(1);
  const domesticFlights = stats.totalFlights - stats.internationalFlights;
  const airportInfo = stats.selectedAirportInfo;
  
  // State to track which sections are open (for collapse all/expand all)
  const [allExpanded, setAllExpanded] = useState(true);
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>({});
  
  // Get the open state for a section
  const getSectionOpen = (sectionId: string, defaultOpen = true) => {
    if (sectionStates[sectionId] !== undefined) return sectionStates[sectionId];
    return allExpanded ? defaultOpen : false;
  };
  
  // Toggle a specific section
  const toggleSection = (sectionId: string) => {
    setSectionStates(prev => ({
      ...prev,
      [sectionId]: !getSectionOpen(sectionId),
    }));
  };
  
  // Collapse all or expand all
  const toggleAll = () => {
    const newExpanded = !allExpanded;
    setAllExpanded(newExpanded);
    // Clear individual states so they follow the global state
    setSectionStates({});
  };
  
  return (
    <div className={`absolute top-16 left-4 transition-all duration-300 ${isOpen ? 'w-80' : 'w-auto'} z-10`}>
      <button
        onClick={onToggle}
        className="bg-gray-900/90 backdrop-blur px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800/90 transition-colors flex items-center gap-2"
      >
        <span>📊</span>
        <span>{isOpen ? 'Hide Stats' : 'Show Stats'}</span>
      </button>
      
      {isOpen && (
        <div className="mt-2 bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 p-4 text-sm max-h-[calc(100vh-120px)] overflow-y-auto">
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
              <div className="text-gray-500 text-xs mb-1">{airportInfo.municipality}, {airportInfo.regionName}</div>
              <div className="text-gray-500 text-xs mb-1">{airportInfo.countryName} • {airportInfo.continentName}</div>
              <div className="text-gray-600 text-xs mb-3">
                📍 {airportInfo.elevationFt.toLocaleString()} ft ({airportInfo.elevationM.toLocaleString()} m)
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
                      <span className="text-gray-500">from </span>
                      <ClickableAirport code={airportInfo.firstVisit.from} onClick={onAirportClick} className="text-gray-400" />
                    </span>
                  </div>
                )}
                {airportInfo.lastVisit && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Last visit:</span>
                    <span className="text-gray-300">
                      {airportInfo.lastVisit.date}{' '}
                      <span className="text-gray-500">to </span>
                      <ClickableAirport code={airportInfo.lastVisit.to} onClick={onAirportClick} className="text-gray-400" />
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
                    {airportInfo.connectedCountries.slice(0, 8).map(country => (
                      <span key={country} className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-400">{country}</span>
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
                    {airportInfo.topDestinations.map(d => (
                      <div key={d.code} className="flex justify-between text-xs">
                        <ClickableAirport code={d.code} onClick={onAirportClick} className="text-gray-300" />
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
                    {airportInfo.topOrigins.map(o => (
                      <div key={o.code} className="flex justify-between text-xs">
                        <ClickableAirport code={o.code} onClick={onAirportClick} className="text-gray-300" />
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
                    {airportInfo.airlines.slice(0, 6).map(airline => (
                      <span key={airline} className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-400">{airline}</span>
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
                  <StatItem 
                    icon="📏" 
                    label="Total" 
                    value={`${stats.totalDistance.toLocaleString()} km`} 
                  />
                  <StatItem 
                    icon="📐" 
                    label="Average" 
                    value={`${stats.averageDistance.toLocaleString()} km`} 
                  />
                </div>
              </CollapsibleSection>
            </>
          ) : (
            /* Overall stats when no airport selected */
            <>
              <h3 className="text-white font-semibold mb-1 text-base">
                Flight Statistics
              </h3>
              {selectedYear && (
                <div className="text-purple-400 text-xs mb-3">Filtered: {selectedYear}</div>
              )}
              {selectedAirline && (
                <div className="text-orange-400 text-xs mb-3 flex items-center gap-2">
                  <span>Airline: {selectedAirline}</span>
                  <button 
                    onClick={() => onAirlineSelect(null)}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}
              {!selectedYear && !selectedAirline && stats.firstFlight && stats.lastFlight && (
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
                  value={`${stats.totalDistance.toLocaleString()} km`} 
                  className="mb-2"
                />
                <div className="grid grid-cols-2 gap-3">
                  <StatItem 
                    icon="🔄" 
                    label="Around Earth" 
                    value={`${timesAroundEarth}×`} 
                  />
                  <StatItem 
                    icon="📐" 
                    label="Avg Distance" 
                    value={`${stats.averageDistance.toLocaleString()} km`} 
                  />
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
                  />
                  <StatItem 
                    icon="🌐" 
                    label="International" 
                    value={stats.internationalFlights.toString()} 
                  />
                  <StatItem 
                    icon="🌏" 
                    label="Intercontinental" 
                    value={stats.intercontinentalFlights.toString()} 
                  />
                  {stats.mostVisitedCountry && (
                    <StatItem 
                      icon="🏆" 
                      label="Top Country" 
                      value={stats.mostVisitedCountry.country} 
                      subValue={<><span className="text-yellow-400">{stats.mostVisitedCountry.count}</span>✈ <span className="text-green-400">{stats.mostVisitedCountry.arrivals}</span>↓ <span className="text-blue-400">{stats.mostVisitedCountry.departures}</span>↑</>}
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
                        <ClickableAirport code={stats.busiestAirport.code} onClick={onAirportClick} className="text-gray-300" />
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
                        />
                      </div>
                      <div className="text-gray-500 text-xs">{Math.round(stats.longestFlight.distance).toLocaleString()} km</div>
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
                        />
                      </div>
                      <div className="text-gray-500 text-xs">{Math.round(stats.shortestFlight.distance).toLocaleString()} km</div>
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
                          <ClickableAirport code={stats.highestAirport.code} onClick={onAirportClick} className="text-gray-300" />
                        </div>
                        <div className="text-gray-500 text-xs truncate max-w-[200px]" title={stats.highestAirport.name}>
                          {stats.highestAirport.name}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {stats.highestAirport.elevationFt.toLocaleString()} ft ({stats.highestAirport.elevationM.toLocaleString()} m)
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
                          <ClickableAirport code={stats.lowestAirport.code} onClick={onAirportClick} className="text-gray-300" />
                        </div>
                        <div className="text-gray-500 text-xs truncate max-w-[200px]" title={stats.lowestAirport.name}>
                          {stats.lowestAirport.name}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {stats.lowestAirport.elevationFt.toLocaleString()} ft ({stats.lowestAirport.elevationM.toLocaleString()} m)
                        </div>
                      </div>
                    </div>
                  )}
                </CollapsibleSection>
              )}
              
              {/* Top Routes */}
              {stats.busiestRoutes.length > 0 && (
                <CollapsibleSection 
                  title="Top Routes" 
                  icon="🔀"
                  isOpen={getSectionOpen('overall-routes')}
                  onToggle={() => toggleSection('overall-routes')}
                >
                  <div className="space-y-1">
                    {stats.busiestRoutes.slice(0, 5).map((route) => (
                      <div key={route.routeKey} className="flex justify-between text-gray-300 text-sm">
                        <ClickableRoute 
                          origin={route.origin} 
                          destination={route.destination} 
                          onAirportClick={onAirportClick}
                          onRouteClick={onRouteClick}
                        />
                        <span className="text-purple-400">×{route.count}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatItem({ icon, label, value, subValue, className = '' }: {
  icon: string;
  label: string;
  value: string;
  subValue?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-gray-400 text-xs">{label}</div>
        <div className="text-white font-medium">{value}</div>
        {subValue && <div className="text-gray-500 text-xs">{subValue}</div>}
      </div>
    </div>
  );
}

// Filter Panel Component - expandable filter with multiple filter types
function FilterPanel({ 
  years, 
  selectedYear, 
  onYearChange,
  flightCount,
}: { 
  years: number[]; 
  selectedYear: number | null; 
  onYearChange: (year: number | null) => void;
  flightCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ year: true });
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Group years by decade for better organization
  const yearsByDecade = years.reduce((acc, year) => {
    const decade = Math.floor(year / 10) * 10;
    if (!acc[decade]) acc[decade] = [];
    acc[decade].push(year);
    return acc;
  }, {} as Record<number, number[]>);
  
  const decades = Object.keys(yearsByDecade).map(Number).sort((a, b) => b - a);
  const hasActiveFilters = selectedYear !== null;
  
  return (
    <div className="relative">
      {/* Filter Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-gray-900/90 backdrop-blur px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
          hasActiveFilters 
            ? 'border-purple-500 text-purple-300' 
            : 'border-gray-700 text-gray-300 hover:bg-gray-800/90'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {hasActiveFilters && (
          <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">1</span>
        )}
      </button>
      
      {/* Filter Panel */}
      {isOpen && (
        <div className="absolute top-12 right-0 w-72 bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 shadow-xl overflow-hidden z-30">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <h3 className="text-white font-medium text-sm">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={() => onYearChange(null)}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          
          {/* Filter Sections */}
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Year Filter Section */}
            <div className="border-b border-gray-800">
              <button
                onClick={() => toggleSection('year')}
                className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">📅</span>
                  <span className="text-gray-200 text-sm font-medium">Year</span>
                  {selectedYear && (
                    <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {selectedYear}
                    </span>
                  )}
                </div>
                <span className="text-gray-500 text-xs">
                  {expandedSections.year ? '▼' : '▶'}
                </span>
              </button>
              
              {expandedSections.year && (
                <div className="px-4 pb-4">
                  {/* All Years Button */}
                  <button
                    onClick={() => onYearChange(null)}
                    className={`w-full mb-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedYear === null 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    All Years ({flightCount} flights)
                  </button>
                  
                  {/* Years by Decade */}
                  <div className="space-y-3">
                    {decades.map(decade => (
                      <div key={decade}>
                        <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">
                          {decade}s
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {yearsByDecade[decade].sort((a, b) => b - a).map(year => (
                            <button
                              key={year}
                              onClick={() => onYearChange(year)}
                              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                                selectedYear === year 
                                  ? 'bg-purple-600 text-white' 
                                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                              }`}
                            >
                              {year}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Placeholder for future filters */}
            {/* 
            <div className="border-b border-gray-800">
              <button className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-gray-800/50 transition-colors opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">✈️</span>
                  <span className="text-gray-400 text-sm">Airline</span>
                </div>
                <span className="text-gray-600 text-xs">Coming soon</span>
              </button>
            </div>
            */}
          </div>
        </div>
      )}
    </div>
  );
}

// Color Mode Selector - collapsible on all screens
function ColorModeSelector({ 
  mode, 
  onModeChange 
}: { 
  mode: ColorMode; 
  onModeChange: (mode: ColorMode) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const modes: { value: ColorMode; label: string; icon: string }[] = [
    { value: 'default', label: 'Default', icon: '🎨' },
    { value: 'year', label: 'By Year', icon: '📅' },
    { value: 'frequency', label: 'By Frequency', icon: '🔥' },
    { value: 'airline', label: 'By Airline', icon: '✈️' },
  ];
  
  const currentMode = modes.find(m => m.value === mode);

  return (
    <div className="absolute bottom-4 right-4 z-10">
      {/* Collapsed: just show icon button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gray-900/90 backdrop-blur p-2.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800/90 transition-colors"
          title={`Color: ${currentMode?.label}`}
        >
          <span className="text-lg">{currentMode?.icon}</span>
        </button>
      )}
      
      {/* Expanded: show full selector */}
      {isOpen && (
        <div className="bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-gray-400 text-xs uppercase tracking-wide">Color Mode</div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  onModeChange(m.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-1.5 rounded text-xs text-left transition-colors flex items-center gap-2 ${
                  mode === m.value 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FlightsMap() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('default');
  const [showStats, setShowStats] = useState(false);
  const [hoveredStaticArc, setHoveredStaticArc] = useState<GlobeStaticArc | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const [selectedAirline, setSelectedAirline] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const hasInteracted = useRef(false);

  // Set initial view centered on USA and enable auto-rotation
  useEffect(() => {
    if (globeRef.current) {
      // Center on continental USA (roughly Kansas)
      globeRef.current.pointOfView({ lat: 39.8283, lng: -98.5795, altitude: 2.5 }, 0);
    }
  }, []);

  // Handle auto-rotation
  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = -0.5; // Slow rotation (east to west)
      }
    }
  }, [autoRotate]);

  // Stop auto-rotation on any user interaction
  const stopAutoRotate = useCallback(() => {
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      setAutoRotate(false);
    }
  }, []);

  const { arcsData, staticArcsData, pointsData, flightStats, loading, error } = useGlobeData({
    selectedYear,
    colorMode,
    selectedAirport,
    selectedAirline,
  });

  // Combine static arcs (background lines) and animated arcs (dots) into one dataset
  // Animated arcs render first (underneath), static arcs render on top for better hover detection
  const combinedArcsData = useMemo(() => {
    // Animated arcs: small dots, animated with staggered starting positions
    const animatedArcs = arcsData.map(arc => ({
      ...arc,
      isStatic: false,
    }));
    
    // Static arcs: solid lines, no animation - rendered on top for hover detection
    const staticArcs = staticArcsData.map(arc => ({
      ...arc,
      dashLength: 1,
      dashGap: 0,
      dashInitialGap: 0,
      animateTime: 0,
      isStatic: true,
    }));
    
    return [...animatedArcs, ...staticArcs];
  }, [staticArcsData, arcsData]);

  // Calculate bounds for zoom-to-fit when year changes
  const zoomToBounds = useCallback((points: typeof pointsData) => {
    if (!globeRef.current || points.length === 0) return;
    
    // Calculate the bounding box of all points
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    
    points.forEach(point => {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    });
    
    // Calculate center
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Calculate span
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    // Handle longitude wrapping
    const adjustedLngSpan = lngSpan > 180 ? 360 - lngSpan : lngSpan;
    const maxSpan = Math.max(latSpan, adjustedLngSpan);
    
    // Calculate altitude based on span - small region needs lower altitude, global needs higher
    // Range: 0.5 (very focused, ~10°) to 2.5 (global view, ~180°)
    const altitude = Math.min(2.5, Math.max(0.5, maxSpan / 50 + 0.3));
    
    globeRef.current.pointOfView({ lat: centerLat, lng: centerLng, altitude }, 1000);
  }, []);

  // Year change handler with zoom-to-fit
  const handleYearChange = useCallback((year: number | null) => {
    stopAutoRotate();
    setSelectedYear(year);
    // Clear airport selection when changing year filter
    setSelectedAirport(null);
  }, [stopAutoRotate]);

  // Effect to zoom to bounds when year filter changes and data updates
  const prevYearRef = useRef<number | null>(null);
  useMemo(() => {
    // Only zoom when year actually changes (not on initial render)
    if (prevYearRef.current !== selectedYear && selectedYear !== null && pointsData.length > 0) {
      // Small delay to let the data update
      setTimeout(() => zoomToBounds(pointsData), 100);
    }
    prevYearRef.current = selectedYear;
  }, [selectedYear, pointsData, zoomToBounds]);

  // Static arc hover handler  
  const handleStaticArcHover = useCallback((arc: GlobeStaticArc | null) => {
    setHoveredStaticArc(arc);
  }, []);

  // Point hover handler
  const handlePointHover = useCallback((point: GlobePoint | null) => {
    setHoveredPoint(point);
  }, []);

  // Static arc click - zoom to fit the entire route
  const handleStaticArcClick = useCallback((arc: GlobeStaticArc) => {
    stopAutoRotate();
    if (globeRef.current) {
      // Calculate the center point between origin and destination
      const midLat = (arc.startLat + arc.endLat) / 2;
      const midLng = (arc.startLng + arc.endLng) / 2;
      
      // Calculate the distance between the two points to determine zoom level
      const latDiff = Math.abs(arc.startLat - arc.endLat);
      const lngDiff = Math.abs(arc.startLng - arc.endLng);
      // Handle longitude wrapping (e.g., crossing the date line)
      const adjustedLngDiff = lngDiff > 180 ? 360 - lngDiff : lngDiff;
      const maxDiff = Math.max(latDiff, adjustedLngDiff);
      
      // Scale altitude based on the span - larger routes need higher altitude
      // Range from 0.8 (short routes ~10°) to 2.5 (long routes ~180°)
      const altitude = Math.min(2.5, Math.max(0.8, maxDiff / 60));
      
      globeRef.current.pointOfView({ lat: midLat, lng: midLng, altitude }, 1000);
    }
  }, [stopAutoRotate]);

  // Point click - fly to airport and toggle selection
  const handlePointClick = useCallback((point: GlobePoint) => {
    stopAutoRotate();
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: point.lat, lng: point.lng, altitude: 0.5 }, 1000);
    }
    // Toggle selection: if clicking same airport, deselect; otherwise select new one
    setSelectedAirport(prev => {
      const newSelection = prev === point.airport.code ? null : point.airport.code;
      // Open stats panel when selecting an airport, close when deselecting
      if (newSelection) {
        setShowStats(true);
      } else {
        setShowStats(false);
      }
      return newSelection;
    });
  }, [stopAutoRotate]);

  // Handle clicking on an airport code in the stats panel
  const handleAirportCodeClick = useCallback((code: string) => {
    stopAutoRotate();
    // Find the airport in pointsData
    const airport = pointsData.find(p => p.airport.code === code);
    if (airport && globeRef.current) {
      globeRef.current.pointOfView({ lat: airport.lat, lng: airport.lng, altitude: 0.5 }, 1000);
    }
    // Select the airport
    setSelectedAirport(code);
    setShowStats(true);
  }, [stopAutoRotate, pointsData]);

  // Handle clicking on a route in the stats panel
  const handleRouteCodeClick = useCallback((origin: string, destination: string) => {
    stopAutoRotate();
    // Find the airports to get their coordinates
    const originAirport = pointsData.find(p => p.airport.code === origin);
    const destAirport = pointsData.find(p => p.airport.code === destination);
    
    if (originAirport && destAirport && globeRef.current) {
      // Calculate center and zoom (same logic as handleStaticArcClick)
      const midLat = (originAirport.lat + destAirport.lat) / 2;
      const midLng = (originAirport.lng + destAirport.lng) / 2;
      
      const latDiff = Math.abs(originAirport.lat - destAirport.lat);
      const lngDiff = Math.abs(originAirport.lng - destAirport.lng);
      const adjustedLngDiff = lngDiff > 180 ? 360 - lngDiff : lngDiff;
      const maxDiff = Math.max(latDiff, adjustedLngDiff);
      
      const altitude = Math.min(2.5, Math.max(0.8, maxDiff / 60));
      
      globeRef.current.pointOfView({ lat: midLat, lng: midLng, altitude }, 1000);
    }
  }, [stopAutoRotate, pointsData]);

  // Handle clicking on a country in the stats panel - zoom to fit all airports in that country
  const handleCountryClick = useCallback((countryCode: string) => {
    stopAutoRotate();
    // Find all airports in this country
    const countryAirports = pointsData.filter(p => p.airport.country === countryCode);
    
    if (countryAirports.length > 0 && globeRef.current) {
      if (countryAirports.length === 1) {
        // Single airport - zoom to it
        globeRef.current.pointOfView({ 
          lat: countryAirports[0].lat, 
          lng: countryAirports[0].lng, 
          altitude: 0.5 
        }, 1000);
      } else {
        // Multiple airports - calculate bounding box
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        countryAirports.forEach(ap => {
          minLat = Math.min(minLat, ap.lat);
          maxLat = Math.max(maxLat, ap.lat);
          minLng = Math.min(minLng, ap.lng);
          maxLng = Math.max(maxLng, ap.lng);
        });
        
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        const latSpan = maxLat - minLat;
        const lngSpan = maxLng - minLng;
        const adjustedLngSpan = lngSpan > 180 ? 360 - lngSpan : lngSpan;
        const maxSpan = Math.max(latSpan, adjustedLngSpan);
        const altitude = Math.min(2.5, Math.max(0.5, maxSpan / 50 + 0.3));
        
        globeRef.current.pointOfView({ lat: centerLat, lng: centerLng, altitude }, 1000);
      }
    }
  }, [stopAutoRotate, pointsData]);

  // Handle clicking on a region in the stats panel - zoom to fit all airports in that region
  const handleRegionClick = useCallback((regionCode: string) => {
    stopAutoRotate();
    // Find all airports in this region
    const regionAirports = pointsData.filter(p => p.airport.region === regionCode);
    
    if (regionAirports.length > 0 && globeRef.current) {
      if (regionAirports.length === 1) {
        // Single airport - zoom to it
        globeRef.current.pointOfView({ 
          lat: regionAirports[0].lat, 
          lng: regionAirports[0].lng, 
          altitude: 0.5 
        }, 1000);
      } else {
        // Multiple airports - calculate bounding box
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        regionAirports.forEach(ap => {
          minLat = Math.min(minLat, ap.lat);
          maxLat = Math.max(maxLat, ap.lat);
          minLng = Math.min(minLng, ap.lng);
          maxLng = Math.max(maxLng, ap.lng);
        });
        
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        const latSpan = maxLat - minLat;
        const lngSpan = maxLng - minLng;
        const adjustedLngSpan = lngSpan > 180 ? 360 - lngSpan : lngSpan;
        const maxSpan = Math.max(latSpan, adjustedLngSpan);
        const altitude = Math.min(2.5, Math.max(0.5, maxSpan / 50 + 0.3));
        
        globeRef.current.pointOfView({ lat: centerLat, lng: centerLng, altitude }, 1000);
      }
    }
  }, [stopAutoRotate, pointsData]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        Error loading flight data: {error.message}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#000011] flex flex-col">
      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3">
        {/* Left: Back button */}
        <Link 
          to="/projects" 
          className="bg-gray-900/90 backdrop-blur px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800/90 hover:text-white transition-colors flex items-center gap-2"
        >
          <span>←</span>
          <span className="hidden sm:inline">Back</span>
        </Link>
        
        {/* Center: Title (hidden on very small screens) */}
        <h1 className="hidden md:block text-white/80 text-sm font-medium">
          Flight History
        </h1>
        
        {/* Right: Filter */}
        {flightStats.years.length > 0 && (
          <FilterPanel 
            years={flightStats.years} 
            selectedYear={selectedYear} 
            onYearChange={handleYearChange}
            flightCount={flightStats.totalFlights}
          />
        )}
        {flightStats.years.length === 0 && <div />}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-white/70 text-lg">Loading flights...</div>
        </div>
      )}

      <Globe
        ref={globeRef}
        globeImageUrl={GLOBE_IMAGE}
        bumpImageUrl={BUMP_IMAGE}
        backgroundColor="rgba(0,0,17,1)"
        atmosphereColor="lightskyblue"
        atmosphereAltitude={0.15}
        onGlobeReady={() => {
          // Set initial view on USA when globe is ready
          if (globeRef.current) {
            globeRef.current.pointOfView({ lat: 39.8283, lng: -98.5795, altitude: 2.5 }, 0);
            const controls = globeRef.current.controls();
            if (controls) {
              controls.autoRotate = true;
              controls.autoRotateSpeed = -0.5;
              // Listen for user interaction to stop auto-rotate
              controls.addEventListener('start', stopAutoRotate);
            }
          }
        }}
        // Combined arcs: static background lines + animated dots
        arcsData={combinedArcsData}
        arcStartLat={(d: object) => (d as GlobeArc & { startLat: number }).startLat}
        arcStartLng={(d: object) => (d as GlobeArc & { startLng: number }).startLng}
        arcEndLat={(d: object) => (d as GlobeArc & { endLat: number }).endLat}
        arcEndLng={(d: object) => (d as GlobeArc & { endLng: number }).endLng}
        arcColor={(d: object) => (d as GlobeArc & { color: string }).color}
        arcAltitudeAutoScale={0.3}
        arcStroke={(d: object) => (d as GlobeArc & { stroke: number }).stroke}
        arcDashLength={(d: object) => (d as GlobeArc & { dashLength: number }).dashLength}
        arcDashGap={(d: object) => (d as GlobeArc & { dashGap: number }).dashGap}
        arcDashInitialGap={(d: object) => (d as GlobeArc & { dashInitialGap: number }).dashInitialGap}
        arcDashAnimateTime={(d: object) => (d as GlobeArc & { animateTime: number }).animateTime}
        arcsTransitionDuration={800}
        onArcHover={(arc: object | null) => {
          // Handle hover for static arcs (which have flights array)
          // When arc is null (hovering off), clear the state
          if (!arc) {
            handleStaticArcHover(null);
            return;
          }
          const arcData = arc as (GlobeStaticArc & { isStatic?: boolean });
          if (arcData.isStatic) {
            handleStaticArcHover(arcData as GlobeStaticArc);
          }
        }}
        onArcClick={(arc: object) => {
          const arcData = arc as GlobeStaticArc & { isStatic?: boolean };
          if (arcData?.isStatic) {
            handleStaticArcClick(arcData as GlobeStaticArc);
          }
        }}
        arcLabel={(d: object) => {
          const arcData = d as GlobeStaticArc & { isStatic?: boolean };
          // Only show labels for static arcs
          if (!arcData.isStatic || !arcData.flights) return '';
          const firstFlight = arcData.flights[0];
          const recentFlights = arcData.flights.slice(0, 5);
          return `
            <div class="bg-gray-900/95 px-3 py-2 rounded-lg shadow-xl border border-gray-700 text-sm">
              <div class="font-bold text-purple-300">${firstFlight.origin_code} ↔ ${firstFlight.destination_code}</div>
              <div class="text-gray-300 text-xs">${firstFlight.origin_name}</div>
              <div class="text-gray-400 text-xs">↕</div>
              <div class="text-gray-300 text-xs">${firstFlight.destination_name}</div>
              <div class="mt-2 pt-2 border-t border-gray-700">
                <span class="text-purple-400">${arcData.routeCount} flight${arcData.routeCount > 1 ? 's' : ''}</span>
              </div>
              <div class="text-gray-500 text-xs mt-1">
                ${recentFlights.map((f: { date: string }) => f.date).join(', ')}${arcData.flights.length > 5 ? '...' : ''}
              </div>
            </div>
          `;
        }}
        // Points (airports)
        pointsData={pointsData}
        pointLat={(d: object) => (d as GlobePoint).lat}
        pointLng={(d: object) => (d as GlobePoint).lng}
        pointColor={(d: object) => (d as GlobePoint).color}
        pointAltitude={0.015}
        pointRadius={(d: object) => (d as GlobePoint).size}
        pointsMerge={false}
        onPointHover={handlePointHover as (point: object | null) => void}
        onPointClick={handlePointClick as (point: object) => void}
        pointLabel={(d: object) => {
          const point = d as GlobePoint;
          const a = point.airport;
          return `
            <div class="bg-gray-900/95 px-3 py-2 rounded-lg shadow-xl border border-gray-700 text-sm">
              <div class="font-bold text-yellow-300">${a.code}</div>
              <div class="text-gray-300">${a.name}</div>
              <div class="text-gray-400 text-xs">${a.municipality}, ${a.countryName}</div>
              <div class="text-gray-500 text-xs">${a.elevationFt.toLocaleString()} ft (${a.elevationM.toLocaleString()} m)</div>
              <div class="text-gray-500 mt-2 pt-2 border-t border-gray-700">
                <span class="text-yellow-400">${a.visitCount}</span> visits
                <span class="text-gray-600 mx-1">•</span>
                <span class="text-green-400">${a.arrivalCount}</span>↓
                <span class="text-blue-400">${a.departureCount}</span>↑
              </div>
            </div>
          `;
        }}
        // Labels
        labelsData={pointsData}
        labelLat={(d: object) => (d as GlobePoint).lat}
        labelLng={(d: object) => (d as GlobePoint).lng}
        labelText={(d: object) => (d as GlobePoint).label}
        labelSize={0.6}
        labelDotRadius={0}
        labelColor={() => 'rgba(255, 255, 255, 0.95)'}
        labelAltitude={0.018}
        labelResolution={3}
        // Click on globe background to deselect and close stats
        onGlobeClick={() => {
          stopAutoRotate();
          setSelectedAirport(null);
          setShowStats(false);
        }}
      />

      {/* Stats Panel */}
      <StatsPanel 
        stats={flightStats} 
        isOpen={showStats} 
        onToggle={() => setShowStats(!showStats)}
        selectedYear={selectedYear}
        onClearAirport={() => {
          setSelectedAirport(null);
          setShowStats(false);
        }}
        selectedAirline={selectedAirline}
        onAirlineSelect={setSelectedAirline}
        onAirportClick={handleAirportCodeClick}
        onRouteClick={handleRouteCodeClick}
        onCountryClick={handleCountryClick}
        onRegionClick={handleRegionClick}
      />

      {/* Color Mode Selector */}
      <ColorModeSelector mode={colorMode} onModeChange={setColorMode} />

      {/* Bottom Stats Bar - responsive sizing */}
      <div className="absolute bottom-4 left-4 right-20 sm:right-auto bg-gray-900/80 backdrop-blur px-3 sm:px-4 py-2 sm:py-3 rounded-lg border border-gray-700 text-xs sm:text-sm">
        <div className="text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            <span className="text-purple-300 font-semibold">{flightStats.totalFlights}</span>
            <span className="hidden sm:inline"> flights</span>
            <span className="sm:hidden">✈</span>
          </span>
          <span className="text-gray-600">•</span>
          <span>
            <span className="text-yellow-300 font-semibold">{flightStats.totalAirports}</span>
            <span className="hidden sm:inline"> airports</span>
            <span className="sm:hidden">📍</span>
          </span>
          {selectedYear && (
            <>
              <span className="text-gray-600">•</span>
              <span className="text-white font-semibold">{selectedYear}</span>
            </>
          )}
          {selectedAirport && (
            <>
              <span className="text-gray-600">•</span>
              <span className="text-cyan-400 font-semibold">{selectedAirport}</span>
            </>
          )}
          {selectedAirline && (
            <>
              <span className="text-gray-600 hidden sm:inline">•</span>
              <span className="text-orange-400 font-semibold hidden sm:inline">{selectedAirline}</span>
            </>
          )}
        </div>
      </div>

      {/* Hover info - hidden on small screens, positioned above color mode selector */}
      {(hoveredStaticArc || hoveredPoint) && (
        <div className="hidden sm:block absolute bottom-16 right-4 bg-gray-900/80 backdrop-blur px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 max-w-xs">
          {hoveredStaticArc && (
            <div>
              <span className="text-purple-300">{hoveredStaticArc.flights[0]?.origin_code} ↔ {hoveredStaticArc.flights[0]?.destination_code}</span>
              {hoveredStaticArc.routeCount > 1 && (
                <span className="text-gray-500 ml-2">({hoveredStaticArc.routeCount} flights)</span>
              )}
            </div>
          )}
          {hoveredPoint && `${hoveredPoint.airport.code}: ${hoveredPoint.airport.name}`}
        </div>
      )}
    </div>
  );
}
