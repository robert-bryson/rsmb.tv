import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { useGlobeData } from '../hooks/useFlightData';
import { useStatsPanelState } from '../hooks/useStatsPanelState';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { StatsPanel } from './StatsPanel';
import { FilterPanel } from './FilterPanel';
import { ColorModeSelector } from './ColorModeSelector';
import { KeyboardHelp } from './KeyboardHelp';
import { EmptyState } from './EmptyState';
import type { GlobeArc, GlobePoint, GlobeStaticArc, ColorMode } from '../types';

// Earth textures
const GLOBE_IMAGE = '//unpkg.com/three-globe/example/img/earth-night.jpg';
const BUMP_IMAGE = '//unpkg.com/three-globe/example/img/earth-topology.png';

// Color mode values for keyboard shortcuts
const COLOR_MODES: ColorMode[] = ['default', 'year', 'frequency', 'airline'];

export function FlightsMap() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  
  // URL state for filters
  const selectedYear = searchParams.get('year') ? Number(searchParams.get('year')) : null;
  const selectedAirport = searchParams.get('airport') || null;
  const selectedAirline = searchParams.get('airline') || null;
  
  const [colorMode, setColorMode] = useState<ColorMode>('default');
  const [showStats, setShowStats] = useStatsPanelState(false);
  const [hoveredStaticArc, setHoveredStaticArc] = useState<GlobeStaticArc | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null);
  const [autoRotate, setAutoRotate] = useState(false); // Start paused
  const hasInteracted = useRef(false);

  // URL state setters
  const setSelectedYear = useCallback((year: number | null) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (year === null) {
        newParams.delete('year');
      } else {
        newParams.set('year', String(year));
      }
      // Clear airport selection when changing year
      newParams.delete('airport');
      return newParams;
    });
  }, [setSearchParams]);

  const setSelectedAirport = useCallback((airport: string | null) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (airport === null) {
        newParams.delete('airport');
      } else {
        newParams.set('airport', airport);
      }
      return newParams;
    });
  }, [setSearchParams]);

  const setSelectedAirline = useCallback((airline: string | null) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (airline === null) {
        newParams.delete('airline');
      } else {
        newParams.set('airline', airline);
      }
      return newParams;
    });
  }, [setSearchParams]);

  const clearAllFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  // Set initial view centered on USA
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 39.8283, lng: -98.5795, altitude: 2.5 }, 0);
    }
  }, []);

  // Start auto-rotation after a delay (gives user time to explore first)
  useEffect(() => {
    const rotationDelay = 12000; // 12 seconds before starting rotation
    const timer = setTimeout(() => {
      if (!hasInteracted.current && !prefersReducedMotion) {
        setAutoRotate(true);
      }
    }, rotationDelay);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  // Handle auto-rotation (disable if user prefers reduced motion)
  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = autoRotate && !prefersReducedMotion;
        controls.autoRotateSpeed = -0.25; // Slow, gentle rotation
      }
    }
  }, [autoRotate, prefersReducedMotion]);

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

  // Reset view callback for keyboard shortcuts
  const resetView = useCallback(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 39.8283, lng: -98.5795, altitude: 2.5 }, 1000);
    }
  }, []);

  // Keyboard shortcuts
  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    onToggleStats: () => setShowStats(prev => !prev),
    onToggleFilter: () => {
      // Filter panel is self-managed, this is a no-op for now
      // Could be enhanced with a ref-based approach
    },
    onResetView: resetView,
    onClearSelection: () => {
      setSelectedAirport(null);
      setShowStats(false);
    },
    onColorModeChange: (modeIndex) => {
      if (modeIndex >= 0 && modeIndex < COLOR_MODES.length) {
        setColorMode(COLOR_MODES[modeIndex]);
      }
    },
  });

  // Combine static arcs and animated arcs
  const combinedArcsData = useMemo(() => {
    // Disable animation if user prefers reduced motion
    const animatedArcs = arcsData.map(arc => ({
      ...arc,
      isStatic: false,
      animateTime: prefersReducedMotion ? 0 : arc.animateTime,
    }));

    const staticArcs = staticArcsData.map(arc => ({
      ...arc,
      dashLength: 1,
      dashGap: 0,
      dashInitialGap: 0,
      animateTime: 0,
      isStatic: true,
    }));

    return [...animatedArcs, ...staticArcs];
  }, [staticArcsData, arcsData, prefersReducedMotion]);

  // Calculate bounds for zoom-to-fit when year changes
  const zoomToBounds = useCallback((points: typeof pointsData) => {
    if (!globeRef.current || points.length === 0) return;

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    points.forEach(point => {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    const adjustedLngSpan = lngSpan > 180 ? 360 - lngSpan : lngSpan;
    const maxSpan = Math.max(latSpan, adjustedLngSpan);
    const altitude = Math.min(2.5, Math.max(0.5, maxSpan / 50 + 0.3));

    globeRef.current.pointOfView({ lat: centerLat, lng: centerLng, altitude }, 1000);
  }, []);

  // Year change handler with zoom-to-fit
  const handleYearChange = useCallback((year: number | null) => {
    stopAutoRotate();
    setSelectedYear(year);
  }, [stopAutoRotate, setSelectedYear]);

  // Effect to zoom to bounds when year filter changes
  const prevYearRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevYearRef.current !== selectedYear && selectedYear !== null && pointsData.length > 0) {
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
      const midLat = (arc.startLat + arc.endLat) / 2;
      const midLng = (arc.startLng + arc.endLng) / 2;
      const latDiff = Math.abs(arc.startLat - arc.endLat);
      const lngDiff = Math.abs(arc.startLng - arc.endLng);
      const adjustedLngDiff = lngDiff > 180 ? 360 - lngDiff : lngDiff;
      const maxDiff = Math.max(latDiff, adjustedLngDiff);
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
    const newSelection = selectedAirport === point.airport.code ? null : point.airport.code;
    setSelectedAirport(newSelection);
    if (newSelection) {
      setShowStats(true);
    } else {
      setShowStats(false);
    }
  }, [stopAutoRotate, selectedAirport, setSelectedAirport, setShowStats]);

  // Handle clicking on an airport code in the stats panel
  const handleAirportCodeClick = useCallback((code: string) => {
    stopAutoRotate();
    const airport = pointsData.find(p => p.airport.code === code);
    if (airport && globeRef.current) {
      globeRef.current.pointOfView({ lat: airport.lat, lng: airport.lng, altitude: 0.5 }, 1000);
    }
    setSelectedAirport(code);
    setShowStats(true);
  }, [stopAutoRotate, pointsData, setSelectedAirport, setShowStats]);

  // Handle clicking on a route in the stats panel
  const handleRouteCodeClick = useCallback((origin: string, destination: string) => {
    stopAutoRotate();
    const originAirport = pointsData.find(p => p.airport.code === origin);
    const destAirport = pointsData.find(p => p.airport.code === destination);

    if (originAirport && destAirport && globeRef.current) {
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

  // Handle clicking on a country in the stats panel
  const handleCountryClick = useCallback((countryCode: string) => {
    stopAutoRotate();
    const countryAirports = pointsData.filter(p => p.airport.country === countryCode);

    if (countryAirports.length > 0 && globeRef.current) {
      if (countryAirports.length === 1) {
        globeRef.current.pointOfView({
          lat: countryAirports[0].lat,
          lng: countryAirports[0].lng,
          altitude: 0.5
        }, 1000);
      } else {
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

  // Handle clicking on a region in the stats panel
  const handleRegionClick = useCallback((regionCode: string) => {
    stopAutoRotate();
    const regionAirports = pointsData.filter(p => p.airport.region === regionCode);

    if (regionAirports.length > 0 && globeRef.current) {
      if (regionAirports.length === 1) {
        globeRef.current.pointOfView({
          lat: regionAirports[0].lat,
          lng: regionAirports[0].lng,
          altitude: 0.5
        }, 1000);
      } else {
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

  const hasNoResults = !loading && flightStats.totalFlights === 0 && (selectedYear !== null || selectedAirline !== null);

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
            airports={pointsData}
            onAirportSelect={handleAirportCodeClick}
          />
        )}
        {flightStats.years.length === 0 && <div />}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-white/70 text-lg">Loading flights...</div>
        </div>
      )}

      {/* Empty State */}
      {hasNoResults && (
        <EmptyState
          selectedYear={selectedYear}
          selectedAirline={selectedAirline}
          selectedAirport={selectedAirport}
          onClearFilters={clearAllFilters}
        />
      )}

      <Globe
        ref={globeRef}
        globeImageUrl={GLOBE_IMAGE}
        bumpImageUrl={BUMP_IMAGE}
        backgroundColor="rgba(0,0,17,1)"
        atmosphereColor="lightskyblue"
        atmosphereAltitude={0.15}
        onGlobeReady={() => {
          if (globeRef.current) {
            globeRef.current.pointOfView({ lat: 39.8283, lng: -98.5795, altitude: 2.5 }, 0);
            const controls = globeRef.current.controls();
            if (controls) {
              controls.autoRotate = !prefersReducedMotion;
              controls.autoRotateSpeed = -0.5;
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
        arcsTransitionDuration={prefersReducedMotion ? 0 : 800}
        onArcHover={(arc: object | null) => {
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

      {/* Color Mode Selector with Legend */}
      <ColorModeSelector
        mode={colorMode}
        onModeChange={setColorMode}
        years={flightStats.years}
      />

      {/* Bottom Stats Bar */}
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
          {/* Help hint */}
          <span className="text-gray-600 hidden lg:inline">•</span>
          <span className="text-gray-500 hidden lg:inline text-xs">Press H for help</span>
        </div>
      </div>

      {/* Hover info - hidden on small screens */}
      {(hoveredStaticArc || hoveredPoint) && (
        <div className="hidden sm:block absolute bottom-16 right-4 bg-gray-900/80 backdrop-blur px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 max-w-xs">
          {hoveredStaticArc && (
            <div>
              <span className="text-purple-300">
                {hoveredStaticArc.flights[0]?.origin_code} ↔ {hoveredStaticArc.flights[0]?.destination_code}
              </span>
              {hoveredStaticArc.routeCount > 1 && (
                <span className="text-gray-500 ml-2">({hoveredStaticArc.routeCount} flights)</span>
              )}
            </div>
          )}
          {hoveredPoint && `${hoveredPoint.airport.code}: ${hoveredPoint.airport.name}`}
        </div>
      )}

      {/* Keyboard Help Modal */}
      <KeyboardHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
