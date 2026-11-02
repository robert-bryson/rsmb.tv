import { useCallback, useMemo, type RefObject } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { cartoRasterUrl } from '../../../maps/cartoBasemaps';
import { useGlobeCamera } from '../hooks/useGlobeCamera';
import type { useFlightMapLayers } from '../hooks/useFlightMapLayers';
import type { useFlightsFilters } from '../hooks/useFlightsFilters';
import { buildArcLabelHtml, buildPointLabelHtml, buildStatePolygonLabelHtml } from '../utils/tooltipHtml';
import { flightMatchesType } from '../utils';
import {
  type BasemapConfig, ARC_ALTITUDE_AUTOSCALE, LINE_HOVER_PRECISION, ATMOSPHERE_ALTITUDE,
  POINT_ALTITUDE, SELECTED_POINT_ALTITUDE, LABEL_ALTITUDE, ALL_AIRPORTS_POINT_ALTITUDE,
  ALL_AIRPORTS_POINT_SIZE, STATE_POLYGON_ALTITUDE, STATE_POLYGON_SIDE_COLOR,
} from '../constants';
import type { GlobeArc, GlobePoint, GlobeStaticArc, GlobeAllAirportPoint, GlobeStatePolygon, GlobeViewState } from '../types';

type MapLayers = ReturnType<typeof useFlightMapLayers>;
type RenderedArc = (GlobeArc & { isStatic: false }) |
  (GlobeStaticArc & { isStatic: true; dashLength: number; dashGap: number; dashInitialGap: number; animateTime: number });
type GlobeSelection = Pick<ReturnType<typeof useFlightsFilters>,
  'selectedRoute' | 'selectedRouteAirports' | 'selectedCountry' | 'selectedRegion' | 'selectedFlightType'>;

interface FlightsGlobeProps {
  globeRef: RefObject<GlobeMethods | undefined>;
  navigationViewRef: RefObject<GlobeViewState | null>;
  basemap: BasemapConfig;
  selectedView: GlobeViewState | null;
  globeRotationEnabled: boolean;
  prefersReducedMotion: boolean;
  animationEnabled: boolean;
  showFlightPaths: boolean;
  isMetric: boolean;
  selection: GlobeSelection;
  arcsData: GlobeArc[];
  staticArcsData: GlobeStaticArc[];
  layers: MapLayers;
  onViewChange: (view: GlobeViewState, options: { replace: boolean }) => void;
  onStopRotation: () => void;
  onRouteClick: (route: GlobeStaticArc) => void;
  onRouteHover: (route: GlobeStaticArc | null) => void;
  onPointClick: (point: GlobePoint) => void;
  onPointHover: (point: GlobePoint | null) => void;
  onBackgroundClick: () => void;
}

