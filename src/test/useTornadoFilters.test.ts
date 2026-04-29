import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTornadoFilters } from '../features/tornadoes/hooks/useTornadoFilters';
import { DEFAULT_END_YEAR, DEFAULT_START_YEAR, INITIAL_CENTER, INITIAL_ZOOM } from '../features/tornadoes/constants';

function wrapper({ children }: { children: ReactNode }) {
    return MemoryRouter({ initialEntries: ['/tornadoes'], children });
}

function wrapperWithParams(params: string) {
    return ({ children }: { children: ReactNode }) =>
        MemoryRouter({ initialEntries: [`/tornadoes?${params}`], children });
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

describe('useTornadoFilters — defaults', () => {
    it('starts with default year range', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        expect(result.current.filters.startYear).toBe(DEFAULT_START_YEAR);
        expect(result.current.filters.endYear).toBe(DEFAULT_END_YEAR);
    });

    it('starts with scaleFilter=all', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        expect(result.current.filters.scaleFilter).toBe('all');
    });

    it('starts with region=conus', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        expect(result.current.filters.region).toBe('conus');
    });

    it('starts with mode=tracks', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        expect(result.current.filters.mode).toBe('tracks');
    });

    it('starts with colorMode=scale', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        expect(result.current.filters.colorMode).toBe('scale');
    });

    it('starts with selectedTrackId=null', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        expect(result.current.filters.selectedTrackId).toBeNull();
    });

    it('starts with selectedState=null', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        expect(result.current.filters.selectedState).toBeNull();
    });

    it('starts with default map center and zoom', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        expect(result.current.filters.mapLng).toBe(INITIAL_CENTER[0]);
        expect(result.current.filters.mapLat).toBe(INITIAL_CENTER[1]);
        expect(result.current.filters.mapZoom).toBe(INITIAL_ZOOM);
    });
});

// ---------------------------------------------------------------------------
// URL param parsing
// ---------------------------------------------------------------------------

describe('useTornadoFilters — URL param parsing', () => {
    it('reads year range from ?start= and ?end=', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('start=1990&end=2000'),
        });
        expect(result.current.filters.startYear).toBe(1990);
        expect(result.current.filters.endYear).toBe(2000);
    });

    it('falls back to default for invalid year values', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('start=abc&end='),
        });
        expect(result.current.filters.startYear).toBe(DEFAULT_START_YEAR);
        expect(result.current.filters.endYear).toBe(DEFAULT_END_YEAR);
    });

    it.each([
        'ef0', 'ef1', 'ef2', 'ef3', 'ef4', 'ef5',
        'ef1plus', 'ef2plus', 'ef3plus', 'all',
    ] as const)('parses scale filter %s from URL', (value) => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams(`scale=${value}`),
        });
        expect(result.current.filters.scaleFilter).toBe(value);
    });

    it('falls back to "all" for unknown scale values', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('scale=invalid'),
        });
        expect(result.current.filters.scaleFilter).toBe('all');
    });

    it('reads selectedTrackId from ?track=', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('track=20240521-KS-001'),
        });
        expect(result.current.filters.selectedTrackId).toBe('20240521-KS-001');
    });

    it('reads selectedState from ?state= and normalizes case', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('state=ks'),
        });
        expect(result.current.filters.selectedState).toBe('KS');
    });

    it('treats selectedState as the canonical geography when both state and region are present', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('state=ks&region=plains'),
        });
        expect(result.current.filters.selectedState).toBe('KS');
        expect(result.current.filters.region).toBe('conus');
    });

    it('ignores invalid selectedState values', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('state=kansas'),
        });
        expect(result.current.filters.selectedState).toBeNull();
    });

    it('reads region from URL', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('region=plains'),
        });
        expect(result.current.filters.region).toBe('plains');
    });

    it('falls back to conus for unknown region', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('region=atlantis'),
        });
        expect(result.current.filters.region).toBe('conus');
    });

    it.each(['scale', 'year', 'decade'] as const)('parses color mode %s from URL', (value) => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams(`color=${value}`),
        });
        expect(result.current.filters.colorMode).toBe(value);
    });

    it('falls back to "scale" for unknown color mode values', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('color=rainbow'),
        });
        expect(result.current.filters.colorMode).toBe('scale');
    });

    it('reads map view from ?lat=, ?lng=, ?zoom=', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('lat=36.1&lng=-97.5&zoom=5.25'),
        });
        expect(result.current.filters.mapLat).toBe(36.1);
        expect(result.current.filters.mapLng).toBe(-97.5);
        expect(result.current.filters.mapZoom).toBe(5.25);
    });

    it('falls back to defaults for invalid map view params', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('lat=abc&lng=&zoom=NaN'),
        });
        expect(result.current.filters.mapLat).toBe(INITIAL_CENTER[1]);
        expect(result.current.filters.mapLng).toBe(INITIAL_CENTER[0]);
        expect(result.current.filters.mapZoom).toBe(INITIAL_ZOOM);
    });

    it('falls back to defaults for out-of-bounds map view params', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('lat=999&lng=9999&zoom=-5'),
        });
        expect(result.current.filters.mapLat).toBe(INITIAL_CENTER[1]);
        expect(result.current.filters.mapLng).toBe(INITIAL_CENTER[0]);
        expect(result.current.filters.mapZoom).toBe(INITIAL_ZOOM);
    });
});

