import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { usePersistedState } from '../../../hooks/usePersistedState';
import { useGlobeData, useFlights } from '../hooks/useFlightData';
import { useAllAirports, useAllAirportsLayer } from '../hooks/useAllAirports';
import { useUSStates, useUSStateStats, useUSStatesLayer } from '../hooks/useUSStates';
import { useStatsPanelState } from '../hooks/useStatsPanelState';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useYearSwipeNavigation } from '../hooks/useSwipeGesture';
import { useZoomNavigation } from '../hooks/useZoomNavigation';
import { StatsPanel } from './StatsPanel';
// ColorModeSelector is now integrated into LayersControl
import { KeyboardHelp } from './KeyboardHelp';
import { EmptyState } from './EmptyState';
import { GlobeErrorBoundary } from './GlobeErrorBoundary';
import { GlobeLoadingOverlay, useGlobeTextures } from './GlobeLoadingOverlay';
import { SkipLink } from './SkipLink';
import { TopNavigationBar } from './TopNavigationBar';
import { ControlButtons } from './ControlButtons';
import { BottomStatsBar } from './BottomStatsBar';
import { SelectedRouteIndicator } from './SelectedRouteIndicator';
import { MobileInfoOverlay } from './MobileInfoOverlay';
import { HoverInfo } from './HoverInfo';
import { LoadingSkeleton } from './LoadingSkeleton';
import { LayersControl } from './LayersControl';
import {
  DEFAULT_BASEMAP_ID,
  getBasemap,
  isValidBasemapId,
  DEFAULT_VIEW,
  AUTO_ROTATION_DELAY_MS,
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
import type { GlobeArc, GlobePoint, GlobeStaticArc, ColorMode, AirportSymbolMode, GlobeAllAirportPoint, StateSymbolMode, GlobeStatePolygon, BasemapId, SelectedRouteInfo, SelectedCountryInfo, SelectedRegionInfo } from '../types';
import { EARTH_RADIUS_KM } from '../constants';

export function FlightsMap() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const [rawBasemapId, setBasemapId] = usePersistedState<BasemapId>('flights-basemap', DEFAULT_BASEMAP_ID);
  // Guard against stale/invalid basemap IDs from localStorage
  const basemapId = isValidBasemapId(rawBasemapId) ? rawBasemapId : DEFAULT_BASEMAP_ID;
  const basemap = useMemo(() => getBasemap(basemapId), [basemapId]);
  const textureState = useGlobeTextures(basemap);
  const { resetView, zoomToPoints, zoomToRoute, zoomToPoint, zoomToAirportWithConnections } = useZoomNavigation(globeRef);

  // URL state for filters
  const selectedYear = searchParams.get('year') ? Number(searchParams.get('year')) : null;
  const selectedAirport = searchParams.get('airport') || null;
  const selectedAirline = searchParams.get('airline') || null;
  const selectedRoute = searchParams.get('route') || null; // Format: "JFK-LAX"
  const selectedCountry = searchParams.get('country') || null;
  const selectedRegion = searchParams.get('region') || null;

  const [colorMode, setColorMode] = usePersistedState<ColorMode>('flights-color-mode', 'default');
  const [animationEnabled, setAnimationEnabled] = usePersistedState('flights-animation-enabled', true);
  const [showStats, setShowStats] = useStatsPanelState(false);
  const [hoveredStaticArc, setHoveredStaticArc] = useState<GlobeStaticArc | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null);
  const [autoRotate, setAutoRotate] = useState(false); // Start paused
  const [mobileInfoArc, setMobileInfoArc] = useState<GlobeStaticArc | null>(null); // For mobile tap-to-show
  const [copiedUrl, setCopiedUrl] = useState(false);
  const hasInteracted = useRef(false);

  // All airports layer state
  const [allAirportsVisible, setAllAirportsVisible] = usePersistedState('flights-all-airports-visible', false);
  const [airportSymbolMode, setAirportSymbolMode] = usePersistedState<AirportSymbolMode>('flights-airport-symbol-mode', 'visited');
  const [showFlightPaths, setShowFlightPaths] = usePersistedState('flights-show-flight-paths', true);

  // US States layer state
  const [usStatesVisible, setUSStatesVisible] = usePersistedState('flights-us-states-visible', false);
  const [stateSymbolMode, setStateSymbolMode] = usePersistedState<StateSymbolMode>('flights-state-symbol-mode', 'visited');

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

  const setSelectedCountry = useCallback((country: string | null) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (country === null) {
        newParams.delete('country');
      } else {
        newParams.set('country', country);
      }
      // Clear other detail selections
      newParams.delete('airport');
      newParams.delete('route');
      newParams.delete('region');
      return newParams;
    });
  }, [setSearchParams]);

  const setSelectedRegion = useCallback((region: string | null) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (region === null) {
        newParams.delete('region');
      } else {
        newParams.set('region', region);
      }
      // Clear other detail selections
      newParams.delete('airport');
      newParams.delete('route');
      newParams.delete('country');
      return newParams;
    });
  }, [setSearchParams]);

  const clearAllFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  // Set initial view centered on USA and disable rotation initially
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView(DEFAULT_VIEW, 0);
      // Explicitly disable auto-rotation on mount
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = false;
      }
    }
  }, []);

  // Check if any URL filters are active (don't auto-rotate if user came via direct link)
  const hasUrlFilters = selectedYear !== null || selectedAirport !== null || selectedAirline !== null || selectedRoute !== null || selectedCountry !== null || selectedRegion !== null;

  // Start auto-rotation after a delay (gives user time to explore first)
  // Skip if user prefers reduced motion, has interacted, or came via filtered URL
  useEffect(() => {
    // Don't start rotation if user came via a filtered URL
    if (hasUrlFilters || prefersReducedMotion) {
      return;
    }

    const timer = setTimeout(() => {
      if (!hasInteracted.current) {
        setAutoRotate(true);
      }
    }, AUTO_ROTATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasUrlFilters, prefersReducedMotion]);

  // Handle auto-rotation (disable if user prefers reduced motion)
  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = autoRotate && !prefersReducedMotion;
        controls.autoRotateSpeed = AUTO_ROTATION_SPEED;
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

  // Double-click to zoom in toward clicked point
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const domEl = globe.renderer().domElement;
    const handler = (e: MouseEvent) => {
      stopAutoRotate();
      const coords = globe.toGlobeCoords(e.offsetX, e.offsetY);
      if (!coords) return;
      const pov = globe.pointOfView();
      const newAltitude = Math.max(ZOOM_ALTITUDE_MIN, pov.altitude * DBLCLICK_ZOOM_FACTOR);
      globe.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: newAltitude }, VIEW_TRANSITION_MS);
    };
    domEl.addEventListener('dblclick', handler);
    return () => domEl.removeEventListener('dblclick', handler);
  }, [stopAutoRotate]);

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

  // All airports layer data
  const { data: allAirportsData, loading: allAirportsLoading } = useAllAirports();
  const allAirportsPoints = useAllAirportsLayer(allAirportsData, {
    visible: allAirportsVisible,
    symbolMode: airportSymbolMode,
    visitedAirportCodes: validAirportCodes,
  });

  // US States layer data
  const { data: usStatesData, loading: usStatesLoading } = useUSStates();
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
  const labeledAirports = useMemo(() => {
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
            return { lat, lng, size: ALL_AIRPORTS_POINT_SIZE, color: '', label: f.properties.code, airport: f.properties } as unknown as GlobePoint;
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
            return { lat, lng, size: ALL_AIRPORTS_POINT_SIZE, color: '', label: f.properties.code, airport: f.properties } as unknown as GlobePoint;
          });
        return [...visited, ...unvisited];
      }
      return visited;
    }
    return pointsData.filter(p => p.airport.visitCount >= LABEL_MIN_VISITS);
  }, [pointsData, selectedAirport, selectedCountry, selectedRegion, staticArcsData, allAirportsData]);

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
    onToggleAllAirports: () => setAllAirportsVisible(prev => !prev),
    onToggleUSStates: () => setUSStatesVisible(prev => !prev),
  });

  // Parse selected route into origin/destination codes
  const selectedRouteAirports = useMemo(() => {
    if (!selectedRoute) return null;
    const [origin, destination] = selectedRoute.split('-');
    return { origin, destination };
  }, [selectedRoute]);

  // Compute selected route info for stats panel
  const selectedRouteInfo = useMemo<SelectedRouteInfo | null>(() => {
    if (!selectedRoute) return null;
    const arc = staticArcsData.find(a => a.routeKey === selectedRoute);
    if (!arc || arc.flights.length === 0) return null;
    const first = arc.flights[0];
    const airlines = [...new Set(arc.flights.map(f => f.airline).filter(Boolean))];
    const years = [...new Set(arc.flights.map(f => {
      const parts = f.date.split('/');
      return parseInt(parts[2], 10);
    }))].sort((a, b) => a - b);
    const dates = arc.flights.map(f => f.date).sort((a, b) => {
      const pa = a.split('/'); const pb = b.split('/');
      const da = new Date(+pa[2], +pa[0] - 1, +pa[1]);
      const db = new Date(+pb[2], +pb[0] - 1, +pb[1]);
      return db.getTime() - da.getTime();
    });
    // Haversine distance
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(first.destination_lat - first.origin_lat);
    const dLon = toRad(first.destination_lon - first.origin_lon);
    const a2 = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(first.origin_lat)) * Math.cos(toRad(first.destination_lat)) *
      Math.sin(dLon / 2) ** 2;
    const distanceKm = Math.round(EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2)));
    return {
      routeKey: selectedRoute,
      originCode: first.origin_code,
      originName: first.origin_name,
      originMunicipality: first.origin_municipality,
      originCountry: first.origin_country,
      originCountryName: first.origin_countryName,
      originRegion: first.origin_region,
      originRegionName: first.origin_regionName,
      originContinentName: first.origin_continentName,
      destinationCode: first.destination_code,
      destinationName: first.destination_name,
      destinationMunicipality: first.destination_municipality,
      destinationCountry: first.destination_country,
      destinationCountryName: first.destination_countryName,
      destinationRegion: first.destination_region,
      destinationRegionName: first.destination_regionName,
      destinationContinentName: first.destination_continentName,
      totalFlights: arc.routeCount,
      airlines,
      years,
      dates,
      distanceKm,
      isInternational: first.origin_country !== first.destination_country,
      isIntercontinental: first.origin_continent !== first.destination_continent,
    };
  }, [selectedRoute, staticArcsData]);

  // Compute selected country info for stats panel
  const selectedCountryInfo = useMemo<SelectedCountryInfo | null>(() => {
    if (!selectedCountry) return null;
    const countryPoints = pointsData.filter(p => p.airport.country === selectedCountry);
    if (countryPoints.length === 0) return null;
    const first = countryPoints[0].airport;
    // Gather flights touching this country
    const countryFlights = staticArcsData.flatMap(arc =>
      arc.flights.filter(f => f.origin_country === selectedCountry || f.destination_country === selectedCountry)
    );
    const airlines = [...new Set(countryFlights.map(f => f.airline).filter(Boolean))];
    const years = [...new Set(countryFlights.map(f => parseInt(f.date.split('/')[2], 10)))].sort((a, b) => a - b);
    // Top routes
    const routeCounts = new Map<string, { origin: string; destination: string; count: number }>();
    countryFlights.forEach(f => {
      const key = [f.origin_code, f.destination_code].sort().join('-');
      const existing = routeCounts.get(key);
      if (existing) { existing.count++; } else {
        routeCounts.set(key, { origin: f.origin_code, destination: f.destination_code, count: 1 });
      }
    });
    const topRoutes = [...routeCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    // Connected countries
    const connCountries = new Map<string, { code: string; name: string; count: number }>();
    countryFlights.forEach(f => {
      const otherCode = f.origin_country === selectedCountry ? f.destination_country : f.origin_country;
      const otherName = f.origin_country === selectedCountry ? f.destination_countryName : f.origin_countryName;
      if (otherCode === selectedCountry) return;
      const existing = connCountries.get(otherCode);
      if (existing) { existing.count++; } else {
        connCountries.set(otherCode, { code: otherCode, name: otherName, count: 1 });
      }
    });
    const departures = countryFlights.filter(f => f.origin_country === selectedCountry).length;
    const arrivals = countryFlights.filter(f => f.destination_country === selectedCountry).length;
    return {
      code: selectedCountry,
      name: first.countryName,
      continent: first.continent,
      continentName: first.continentName,
      totalFlights: countryFlights.length,
      departures,
      arrivals,
      airports: countryPoints.map(p => ({ code: p.airport.code, name: p.airport.name, visitCount: p.airport.visitCount }))
        .sort((a, b) => b.visitCount - a.visitCount),
      airlines,
      years,
      topRoutes,
      connectedCountries: [...connCountries.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    };
  }, [selectedCountry, pointsData, staticArcsData]);

  // Compute selected region info for stats panel
  const selectedRegionInfo = useMemo<SelectedRegionInfo | null>(() => {
    if (!selectedRegion) return null;
    const regionPoints = pointsData.filter(p => p.airport.region === selectedRegion);
    if (regionPoints.length === 0) return null;
    const first = regionPoints[0].airport;
    const regionFlights = staticArcsData.flatMap(arc =>
      arc.flights.filter(f => f.origin_region === selectedRegion || f.destination_region === selectedRegion)
    );
    const airlines = [...new Set(regionFlights.map(f => f.airline).filter(Boolean))];
    const years = [...new Set(regionFlights.map(f => parseInt(f.date.split('/')[2], 10)))].sort((a, b) => a - b);
    const routeCounts = new Map<string, { origin: string; destination: string; count: number }>();
    regionFlights.forEach(f => {
      const key = [f.origin_code, f.destination_code].sort().join('-');
      const existing = routeCounts.get(key);
      if (existing) { existing.count++; } else {
        routeCounts.set(key, { origin: f.origin_code, destination: f.destination_code, count: 1 });
      }
    });
    const topRoutes = [...routeCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    const departures = regionFlights.filter(f => f.origin_region === selectedRegion).length;
    const arrivals = regionFlights.filter(f => f.destination_region === selectedRegion).length;
    return {
      code: selectedRegion,
      name: first.regionName,
      country: first.country,
      countryName: first.countryName,
      totalFlights: regionFlights.length,
      departures,
      arrivals,
      airports: regionPoints.map(p => ({ code: p.airport.code, name: p.airport.name, visitCount: p.airport.visitCount }))
        .sort((a, b) => b.visitCount - a.visitCount),
      airlines,
      years,
      topRoutes,
    };
  }, [selectedRegion, pointsData, staticArcsData]);

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
    zoomToPoints(points);
  }, [zoomToPoints]);

  // Year change handler with zoom-to-fit
  const handleYearChange = useCallback((year: number | null) => {
    stopAutoRotate();
    setSelectedYear(year);
  }, [stopAutoRotate, setSelectedYear]);

  // US States visibility handler - zoom to US when enabling
  const handleUSStatesVisibilityChange = useCallback((visible: boolean) => {
    setUSStatesVisible(visible);
    if (visible) {
      // Zoom to continental US view
      zoomToPoint({ lat: 39.8283, lng: -98.5795 }, 1.8, VIEW_TRANSITION_MS);
      stopAutoRotate();
    }
  }, [setUSStatesVisible, stopAutoRotate, zoomToPoint]);

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

    if (newRoute) {
      zoomToRoute(
        { lat: arc.startLat, lng: arc.startLng },
        { lat: arc.endLat, lng: arc.endLng }
      );
      setShowStats(true);
    } else {
      setShowStats(false);
    }
  }, [stopAutoRotate, selectedRoute, setSelectedRoute, zoomToRoute, setShowStats]);

  // Point click - fly to airport showing all its routes, and toggle selection
  const handlePointClick = useCallback((point: GlobePoint) => {
    stopAutoRotate();

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
  }, [stopAutoRotate, selectedAirport, setSelectedAirport, setShowStats, staticArcsData, zoomToAirportWithConnections]);

  // Handle clicking on an airport code in the stats panel
  const handleAirportCodeClick = useCallback((code: string) => {
    stopAutoRotate();
    const airport = pointsData.find(p => p.airport.code === code);
    if (airport) {
      zoomToPoint(airport, 0.5);
    }
    setSelectedAirport(code);
    setShowStats(true);
  }, [stopAutoRotate, pointsData, setSelectedAirport, setShowStats, zoomToPoint]);

  // Handle clicking on a route in the stats panel
  const handleRouteCodeClick = useCallback((origin: string, destination: string) => {
    stopAutoRotate();
    const originAirport = pointsData.find(p => p.airport.code === origin);
    const destAirport = pointsData.find(p => p.airport.code === destination);

    if (originAirport && destAirport) {
      zoomToRoute(originAirport, destAirport, { divisor: 60 });
    }
  }, [stopAutoRotate, pointsData, zoomToRoute]);

  // Handle clicking on a country in the stats panel
  const handleCountryClick = useCallback((countryCode: string) => {
    stopAutoRotate();
    setSelectedCountry(countryCode);
    const countryAirports = pointsData.filter(p => p.airport.country === countryCode);
    if (countryAirports.length > 0) {
      zoomToPoints(countryAirports);
    }
    setShowStats(true);
  }, [stopAutoRotate, pointsData, zoomToPoints, setSelectedCountry, setShowStats]);

  // Handle clicking on a region in the stats panel
  const handleRegionClick = useCallback((regionCode: string) => {
    stopAutoRotate();
    setSelectedRegion(regionCode);
    const regionAirports = pointsData.filter(p => p.airport.region === regionCode);
    if (regionAirports.length > 0) {
      zoomToPoints(regionAirports);
    }
    setShowStats(true);
  }, [stopAutoRotate, pointsData, zoomToPoints, setSelectedRegion, setShowStats]);

  // Swipe navigation for year changes on mobile
  const swipeRef = useYearSwipeNavigation(flightStats.years, selectedYear, handleYearChange);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        Error loading flight data: {error.message}
      </div>
    );
  }

  const hasNoResults = !loading && flightStats.totalFlights === 0 && (selectedYear !== null || selectedAirline !== null);

  return (
    <div ref={swipeRef} className="relative w-full h-full bg-[#000011] flex flex-col">
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
        onResetView={resetView}
        animationEnabled={animationEnabled}
        onToggleAnimation={() => setAnimationEnabled(prev => !prev)}
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
          className="flex-1"
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
            arcsData={showFlightPaths ? combinedArcsData : []}
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
            arcAltitudeAutoScale={ARC_ALTITUDE_AUTOSCALE}
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
                  <div class="text-gray-300">${years.length > 3 ? years[0] + '–' + years[years.length - 1] : years.join(', ')}</div>
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
              const a = point.airport;

              // Different tooltip for all airports vs visited airports
              if (point.isAllAirports) {
                return `
            <div class="bg-gray-900/95 px-3 py-2 rounded-lg shadow-xl border border-gray-600 text-sm">
              <div class="font-bold text-gray-300">${a.code}</div>
              <div class="text-gray-400">${a.name}</div>
              <div class="text-gray-500 text-xs mt-1">${a.municipality ? a.municipality + ', ' : ''}${a.countryName}</div>
              <div class="text-gray-500 text-xs">${a.continentName}</div>
              <div class="text-gray-600 text-xs mt-2 pt-2 border-t border-gray-700">
                ${a.elevationFt.toLocaleString()} ft (${a.elevationM.toLocaleString()} m)
              </div>
              <div class="text-gray-600 text-xs mt-1 italic">Not yet visited</div>
            </div>
          `;
              }

              // Visited airport tooltip (with visit statistics)
              const visitedAirport = a as GlobePoint['airport'];
              return `
            <div class="bg-gray-900/95 px-3 py-2 rounded-lg shadow-xl border border-gray-700 text-sm">
              <div class="font-bold text-yellow-300">${visitedAirport.code}</div>
              <div class="text-gray-300">${visitedAirport.name}</div>
              <div class="text-gray-400 text-xs">${visitedAirport.municipality}, ${visitedAirport.countryName}</div>
              <div class="text-gray-500 text-xs">${visitedAirport.elevationFt.toLocaleString()} ft (${visitedAirport.elevationM.toLocaleString()} m)</div>
              <div class="text-gray-500 mt-2 pt-2 border-t border-gray-700">
                <span class="text-yellow-400">${visitedAirport.visitCount}</span> visits
                <span class="text-gray-600 mx-1">•</span>
                <span class="text-green-400">${visitedAirport.arrivalCount}</span>↓
                <span class="text-blue-400">${visitedAirport.departureCount}</span>↑
              </div>
            </div>
          `;
            }}
            // Labels - HTML overlay for readability on any basemap
            htmlElementsData={labeledAirports}
            htmlLat={(d: object) => (d as GlobePoint).lat}
            htmlLng={(d: object) => (d as GlobePoint).lng}
            htmlAltitude={LABEL_ALTITUDE}
            htmlElement={(d: object) => {
              const point = d as GlobePoint;
              const el = document.createElement('div');
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
              const { stats } = poly;
              return `
                <div class="bg-gray-900/95 px-3 py-2 rounded-lg shadow-xl border border-blue-700 text-sm">
                  <div class="font-bold text-blue-300">${stats.name}</div>
                  <div class="text-gray-400 text-xs">${stats.abbr}</div>
                  ${stats.visited ? `
                    <div class="mt-2 pt-2 border-t border-gray-700">
                      <div class="text-xs text-gray-500">Airports Visited</div>
                      <div class="text-green-400">${stats.airportCount} of ${stats.totalAirports}</div>
                    </div>
                    <div class="mt-1">
                      <div class="text-xs text-gray-500">Flights</div>
                      <div class="text-orange-400">${stats.flightCount}</div>
                    </div>
                    ${stats.firstVisitDate ? `
                      <div class="mt-1 text-xs text-gray-500">
                        First: ${stats.firstVisitDate}
                      </div>
                    ` : ''}
                  ` : `
                    <div class="mt-2 text-gray-500 text-xs">Not yet visited</div>
                  `}
                </div>
              `;
            }}
            // Click on globe background to deselect and close stats
            onGlobeClick={() => {
              stopAutoRotate();
              setSelectedAirport(null);
              setSelectedRoute(null);
              setSelectedCountry(null);
              setSelectedRegion(null);
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
          setShowStats(false);
        }}
        selectedAirline={selectedAirline}
        onAirlineSelect={setSelectedAirline}
        onAirportClick={handleAirportCodeClick}
        onRouteClick={handleRouteCodeClick}
        onCountryClick={handleCountryClick}
        onRegionClick={handleRegionClick}
        validAirportCodes={validAirportCodes}
        selectedRouteInfo={selectedRouteInfo}
        onClearRoute={() => {
          setSelectedRoute(null);
          setShowStats(false);
        }}
        selectedCountryInfo={selectedCountryInfo}
        onClearCountry={() => {
          setSelectedCountry(null);
          setShowStats(false);
        }}
        selectedRegionInfo={selectedRegionInfo}
        onClearRegion={() => {
          setSelectedRegion(null);
          setShowStats(false);
        }}
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
      />

      {/* Bottom Stats Bar */}
      <BottomStatsBar
        totalFlights={flightStats.totalFlights}
        totalAirports={flightStats.totalAirports}
        totalDistance={flightStats.totalDistance}
        selectedYear={selectedYear}
        selectedAirport={selectedAirport}
        selectedAirline={selectedAirline}
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
