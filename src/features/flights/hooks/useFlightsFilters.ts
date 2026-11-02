import { useCallback, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import {
    COLOR_MODES,
    DEFAULT_BASEMAP_ID,
    DEFAULT_VIEW,
    isValidBasemapId,
    ZOOM_ALTITUDE_MIN,
} from '../constants';
import type {
    AirportSymbolMode,
    BasemapId,
    ColorMode,
    FlightTypeFilter,
    GlobeViewState,
    LayerPanelSection,
    StateSymbolMode,
} from '../types';
import { isValidFlightTypeFilter } from '../utils';
import { globeViewsEqual } from '../utils/globeView';

type SearchUpdateOptions = { replace?: boolean };
const QUERY_WRITE_STATE_KEY = '__rsmbFlightQueryWrite';
type BooleanUpdate = boolean | ((prev: boolean) => boolean);

const AIRPORT_SYMBOL_MODES: AirportSymbolMode[] = ['visited', 'continent', 'country', 'elevation'];
const STATE_SYMBOL_MODES: StateSymbolMode[] = ['visited', 'visitCount', 'flightCount'];
const LAYER_PANEL_SECTIONS: LayerPanelSection[] = ['none', 'flights', 'basemap', 'airports', 'states'];
const URL_GLOBE_ALTITUDE_MAX = 5;

function parseSelectedYear(yearParam: string | null) {
    if (yearParam === null) return null;

    const year = Number(yearParam);
    return Number.isInteger(year) && year > 0 ? year : null;
}

function parseBoolean(value: string | null, fallback: boolean) {
    if (value === null) return fallback;
    if (value === '1' || value === 'true') return true;
    if (value === '0' || value === 'false') return false;
    return fallback;
}

function resolveBooleanUpdate(update: BooleanUpdate, current: boolean) {
    return typeof update === 'function' ? update(current) : update;
}

function setBooleanParam(params: URLSearchParams, key: string, value: boolean, defaultValue: boolean) {
    if (value === defaultValue) {
        params.delete(key);
    } else {
        params.set(key, value ? '1' : '0');
    }
}

function setBooleanParamUpdate(params: URLSearchParams, key: string, update: BooleanUpdate, defaultValue: boolean) {
    const currentValue = parseBoolean(params.get(key), defaultValue);
    setBooleanParam(params, key, resolveBooleanUpdate(update, currentValue), defaultValue);
}

function parseEnum<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
    return value !== null && allowed.includes(value as T) ? value as T : fallback;
}

function parseColorMode(value: string | null): ColorMode {
    return parseEnum(value, COLOR_MODES, 'default');
}

function setEnumParam<T extends string>(params: URLSearchParams, key: string, value: T, defaultValue: T) {
    if (value === defaultValue) {
        params.delete(key);
    } else {
        params.set(key, value);
    }
}

function parseNumberInRange(value: string | null, min: number, max: number) {
    if (value === null) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
    return parsed;
}

function parseGlobeView(params: URLSearchParams): GlobeViewState | null {
    const lat = parseNumberInRange(params.get('lat'), -90, 90);
    const lng = parseNumberInRange(params.get('lng'), -180, 180);
    const altitude = parseNumberInRange(params.get('alt'), ZOOM_ALTITUDE_MIN, URL_GLOBE_ALTITUDE_MAX);

    if (lat === null || lng === null || altitude === null) return null;
    return { lat, lng, altitude };
}

function formatViewNumber(value: number, precision: number) {
    return Number(value.toFixed(precision)).toString();
}

function isDefaultGlobeView(view: GlobeViewState) {
    return globeViewsEqual(view, DEFAULT_VIEW);
}

function setGlobeViewParams(params: URLSearchParams, view: GlobeViewState | null) {
    if (view === null || isDefaultGlobeView(view)) {
        params.delete('lat');
        params.delete('lng');
        params.delete('alt');
        return;
    }

    params.set('lat', formatViewNumber(view.lat, 4));
    params.set('lng', formatViewNumber(view.lng, 4));
    params.set('alt', formatViewNumber(view.altitude, 3));
}