// ---------------------------------------------------------------------------
// Setters
// ---------------------------------------------------------------------------

describe('useTornadoFilters — setters', () => {
    it('setYearRange to defaults removes start/end from URL', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('start=1990&end=2000'),
        });
        act(() => result.current.setYearRange(DEFAULT_START_YEAR, DEFAULT_END_YEAR));
        expect(result.current.filters.startYear).toBe(DEFAULT_START_YEAR);
        expect(result.current.filters.endYear).toBe(DEFAULT_END_YEAR);
    });

    it('setYearRange updates start and end', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        act(() => result.current.setYearRange(2010, 2015));
        expect(result.current.filters.startYear).toBe(2010);
        expect(result.current.filters.endYear).toBe(2015);
    });

    it('setYearRange normalizes inverted range', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        act(() => result.current.setYearRange(2020, 2005));
        expect(result.current.filters.startYear).toBe(2005);
        expect(result.current.filters.endYear).toBe(2020);
    });

    it('setScaleFilter updates scaleFilter', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        act(() => result.current.setScaleFilter('ef3plus'));
        expect(result.current.filters.scaleFilter).toBe('ef3plus');
    });

    it('setScaleFilter to "all" removes ?scale= from URL', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('scale=ef2plus'),
        });
        act(() => result.current.setScaleFilter('all'));
        expect(result.current.filters.scaleFilter).toBe('all');
    });

    it('setRegion updates region', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        act(() => result.current.setRegion('dixie'));
        expect(result.current.filters.region).toBe('dixie');
    });

    it('setRegion("conus") removes ?region= from URL', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('region=plains'),
        });
        act(() => result.current.setRegion('conus'));
        expect(result.current.filters.region).toBe('conus');
    });

    it('setRegion clears selected state', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('state=KS'),
        });
        act(() => result.current.setRegion('plains'));
        expect(result.current.filters.region).toBe('plains');
        expect(result.current.filters.selectedState).toBeNull();
    });

    it('setMode updates mode', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        act(() => result.current.setMode('density'));
        expect(result.current.filters.mode).toBe('density');
    });

    it('setMode("tracks") removes ?mode= from URL', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('mode=density'),
        });
        act(() => result.current.setMode('tracks'));
        expect(result.current.filters.mode).toBe('tracks');
    });

    it('setColorMode updates colorMode', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        act(() => result.current.setColorMode('year'));
        expect(result.current.filters.colorMode).toBe('year');
    });

    it('setColorMode("decade") updates colorMode to decade', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        act(() => result.current.setColorMode('decade'));
        expect(result.current.filters.colorMode).toBe('decade');
    });

    it('setColorMode("scale") removes ?color= from URL (default)', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('color=decade'),
        });
        act(() => result.current.setColorMode('scale'));
        expect(result.current.filters.colorMode).toBe('scale');
    });

    it('setSelectedTrackId writes track ID to URL', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        act(() => result.current.setSelectedTrackId('track-abc-123'));
        expect(result.current.filters.selectedTrackId).toBe('track-abc-123');
    });

    it('setSelectedTrackId(null) removes ?track= from URL', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('track=abc'),
        });
        act(() => result.current.setSelectedTrackId(null));
        expect(result.current.filters.selectedTrackId).toBeNull();
    });

    it('setSelectedState writes normalized state to URL and clears region', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('region=plains'),
        });
        act(() => result.current.setSelectedState('ks'));
        expect(result.current.filters.selectedState).toBe('KS');
        expect(result.current.filters.region).toBe('conus');
    });

    it('setSelectedState(null) removes ?state= from URL', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('state=OK'),
        });
        act(() => result.current.setSelectedState(null));
        expect(result.current.filters.selectedState).toBeNull();
    });

    it('setSelectedState ignores invalid state values', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('state=TX'),
        });
        act(() => result.current.setSelectedState('texas'));
        expect(result.current.filters.selectedState).toBeNull();
    });

    it('setMapView updates lat, lng, zoom in URL', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        act(() => result.current.setMapView(35.5, -98.25, 6));
        expect(result.current.filters.mapLat).toBe(35.5);
        expect(result.current.filters.mapLng).toBe(-98.25);
        expect(result.current.filters.mapZoom).toBe(6);
    });

    it('setMapView to defaults removes lat/lng/zoom params', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('lat=35.5&lng=-98.25&zoom=6'),
        });
        act(() => result.current.setMapView(INITIAL_CENTER[1], INITIAL_CENTER[0], INITIAL_ZOOM));
        expect(result.current.filters.mapLat).toBe(INITIAL_CENTER[1]);
        expect(result.current.filters.mapLng).toBe(INITIAL_CENTER[0]);
        expect(result.current.filters.mapZoom).toBe(INITIAL_ZOOM);
    });
});

