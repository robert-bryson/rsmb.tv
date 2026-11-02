import { useRef, useCallback, useState, useMemo, useEffect, type SyntheticEvent } from 'react';
import type { GlobeMethods } from 'react-globe.gl';
import { FlightsGlobe } from './FlightsGlobe';
import { useFlightMapLayers } from '../hooks/useFlightMapLayers';
import { CARTO_API_KEY } from '../../../maps/cartoBasemaps';
import { useGlobeData, useFlights } from '../hooks/useFlightData';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useYearSwipeNavigation } from '../hooks/useSwipeGesture';
import { useZoomNavigation } from '../hooks/useZoomNavigation';
import { useFlightsFilters } from '../hooks/useFlightsFilters';
import { useSelectionInfo } from '../hooks/useSelectionInfo';
import { StatsPanel } from './StatsPanel';
import { KeyboardHelp } from './KeyboardHelp';
import { EmptyState } from './EmptyState';
import { GlobeErrorBoundary } from './GlobeErrorBoundary';
import { GlobeLoadingOverlay } from './GlobeLoadingOverlay';
import { useGlobeTextures } from '../hooks/useGlobeTextures';
import { SkipLink } from './SkipLink';
import { TopNavigationBar } from './TopNavigationBar';
import { ControlButtons } from './ControlButtons';
import { BottomStatsBar } from './BottomStatsBar';
import { ActiveFilterChips } from './ActiveFilterChips';
import { SelectedRouteIndicator } from './SelectedRouteIndicator';
import { MobileInfoOverlay } from './MobileInfoOverlay';
import { HoverInfo } from './HoverInfo';
import { LoadingSkeleton } from './LoadingSkeleton';
import { LayersControl } from './LayersControl';
import { getBasemap, VIEW_TRANSITION_MS, COPY_FEEDBACK_MS, COLOR_MODES } from '../constants';
import type { GlobePoint, GlobeStaticArc, GlobeViewState } from '../types';
import { globeViewsEqual } from '../utils/globeView';

