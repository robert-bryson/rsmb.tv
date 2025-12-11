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

// Custom hook for persisted state
function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setPersistedState = useCallback((value: T | ((prev: T) => T)) => {
    setState(prev => {
      const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  }, [key]);

  return [state, setPersistedState];
}

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
  const selectedRoute = searchParams.get('route') || null; // Format: "JFK-LAX"
  
  const [colorMode, setColorMode] = usePersistedState<ColorMode>('flights-color-mode', 'default');
  const [animationEnabled, setAnimationEnabled] = usePersistedState('flights-animation-enabled', true);
  const [showStats, setShowStats] = useStatsPanelState(false);
  const [hoveredStaticArc, setHoveredStaticArc] = useState<GlobeStaticArc | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null);
  const [autoRotate, setAutoRotate] = useState(false); // Start paused
  const [mobileInfoArc, setMobileInfoArc] = useState<GlobeStaticArc | null>(null); // For mobile tap-to-show
  const [copiedUrl, setCopiedUrl] = useState(false);
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
      // Clear route selection when selecting an airport
      newParams.delete('route');
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

  const setSelectedRoute = useCallback((route: string | null) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (route === null) {
        newParams.delete('route');
      } else {
        newParams.set('route', route);
      }
      // Clear airport selection when selecting a route
      newParams.delete('airport');
      return newParams;
    });
  }, [setSearchParams]);

  const clearAllFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  // Set initial view centered on USA and disable rotation initially
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 39.8283, lng: -98.5795, altitude: 2.0 }, 0);
      // Explicitly disable auto-rotation on mount
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = false;
      }
    }
  }, []);

  // Check if any URL filters are active (don't auto-rotate if user came via direct link)
  const hasUrlFilters = selectedYear !== null || selectedAirport !== null || selectedAirline !== null || selectedRoute !== null;

  // Start auto-rotation after a delay (gives user time to explore first)
  // Skip if user prefers reduced motion, has interacted, or came via filtered URL
  useEffect(() => {
    // Don't start rotation if user came via a filtered URL
    if (hasUrlFilters || prefersReducedMotion) {
      return;
    }
    
    const rotationDelay = 12000; // 12 seconds before starting rotation
    const timer = setTimeout(() => {
      if (!hasInteracted.current) {
        setAutoRotate(true);
      }
    }, rotationDelay);
    return () => clearTimeout(timer);
  }, [hasUrlFilters, prefersReducedMotion]);

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

  // Create a set of valid airport codes for clickable validation
  const validAirportCodes = useMemo(() => {
    return new Set(pointsData.map(p => p.airport.code));
  }, [pointsData]);

  // Reset view callback for keyboard shortcuts
  const resetView = useCallback(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 39.8283, lng: -98.5795, altitude: 2.0 }, 1000);
    }
  }, []);

  // Share URL handler
  const handleShareUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
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
      setSelectedRoute(null);
      setShowStats(false);
    },
    onColorModeChange: (modeIndex) => {
      if (modeIndex >= 0 && modeIndex < COLOR_MODES.length) {
        setColorMode(COLOR_MODES[modeIndex]);
      }
    },
  });

  // Parse selected route into origin/destination codes
  const selectedRouteAirports = useMemo(() => {
    if (!selectedRoute) return null;
    const [origin, destination] = selectedRoute.split('-');
    return { origin, destination };
  }, [selectedRoute]);

  // Combine static arcs and animated arcs (keep stable - don't depend on selection state)
  const combinedArcsData = useMemo(() => {
    // Disable animation if user prefers reduced motion or has disabled it
    const shouldAnimate = animationEnabled && !prefersReducedMotion;
    const animatedArcs = arcsData.map(arc => ({
      ...arc,
      isStatic: false,
      animateTime: shouldAnimate ? arc.animateTime : 0,
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
  }, [staticArcsData, arcsData, prefersReducedMotion, animationEnabled]);

  // Memoize arc styling based on selection - pre-compute colors and strokes
  const arcStyles = useMemo(() => {
    const styles = new Map<string, { color: string; stroke: number }>();
    combinedArcsData.forEach(arc => {
      const routeKey = (arc as GlobeArc & { routeKey?: string }).routeKey;
      const isStatic = (arc as GlobeArc & { isStatic?: boolean }).isStatic;
      if (!isStatic || !routeKey) return;
      
      if (!selectedRoute) {
        styles.set(routeKey, { color: arc.color as string, stroke: arc.stroke });
      } else if (routeKey === selectedRoute) {
        styles.set(routeKey, { color: 'rgba(255, 200, 50, 0.95)', stroke: 1.5 });
      } else {
        styles.set(routeKey, { color: 'rgba(100, 100, 120, 0.3)', stroke: 0.3 });
      }
    });
    return styles;
  }, [combinedArcsData, selectedRoute]);

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

  // Static arc click - zoom to fit the entire route and select it
  const handleStaticArcClick = useCallback((arc: GlobeStaticArc) => {
    stopAutoRotate();
    
    // If clicking the same route, deselect; otherwise select the new route
    const newRoute = selectedRoute === arc.routeKey ? null : arc.routeKey;
    setSelectedRoute(newRoute);
    
    if (globeRef.current && newRoute) {
      const midLat = (arc.startLat + arc.endLat) / 2;
      const midLng = (arc.startLng + arc.endLng) / 2;
      const latDiff = Math.abs(arc.startLat - arc.endLat);
      const lngDiff = Math.abs(arc.startLng - arc.endLng);
      const adjustedLngDiff = lngDiff > 180 ? 360 - lngDiff : lngDiff;
      const maxDiff = Math.max(latDiff, adjustedLngDiff);
      const altitude = Math.min(2.0, Math.max(0.6, maxDiff / 70));

      globeRef.current.pointOfView({ lat: midLat, lng: midLng, altitude }, 1000);
    }
  }, [stopAutoRotate, selectedRoute, setSelectedRoute]);

  // Point click - fly to airport showing all its routes, and toggle selection
  const handlePointClick = useCallback((point: GlobePoint) => {
    stopAutoRotate();
    
    const newSelection = selectedAirport === point.airport.code ? null : point.airport.code;
    setSelectedAirport(newSelection);
    
    if (newSelection && globeRef.current) {
      // Find all connected airports to calculate bounds
      const connectedAirports = staticArcsData
        .filter(arc => {
          const flights = arc.flights;
          if (!flights || flights.length === 0) return false;
          return flights.some(f => 
            f.origin_code === newSelection || f.destination_code === newSelection
          );
        })
        .flatMap(arc => {
          const f = arc.flights[0];
          return f.origin_code === newSelection 
            ? [{ lat: f.destination_lat, lng: f.destination_lon }]
            : [{ lat: f.origin_lat, lng: f.origin_lon }];
        });
      
      if (connectedAirports.length > 0) {
        // Calculate bounds including the selected airport and all connections
        let minLat = point.lat, maxLat = point.lat;
        let minLng = point.lng, maxLng = point.lng;
        
        connectedAirports.forEach(({ lat, lng }) => {
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        });
        
        // Center on the selected airport, but zoom out to show connections
        const latSpan = maxLat - minLat;
        const lngSpan = maxLng - minLng;
        const adjustedLngSpan = lngSpan > 180 ? 360 - lngSpan : lngSpan;
        const maxSpan = Math.max(latSpan, adjustedLngSpan);
        const altitude = Math.min(2.5, Math.max(0.5, maxSpan / 45 + 0.3));
        
        globeRef.current.pointOfView({ lat: point.lat, lng: point.lng, altitude }, 1000);
      } else {
        // No connections, just zoom to the airport
        globeRef.current.pointOfView({ lat: point.lat, lng: point.lng, altitude: 0.5 }, 1000);
      }
    }
    
    if (newSelection) {
      setShowStats(true);
    } else {
      setShowStats(false);
    }
  }, [stopAutoRotate, selectedAirport, setSelectedAirport, setShowStats, staticArcsData]);

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

      {/* Selected Route Indicator - small chip at top */}
      {selectedRoute && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => setSelectedRoute(null)}
            className="bg-gray-900/95 backdrop-blur px-3 py-1.5 rounded-full border border-yellow-500/50 text-sm flex items-center gap-2 shadow-lg hover:bg-gray-800/95 transition-colors"
            title="Click to clear selection (Esc)"
          >
            <span className="text-yellow-400 font-medium">
              {selectedRoute.replace('-', ' ↔ ')}
            </span>
            <span className="text-gray-500">✕</span>
          </button>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          {/* Skeleton globe */}
          <div className="relative">
            <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse border border-gray-700/50 shadow-2xl shadow-blue-500/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl mb-2">🌍</div>
                <div className="text-white/70 text-sm">Loading flights...</div>
              </div>
            </div>
            {/* Fake route lines */}
            <div className="absolute top-1/4 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent animate-pulse" />
            <div className="absolute top-1/2 left-1/3 w-1/3 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent animate-pulse" style={{ transform: 'rotate(-30deg)' }} />
          </div>
        </div>
      )}

      {/* Control buttons - Bottom right */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
        {/* Reset View */}
        <button
          onClick={resetView}
          className="bg-gray-900/90 backdrop-blur p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800/90 transition-colors"
          title="Reset view (R)"
          aria-label="Reset globe view to default position"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v5h5" />
          </svg>
        </button>
        
        {/* Animation Toggle */}
        <button
          onClick={() => setAnimationEnabled(prev => !prev)}
          className={`bg-gray-900/90 backdrop-blur p-2 rounded-lg border transition-colors ${
            animationEnabled 
              ? 'border-purple-500/50 text-purple-400 hover:bg-purple-900/30' 
              : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-800/90'
          }`}
          title={animationEnabled ? 'Pause animations' : 'Play animations'}
          aria-label={animationEnabled ? 'Pause flight animations' : 'Play flight animations'}
          aria-pressed={animationEnabled}
        >
          {animationEnabled ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        
        {/* Share URL */}
        <button
          onClick={handleShareUrl}
          className={`bg-gray-900/90 backdrop-blur p-2 rounded-lg border transition-colors ${
            copiedUrl
              ? 'border-green-500/50 text-green-400'
              : 'border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800/90'
          }`}
          title={copiedUrl ? 'URL copied!' : 'Copy URL to share'}
          aria-label="Copy current view URL to clipboard"
        >
          {copiedUrl ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          )}
        </button>
      </div>

      {/* Empty State */}
      {hasNoResults && (
        <EmptyState
          selectedYear={selectedYear}
          selectedAirline={selectedAirline}
          selectedAirport={selectedAirport}
          onClearFilters={clearAllFilters}
        />
      )}

      {/* Globe Container with ARIA */}
      <div
        role="application"
        aria-label={`Interactive 3D globe showing ${flightStats.totalFlights} flights across ${flightStats.totalAirports} airports. Click and drag to rotate, scroll to zoom, click on routes or airports for details.`}
        className="flex-1"
      >
        <Globe
          ref={globeRef}
          globeImageUrl={GLOBE_IMAGE}
          bumpImageUrl={BUMP_IMAGE}
          backgroundColor="rgba(0,0,17,1)"
          atmosphereColor="lightskyblue"
          atmosphereAltitude={0.15}
          lineHoverPrecision={1} // Make thin lines easier to click/hover
          onGlobeReady={() => {
          if (globeRef.current) {
            globeRef.current.pointOfView({ lat: 39.8283, lng: -98.5795, altitude: 2.0 }, 0);
            const controls = globeRef.current.controls();
            if (controls) {
              // Start with rotation disabled - it will be enabled after a delay
              controls.autoRotate = false;
              controls.autoRotateSpeed = -0.2;
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
        arcColor={(d: object) => {
          const arc = d as GlobeArc & { color: string; routeKey?: string; isStatic?: boolean };
          if (!arc.isStatic) return arc.color; // Animated arcs keep their color
          const style = arc.routeKey ? arcStyles.get(arc.routeKey) : null;
          return style?.color ?? arc.color;
        }}
        arcAltitudeAutoScale={0.3}
        arcStroke={(d: object) => {
          const arc = d as GlobeArc & { stroke: number; routeKey?: string; isStatic?: boolean };
          if (!arc.isStatic) return arc.stroke; // Animated arcs keep their stroke
          const style = arc.routeKey ? arcStyles.get(arc.routeKey) : null;
          return style?.stroke ?? arc.stroke;
        }}
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
            // On mobile, show info panel first; on desktop, select directly
            const isMobile = window.matchMedia('(max-width: 640px)').matches;
            if (isMobile && !selectedRoute) {
              setMobileInfoArc(arcData as GlobeStaticArc);
            } else {
              handleStaticArcClick(arcData as GlobeStaticArc);
            }
          }
        }}
        arcLabel={(d: object) => {
          const arcData = d as GlobeStaticArc & { isStatic?: boolean };
          if (!arcData.isStatic || !arcData.flights) return '';
          const firstFlight = arcData.flights[0];
          const isSelected = selectedRoute === arcData.routeKey;
          
          // Basic tooltip for non-selected routes
          if (!isSelected) {
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
                <div class="text-gray-600 text-xs mt-2 italic">Click for details</div>
              </div>
            `;
          }
          
          // Expanded tooltip for selected route
          const airlines = [...new Set(arcData.flights.map((f: { airline: string }) => f.airline))];
          const years = [...new Set(arcData.flights.map((f: { date: string }) => f.date.split('-')[0]))].sort();
          const allDates = arcData.flights.map((f: { date: string }) => f.date).sort().reverse();
          
          return `
            <div class="bg-gray-900/95 px-4 py-3 rounded-lg shadow-xl border border-yellow-500/50 text-sm min-w-64">
              <div class="font-bold text-yellow-400 text-base">${firstFlight.origin_code} ↔ ${firstFlight.destination_code}</div>
              <div class="text-gray-300 text-xs mt-1">${firstFlight.origin_name}</div>
              <div class="text-gray-400 text-xs">↕</div>
              <div class="text-gray-300 text-xs">${firstFlight.destination_name}</div>
              
              <div class="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <div class="text-gray-500 text-xs">Total Flights</div>
                  <div class="text-yellow-400 font-semibold">${arcData.routeCount}</div>
                </div>
                <div>
                  <div class="text-gray-500 text-xs">Years Active</div>
                  <div class="text-gray-300">${years.length > 3 ? years[0] + '–' + years[years.length-1] : years.join(', ')}</div>
                </div>
                <div>
                  <div class="text-gray-500 text-xs">Airlines</div>
                  <div class="text-orange-400">${airlines.slice(0, 3).join(', ')}${airlines.length > 3 ? '...' : ''}</div>
                </div>
                <div>
                  <div class="text-gray-500 text-xs">Last Flight</div>
                  <div class="text-gray-300">${allDates[0]}</div>
                </div>
              </div>
              
              <div class="mt-3 pt-3 border-t border-gray-700">
                <div class="text-gray-500 text-xs mb-1">All Flights</div>
                <div class="text-gray-400 text-xs max-h-24 overflow-y-auto">
                  ${allDates.join(', ')}
                </div>
              </div>
              
              <div class="text-gray-600 text-xs mt-3 italic">Click to deselect • Esc to clear</div>
            </div>
          `;
        }}
        // Points (airports)
        pointsData={pointsData}
        pointLat={(d: object) => (d as GlobePoint).lat}
        pointLng={(d: object) => (d as GlobePoint).lng}
        pointColor={(d: object) => {
          const point = d as GlobePoint;
          if (selectedRouteAirports) {
            const isRouteEndpoint = point.airport.code === selectedRouteAirports.origin || 
                                    point.airport.code === selectedRouteAirports.destination;
            if (isRouteEndpoint) return 'rgba(255, 200, 50, 1)'; // Bright gold for route endpoints
            return 'rgba(100, 100, 120, 0.4)'; // Dim other airports
          }
          return point.color;
        }}
        pointAltitude={(d: object) => {
          const point = d as GlobePoint;
          if (selectedRouteAirports) {
            const isRouteEndpoint = point.airport.code === selectedRouteAirports.origin || 
                                    point.airport.code === selectedRouteAirports.destination;
            if (isRouteEndpoint) return 0.05; // Raise route endpoints higher
          }
          return 0.015;
        }}
        pointRadius={(d: object) => {
          const point = d as GlobePoint;
          if (selectedRouteAirports) {
            const isRouteEndpoint = point.airport.code === selectedRouteAirports.origin || 
                                    point.airport.code === selectedRouteAirports.destination;
            if (isRouteEndpoint) return point.size * 2; // Bigger for route endpoints
            return point.size * 0.6; // Smaller for others
          }
          return point.size;
        }}
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
          setSelectedRoute(null);
          setShowStats(false);
        }}
      />
      </div>

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
        validAirportCodes={validAirportCodes}
      />

      {/* Color Mode Selector with Legend */}
      <ColorModeSelector
        mode={colorMode}
        onModeChange={setColorMode}
        years={flightStats.years}
      />

      {/* Bottom Stats Bar */}
      <div 
        className="absolute bottom-4 left-4 right-20 sm:right-auto bg-gray-900/80 backdrop-blur px-3 sm:px-4 py-2 sm:py-3 rounded-lg border border-gray-700 text-xs sm:text-sm"
        role="status"
        aria-live="polite"
      >
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
          <span className="text-gray-600 hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            <span className="text-green-300 font-semibold">{flightStats.totalDistance.toLocaleString()}</span>
            <span> km</span>
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

      {/* Mobile tap info overlay */}
      {mobileInfoArc && (
        <div 
          className="sm:hidden fixed inset-x-4 bottom-20 z-30"
          role="dialog"
          aria-label="Route information"
        >
          <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-4 shadow-xl">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-purple-300 font-bold text-lg">
                  {mobileInfoArc.flights[0]?.origin_code} ↔ {mobileInfoArc.flights[0]?.destination_code}
                </div>
                <div className="text-gray-400 text-sm">
                  {mobileInfoArc.routeCount} flight{mobileInfoArc.routeCount !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                onClick={() => setMobileInfoArc(null)}
                className="text-gray-500 hover:text-white p-1"
                aria-label="Close route information"
              >
                ✕
              </button>
            </div>
            <div className="text-gray-300 text-sm space-y-1">
              <div>{mobileInfoArc.flights[0]?.origin_name}</div>
              <div className="text-gray-500">↕</div>
              <div>{mobileInfoArc.flights[0]?.destination_name}</div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
              Dates: {mobileInfoArc.flights.slice(0, 3).map(f => f.date).join(', ')}
              {mobileInfoArc.flights.length > 3 && '...'}
            </div>
            <button
              onClick={() => {
                handleStaticArcClick(mobileInfoArc);
                setMobileInfoArc(null);
              }}
              className="mt-3 w-full bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 py-2 rounded-lg text-sm transition-colors"
            >
              Select this route
            </button>
          </div>
        </div>
      )}

      {/* Hover info - hidden on small screens */}
      {(hoveredStaticArc || hoveredPoint) && (
        <div 
          className="hidden sm:block absolute bottom-16 right-4 bg-gray-900/80 backdrop-blur px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 max-w-xs"
          role="tooltip"
        >
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
