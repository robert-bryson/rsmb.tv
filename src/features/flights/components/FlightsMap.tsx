import { useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { useGlobeData } from '../hooks/useFlightData';
import type { GlobeArc, GlobePoint, ColorMode, FlightStats } from '../types';

// Earth textures
const GLOBE_IMAGE = '//unpkg.com/three-globe/example/img/earth-night.jpg';
const BUMP_IMAGE = '//unpkg.com/three-globe/example/img/earth-topology.png';

// Stats Panel Component
function StatsPanel({ stats, isOpen, onToggle, selectedYear }: { 
  stats: FlightStats; 
  isOpen: boolean; 
  onToggle: () => void;
  selectedYear: number | null;
}) {
  const earthCircumference = 40075;
  const timesAroundEarth = (stats.totalDistance / earthCircumference).toFixed(1);
  const domesticFlights = stats.totalFlights - stats.internationalFlights;
  
  return (
    <div className={`absolute top-4 left-4 transition-all duration-300 ${isOpen ? 'w-80' : 'w-auto'} z-10`}>
      <button
        onClick={onToggle}
        className="bg-gray-900/90 backdrop-blur px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800/90 transition-colors flex items-center gap-2"
      >
        <span>📊</span>
        <span>{isOpen ? 'Hide Stats' : 'Show Stats'}</span>
      </button>
      
      {isOpen && (
        <div className="mt-2 bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 p-4 text-sm max-h-[calc(100vh-120px)] overflow-y-auto">
          <h3 className="text-white font-semibold mb-1 text-base">
            Flight Statistics
          </h3>
          {selectedYear && (
            <div className="text-purple-400 text-xs mb-3">Filtered: {selectedYear}</div>
          )}
          {!selectedYear && stats.firstFlight && stats.lastFlight && (
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
          <div className="mt-4 pt-3 border-t border-gray-700">
            <h4 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Distance</h4>
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
          </div>

          {/* Flight Types */}
          <div className="mt-4 pt-3 border-t border-gray-700">
            <h4 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Flight Types</h4>
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
                  subValue={`${stats.mostVisitedCountry.count} visits`}
                />
              )}
            </div>
          </div>
          
          {/* Continents */}
          {Object.keys(stats.continentCounts).length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <h4 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Continents Visited</h4>
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
            </div>
          )}

          {/* Notable Flights */}
          <div className="mt-4 pt-3 border-t border-gray-700">
            <h4 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Notable Flights</h4>
            {stats.busiestAirport && (
              <StatItem 
                icon="🏠" 
                label="Busiest Airport" 
                value={`${stats.busiestAirport.code}`}
                subValue={`${stats.busiestAirport.count} visits`}
                className="mb-2"
              />
            )}
            {stats.longestFlight && (
              <StatItem 
                icon="🛫" 
                label="Longest Flight" 
                value={stats.longestFlight.route} 
                subValue={`${Math.round(stats.longestFlight.distance).toLocaleString()} km`}
                className="mb-2"
              />
            )}
            {stats.shortestFlight && (
              <StatItem 
                icon="🛬" 
                label="Shortest Flight" 
                value={stats.shortestFlight.route} 
                subValue={`${Math.round(stats.shortestFlight.distance).toLocaleString()} km`}
              />
            )}
          </div>
          
          {/* Top Routes */}
          {stats.busiestRoutes.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <h4 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Top Routes</h4>
              <div className="space-y-1">
                {stats.busiestRoutes.slice(0, 5).map((route) => (
                  <div key={route.routeKey} className="flex justify-between text-gray-300">
                    <span>{route.origin} ↔ {route.destination}</span>
                    <span className="text-purple-400">×{route.count}</span>
                  </div>
                ))}
              </div>
            </div>
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
  subValue?: string;
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

// Year Filter Component
function YearFilter({ 
  years, 
  selectedYear, 
  onYearChange 
}: { 
  years: number[]; 
  selectedYear: number | null; 
  onYearChange: (year: number | null) => void;
}) {
  return (
    <div className="absolute top-16 right-4 bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 p-3 z-10">
      <div className="text-gray-400 text-xs uppercase tracking-wide mb-2">Filter by Year</div>
      <div className="flex flex-wrap gap-1 max-w-xs">
        <button
          onClick={() => onYearChange(null)}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            selectedYear === null 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          All
        </button>
        {years.map((year) => (
          <button
            key={year}
            onClick={() => onYearChange(year)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              selectedYear === year 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}

// Color Mode Selector
function ColorModeSelector({ 
  mode, 
  onModeChange 
}: { 
  mode: ColorMode; 
  onModeChange: (mode: ColorMode) => void;
}) {
  const modes: { value: ColorMode; label: string; icon: string }[] = [
    { value: 'default', label: 'Default', icon: '🎨' },
    { value: 'year', label: 'By Year', icon: '📅' },
    { value: 'frequency', label: 'By Frequency', icon: '🔥' },
    { value: 'airline', label: 'By Airline', icon: '✈️' },
  ];

  return (
    <div className="absolute bottom-20 right-4 bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 p-3">
      <div className="text-gray-400 text-xs uppercase tracking-wide mb-2">Color Mode</div>
      <div className="flex flex-col gap-1">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => onModeChange(m.value)}
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
  );
}

export function FlightsMap() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('default');
  const [showStats, setShowStats] = useState(false);
  const [hoveredArc, setHoveredArc] = useState<GlobeArc | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null);

  const { arcsData, pointsData, flightStats, loading, error } = useGlobeData({
    selectedYear,
    colorMode,
  });

  // Arc hover handler
  const handleArcHover = useCallback((arc: GlobeArc | null) => {
    setHoveredArc(arc);
  }, []);

  // Point hover handler
  const handlePointHover = useCallback((point: GlobePoint | null) => {
    setHoveredPoint(point);
  }, []);

  // Arc click - fly to midpoint
  const handleArcClick = useCallback((arc: GlobeArc) => {
    if (globeRef.current) {
      const midLat = (arc.startLat + arc.endLat) / 2;
      const midLng = (arc.startLng + arc.endLng) / 2;
      globeRef.current.pointOfView({ lat: midLat, lng: midLng, altitude: 1.5 }, 1000);
    }
  }, []);

  // Point click - fly to airport
  const handlePointClick = useCallback((point: GlobePoint) => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: point.lat, lng: point.lng, altitude: 0.5 }, 1000);
    }
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        Error loading flight data: {error.message}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#000011]">
      {/* Back button */}
      <Link 
        to="/projects" 
        className="absolute top-4 right-4 z-20 bg-gray-900/90 backdrop-blur px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800/90 hover:text-white transition-colors flex items-center gap-2"
      >
        <span>←</span>
        <span>Back</span>
      </Link>

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
        // Arcs (flight paths) - slower, simpler animation
        arcsData={arcsData}
        arcStartLat={(d: object) => (d as GlobeArc).startLat}
        arcStartLng={(d: object) => (d as GlobeArc).startLng}
        arcEndLat={(d: object) => (d as GlobeArc).endLat}
        arcEndLng={(d: object) => (d as GlobeArc).endLng}
        arcColor={(d: object) => (d as GlobeArc).color}
        arcAltitudeAutoScale={0.3}
        arcStroke={(d: object) => (d as GlobeArc).stroke}
        arcDashLength={1}
        arcDashGap={0}
        arcDashAnimateTime={0} // No animation - static arcs
        arcsTransitionDuration={800}
        onArcHover={handleArcHover as (arc: object | null) => void}
        onArcClick={handleArcClick as (arc: object) => void}
        arcLabel={(d: object) => {
          const arc = d as GlobeArc;
          return `
            <div class="bg-gray-900/95 px-3 py-2 rounded-lg shadow-xl border border-gray-700 text-sm">
              <div class="font-bold text-purple-300">${arc.flight.origin_code} → ${arc.flight.destination_code}</div>
              <div class="text-gray-300 text-xs">${arc.flight.origin_name}</div>
              <div class="text-gray-400 text-xs">↓</div>
              <div class="text-gray-300 text-xs">${arc.flight.destination_name}</div>
              <div class="flex justify-between mt-2 pt-2 border-t border-gray-700">
                <span class="text-gray-500">${arc.flight.date}</span>
                ${arc.routeCount > 1 ? `<span class="text-purple-400">×${arc.routeCount} flights</span>` : ''}
              </div>
              <div class="text-gray-500 text-xs mt-1">${arc.flight.airline}</div>
            </div>
          `;
        }}
        // Points (airports)
        pointsData={pointsData}
        pointLat={(d: object) => (d as GlobePoint).lat}
        pointLng={(d: object) => (d as GlobePoint).lng}
        pointColor={(d: object) => (d as GlobePoint).color}
        pointAltitude={0.01}
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
              <div class="text-gray-400 text-xs">${a.municipality}, ${a.country}</div>
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
        labelSize={0.5}
        labelDotRadius={0}
        labelColor={() => 'rgba(255, 255, 255, 0.7)'}
        labelAltitude={0.012}
        labelResolution={2}
      />

      {/* Stats Panel */}
      <StatsPanel 
        stats={flightStats} 
        isOpen={showStats} 
        onToggle={() => setShowStats(!showStats)}
        selectedYear={selectedYear}
      />

      {/* Year Filter */}
      {flightStats.years.length > 0 && (
        <YearFilter 
          years={flightStats.years} 
          selectedYear={selectedYear} 
          onYearChange={setSelectedYear} 
        />
      )}

      {/* Color Mode Selector */}
      <ColorModeSelector mode={colorMode} onModeChange={setColorMode} />

      {/* Bottom Stats Bar */}
      <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur px-4 py-3 rounded-lg border border-gray-700 text-sm">
        <div className="text-gray-400">
          <span className="text-purple-300 font-semibold">{arcsData.length}</span> flights
          {' • '}
          <span className="text-yellow-300 font-semibold">{pointsData.length}</span> airports
          {selectedYear && (
            <>
              {' • '}
              <span className="text-gray-500">Year: </span>
              <span className="text-white font-semibold">{selectedYear}</span>
            </>
          )}
        </div>
      </div>

      {/* Hover info */}
      {(hoveredArc || hoveredPoint) && (
        <div className="absolute bottom-4 right-4 bg-gray-900/80 backdrop-blur px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300">
          {hoveredArc && (
            <div>
              <span className="text-purple-300">{hoveredArc.flight.origin_code} → {hoveredArc.flight.destination_code}</span>
              {hoveredArc.routeCount > 1 && (
                <span className="text-gray-500 ml-2">({hoveredArc.routeCount} times)</span>
              )}
            </div>
          )}
          {hoveredPoint && `${hoveredPoint.airport.code}: ${hoveredPoint.airport.name}`}
        </div>
      )}
    </div>
  );
}