export function FlightsMap() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const prefersReducedMotion = useReducedMotion();

  // URL-driven app state
  const {
    selectedYear, selectedAirport, selectedAirline, selectedRoute,
    selectedCountry, selectedRegion, selectedFlightType, selectedGlobeView,
    selectedRouteAirports, showStats, filterOpen, layersOpen, activeLayerSection,
    showHelp, basemapId, colorMode, animationEnabled, showFlightPaths,
    globeRotationEnabled, allAirportsVisible, airportSymbolMode, usStatesVisible,
    stateSymbolMode, isMetric,
    setSelectedYear, setSelectedAirport, setSelectedAirline, setSelectedRoute,
    setSelectedCountry, setSelectedRegion, setSelectedFlightType, setSelectedGlobeView,
    setShowStats, setFilterOpen, setLayersOpen, setActiveLayerSection, setShowHelp,
    setBasemapId, setColorMode, setAnimationEnabled, setShowFlightPaths,
    setGlobeRotationEnabled, setAllAirportsVisible, setAirportSymbolMode,
    setUSStatesVisible, setStateSymbolMode, setIsMetric, clearAllFilters,
  } = useFlightsFilters();

  const basemap = useMemo(() => getBasemap(basemapId), [basemapId]);
  const textureState = useGlobeTextures(basemap);
  const yearFit = useRef({
    year: selectedYear, view: selectedGlobeView,
    pending: selectedYear !== null && !selectedGlobeView,
    requestedYear: null as number | null,
  });
  const handleNavigationViewChange = useCallback((view: GlobeViewState, options?: { replace?: boolean }) => {
    yearFit.current.pending = false;
    setSelectedGlobeView(view, options);
  }, [setSelectedGlobeView]);
  const { resetView, zoomToPoints, zoomToRoute, zoomToPoint, zoomToAirportWithConnections, navigationViewRef } = useZoomNavigation(globeRef, handleNavigationViewChange);
  const [hoveredRouteKey, setHoveredRouteKey] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null);
  const [mobileInfoRouteKey, setMobileInfoRouteKey] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const copyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyRequest = useRef(0);
  useEffect(() => () => {
    copyRequest.current++;
    if (copyFeedbackTimer.current !== null) clearTimeout(copyFeedbackTimer.current);
  }, []);
  const showCopiedFeedback = useCallback(() => {
    if (copyFeedbackTimer.current !== null) clearTimeout(copyFeedbackTimer.current);
    setCopiedUrl(true);
    copyFeedbackTimer.current = setTimeout(() => {
      copyFeedbackTimer.current = null;
      setCopiedUrl(false);
    }, COPY_FEEDBACK_MS);
  }, []);

  const stopGlobeRotation = useCallback(() => {
    setGlobeRotationEnabled(false);
  }, [setGlobeRotationEnabled]);

  const handleGlobeInteraction = useCallback(() => {
    yearFit.current.pending = false;
    stopGlobeRotation();
  }, [stopGlobeRotation]);

  const handleMapInteraction = useCallback((event: SyntheticEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('[data-globe-rotation-toggle]')) {
      return;
    }
    stopGlobeRotation();
  }, [stopGlobeRotation]);

  const handleToggleGlobeRotation = useCallback(() => {
    setGlobeRotationEnabled((enabled) => !enabled);
  }, [setGlobeRotationEnabled]);

  const handleResetView = useCallback(() => {
    stopGlobeRotation();
    resetView();
  }, [resetView, stopGlobeRotation]);

  const handleToggleAnimation = useCallback(() => {
    stopGlobeRotation();
    setAnimationEnabled((enabled) => !enabled);
  }, [setAnimationEnabled, stopGlobeRotation]);

  const { arcsData, staticArcsData, pointsData, flightStats, matchingFlights, loading, error } = useGlobeData({
    selectedYear,
    colorMode,
    selectedAirport,
    selectedAirline,
    selectedRoute,
    selectedCountry,
    selectedRegion,
    selectedFlightType,
  });

  // Resolve previews from current data so filters cannot retain stale counts or time.
  const hoveredStaticArc = staticArcsData.find(arc => arc.routeKey === hoveredRouteKey) ?? null;
  const mobileInfoArc = staticArcsData.find(arc => arc.routeKey === mobileInfoRouteKey) ?? null;

  const { data: flightsData } = useFlights();
  const layers = useFlightMapLayers({
    selectedAirport, selectedCountry, selectedRegion, selectedFlightType,
    allAirportsVisible, airportSymbolMode, usStatesVisible, stateSymbolMode,
    layersOpen, activeLayerSection, pointsData, staticArcsData, matchingFlights, flightsData,
  });
  const { validAirportCodes, airportNames, allAirportsData, allAirportsLoading,
    usStatesLoading, usStateStats } = layers;

  // Share URL handler
  const handleShareUrl = useCallback(async () => {
    stopGlobeRotation();
    const request = ++copyRequest.current;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      if (request !== copyRequest.current) return;
      showCopiedFeedback();
    } catch {
      if (request !== copyRequest.current) return;
      // Fallback: create a temporary input for older browsers
      const input = document.createElement('input');
      const previousFocus = document.activeElement;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      input.value = url;
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, input.value.length);
      // Note: document.execCommand is deprecated but serves as last-resort fallback
      try {
        if (document.execCommand('copy')) {
          showCopiedFeedback();
        } else {
          setCopiedUrl(false);
          window.prompt('Copy this URL:', input.value);
        }
      } catch {
        // If even execCommand fails, open a prompt with the URL
        setCopiedUrl(false);
        window.prompt('Copy this URL:', input.value);
      } finally {
        input.remove();
        if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
      }
    }
  }, [stopGlobeRotation, showCopiedFeedback]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleStats: () => setShowStats(prev => !prev),
    onToggleFilter: () => setFilterOpen(prev => !prev),
    onResetView: handleResetView,
    onClearSelection: () => {
      setSelectedAirport(null);
      setSelectedRoute(null);
      setSelectedCountry(null);
      setSelectedRegion(null);
      setSelectedFlightType(null);
      setShowStats(false);
      setFilterOpen(false);
    },
    onColorModeChange: (modeIndex) => {
      if (modeIndex >= 0 && modeIndex < COLOR_MODES.length) {
        setColorMode(COLOR_MODES[modeIndex]);
      }
    },
    onToggleAllAirports: () => setAllAirportsVisible(prev => !prev),
    onToggleUSStates: () => setUSStatesVisible(prev => !prev),
    onShortcut: stopGlobeRotation,
    showHelp,
    onHelpChange: setShowHelp,
  });

  // Derived selection info for stats panel
  const { selectedRouteInfo, selectedCountryInfo, selectedRegionInfo } = useSelectionInfo({
    selectedRoute,
    selectedCountry,
    selectedRegion,
    staticArcsData,
    pointsData,
    selectedAirport,
    selectedFlightType,
  });

  // Year change handler with zoom-to-fit
  const handleYearChange = useCallback((year: number | null) => {
    stopGlobeRotation();
    yearFit.current.requestedYear = year;
    setSelectedYear(year);
  }, [stopGlobeRotation, setSelectedYear]);

  // US States visibility handler - zoom to US when enabling
  const handleUSStatesVisibilityChange = useCallback((visible: boolean) => {
    setUSStatesVisible(visible);
    if (visible) {
      // Zoom to continental US view
      zoomToPoint({ lat: 39.8283, lng: -98.5795 }, 1.8, VIEW_TRANSITION_MS);
      stopGlobeRotation();
    }
  }, [setUSStatesVisible, stopGlobeRotation, zoomToPoint]);

  // Track every year, including empty years. A later camera navigation takes
  // precedence over any fit that is still waiting for data or its timer.
  useEffect(() => {
    const cameraChanged = !globeViewsEqual(selectedGlobeView, yearFit.current.view);
    if (yearFit.current.year !== selectedYear) {
      yearFit.current.pending = selectedYear !== null
        && (yearFit.current.requestedYear === selectedYear || selectedGlobeView === null);
      yearFit.current.year = selectedYear;
      yearFit.current.requestedYear = null;
    } else if (cameraChanged) {
      yearFit.current.pending = false;
    }
    yearFit.current.view = selectedGlobeView;
    if (!yearFit.current.pending || loading) return;
    if (pointsData.length === 0) {
      yearFit.current.pending = false;
      return;
    }
    const timer = setTimeout(() => {
      if (!yearFit.current.pending) return;
      yearFit.current.pending = false;
      zoomToPoints(pointsData);
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedYear, selectedGlobeView, pointsData, loading, zoomToPoints]);

  // Static arc hover handler
  const handleStaticArcHover = useCallback((arc: GlobeStaticArc | null) => {
    setHoveredRouteKey(arc?.routeKey ?? null);
  }, []);

  // Point hover handler
  const handlePointHover = useCallback((point: GlobePoint | null) => {
    setHoveredPoint(point);
  }, []);

  // Static arc click - zoom to fit the entire route and select it
  const handleStaticArcClick = useCallback((arc: GlobeStaticArc) => {
    stopGlobeRotation();

    // If clicking the same route, deselect; otherwise select the new route
    const newRoute = selectedRoute === arc.routeKey ? null : arc.routeKey;
    setSelectedRoute(newRoute);

    if (newRoute) {
      zoomToRoute(
        { lat: arc.startLat, lng: arc.startLng },
        { lat: arc.endLat, lng: arc.endLng }
      );
      setShowStats(true);
    } else {
      setShowStats(false);
    }
  }, [stopGlobeRotation, selectedRoute, setSelectedRoute, zoomToRoute, setShowStats]);

  // Point click - fly to airport showing all its routes, and toggle selection
  const handlePointClick = useCallback((point: GlobePoint) => {
    stopGlobeRotation();

    const newSelection = selectedAirport === point.airport.code ? null : point.airport.code;
    setSelectedAirport(newSelection);

    if (newSelection) {
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

      zoomToAirportWithConnections(point, connectedAirports);
      setShowStats(true);
    } else {
      setShowStats(false);
    }
  }, [stopGlobeRotation, selectedAirport, setSelectedAirport, setShowStats, staticArcsData, zoomToAirportWithConnections]);

  // Handle clicking on an airport code in the stats panel
  const handleAirportCodeClick = useCallback((code: string) => {
    stopGlobeRotation();
    const airport = pointsData.find(p => p.airport.code === code);
    if (airport) {
      zoomToPoint(airport, 0.5);
    }
    setSelectedAirport(code);
    setShowStats(true);
  }, [stopGlobeRotation, pointsData, setSelectedAirport, setShowStats, zoomToPoint]);

  // Handle clicking on a route in the stats panel
  const handleRouteCodeClick = useCallback((origin: string, destination: string) => {
    stopGlobeRotation();
    const originAirport = pointsData.find(p => p.airport.code === origin);
    const destAirport = pointsData.find(p => p.airport.code === destination);

    if (originAirport && destAirport) {
      zoomToRoute(originAirport, destAirport, { divisor: 60 });
    }
  }, [stopGlobeRotation, pointsData, zoomToRoute]);

  // Handle clicking on a country in the stats panel
  const handleCountryClick = useCallback((countryCode: string) => {
    stopGlobeRotation();
    setSelectedCountry(countryCode);
    const countryAirports = pointsData.filter(p => p.airport.country === countryCode);
    if (countryAirports.length > 0) {
      zoomToPoints(countryAirports);
    }
    setShowStats(true);
  }, [stopGlobeRotation, pointsData, zoomToPoints, setSelectedCountry, setShowStats]);

  // Handle clicking on a region in the stats panel
  const handleRegionClick = useCallback((regionCode: string) => {
    stopGlobeRotation();
    setSelectedRegion(regionCode);
    const regionAirports = pointsData.filter(p => p.airport.region === regionCode);
    if (regionAirports.length > 0) {
      zoomToPoints(regionAirports);
    }
    setShowStats(true);
  }, [stopGlobeRotation, pointsData, zoomToPoints, setSelectedRegion, setShowStats]);

  // Swipe navigation for year changes on mobile
  const swipeRef = useYearSwipeNavigation(flightStats.years, selectedYear, handleYearChange);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-md mx-4 text-center">
          <div className="text-4xl mb-4">🌍</div>
          <h2 className="text-white font-semibold text-lg mb-2">
            Unable to load flight data
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            There was a problem fetching the flight data. Check your connection and try again.
          </p>
          <details className="text-left mb-4">
            <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-400">
              Technical details
            </summary>
            <pre className="mt-2 p-2 bg-gray-900 rounded text-red-400 text-xs overflow-auto max-h-24">
              {error.message}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  const hasNoResults = !loading && flightStats.totalFlights === 0 && (selectedYear !== null || selectedAirline !== null);

  return (
    <div
      ref={swipeRef}
      className="relative w-full h-full bg-[#000011] flex flex-col"
      onPointerDownCapture={handleMapInteraction}
      onTouchStartCapture={handleMapInteraction}
      onWheelCapture={handleMapInteraction}
      onKeyDownCapture={handleMapInteraction}
    >
      {/* Skip link for keyboard accessibility */}
      <SkipLink />

      {/* Texture loading overlay */}
      {(textureState.isLoading || textureState.error) && (
        <GlobeLoadingOverlay
          progress={textureState.progress}
          error={textureState.error}
          onRetry={textureState.retry}
        />
      )}

      {/* Top Navigation Bar */}
      {basemap.tiles && (
        <div className="absolute bottom-0 left-4 z-10 bg-gray-900/90 px-2 text-[10px] text-gray-300">
          © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attribution/">CARTO</a>
          {!CARTO_API_KEY && ' · Basemap unavailable'}
        </div>
      )}
      <TopNavigationBar
        years={flightStats.years}
        selectedYear={selectedYear}
        onYearChange={handleYearChange}
        flightCount={flightsData?.features.length ?? 0}
        filterOpen={filterOpen}
        onFilterOpenChange={setFilterOpen}
        airports={pointsData}
        onAirportSelect={handleAirportCodeClick}
        layerControls={
          <LayersControl
            basemapId={basemapId}
            onBasemapChange={setBasemapId}
            allAirportsVisible={allAirportsVisible}
            onAllAirportsVisibilityChange={setAllAirportsVisible}
            airportSymbolMode={airportSymbolMode}
            onAirportSymbolModeChange={setAirportSymbolMode}
            airportsMetadata={allAirportsData?.metadata}
            airportsLoading={allAirportsLoading}
            showFlightPaths={showFlightPaths}
            onShowFlightPathsChange={setShowFlightPaths}
            colorMode={colorMode}
            onColorModeChange={setColorMode}
            years={flightStats.years}
            usStatesVisible={usStatesVisible}
            onUSStatesVisibilityChange={handleUSStatesVisibilityChange}
            stateSymbolMode={stateSymbolMode}
            onStateSymbolModeChange={setStateSymbolMode}
            stateStats={usStateStats}
            statesLoading={usStatesLoading}
            isOpen={layersOpen}
            onOpenChange={setLayersOpen}
            activeSection={activeLayerSection}
            onActiveSectionChange={setActiveLayerSection}
          />
        }
      />

      {/* Selected Route Indicator */}
      {selectedRoute && (
        <SelectedRouteIndicator
          route={selectedRoute}
          onClear={() => setSelectedRoute(null)}
        />
      )}

      {loading && <LoadingSkeleton />}

      {/* Control buttons - Bottom right */}
      <ControlButtons
        onResetView={handleResetView}
        animationEnabled={animationEnabled}
        onToggleAnimation={handleToggleAnimation}
        globeRotationEnabled={globeRotationEnabled}
        onToggleGlobeRotation={handleToggleGlobeRotation}
        globeRotationDisabled={prefersReducedMotion}
        onShareUrl={handleShareUrl}
        copiedUrl={copiedUrl}
      />

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
      <GlobeErrorBoundary>
        <div
          role="application"
          aria-label={`Interactive 3D globe showing ${flightStats.totalFlights} flights across ${flightStats.totalAirports} airports. Click and drag to rotate, scroll to zoom, click on routes or airports for details.`}
          className="flights-globe relative z-0 flex-1"
          data-skip-target="globe"
        >
          <FlightsGlobe
            key={textureState.attempt}
            globeRef={globeRef}
            navigationViewRef={navigationViewRef}
            basemap={basemap}
            selectedView={selectedGlobeView}
            globeRotationEnabled={globeRotationEnabled}
            prefersReducedMotion={prefersReducedMotion}
            animationEnabled={animationEnabled}
            showFlightPaths={showFlightPaths}
            isMetric={isMetric}
            selection={{ selectedRoute, selectedRouteAirports, selectedCountry, selectedRegion, selectedFlightType }}
            arcsData={arcsData}
            staticArcsData={staticArcsData}
            layers={layers}
            onViewChange={setSelectedGlobeView}
            onStopRotation={handleGlobeInteraction}
            onRouteHover={handleStaticArcHover}
            onRouteClick={(arc) => {
              if (window.matchMedia('(max-width: 640px)').matches && !selectedRoute) {
                setMobileInfoRouteKey(arc.routeKey);
              } else {
                handleStaticArcClick(arc);
              }
            }}
            onPointHover={handlePointHover}
            onPointClick={handlePointClick}
            onBackgroundClick={() => {
              stopGlobeRotation();
              setSelectedAirport(null);
              setSelectedRoute(null);
              setSelectedCountry(null);
              setSelectedRegion(null);
              setSelectedFlightType(null);
              setShowStats(false);
            }}
          />
        </div>
      </GlobeErrorBoundary>

      {/* Stats Panel */}
      <StatsPanel
        stats={flightStats}
        isOpen={showStats}
        onToggle={() => setShowStats(!showStats)}
        selectedYear={selectedYear}
        onClearAirport={() => {
          setSelectedAirport(null);
        }}
        selectedAirline={selectedAirline}
        onAirlineSelect={setSelectedAirline}
        selectedFlightType={selectedFlightType}
        onFlightTypeSelect={(flightType) => {
          stopGlobeRotation();
          setSelectedFlightType(flightType);
        }}
        onAirportClick={handleAirportCodeClick}
        onRouteClick={handleRouteCodeClick}
        onCountryClick={handleCountryClick}
        onRegionClick={handleRegionClick}
        validAirportCodes={validAirportCodes}
        airportNames={airportNames}
        selectedRouteInfo={selectedRouteInfo}
        onClearRoute={() => {
          setSelectedRoute(null);
        }}
        selectedCountryInfo={selectedCountryInfo}
        onClearCountry={() => {
          setSelectedCountry(null);
        }}
        selectedRegionInfo={selectedRegionInfo}
        onClearRegion={() => {
          setSelectedRegion(null);
        }}
        isMetric={isMetric}
      />
      {/* Active filter chips */}
      <ActiveFilterChips
        selectedYear={selectedYear}
        selectedAirport={selectedAirport}
        selectedAirline={selectedAirline}
        selectedRoute={selectedRoute}
        selectedCountry={selectedCountryInfo?.name ?? selectedCountry}
        selectedRegion={selectedRegionInfo?.name ?? selectedRegion}
        selectedFlightType={selectedFlightType}
        onClearYear={() => setSelectedYear(null)}
        onClearAirport={() => setSelectedAirport(null)}
        onClearAirline={() => setSelectedAirline(null)}
        onClearRoute={() => setSelectedRoute(null)}
        onClearCountry={() => setSelectedCountry(null)}
        onClearRegion={() => setSelectedRegion(null)}
        onClearFlightType={() => setSelectedFlightType(null)}
      />

      {/* Bottom Stats Bar */}
      <BottomStatsBar
        totalFlights={flightStats.totalFlights}
        totalAirports={flightStats.totalAirports}
        totalDistance={flightStats.totalDistance}
        duration={flightStats.duration}
        selectedYear={selectedYear}
        selectedAirport={selectedAirport}
        selectedAirline={selectedAirline}
        selectedCountry={selectedCountryInfo?.name ?? selectedCountry}
        selectedRegion={selectedRegionInfo?.name ?? selectedRegion}
        selectedFlightType={selectedFlightType}
        isMetric={isMetric}
        onToggleUnits={() => setIsMetric(prev => !prev)}
      />

      {/* Mobile tap info overlay */}
      <MobileInfoOverlay
        arc={mobileInfoArc}
        onClose={() => setMobileInfoRouteKey(null)}
        onSelect={(arc) => {
          handleStaticArcClick(arc);
          setMobileInfoRouteKey(null);
        }}
      />

      {/* Hover info - hidden on small screens */}
      <HoverInfo
        hoveredArc={hoveredStaticArc}
        hoveredPoint={hoveredPoint}
      />

      {/* Keyboard Help Modal */}
      <KeyboardHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