/** Adapts filtered flight layers and selection to the WebGL renderer. */
export function FlightsGlobe({
  globeRef, navigationViewRef, basemap, selectedView, globeRotationEnabled, prefersReducedMotion,
  animationEnabled, showFlightPaths, isMetric, selection, arcsData, staticArcsData, layers,
  onViewChange, onStopRotation, onRouteClick, onRouteHover, onPointClick, onPointHover, onBackgroundClick,
}: FlightsGlobeProps) {
  const { selectedRoute, selectedRouteAirports, selectedCountry, selectedRegion, selectedFlightType } = selection;
  const { combinedPointsData, labeledAirports, usStatesPolygons, flightTypeSelection } = layers;
  const tileUrl = useMemo(() => {
    if (!basemap.tiles) return null;
    const template = cartoRasterUrl(basemap.tiles);
    return (x: number, y: number, level: number) => template.replace('{z}', String(level)).replace('{x}', String(x)).replace('{y}', String(y));
  }, [basemap]);
  const { onGlobeReady: handleGlobeReady, onZoom: handleGlobeZoom } = useGlobeCamera({
    globeRef, navigationViewRef, selectedView, rotationEnabled: globeRotationEnabled, reducedMotion: prefersReducedMotion,
    tileUrl, onStopRotation, onViewChange,
  });

  // Object identity is the renderer's geometry cache key. Pausing changes the
  // timing accessor below, so existing geometry and dash positions survive.
  const combinedArcsData = useMemo<RenderedArc[]>(() => {
    const animatedArcs = arcsData.map(arc => ({
      ...arc,
      isStatic: false as const,
    }));

    const staticArcs = staticArcsData.map(arc => ({
      ...arc,
      dashLength: 1,
      dashGap: 0,
      dashInitialGap: 0,
      animateTime: 0,
      isStatic: true as const,
    }));

    return [...animatedArcs, ...staticArcs];
  }, [staticArcsData, arcsData]);
  const arcDashAnimateTime = useCallback((data: object) => {
    return animationEnabled && !prefersReducedMotion ? (data as RenderedArc).animateTime : 0;
  }, [animationEnabled, prefersReducedMotion]);

  // Memoize arc styling based on selection - pre-compute colors and strokes
  const arcStyles = useMemo(() => {
    const styles = new Map<string, { color: string; stroke: number }>();
    staticArcsData.forEach(arc => {
      const { routeKey } = arc;

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
        styles.set(routeKey, { color: arc.color, stroke: arc.stroke });
      }
    });
    return styles;
  }, [staticArcsData, selectedRoute, flightTypeSelection]);

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

  return (
    <Globe
      ref={globeRef}
      globeImageUrl={basemap.image}
      globeTileEngineUrl={tileUrl}
      bumpImageUrl={basemap.bump ?? ''}
      backgroundColor={basemap.bg}
      atmosphereColor={basemap.atmosphere}
      atmosphereAltitude={ATMOSPHERE_ALTITUDE}
      lineHoverPrecision={LINE_HOVER_PRECISION}
      onGlobeReady={handleGlobeReady}
      onZoom={handleGlobeZoom}
      // Combined arcs: static background lines + animated dots
      arcsData={showFlightPaths ? combinedArcsData : []}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcColor={(d: object) => {
        const arc = d as RenderedArc;
        if (!arc.isStatic) {
          return getAnimatedArcFlightTypeStyle(arc)?.color ?? arc.color;
        }
        const style = arcStyles.get(arc.routeKey);
        return style?.color ?? arc.color;
      }}
      arcAltitudeAutoScale={ARC_ALTITUDE_AUTOSCALE}
      // Thin route tubes need fewer segments than the library's general-purpose
      // defaults. This also bounds the cost of pointer intersection checks.
      arcCurveResolution={24}
      arcCircularResolution={4}
      arcStroke={(d: object) => {
        const arc = d as RenderedArc;
        if (!arc.isStatic) {
          return getAnimatedArcFlightTypeStyle(arc)?.stroke ?? arc.stroke;
        }
        const style = arcStyles.get(arc.routeKey);
        return style?.stroke ?? arc.stroke;
      }}
      arcDashLength="dashLength"
      arcDashGap="dashGap"
      arcDashInitialGap="dashInitialGap"
      arcDashAnimateTime={arcDashAnimateTime}
      arcsTransitionDuration={prefersReducedMotion ? 0 : 800}
      onArcHover={(arc: object | null) => {
        if (!arc) {
          onRouteHover(null);
          return;
        }
        const arcData = arc as RenderedArc;
        if (arcData.isStatic) {
          onRouteHover(arcData);
        }
      }}
      onArcClick={(arc: object) => {
        const routeKey = (arc as GlobeArc | GlobeStaticArc).routeKey;
        const route = staticArcsData.find(item => item.routeKey === routeKey);
        if (route) onRouteClick(route);
      }}
      arcLabel={(d: object) => {
        const arc = d as RenderedArc;
        return arc.isStatic ? buildArcLabelHtml(arc, selectedRoute) : '';
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
      onPointHover={onPointHover as (point: object | null) => void}
      onPointClick={(point: object) => {
        const p = point as GlobePoint & { isAllAirports?: boolean };
        if (p.isAllAirports) {
          // For all-airports layer, show info but don't select (can't filter by unvisited airports)
          return;
        }
        onPointClick(p as GlobePoint);
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
      polygonGeoJsonGeometry="geometry"
      polygonCapColor={(d: object) => (d as GlobeStatePolygon).color}
      polygonSideColor={() => STATE_POLYGON_SIDE_COLOR}
      polygonAltitude={STATE_POLYGON_ALTITUDE}
      polygonLabel={(d: object) => {
        const poly = d as GlobeStatePolygon;
        return buildStatePolygonLabelHtml(poly);
      }}
      onGlobeClick={onBackgroundClick}
    />
  );
}