function deleteSelectionParams(params: URLSearchParams) {
    params.delete('year');
    params.delete('airport');
    params.delete('airline');
    params.delete('route');
    params.delete('country');
    params.delete('region');
    params.delete('flightType');
}

/**
 * Manages URL-based state for the flights globe.
 * Values in the URL are shareable and override local defaults.
 */
export function useFlightsFilters() {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const navigationType = useNavigationType();
    const ownerId = useId();
    const writeSequence = useRef(0);
    const committed = useRef({ searchParams, setSearchParams, state: location.state as unknown });
    const pendingWrite = useRef<{ params: URLSearchParams; id: string } | null>(null);
    const issuedWrites = useRef(new Set<string>());

    useLayoutEffect(() => {
        committed.current = { searchParams, setSearchParams, state: location.state as unknown };
        const state: unknown = location.state;
        const writeId = state !== null && typeof state === 'object'
            ? (state as Record<string, unknown>)[QUERY_WRITE_STATE_KEY] : null;
        // Concurrent navigation can commit an earlier write after a newer one
        // has reached history. Track write identities because query text can
        // recur or arrive through an unrelated navigation.
        const intermediateCommit = navigationType !== 'POP'
            && typeof writeId === 'string' && issuedWrites.current.has(writeId)
            && pendingWrite.current !== null && pendingWrite.current.id !== writeId;
        if (!intermediateCommit) {
            pendingWrite.current = null;
            issuedWrites.current.clear();
        }
    }, [searchParams, setSearchParams, navigationType, location.key, location.state]);

    // Native listeners can retain a setter from an earlier render. Compose its
    // writes with pending updates or the latest committed URL, never its closure.
    const updateParams = useCallback((mutate: (params: URLSearchParams) => void, options?: SearchUpdateOptions) => {
        const base = pendingWrite.current?.params ?? committed.current.searchParams;
        const newParams = new URLSearchParams(base);
        mutate(newParams);
        if (newParams.toString() === base.toString()) return;
        const id = `${ownerId}:${++writeSequence.current}`;
        pendingWrite.current = { params: newParams, id };
        issuedWrites.current.add(id);
        const currentState = committed.current.state;
        committed.current.setSearchParams(newParams, {
            ...options,
            state: {
                ...(currentState !== null && typeof currentState === 'object' ? currentState : {}),
                [QUERY_WRITE_STATE_KEY]: id,
            },
        });
    }, [ownerId]);

    const selectedYear = parseSelectedYear(searchParams.get('year'));
    const selectedAirport = searchParams.get('airport') || null;
    const selectedAirline = searchParams.get('airline') || null;
    const selectedRoute = searchParams.get('route') || null;
    const selectedCountry = searchParams.get('country') || null;
    const selectedRegion = searchParams.get('region') || null;
    const flightTypeParam = searchParams.get('flightType');
    const selectedFlightType = isValidFlightTypeFilter(flightTypeParam) ? flightTypeParam : null;

    const selectedGlobeView = useMemo(() => parseGlobeView(searchParams), [searchParams]);
    const showStats = parseBoolean(searchParams.get('stats'), true);
    const layersOpen = parseBoolean(searchParams.get('layers'), false);
    // Older/shared URLs can request both panels. Layers takes precedence.
    const filterOpen = !layersOpen && parseBoolean(searchParams.get('filters'), false);
    const activeLayerSection = layersOpen
        ? parseEnum(searchParams.get('layerSection'), LAYER_PANEL_SECTIONS, 'none')
        : 'none';
    const showHelp = parseBoolean(searchParams.get('help'), false);

    const basemapParam = searchParams.get('basemap');
    const basemapId: BasemapId = isValidBasemapId(basemapParam) ? basemapParam : DEFAULT_BASEMAP_ID;
    const colorMode = parseColorMode(searchParams.get('color'));
    const animationEnabled = parseBoolean(searchParams.get('anim'), true);
    const showFlightPaths = parseBoolean(searchParams.get('paths'), true);
    const globeRotationEnabled = parseBoolean(searchParams.get('rotation'), false);
    const allAirportsVisible = parseBoolean(searchParams.get('allAirports'), false);
    const airportSymbolMode = parseEnum(searchParams.get('airportMode'), AIRPORT_SYMBOL_MODES, 'visited');
    const usStatesVisible = parseBoolean(searchParams.get('usStates'), false);
    const stateSymbolMode = parseEnum(searchParams.get('stateMode'), STATE_SYMBOL_MODES, 'visited');
    const isMetric = searchParams.get('units') === 'imperial' ? false : true;

    const hasUrlFilters = selectedYear !== null || selectedAirport !== null || selectedAirline !== null || selectedRoute !== null || selectedCountry !== null || selectedRegion !== null || selectedFlightType !== null;

    const setSelectedYear = useCallback((year: number | null) => {
        updateParams(params => {
            if (year === null || !Number.isInteger(year) || year <= 0) {
                params.delete('year');
            } else {
                params.set('year', String(year));
            }
        });
    }, [updateParams]);

    const setSelectedAirport = useCallback((airport: string | null) => {
        updateParams(params => {
            if (airport === null) {
                params.delete('airport');
            } else {
                params.set('airport', airport);
            }
            params.delete('route');
            params.delete('country');
            params.delete('region');
            params.delete('flightType');
        });
    }, [updateParams]);

    const setSelectedAirline = useCallback((airline: string | null) => {
        updateParams(params => {
            if (airline === null) {
                params.delete('airline');
            } else {
                params.set('airline', airline);
            }
        });
    }, [updateParams]);

    const setSelectedFlightType = useCallback((flightType: FlightTypeFilter | null) => {
        updateParams(params => {
            if (flightType === null || !isValidFlightTypeFilter(flightType)) {
                params.delete('flightType');
            } else {
                params.set('flightType', flightType);
                params.delete('airport');
                params.delete('route');
                params.delete('country');
                params.delete('region');
            }
        });
    }, [updateParams]);

    const setSelectedRoute = useCallback((route: string | null) => {
        updateParams(params => {
            if (route === null) {
                params.delete('route');
            } else {
                params.set('route', route);
            }
            params.delete('airport');
            params.delete('country');
            params.delete('region');
            params.delete('flightType');
        });
    }, [updateParams]);

    const setSelectedCountry = useCallback((country: string | null) => {
        updateParams(params => {
            if (country === null) {
                params.delete('country');
            } else {
                params.set('country', country);
            }
            params.delete('airport');
            params.delete('route');
            params.delete('region');
            params.delete('flightType');
        });
    }, [updateParams]);

    const setSelectedRegion = useCallback((region: string | null) => {
        updateParams(params => {
            if (region === null) {
                params.delete('region');
            } else {
                params.set('region', region);
            }
            params.delete('airport');
            params.delete('route');
            params.delete('country');
            params.delete('flightType');
        });
    }, [updateParams]);

    const setSelectedGlobeView = useCallback((view: GlobeViewState | null, options?: SearchUpdateOptions) => {
        updateParams(params => setGlobeViewParams(params, view), options);
    }, [updateParams]);

    const setShowStats = useCallback((next: BooleanUpdate) => {
        updateParams(params => setBooleanParamUpdate(params, 'stats', next, true));
    }, [updateParams]);

    const setFilterOpen = useCallback((next: BooleanUpdate) => {
        updateParams(params => {
            const currentValue = !parseBoolean(params.get('layers'), false) && parseBoolean(params.get('filters'), false);
            const nextValue = resolveBooleanUpdate(next, currentValue);
            setBooleanParam(params, 'filters', nextValue, false);
            if (nextValue) {
                params.delete('layers');
                params.delete('layerSection');
            }
        });
    }, [updateParams]);

    const setLayersOpen = useCallback((next: BooleanUpdate) => {
        updateParams(params => {
            const currentValue = parseBoolean(params.get('layers'), false);
            const nextValue = resolveBooleanUpdate(next, currentValue);
            setBooleanParam(params, 'layers', nextValue, false);
            if (currentValue || nextValue) params.delete('filters');
            if (!nextValue) params.delete('layerSection');
        });
    }, [updateParams]);

    const setActiveLayerSection = useCallback((section: LayerPanelSection) => {
        updateParams(params => {
            if (section === 'none') {
                params.delete('layerSection');
            } else {
                params.set('layers', '1');
                params.delete('filters');
                params.set('layerSection', section);
            }
        });
    }, [updateParams]);

    const setShowHelp = useCallback((next: BooleanUpdate) => {
        updateParams(params => setBooleanParamUpdate(params, 'help', next, false));
    }, [updateParams]);

    const setBasemapId = useCallback((id: BasemapId) => {
        updateParams(params => setEnumParam(params, 'basemap', id, DEFAULT_BASEMAP_ID));
    }, [updateParams]);

    const setColorMode = useCallback((mode: ColorMode) => {
        updateParams(params => setEnumParam(params, 'color', mode, 'default'));
    }, [updateParams]);

    const setAnimationEnabled = useCallback((next: BooleanUpdate) => {
        updateParams(params => setBooleanParamUpdate(params, 'anim', next, true));
    }, [updateParams]);

    const setShowFlightPaths = useCallback((next: BooleanUpdate) => {
        updateParams(params => setBooleanParamUpdate(params, 'paths', next, true));
    }, [updateParams]);

    const setGlobeRotationEnabled = useCallback((next: BooleanUpdate) => {
        updateParams(params => setBooleanParamUpdate(params, 'rotation', next, false));
    }, [updateParams]);

    const setAllAirportsVisible = useCallback((next: BooleanUpdate) => {
        updateParams(params => setBooleanParamUpdate(params, 'allAirports', next, false));
    }, [updateParams]);

    const setAirportSymbolMode = useCallback((mode: AirportSymbolMode) => {
        updateParams(params => setEnumParam(params, 'airportMode', mode, 'visited'));
    }, [updateParams]);

    const setUSStatesVisible = useCallback((next: BooleanUpdate) => {
        updateParams(params => setBooleanParamUpdate(params, 'usStates', next, false));
    }, [updateParams]);

    const setStateSymbolMode = useCallback((mode: StateSymbolMode) => {
        updateParams(params => setEnumParam(params, 'stateMode', mode, 'visited'));
    }, [updateParams]);

    const setIsMetric = useCallback((next: BooleanUpdate) => {
        updateParams(params => {
            const nextValue = resolveBooleanUpdate(next, params.get('units') !== 'imperial');
            if (nextValue) {
                params.delete('units');
            } else {
                params.set('units', 'imperial');
            }
        });
    }, [updateParams]);

    const clearAllFilters = useCallback(() => {
        updateParams(deleteSelectionParams);
    }, [updateParams]);

    // Parse selected route into origin/destination codes
    const selectedRouteAirports = useMemo(() => {
        if (!selectedRoute) return null;
        const parts = selectedRoute.split('-');
        if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
        return { origin: parts[0], destination: parts[1] };
    }, [selectedRoute]);

    return {
        selectedYear,
        selectedAirport,
        selectedAirline,
        selectedRoute,
        selectedCountry,
        selectedRegion,
        selectedFlightType,
        selectedGlobeView,
        showStats,
        filterOpen,
        layersOpen,
        activeLayerSection,
        showHelp,
        basemapId,
        colorMode,
        animationEnabled,
        showFlightPaths,
        globeRotationEnabled,
        allAirportsVisible,
        airportSymbolMode,
        usStatesVisible,
        stateSymbolMode,
        isMetric,
        hasUrlFilters,
        selectedRouteAirports,
        setSelectedYear,
        setSelectedAirport,
        setSelectedAirline,
        setSelectedRoute,
        setSelectedCountry,
        setSelectedRegion,
        setSelectedFlightType,
        setSelectedGlobeView,
        setShowStats,
        setFilterOpen,
        setLayersOpen,
        setActiveLayerSection,
        setShowHelp,
        setBasemapId,
        setColorMode,
        setAnimationEnabled,
        setShowFlightPaths,
        setGlobeRotationEnabled,
        setAllAirportsVisible,
        setAirportSymbolMode,
        setUSStatesVisible,
        setStateSymbolMode,
        setIsMetric,
        clearAllFilters,
    };
}
