import { useRef, useCallback, useState, useMemo, useEffect, type SyntheticEvent } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { useGlobeData, useFlights } from '../hooks/useFlightData';
import { useAllAirports, useAllAirportsLayer } from '../hooks/useAllAirports';
import { useUSStates, useUSStateStats, useUSStatesLayer } from '../hooks/useUSStates';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useYearSwipeNavigation } from '../hooks/useSwipeGesture';
import { useZoomNavigation } from '../hooks/useZoomNavigation';
import { useFlightsFilters } from '../hooks/useFlightsFilters';
import { useSelectionInfo } from '../hooks/useSelectionInfo';
import { StatsPanel } from './StatsPanel';
// ColorModeSelector is now integrated into LayersControl
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
import { buildArcLabelHtml, buildPointLabelHtml, buildStatePolygonLabelHtml } from '../utils/tooltipHtml';
import { flightMatchesType, getFlightTypeColor } from '../utils';
import {
  getBasemap,
  DEFAULT_VIEW,
  AUTO_ROTATION_SPEED,
  VIEW_TRANSITION_MS,
  COPY_FEEDBACK_MS,
  ARC_ALTITUDE_AUTOSCALE,
  LINE_HOVER_PRECISION,
  ATMOSPHERE_ALTITUDE,
  POINT_ALTITUDE,
  SELECTED_POINT_ALTITUDE,
  LABEL_ALTITUDE,
  LABEL_MIN_VISITS,
  COLOR_MODES,
  ALL_AIRPORTS_POINT_ALTITUDE,
  ALL_AIRPORTS_POINT_SIZE,
  STATE_POLYGON_ALTITUDE,
  STATE_POLYGON_SIDE_COLOR,
  DBLCLICK_ZOOM_FACTOR,
  ZOOM_ALTITUDE_MIN,
} from '../constants';
import type { GlobeArc, GlobePoint, GlobeStaticArc, GlobeAllAirportPoint, GlobeStatePolygon, GlobeViewState } from '../types';