// ---------------------------------------------------------------------------
// selectState (combined action)
// ---------------------------------------------------------------------------

describe('useTornadoFilters — selectState', () => {
    it('sets state, switches mode to trends, clears track, and clears region — atomically', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('region=plains&mode=density&track=abc-123'),
        });
        act(() => result.current.selectState('OK'));
        const { filters } = result.current;
        expect(filters.selectedState).toBe('OK');
        expect(filters.mode).toBe('trends');
        expect(filters.selectedTrackId).toBeNull();
        expect(filters.region).toBe('conus'); // region overridden by state
    });

    it('normalizes lowercase state abbreviation', () => {
        const { result } = renderHook(() => useTornadoFilters(), { wrapper });
        act(() => result.current.selectState('tx'));
        expect(result.current.filters.selectedState).toBe('TX');
    });

    it('ignores invalid state abbreviations (> 2 letters)', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('state=TX'),
        });
        act(() => result.current.selectState('texas'));
        // invalid input → selectState treats it as null → clears state
        expect(result.current.filters.selectedState).toBeNull();
    });

    it('selectState(null) clears the selected state', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('state=KS&mode=trends'),
        });
        act(() => result.current.selectState(null));
        expect(result.current.filters.selectedState).toBeNull();
    });

    it('selectState(null) does not alter mode (deselect stays in current mode)', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('state=KS&mode=trends'),
        });
        act(() => result.current.selectState(null));
        // mode is intentionally left unchanged on deselect
        expect(result.current.filters.mode).toBe('trends');
    });

    it('does not affect year range or scale filter', () => {
        const { result } = renderHook(() => useTornadoFilters(), {
            wrapper: wrapperWithParams('start=2010&end=2020&scale=ef3plus'),
        });
        act(() => result.current.selectState('NE'));
        expect(result.current.filters.startYear).toBe(2010);
        expect(result.current.filters.endYear).toBe(2020);
        expect(result.current.filters.scaleFilter).toBe('ef3plus');
    });
});
