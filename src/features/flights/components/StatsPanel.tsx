import { useState } from 'react';
import type { FlightStats } from '../types';
import { StatItem, CollapsibleSection, ClickableAirport, ClickableRoute, FlightCount } from './shared';
import { AirlinesSection } from './AirlinesSection';
import { CountriesSection } from './CountriesSection';
import { RegionsSection } from './RegionsSection';
import { RoutesSection } from './RoutesSection';

interface StatsPanelProps {
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
}

export function StatsPanel({
  stats,
  isOpen,
  onToggle,
  selectedYear,
  onClearAirport,
  selectedAirline,
  onAirlineSelect,
  onAirportClick,
  onRouteClick,
  onCountryClick,
  onRegionClick,
}: StatsPanelProps) {
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
    setSectionStates((prev) => ({
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
        <span className="text-gray-500 text-xs hidden sm:inline">[S]</span>
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
            <AirportStats
              airportInfo={airportInfo}
              stats={stats}
              onClearAirport={onClearAirport}
              onAirportClick={onAirportClick}
              getSectionOpen={getSectionOpen}
              toggleSection={toggleSection}
            />
          ) : (
            <OverallStats
              stats={stats}
              selectedYear={selectedYear}
              selectedAirline={selectedAirline}
              onAirlineSelect={onAirlineSelect}
              onAirportClick={onAirportClick}
              onRouteClick={onRouteClick}
              onCountryClick={onCountryClick}
              onRegionClick={onRegionClick}
              timesAroundEarth={timesAroundEarth}
              domesticFlights={domesticFlights}
              getSectionOpen={getSectionOpen}
              toggleSection={toggleSection}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Airport-specific stats
function AirportStats({
  airportInfo,
  stats,
  onClearAirport,
  onAirportClick,
  getSectionOpen,
  toggleSection,
}: {
  airportInfo: NonNullable<FlightStats['selectedAirportInfo']>;
  stats: FlightStats;
  onClearAirport: () => void;
  onAirportClick: (code: string) => void;
  getSectionOpen: (id: string, defaultOpen?: boolean) => boolean;
  toggleSection: (id: string) => void;
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
        {airportInfo.municipality}, {airportInfo.regionName}
      </div>
      <div className="text-gray-500 text-xs mb-1">
        {airportInfo.countryName} • {airportInfo.continentName}
      </div>
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
            {airportInfo.connectedCountries.slice(0, 8).map((country) => (
              <span key={country} className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-400">
                {country}
              </span>
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
            {airportInfo.topOrigins.map((o) => (
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
          <StatItem icon="📏" label="Total" value={`${stats.totalDistance.toLocaleString()} km`} />
          <StatItem icon="📐" label="Average" value={`${stats.averageDistance.toLocaleString()} km`} />
        </div>
      </CollapsibleSection>
    </>
  );
}

// Overall stats when no airport selected
function OverallStats({
  stats,
  selectedYear,
  selectedAirline,
  onAirlineSelect,
  onAirportClick,
  onRouteClick,
  onCountryClick,
  onRegionClick,
  timesAroundEarth,
  domesticFlights,
  getSectionOpen,
  toggleSection,
}: {
  stats: FlightStats;
  selectedYear: number | null;
  selectedAirline: string | null;
  onAirlineSelect: (airline: string | null) => void;
  onAirportClick: (code: string) => void;
  onRouteClick: (origin: string, destination: string) => void;
  onCountryClick: (countryCode: string) => void;
  onRegionClick: (regionCode: string) => void;
  timesAroundEarth: string;
  domesticFlights: number;
  getSectionOpen: (id: string, defaultOpen?: boolean) => boolean;
  toggleSection: (id: string) => void;
}) {
  return (
    <>
      <h3 className="text-white font-semibold mb-1 text-base">Flight Statistics</h3>
      {selectedYear && <div className="text-purple-400 text-xs mb-3">Filtered: {selectedYear}</div>}
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
          <StatItem icon="🔄" label="Around Earth" value={`${timesAroundEarth}×`} />
          <StatItem icon="📐" label="Avg Distance" value={`${stats.averageDistance.toLocaleString()} km`} />
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
          <StatItem icon="🏠" label="Domestic" value={domesticFlights.toString()} />
          <StatItem icon="🌐" label="International" value={stats.internationalFlights.toString()} />
          <StatItem icon="🌏" label="Intercontinental" value={stats.intercontinentalFlights.toString()} />
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
              <div className="text-gray-500 text-xs">
                {Math.round(stats.longestFlight.distance).toLocaleString()} km
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
                />
              </div>
              <div className="text-gray-500 text-xs">
                {Math.round(stats.shortestFlight.distance).toLocaleString()} km
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
                  />
                </div>
                <div className="text-gray-500 text-xs truncate max-w-[200px]" title={stats.highestAirport.name}>
                  {stats.highestAirport.name}
                </div>
                <div className="text-gray-500 text-xs">
                  {stats.highestAirport.elevationFt.toLocaleString()} ft (
                  {stats.highestAirport.elevationM.toLocaleString()} m)
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
                  />
                </div>
                <div className="text-gray-500 text-xs truncate max-w-[200px]" title={stats.lowestAirport.name}>
                  {stats.lowestAirport.name}
                </div>
                <div className="text-gray-500 text-xs">
                  {stats.lowestAirport.elevationFt.toLocaleString()} ft (
                  {stats.lowestAirport.elevationM.toLocaleString()} m)
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
        />
      )}
    </>
  );
}