export function FlightsMap() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const controlsRef = useRef<ReturnType<GlobeMethods['controls']> | null>(null);
  const cameraSyncTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const pendingCameraViewRef = useRef<GlobeViewState | null>(null);
  const suppressCameraSyncRef = useRef(false);
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
  const { resetView, zoomToPoints, zoomToRoute, zoomToPoint, zoomToAirportWithConnections } = useZoomNavigation(globeRef, setSelectedGlobeView);
  const urlGlobeLat = selectedGlobeView?.lat ?? DEFAULT_VIEW.lat;
  const urlGlobeLng = selectedGlobeView?.lng ?? DEFAULT_VIEW.lng;
  const urlGlobeAltitude = selectedGlobeView?.altitude ?? DEFAULT_VIEW.altitude;

  const [hoveredStaticArc, setHoveredStaticArc] = useState<GlobeStaticArc | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null);
  const [mobileInfoArc, setMobileInfoArc] = useState<GlobeStaticArc | null>(null); // For mobile tap-to-show
  const [copiedUrl, setCopiedUrl] = useState(false);

  const clearScheduledGlobeViewSync = useCallback(() => {
    if (cameraSyncTimeoutRef.current !== null) {
      window.clearTimeout(cameraSyncTimeoutRef.current);
      cameraSyncTimeoutRef.current = null;
    }
    pendingCameraViewRef.current = null;
  }, []);

  const syncGlobeViewToUrl = useCallback((view: GlobeViewState) => {
    if (!view || !Number.isFinite(view.lat) || !Number.isFinite(view.lng) || !Number.isFinite(view.altitude)) return;
    setSelectedGlobeView({ lat: view.lat, lng: view.lng, altitude: view.altitude }, { replace: true });
  }, [setSelectedGlobeView]);

  const syncCurrentGlobeViewToUrl = useCallback(() => {
    clearScheduledGlobeViewSync();
    const view = globeRef.current?.pointOfView();
    if (!view) return;
    syncGlobeViewToUrl(view);
  }, [clearScheduledGlobeViewSync, syncGlobeViewToUrl]);

  const scheduleGlobeViewSync = useCallback((view?: GlobeViewState) => {
    if (suppressCameraSyncRef.current) return;
    if (view) {
      pendingCameraViewRef.current = view;
    }
    if (cameraSyncTimeoutRef.current !== null) {
      window.clearTimeout(cameraSyncTimeoutRef.current);
    }
    cameraSyncTimeoutRef.current = window.setTimeout(() => {
      cameraSyncTimeoutRef.current = null;
      const pendingView = pendingCameraViewRef.current;
      pendingCameraViewRef.current = null;
      if (pendingView) {
        syncGlobeViewToUrl(pendingView);
      } else {
        syncCurrentGlobeViewToUrl();
      }
    }, 250);
  }, [syncCurrentGlobeViewToUrl, syncGlobeViewToUrl]);

  const scheduleCurrentGlobeViewSync = useCallback(() => {
    scheduleGlobeViewSync();
  }, [scheduleGlobeViewSync]);

  const applyLinkedGlobeView = useCallback((view: GlobeViewState) => {
    if (!globeRef.current) return;
    clearScheduledGlobeViewSync();
    suppressCameraSyncRef.current = true;
    globeRef.current.pointOfView(view, 0);
    window.setTimeout(() => {
      suppressCameraSyncRef.current = false;
    }, 0);
  }, [clearScheduledGlobeViewSync]);

  const handleGlobeZoom = useCallback((view: GlobeViewState) => {
    scheduleGlobeViewSync(view);
  }, [scheduleGlobeViewSync]);

  // Set initial/share-linked view and disable globe rotation initially
  useEffect(() => {
    if (globeRef.current) {
      applyLinkedGlobeView({ lat: urlGlobeLat, lng: urlGlobeLng, altitude: urlGlobeAltitude });
      // Explicitly disable globe rotation on mount
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = false;
      }
    }
  }, [applyLinkedGlobeView, urlGlobeAltitude, urlGlobeLat, urlGlobeLng]);

  // Handle explicit globe rotation (disabled if user prefers reduced motion)
  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = globeRotationEnabled && !prefersReducedMotion;
        controls.autoRotateSpeed = AUTO_ROTATION_SPEED;
      }
    }
  }, [globeRotationEnabled, prefersReducedMotion]);

  const stopGlobeRotation = useCallback(() => {
    setGlobeRotationEnabled(false);
  }, [setGlobeRotationEnabled]);

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

  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current) return;

    applyLinkedGlobeView({ lat: urlGlobeLat, lng: urlGlobeLng, altitude: urlGlobeAltitude });
    const controls = globeRef.current.controls();
    if (!controls) return;

    controls.autoRotate = globeRotationEnabled && !prefersReducedMotion;
    controls.autoRotateSpeed = AUTO_ROTATION_SPEED;
    if (controlsRef.current && controlsRef.current !== controls) {
      controlsRef.current.removeEventListener('start', stopGlobeRotation);
      controlsRef.current.removeEventListener('end', syncCurrentGlobeViewToUrl);
      controlsRef.current.removeEventListener('change', scheduleCurrentGlobeViewSync);
    }
    controls.removeEventListener('start', stopGlobeRotation);
    controls.removeEventListener('end', syncCurrentGlobeViewToUrl);
    controls.removeEventListener('change', scheduleCurrentGlobeViewSync);
    controls.addEventListener('start', stopGlobeRotation);
    controls.addEventListener('end', syncCurrentGlobeViewToUrl);
    controls.addEventListener('change', scheduleCurrentGlobeViewSync);
    controlsRef.current = controls;
  }, [applyLinkedGlobeView, globeRotationEnabled, prefersReducedMotion, scheduleCurrentGlobeViewSync, stopGlobeRotation, syncCurrentGlobeViewToUrl, urlGlobeAltitude, urlGlobeLat, urlGlobeLng]);

  useEffect(() => {
    return () => {
      controlsRef.current?.removeEventListener('start', stopGlobeRotation);
      controlsRef.current?.removeEventListener('end', syncCurrentGlobeViewToUrl);
      controlsRef.current?.removeEventListener('change', scheduleCurrentGlobeViewSync);
      clearScheduledGlobeViewSync();
      controlsRef.current = null;
    };
  }, [clearScheduledGlobeViewSync, scheduleCurrentGlobeViewSync, stopGlobeRotation, syncCurrentGlobeViewToUrl]);

  // Double-click to zoom in toward clicked point
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const domEl = globe.renderer().domElement;
    const handler = (e: MouseEvent) => {
      stopGlobeRotation();
      let coords: { lat: number; lng: number } | null;
      try {
        coords = globe.toGlobeCoords(e.offsetX, e.offsetY) ?? null;
      } catch {
        coords = null;
      }
      const pov = globe.pointOfView();
      const newAltitude = Math.max(ZOOM_ALTITUDE_MIN, pov.altitude * DBLCLICK_ZOOM_FACTOR);
      const view = {
        lat: coords?.lat ?? pov.lat,
        lng: coords?.lng ?? pov.lng,
        altitude: newAltitude,
      };
      globe.pointOfView(view, VIEW_TRANSITION_MS);
      setSelectedGlobeView(view, { replace: true });
    };
    domEl.addEventListener('dblclick', handler);
    return () => domEl.removeEventListener('dblclick', handler);
  }, [setSelectedGlobeView, stopGlobeRotation]);

  const { arcsData, staticArcsData, pointsData, flightStats, loading, error } = useGlobeData({
    selectedYear,
    colorMode,
    selectedAirport,
    selectedAirline,
  });

  const flightTypeSelection = useMemo(() => {
    if (!selectedFlightType) return null;

    const routeKeys = new Set<string>();
    const airportCodes = new Set<string>();

    staticArcsData.forEach(arc => {
      const matchingFlights = arc.flights.filter(flight => flightMatchesType(flight, selectedFlightType));
      if (matchingFlights.length === 0) return;

      routeKeys.add(arc.routeKey);
      matchingFlights.forEach(flight => {
        airportCodes.add(flight.origin_code);
        airportCodes.add(flight.destination_code);
      });
    });

    return {
      routeKeys,
      airportCodes,
      color: getFlightTypeColor(selectedFlightType),
    };
  }, [selectedFlightType, staticArcsData]);

  // Create a set of valid airport codes for clickable validation
  const validAirportCodes = useMemo(() => {
    return new Set(pointsData.map(p => p.airport.code));
  }, [pointsData]);

  // Map of airport code -> name for tooltips in StatsPanel
  const airportNames = useMemo(() => {
    const map = new Map<string, string>();
    pointsData.forEach(p => map.set(p.airport.code, p.airport.name));
    return map;
  }, [pointsData]);

  // Optional layer data: defer larger payloads until a visible layer or focused
  // country/region selection actually needs them.
  const shouldLoadAllAirports = allAirportsVisible
    || selectedCountry !== null
    || selectedRegion !== null
    || usStatesVisible
    || (layersOpen && activeLayerSection === 'airports');
  const shouldLoadUSStates = usStatesVisible || (layersOpen && activeLayerSection === 'states');

  const { data: allAirportsData, loading: allAirportsLoading } = useAllAirports({ enabled: shouldLoadAllAirports });
  const allAirportsPoints = useAllAirportsLayer(allAirportsData, {
    visible: allAirportsVisible,
    symbolMode: airportSymbolMode,
    visitedAirportCodes: validAirportCodes,
  });

  // US States layer data
  const { data: usStatesData, loading: usStatesLoading } = useUSStates({ enabled: shouldLoadUSStates });
  const { data: flightsData } = useFlights();
  const usStateStats = useUSStateStats(usStatesData, allAirportsData, flightsData);
  const usStatesPolygons = useUSStatesLayer(usStatesData, usStateStats, {
    visible: usStatesVisible,
    symbolMode: stateSymbolMode,
  });

  // Combined points: all airports (rendered below) + visited airports (rendered on top)
  // When an airport is selected, only label it and its connected airports
  // When a country/region is selected, only label airports in that country/region
  // Otherwise, label high-traffic airports for legibility
  const labeledAirports = useMemo<(GlobePoint | GlobeAllAirportPoint)[]>(() => {
    if (selectedAirport) {
      const connectedCodes = new Set<string>([selectedAirport]);
      staticArcsData.forEach(arc => {
        if (arc.flights.some(f => f.origin_code === selectedAirport || f.destination_code === selectedAirport)) {
          arc.flights.forEach(f => {
            connectedCodes.add(f.origin_code);
            connectedCodes.add(f.destination_code);
          });
        }
      });
      return pointsData.filter(p => connectedCodes.has(p.airport.code));
    }
    if (selectedCountry) {
      const visited = pointsData.filter(p => p.airport.country === selectedCountry);
      if (allAirportsData) {
        const visitedCodes = new Set(visited.map(p => p.airport.code));
        const unvisited = allAirportsData.features
          .filter(f => f.properties.country === selectedCountry && !visitedCodes.has(f.properties.code))
          .map(f => {
            const [lng, lat] = f.geometry.coordinates;
            return { lat, lng, size: ALL_AIRPORTS_POINT_SIZE, color: '', label: f.properties.code, airport: f.properties } satisfies GlobeAllAirportPoint;
          });
        return [...visited, ...unvisited];
      }
      return visited;
    }
    if (selectedRegion) {
      const visited = pointsData.filter(p => p.airport.region === selectedRegion);
      if (allAirportsData) {
        const visitedCodes = new Set(visited.map(p => p.airport.code));
        const unvisited = allAirportsData.features
          .filter(f => f.properties.region === selectedRegion && !visitedCodes.has(f.properties.code))
          .map(f => {
            const [lng, lat] = f.geometry.coordinates;
            return { lat, lng, size: ALL_AIRPORTS_POINT_SIZE, color: '', label: f.properties.code, airport: f.properties } satisfies GlobeAllAirportPoint;
          });
        return [...visited, ...unvisited];
      }
      return visited;
    }
    if (flightTypeSelection) {
      return pointsData.filter(p => flightTypeSelection.airportCodes.has(p.airport.code));
    }
    return pointsData.filter(p => p.airport.visitCount >= LABEL_MIN_VISITS);
  }, [pointsData, selectedAirport, selectedCountry, selectedRegion, staticArcsData, allAirportsData, flightTypeSelection]);

  const combinedPointsData = useMemo(() => {
    const visitedCodes = new Set(pointsData.map(p => p.airport.code));

    // When a country/region is selected, show ALL airports in that area (including unvisited)
    const showCountryRegionAirports = (selectedCountry || selectedRegion) && allAirportsData;
    let countryRegionUnvisited: GlobeAllAirportPoint[] = [];
    if (showCountryRegionAirports) {
      countryRegionUnvisited = allAirportsData!.features
        .filter(f => {
          if (visitedCodes.has(f.properties.code)) return false;
          if (selectedCountry) return f.properties.country === selectedCountry;
          if (selectedRegion) return f.properties.region === selectedRegion;
          return false;
        })
        .map(f => {
          const [lng, lat] = f.geometry.coordinates;
          return {
            lat, lng,
            size: ALL_AIRPORTS_POINT_SIZE,
            color: 'rgba(100, 116, 139, 0.5)',
            label: f.properties.code,
            airport: f.properties,
          };
        });
    }

    if (!allAirportsVisible && countryRegionUnvisited.length === 0) return pointsData;

    // Include all-airports layer points when visible
    const globalUnvisited = allAirportsVisible
      ? allAirportsPoints.filter(p => !visitedCodes.has(p.airport.code))
      : [];

    // Merge: country/region unvisited may overlap with global unvisited, dedupe
    const addedCodes = new Set(globalUnvisited.map(p => p.airport.code));
    const extraCountryRegion = countryRegionUnvisited.filter(p => !addedCodes.has(p.airport.code));

    // Tag points with their type for styling
    type CombinedPoint = (GlobePoint | GlobeAllAirportPoint) & { isAllAirports?: boolean; isCountryRegionUnvisited?: boolean };
    const taggedGlobal: CombinedPoint[] = globalUnvisited.map(p => ({
      ...p,
      isAllAirports: true,
    }));
    const taggedCountryRegion: CombinedPoint[] = extraCountryRegion.map(p => ({
      ...p,
      isAllAirports: true,
      isCountryRegionUnvisited: true,
    }));
    const taggedVisited: CombinedPoint[] = pointsData.map(p => ({
      ...p,
      isAllAirports: false,
    }));

    // All airports rendered first (below), visited airports on top
    return [...taggedGlobal, ...taggedCountryRegion, ...taggedVisited];
  }, [pointsData, allAirportsPoints, allAirportsVisible, allAirportsData, selectedCountry, selectedRegion]);

  // Share URL handler
  const handleShareUrl = useCallback(async () => {
    stopGlobeRotation();
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), COPY_FEEDBACK_MS);
    } catch {
      // Fallback: create a temporary input for older browsers
      const input = document.createElement('input');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, input.value.length);
      // Note: document.execCommand is deprecated but serves as last-resort fallback
      try {
        document.execCommand('copy');
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), COPY_FEEDBACK_MS);
      } catch {
        // If even execCommand fails, open a prompt with the URL
        window.prompt('Copy this URL:', window.location.href);
      }
      document.body.removeChild(input);
    }
  }, [stopGlobeRotation]);

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
  });

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

      if (selectedRoute) {
        if (routeKey === selectedRoute) {
          styles.set(routeKey, { color: 'rgba(255, 200, 50, 0.95)', stroke: 1.5 });
        } else {
          styles.set(routeKey, { color: 'rgba(100, 100, 120, 0.3)', stroke: 0.3 });
        }
      } else if (flightTypeSelection) {
        if (flightTypeSelection.routeKeys.has(routeKey)) {
          styles.set(routeKey, { color: flightTypeSelection.color, stroke: Math.max(arc.stroke * 1.8, 0.8) });
        } else {
          styles.set(routeKey, { color: 'rgba(100, 100, 120, 0.16)', stroke: 0.25 });
        }
      } else {
        styles.set(routeKey, { color: arc.color as string, stroke: arc.stroke });
      }
    });
    return styles;
  }, [combinedArcsData, selectedRoute, flightTypeSelection]);

  const getAnimatedArcFlightTypeStyle = useCallback((arc: GlobeArc) => {
    if (!selectedFlightType || !flightTypeSelection) return null;

    if (flightMatchesType(arc.flight, selectedFlightType)) {
      return {
        color: flightTypeSelection.color,
        stroke: Math.max(arc.stroke * 1.35, 0.45),
      };
    }

    return {
      color: 'rgba(100, 100, 120, 0.12)',
      stroke: Math.max(arc.stroke * 0.35, 0.12),
    };
  }, [selectedFlightType, flightTypeSelection]);

  // Calculate bounds for zoom-to-fit when year changes
  const zoomToBounds = useCallback((points: typeof pointsData) => {
    zoomToPoints(points);
  }, [zoomToPoints]);

  // Year change handler with zoom-to-fit
  const handleYearChange = useCallback((year: number | null) => {
    stopGlobeRotation();
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
      {textureState.isLoading && (
        <GlobeLoadingOverlay
          progress={textureState.progress}
          error={textureState.error}
        />
      )}

      {/* Top Navigation Bar */}
      <TopNavigationBar
        years={flightStats.years}
        selectedYear={selectedYear}
        onYearChange={handleYearChange}
        flightCount={flightStats.totalFlights}
        filterOpen={filterOpen}
        onFilterOpenChange={setFilterOpen}
        airports={pointsData}
        onAirportSelect={handleAirportCodeClick}
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
          <Globe
            ref={globeRef}
            globeImageUrl={basemap.image}
            bumpImageUrl={basemap.bump ?? ''}
            backgroundColor={basemap.bg}
            atmosphereColor={basemap.atmosphere}
            atmosphereAltitude={ATMOSPHERE_ALTITUDE}
            lineHoverPrecision={LINE_HOVER_PRECISION}
            onGlobeReady={handleGlobeReady}
            onZoom={handleGlobeZoom}
            // Combined arcs: static background lines + animated dots
            arcsData={showFlightPaths ? combinedArcsData : []}
            arcStartLat={(d: object) => (d as GlobeArc & { startLat: number }).startLat}
            arcStartLng={(d: object) => (d as GlobeArc & { startLng: number }).startLng}
            arcEndLat={(d: object) => (d as GlobeArc & { endLat: number }).endLat}
            arcEndLng={(d: object) => (d as GlobeArc & { endLng: number }).endLng}
            arcColor={(d: object) => {
              const arc = d as GlobeArc & { color: string; routeKey?: string; isStatic?: boolean };
              if (!arc.isStatic) {
                return getAnimatedArcFlightTypeStyle(arc)?.color ?? arc.color;
              }
              const style = arc.routeKey ? arcStyles.get(arc.routeKey) : null;
              return style?.color ?? arc.color;
            }}
            arcAltitudeAutoScale={ARC_ALTITUDE_AUTOSCALE}
            arcStroke={(d: object) => {
              const arc = d as GlobeArc & { stroke: number; routeKey?: string; isStatic?: boolean };
              if (!arc.isStatic) {
                return getAnimatedArcFlightTypeStyle(arc)?.stroke ?? arc.stroke;
              }
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
              const arcData = arc as (GlobeStaticArc & { isStatic?: boolean; routeKey?: string });
              // Find the static arc for this route (works for both static and animated arcs)
              const routeKey = arcData?.routeKey;
              if (arcData?.isStatic) {
                const isMobile = window.matchMedia('(max-width: 640px)').matches;
                if (isMobile && !selectedRoute) {
                  setMobileInfoArc(arcData as GlobeStaticArc);
                } else {
                  handleStaticArcClick(arcData as GlobeStaticArc);
                }
              } else if (routeKey) {
                // Clicked on an animated arc — find the matching static arc and select it
                const matchingStatic = staticArcsData.find(s => s.routeKey === routeKey);
                if (matchingStatic) {
                  const isMobile = window.matchMedia('(max-width: 640px)').matches;
                  if (isMobile && !selectedRoute) {
                    setMobileInfoArc(matchingStatic);
                  } else {
                    handleStaticArcClick(matchingStatic);
                  }
                }
              }
            }}
            arcLabel={(d: object) => {
              const arcData = d as GlobeStaticArc & { isStatic?: boolean };
              return buildArcLabelHtml(arcData, selectedRoute);
            }}
            // Points (airports - combined visited + all airports when layer is enabled)
            pointsData={combinedPointsData}
            pointLat={(d: object) => (d as GlobePoint).lat}
            pointLng={(d: object) => (d as GlobePoint).lng}
            pointColor={(d: object) => {
              const point = d as GlobePoint & { isAllAirports?: boolean; isCountryRegionUnvisited?: boolean };
              // Handle all airports layer styling
              if (point.isAllAirports) {
                // Unvisited airports in selected country/region get a distinct color
                if (point.isCountryRegionUnvisited || (selectedCountry && point.airport.country === selectedCountry) || (selectedRegion && point.airport.region === selectedRegion)) {
                  return selectedCountry ? 'hsla(150, 50%, 45%, 0.6)' : 'hsla(40, 60%, 50%, 0.6)';
                }
                return point.color; // Color is set by the symbol mode
              }
              // Regular visited airports
              if (selectedRouteAirports) {
                const isRouteEndpoint = point.airport.code === selectedRouteAirports.origin ||
                  point.airport.code === selectedRouteAirports.destination;
                if (isRouteEndpoint) return 'hsl(50, 100%, 65%)'; // Bright gold for route endpoints
                return 'rgba(100, 100, 120, 0.4)'; // Dim other airports
              }
              if (selectedCountry) {
                if (point.airport.country === selectedCountry) return 'hsl(150, 80%, 55%)';
                return 'rgba(100, 100, 120, 0.3)';
              }
              if (selectedRegion) {
                if (point.airport.region === selectedRegion) return 'hsl(40, 90%, 60%)';
                return 'rgba(100, 100, 120, 0.3)';
              }
              if (flightTypeSelection) {
                if (flightTypeSelection.airportCodes.has(point.airport.code)) return flightTypeSelection.color;
                return 'rgba(100, 100, 120, 0.3)';
              }
              return point.color;
            }}
            pointAltitude={(d: object) => {
              const point = d as GlobePoint & { isAllAirports?: boolean; isCountryRegionUnvisited?: boolean };
              // All airports render at a lower altitude
              if (point.isAllAirports) {
                // Unvisited airports in selected country/region render slightly higher than normal all-airports
                if (point.isCountryRegionUnvisited || (selectedCountry && point.airport.country === selectedCountry) || (selectedRegion && point.airport.region === selectedRegion)) {
                  return POINT_ALTITUDE;
                }
                return ALL_AIRPORTS_POINT_ALTITUDE;
              }
              if (selectedRouteAirports) {
                const isRouteEndpoint = point.airport.code === selectedRouteAirports.origin ||
                  point.airport.code === selectedRouteAirports.destination;
                if (isRouteEndpoint) return SELECTED_POINT_ALTITUDE; // Raise route endpoints higher
              }
              if (selectedCountry && point.airport.country === selectedCountry) return SELECTED_POINT_ALTITUDE;
              if (selectedRegion && point.airport.region === selectedRegion) return SELECTED_POINT_ALTITUDE;
              if (flightTypeSelection && flightTypeSelection.airportCodes.has(point.airport.code)) return SELECTED_POINT_ALTITUDE;
              return POINT_ALTITUDE;
            }}
            pointRadius={(d: object) => {
              const point = d as GlobePoint & { isAllAirports?: boolean; isCountryRegionUnvisited?: boolean };
              // All airports use smaller point size
              if (point.isAllAirports) {
                // Unvisited airports in selected country/region are slightly larger than default all-airports
                if (point.isCountryRegionUnvisited || (selectedCountry && point.airport.country === selectedCountry) || (selectedRegion && point.airport.region === selectedRegion)) {
                  return ALL_AIRPORTS_POINT_SIZE * 1.2;
                }
                return point.size;
              }
              if (selectedRouteAirports) {
                const isRouteEndpoint = point.airport.code === selectedRouteAirports.origin ||
                  point.airport.code === selectedRouteAirports.destination;
                if (isRouteEndpoint) return point.size * 2; // Bigger for route endpoints
                return point.size * 0.6; // Smaller for others
              }
              if (selectedCountry) {
                if (point.airport.country === selectedCountry) return Math.max(point.size * 1.5, 0.3);
                return point.size * 0.5;
              }
              if (selectedRegion) {
                if (point.airport.region === selectedRegion) return Math.max(point.size * 1.5, 0.3);
                return point.size * 0.5;
              }
              if (flightTypeSelection) {
                if (flightTypeSelection.airportCodes.has(point.airport.code)) return Math.max(point.size * 1.45, 0.3);
                return point.size * 0.55;
              }
              return point.size;
            }}
            pointsMerge={false}
            onPointHover={handlePointHover as (point: object | null) => void}
            onPointClick={(point: object) => {
              const p = point as GlobePoint & { isAllAirports?: boolean };
              if (p.isAllAirports) {
                // For all-airports layer, show info but don't select (can't filter by unvisited airports)
                return;
              }
              handlePointClick(p as GlobePoint);
            }}
            pointLabel={(d: object) => {
              const point = d as (GlobePoint | GlobeAllAirportPoint) & { isAllAirports?: boolean };
              return buildPointLabelHtml(point, isMetric);
            }}
            // Labels - HTML overlay for readability on any basemap
            htmlElementsData={labeledAirports}
            htmlLat={(d: object) => (d as GlobePoint).lat}
            htmlLng={(d: object) => (d as GlobePoint).lng}
            htmlAltitude={LABEL_ALTITUDE}
            htmlElement={(d: object) => {
              const point = d as GlobePoint;
              const el = document.createElement('div');
              el.className = 'flight-map-label';
              el.textContent = point.label;
              el.style.cssText = 'color: white; font-size: 10px; font-family: ui-monospace, monospace; font-weight: 600; text-shadow: 0 0 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1), 1px 1px 1px rgba(0,0,0,0.8); pointer-events: none; user-select: none; white-space: nowrap;';
              return el;
            }}
            // US States polygons layer
            polygonsData={usStatesPolygons}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            polygonGeoJsonGeometry={(d: object) => (d as GlobeStatePolygon).geometry as any}
            polygonCapColor={(d: object) => (d as GlobeStatePolygon).color}
            polygonSideColor={() => STATE_POLYGON_SIDE_COLOR}
            polygonAltitude={STATE_POLYGON_ALTITUDE}
            polygonLabel={(d: object) => {
              const poly = d as GlobeStatePolygon;
              return buildStatePolygonLabelHtml(poly);
            }}
            // Click on globe background to deselect and close stats
            onGlobeClick={() => {
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

      {/* Layers Control (Flight Paths, All Airports, US States, Basemap) */}
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
        onClose={() => setMobileInfoArc(null)}
        onSelect={(arc) => {
          handleStaticArcClick(arc);
          setMobileInfoArc(null);
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
