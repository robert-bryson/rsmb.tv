import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlightsMap } from '../features/flights/components/FlightsMap';
import type { AirportsCollection, AllAirportsCollection, FlightsCollection, GlobeArc, GlobePoint, GlobeStaticArc, USStatesCollection } from '../features/flights/types';
import { makeAirport, makeFlight } from './helpers/flights';

const renderer = vi.hoisted(() => ({
    props: {} as ComponentProps<typeof Globe>,
    view: { lat: 0, lng: 0, altitude: 2 },
    listeners: new Map<string, Set<() => void>>(),
    controls: { autoRotate: false, autoRotateSpeed: 0, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    canvas: null as HTMLCanvasElement | null,
    pointOfView: vi.fn(),
    clearCache: vi.fn(),
    loadAsset: vi.fn(),
    readyOnMount: false,
    failRender: false,
    assetState: 'ready' as 'ready' | 'loading' | 'error',
    textureState: { isLoading: false, error: null as Error | null, progress: 100, attempt: 0, retry: vi.fn() },
}));

const flights: FlightsCollection = {
    type: 'FeatureCollection',
    features: [
        makeFlight({ durationMinutes: 165 }),
        makeFlight({ id: 2, date: '1/1/2025', durationMinutes: 240, durationKind: 'scheduled-block' }),
        makeFlight({ id: 3, date: '1/1/2026', destination_code: 'BFI' }),
    ].map(properties => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: [] } })),
};
const airports: AirportsCollection = {
    type: 'FeatureCollection',
    features: [makeAirport('SEA'), makeAirport('LAX', { region: 'US-CA' }), makeAirport('BFI')]
        .map(properties => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [0, 0] } })),
};
const allAirports: AllAirportsCollection = {
    type: 'FeatureCollection',
    features: [
        ...airports.features.map(feature => ({ ...feature, properties: { ...feature.properties, visited: true } })),
        { type: 'Feature', properties: { ...makeAirport('SFO', { region: 'US-CA' }), visited: false }, geometry: { type: 'Point', coordinates: [-122, 38] } },
        { type: 'Feature', properties: { ...makeAirport('YVR', { country: 'CA', region: 'CA-BC' }), visited: false }, geometry: { type: 'Point', coordinates: [-123, 49] } },
    ],
};
const states: USStatesCollection = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { code: 'US-WA', name: 'Washington', abbr: 'WA' }, geometry: { type: 'Polygon', coordinates: [[[-125, 45], [-117, 45], [-117, 49], [-125, 45]]] } }],
};

// Keep application state, filtering, and UI real. Replace only WebGL and asset loading.
vi.mock('react-globe.gl', async () => {
    const { useImperativeHandle, useLayoutEffect } = await import('react');
    return {
        default: function MockGlobe({ ref, ...props }: ComponentProps<typeof Globe>) {
            renderer.props = props;
            // Tile-only globes can report readiness while mounting, before the
            // library assigns its imperative ref.
            useLayoutEffect(() => {
                if (renderer.readyOnMount) props.onGlobeReady?.();
                // The renderer reports this event only on mount.
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            useImperativeHandle(ref, () => ({
                pointOfView: renderer.pointOfView,
                controls: () => renderer.controls,
                renderer: () => ({ domElement: renderer.canvas }),
                globeTileEngineClearCache: renderer.clearCache,
                toGlobeCoords: () => ({ lat: 12, lng: 34 }),
            }) as unknown as GlobeMethods, []);
            if (renderer.failRender) throw new Error('WebGL renderer failed');
            const arc = (props.arcsData as (GlobeStaticArc & { isStatic: boolean })[]).find(item => item.isStatic);
            return arc && <button onClick={() => props.onArcClick?.(arc, new MouseEvent('click'), { lat: 0, lng: 0, altitude: 0 })} onMouseEnter={() => props.onArcHover?.(arc, null)}>Tap route</button>;
        },
    };
});
vi.mock('../features/flights/hooks/useGlobeTextures', () => ({
    useGlobeTextures: () => renderer.textureState,
}));
vi.mock('../features/flights/hooks/useGeoJsonData', () => ({
    useGeoJsonData: (file: string, options?: { enabled?: boolean }) => {
        renderer.loadAsset(file, options?.enabled ?? true);
        if (renderer.assetState !== 'ready' && ['flights.geojson', 'visitedAirports.geojson'].includes(file)) {
            return { data: null, loading: renderer.assetState === 'loading', error: renderer.assetState === 'error' ? new Error('Flight data unavailable') : null };
        }
        return {
            data: options?.enabled === false ? null : {
                'flights.geojson': flights, 'visitedAirports.geojson': airports,
                'allAirports.geojson': allAirports, 'usStates.geojson': states,
            }[file],
            loading: false, error: null,
        };
    },
}));

function YearLinks() {
    const navigate = useNavigate();
    const location = useLocation();
    return <>
        <output data-testid="location">{location.search}</output>
        {[2024, 2025, 2026, 2027].map(year => <button key={year} onClick={() => {
            const params = new URLSearchParams(location.search);
            params.set('year', String(year));
            navigate(`?${params}`);
        }}>Use {year}</button>)}
        <button onClick={() => navigate('?rotation=1&lat=10&lng=20&alt=1')}>Move camera</button>
        <button onClick={() => {
            const params = new URLSearchParams(location.search);
            params.set('lat', '15');
            params.set('lng', '25');
            params.set('alt', '1');
            navigate(`?${params}`);
        }}>Move current camera</button>
        <button onClick={() => navigate('?year=2025&lat=15&lng=25&alt=1')}>Open shared year</button>
    </>;
}

function renderMap(query = '') {
    const ui = () => <MemoryRouter initialEntries={[`/projects/flights/map${query}`]}><FlightsMap /><YearLinks /></MemoryRouter>;
    const rendered = render(ui());
    return { ...rendered, refresh: () => rendered.rerender(ui()) };
}

type Arc = (GlobeArc | GlobeStaticArc) & { isStatic: boolean };
const renderedArcs = () => renderer.props.arcsData as Arc[];
const renderedPoints = () => renderer.props.pointsData as (GlobePoint & { isAllAirports?: boolean })[];
function rendererValue(name: 'arcColor' | 'arcStroke' | 'arcDashAnimateTime' | 'pointColor' | 'pointAltitude' | 'pointRadius' | 'arcLabel', data: object) {
    const accessor = renderer.props[name];
    if (typeof accessor === 'function') return (accessor as (datum: object) => unknown)(data);
    if (typeof accessor === 'string' && accessor in data) return Reflect.get(data, accessor);
    return accessor;
}

function clickArc(arc: Arc) {
    act(() => renderer.props.onArcClick?.(arc, new MouseEvent('click'), { lat: 0, lng: 0, altitude: 0 }));
}

function emitControl(type: string) {
    act(() => renderer.listeners.get(type)?.forEach(callback => callback()));
}

function selectMapYear(year: number) {
    fireEvent.click(screen.getByRole('button', { name: 'Toggle filters' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Filters' })).getByRole('button', { name: String(year) }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle filters' }));
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    renderer.canvas = document.createElement('canvas');
    renderer.readyOnMount = false;
    renderer.failRender = false;
    renderer.assetState = 'ready';
    renderer.textureState.error = null;
    renderer.listeners.clear();
    renderer.controls.autoRotate = false;
    renderer.controls.addEventListener.mockImplementation((type: string, callback: () => void) => {
        if (!renderer.listeners.has(type)) renderer.listeners.set(type, new Set());
        renderer.listeners.get(type)!.add(callback);
    });
    renderer.controls.removeEventListener.mockImplementation((type: string, callback: () => void) => {
        renderer.listeners.get(type)?.delete(callback);
    });
    renderer.pointOfView.mockImplementation((view?: typeof renderer.view) => {
        if (view) renderer.view = view;
        return renderer.view;
    });
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
        matches: query.includes('max-width'), media: query,
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
});

describe('globe lifecycle', () => {
    it('shows texture errors after loading ends and offers Retry', () => {
        renderer.textureState.error = new Error('Failed to load texture');
        renderMap();
        expect(screen.getByText('Failed to load globe textures')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Retry loading globe textures' }));
        expect(renderer.textureState.retry).toHaveBeenCalledOnce();
    });

    it('waits for delayed flight data before fitting the initial year', () => {
        vi.useFakeTimers();
        renderer.assetState = 'loading';
        const { refresh } = renderMap('?year=2024');
        act(() => renderer.props.onGlobeReady?.());
        act(() => vi.advanceTimersByTime(100));
        renderer.pointOfView.mockClear();
        renderer.assetState = 'ready';
        refresh();
        act(() => vi.advanceTimersByTime(100));
        expect(renderer.pointOfView).toHaveBeenCalledWith({ lat: 0, lng: 0, altitude: 0.3 }, 1000);
    });

    it('retains the initial year fit when flight data arrives before renderer readiness', () => {
        vi.useFakeTimers();
        renderMap('?year=2024');
        act(() => vi.advanceTimersByTime(100));
        expect(screen.getByTestId('location')).toHaveTextContent('lat=0&lng=0&alt=0.3');
        renderer.pointOfView.mockClear();

        act(() => renderer.props.onGlobeReady?.());
        expect(renderer.pointOfView).toHaveBeenCalledWith({ lat: 0, lng: 0, altitude: 0.3 }, 0);
        expect(screen.getByTestId('location')).toHaveTextContent('lat=0&lng=0&alt=0.3');
    });

    it('retains a camera navigation while a year fit is waiting for flight data', () => {
        vi.useFakeTimers();
        renderer.assetState = 'loading';
        const { refresh } = renderMap('?year=2024');
        act(() => renderer.props.onGlobeReady?.());
        fireEvent.click(screen.getByRole('button', { name: 'Move current camera' }));
        renderer.assetState = 'ready';
        refresh();
        act(() => vi.advanceTimersByTime(100));
        expect(renderer.view).toEqual({ lat: 15, lng: 25, altitude: 1 });
    });

    it('shows the flight-data failure without leaving the globe controls active', () => {
        renderer.assetState = 'error';
        renderMap();
        expect(screen.getByRole('heading', { name: 'Unable to load flight data' })).toBeVisible();
        expect(screen.queryByRole('application')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Pause flight animations' })).not.toBeInTheDocument();
    });
    it('handles synchronous readiness before the imperative ref is assigned', () => {
        renderer.readyOnMount = true;
        renderMap('?basemap=positron&lat=10&lng=20&alt=1');
        expect(renderer.pointOfView).toHaveBeenCalledWith({ lat: 10, lng: 20, altitude: 1 }, 0);
        expect(renderer.listeners.get('start')?.size).toBe(1);
        expect(renderer.clearCache).toHaveBeenCalled();
    });

    it('waits for renderer readiness before applying the linked camera', () => {
        renderMap('?lat=10&lng=20&alt=1');
        expect(renderer.pointOfView).not.toHaveBeenCalled();
        act(() => renderer.props.onGlobeReady?.());
        expect(renderer.pointOfView).toHaveBeenCalledWith({ lat: 10, lng: 20, altitude: 1 }, 0);
        act(() => renderer.props.onGlobeReady?.());
        expect(renderer.listeners.get('start')?.size).toBe(1);
    });

    it('keeps camera listeners attached after URL filters change and removes them on unmount', () => {
        const { unmount } = render(<MemoryRouter><FlightsMap /><YearLinks /></MemoryRouter>);
        act(() => renderer.props.onGlobeReady?.());
        expect(renderer.listeners.get('start')?.size).toBe(1);
        fireEvent.click(screen.getByRole('button', { name: 'Use 2025' }));
        expect(renderer.listeners.get('start')?.size).toBe(1);
        expect(renderer.listeners.get('end')?.size).toBe(1);
        expect(renderer.listeners.get('change')?.size).toBe(1);
        unmount();
        for (const listeners of renderer.listeners.values()) expect(listeners.size).toBe(0);
    });

    it('retains explicit rotation when a linked camera view changes', () => {
        render(<MemoryRouter initialEntries={['/?rotation=1']}><FlightsMap /><YearLinks /></MemoryRouter>);
        act(() => renderer.props.onGlobeReady?.());
        expect(renderer.controls.autoRotate).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: 'Move camera' }));
        expect(renderer.pointOfView).toHaveBeenCalledWith({ lat: 10, lng: 20, altitude: 1 }, 0);
        expect(renderer.controls.autoRotate).toBe(true);
    });

    it('debounces zoom updates, flushes the current camera on gesture end, and cancels pending work on unmount', () => {
        vi.useFakeTimers();
        const { unmount } = renderMap();
        act(() => renderer.props.onGlobeReady?.());
        act(() => vi.advanceTimersByTime(0));
        act(() => renderer.props.onZoom?.({ lat: 15, lng: 25, altitude: 1 }));
        act(() => vi.advanceTimersByTime(249));
        expect(screen.getByTestId('location')).toBeEmptyDOMElement();
        act(() => vi.advanceTimersByTime(1));
        expect(screen.getByTestId('location')).toHaveTextContent('lat=15&lng=25&alt=1');
        act(() => vi.advanceTimersByTime(0));
        renderer.view = { lat: 30, lng: 40, altitude: 0.5 };
        emitControl('change');
        emitControl('end');
        expect(screen.getByTestId('location')).toHaveTextContent('lat=30&lng=40&alt=0.5');
        act(() => vi.advanceTimersByTime(0));
        emitControl('change');
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('zooms toward a double click and detaches the canvas handler on unmount', () => {
        const { unmount } = renderMap();
        act(() => renderer.props.onGlobeReady?.());
        renderer.pointOfView.mockClear();
        fireEvent.doubleClick(renderer.canvas!);
        expect(renderer.pointOfView).toHaveBeenCalledWith({ lat: 12, lng: 34, altitude: 1 }, 1000);
        expect(renderer.pointOfView.mock.calls.filter(call => call.length > 0)).toHaveLength(1);
        unmount();
        renderer.pointOfView.mockClear();
        fireEvent.doubleClick(renderer.canvas!);
        expect(renderer.pointOfView).not.toHaveBeenCalled();
    });

    it('does not replace a shared year and camera view with a delayed year fit', () => {
        vi.useFakeTimers();
        renderMap('?year=2024&lat=10&lng=20&alt=1');
        act(() => renderer.props.onGlobeReady?.());
        act(() => vi.advanceTimersByTime(100));
        expect(renderer.view).toEqual({ lat: 10, lng: 20, altitude: 1 });
    });

    it.each(['Move current camera', 'Reset globe view to default position'])('cancels a pending year fit after %s', action => {
        vi.useFakeTimers();
        renderMap('?year=2024&lat=10&lng=20&alt=1');
        act(() => renderer.props.onGlobeReady?.());
        act(() => vi.advanceTimersByTime(0));
        selectMapYear(2025);
        fireEvent.click(screen.getByRole('button', { name: action }));
        const expected = { ...renderer.view };
        act(() => vi.advanceTimersByTime(100));
        expect(renderer.view).toEqual(expected);
    });

    it.each(['lat=10&lng=20', 'lat=15&lng=25'])('retains a camera supplied with a later shared year, initially %s', camera => {
        vi.useFakeTimers();
        renderMap(`?year=2024&${camera}&alt=1`);
        act(() => renderer.props.onGlobeReady?.());
        fireEvent.click(screen.getByRole('button', { name: 'Open shared year' }));
        act(() => vi.advanceTimersByTime(100));
        expect(renderer.view).toEqual({ lat: 15, lng: 25, altitude: 1 });
    });

    it('fits a locally selected year even when the URL already contains a camera', () => {
        vi.useFakeTimers();
        renderMap('?year=2024&lat=10&lng=20&alt=1');
        act(() => renderer.props.onGlobeReady?.());
        selectMapYear(2025);
        act(() => vi.advanceTimersByTime(100));
        expect(renderer.view).toEqual({ lat: 0, lng: 0, altitude: 0.3 });
    });

    it('cancels a pending year fit as soon as a camera gesture starts', () => {
        vi.useFakeTimers();
        renderMap('?year=2024&lat=10&lng=20&alt=1');
        act(() => renderer.props.onGlobeReady?.());
        act(() => vi.advanceTimersByTime(0));
        selectMapYear(2025);
        emitControl('start');
        renderer.view = { lat: 12, lng: 34, altitude: 1 };
        emitControl('change');
        act(() => vi.advanceTimersByTime(100));
        expect(renderer.view).toEqual({ lat: 12, lng: 34, altitude: 1 });
    });

    it('fits a populated year again after visiting an empty year and resetting the camera', () => {
        vi.useFakeTimers();
        renderMap('?year=2024');
        act(() => renderer.props.onGlobeReady?.());
        act(() => vi.advanceTimersByTime(100));
        const fitted = { ...renderer.view };
        fireEvent.click(screen.getByRole('button', { name: 'Use 2027' }));
        fireEvent.click(screen.getByRole('button', { name: 'Reset globe view to default position' }));
        expect(renderer.view).not.toEqual(fitted);
        fireEvent.click(screen.getByRole('button', { name: 'Use 2024' }));
        act(() => vi.advanceTimersByTime(100));
        expect(renderer.view).toEqual(fitted);
    });

    it('does not replace a route transition with an immediate URL camera echo', () => {
        vi.useFakeTimers();
        vi.mocked(window.matchMedia).mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
        renderMap();
        act(() => renderer.props.onGlobeReady?.());
        act(() => vi.advanceTimersByTime(0));
        renderer.pointOfView.mockClear();
        clickArc(renderedArcs().find(arc => !arc.isStatic)!);
        expect(renderer.pointOfView).toHaveBeenCalledTimes(1);
        expect(renderer.pointOfView).toHaveBeenLastCalledWith(expect.any(Object), 1000);
    });

    it('does not move the renderer again when a gesture publishes its current view', () => {
        vi.useFakeTimers();
        renderMap();
        act(() => renderer.props.onGlobeReady?.());
        act(() => vi.advanceTimersByTime(0));
        renderer.view = { lat: 15.123456, lng: 25.123456, altitude: 1.23456 };
        renderer.pointOfView.mockClear();
        emitControl('end');
        expect(screen.getByTestId('location')).toHaveTextContent('lat=15.1235&lng=25.1235&alt=1.235');
        expect(renderer.pointOfView.mock.calls.filter(call => call.length > 0)).toEqual([]);
    });

    it('cancels a pending year fit on navigation and unmount', () => {
        vi.useFakeTimers();
        const { unmount } = renderMap('?year=2024');
        act(() => renderer.props.onGlobeReady?.());
        act(() => vi.advanceTimersByTime(0));
        fireEvent.click(screen.getByRole('button', { name: 'Use 2025' }));
        fireEvent.click(screen.getByRole('button', { name: 'Use 2026' }));
        unmount();
        renderer.pointOfView.mockClear();
        act(() => vi.advanceTimersByTime(100));
        expect(renderer.pointOfView).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('cleans up after a renderer error and restores the current view on retry', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            renderMap('?lat=5&lng=6&alt=2');
            act(() => renderer.props.onGlobeReady?.());
            renderer.failRender = true;
            fireEvent.click(screen.getByRole('button', { name: 'Move camera' }));
            expect(screen.getByRole('heading', { name: 'Unable to load the globe' })).toBeVisible();
            for (const listeners of renderer.listeners.values()) expect(listeners.size).toBe(0);
            renderer.failRender = false;
            renderer.pointOfView.mockClear();
            fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
            act(() => renderer.props.onGlobeReady?.());
            expect(renderer.listeners.get('start')?.size).toBe(1);
            expect(renderer.pointOfView).toHaveBeenCalledWith({ lat: 10, lng: 20, altitude: 1 }, 0);
        } finally {
            consoleError.mockRestore();
        }
    });
});

describe('copying a flight map link', () => {
    it('offers manual copying when the legacy clipboard command returns false', async () => {
        vi.stubGlobal('navigator', Object.defineProperty(Object.create(navigator), 'clipboard', { value: undefined }));
        const execCommand = vi.fn().mockReturnValue(false);
        Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
        const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
        try {
            renderMap();
            const button = screen.getByRole('button', { name: 'Copy current view URL to clipboard' });
            await act(async () => fireEvent.click(button));
            expect(execCommand).toHaveBeenCalledWith('copy');
            expect(prompt).toHaveBeenCalledWith('Copy this URL:', window.location.href);
            expect(button).not.toHaveAttribute('title', 'URL copied!');
            expect(document.querySelector('input[style*="position: fixed"]')).toBeNull();
        } finally {
            prompt.mockRestore();
            Reflect.deleteProperty(document, 'execCommand');
        }
    });

    it('copies with the modern clipboard API and clears feedback on unmount', async () => {
        vi.useFakeTimers();
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', Object.defineProperty(Object.create(navigator), 'clipboard', { value: { writeText } }));
        const { unmount } = renderMap();
        const button = screen.getByRole('button', { name: 'Copy current view URL to clipboard' });
        await act(async () => fireEvent.click(button));
        expect(writeText).toHaveBeenCalledWith(window.location.href);
        expect(button).toHaveAttribute('title', 'URL copied!');
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does not schedule feedback after a pending clipboard operation outlives the map', async () => {
        vi.useFakeTimers();
        let finish!: () => void;
        const writeText = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
        vi.stubGlobal('navigator', Object.defineProperty(Object.create(navigator), 'clipboard', { value: { writeText } }));
        const { unmount } = renderMap();
        fireEvent.click(screen.getByRole('button', { name: 'Copy current view URL to clipboard' }));
        unmount();
        await act(async () => finish());
        expect(vi.getTimerCount()).toBe(0);
    });

    it('uses legacy copying when the modern clipboard rejects and retains focus', async () => {
        const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
        vi.stubGlobal('navigator', Object.defineProperty(Object.create(navigator), 'clipboard', { value: { writeText } }));
        const execCommand = vi.fn().mockReturnValue(true);
        Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
        try {
            renderMap();
            const button = screen.getByRole('button', { name: 'Copy current view URL to clipboard' });
            button.focus();
            await act(async () => fireEvent.click(button));
            expect(button).toHaveAttribute('title', 'URL copied!');
            expect(button).toHaveFocus();
            expect(execCommand).toHaveBeenCalledOnce();
        } finally { Reflect.deleteProperty(document, 'execCommand'); }
    });
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('route previews after filtering', () => {
    it('refreshes an open touch preview and removes it when its route is excluded', () => {
        render(<MemoryRouter initialEntries={['/projects/flights/map?year=2024']}><FlightsMap /><YearLinks /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Tap route' }));
        expect(within(screen.getByRole('dialog', { name: 'Route information' })).getByText('3h')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Use 2025' }));
        const dialog = screen.getByRole('dialog', { name: 'Route information' });
        const totalTime = within(dialog).getByTitle('Flight time: 4 h.');
        expect(totalTime).toBeVisible();
        expect(dialog).not.toHaveTextContent('Flight time: 2 hours 45 minutes');
        fireEvent.click(screen.getByRole('button', { name: 'Use 2026' }));
        expect(screen.queryByRole('dialog', { name: 'Route information' })).not.toBeInTheDocument();
    });

    it('refreshes hover time from the current route data', () => {
        render(<MemoryRouter initialEntries={['/projects/flights/map?year=2024']}><FlightsMap /><YearLinks /></MemoryRouter>);
        fireEvent.mouseEnter(screen.getByRole('button', { name: 'Tap route' }));
        expect(screen.getByRole('tooltip')).toHaveTextContent('Flight time: 2.8 h');
        fireEvent.click(screen.getByRole('button', { name: 'Use 2025' }));
        expect(screen.getByRole('tooltip')).toHaveTextContent('Flight time: 4 h');
        fireEvent.click(screen.getByRole('button', { name: 'Use 2026' }));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
});

describe('renderer layers and selection', () => {
    it('pauses and resumes existing arc objects without replacing their renderer data', () => {
        renderMap();
        const arcs = renderer.props.arcsData;
        const animated = renderedArcs().find(arc => !arc.isStatic)!;
        expect(Number(rendererValue('arcDashAnimateTime', animated))).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole('button', { name: 'Pause flight animations' }));
        expect(renderer.props.arcsData).toBe(arcs);
        expect(rendererValue('arcDashAnimateTime', animated)).toBe(0);
        fireEvent.click(screen.getByRole('button', { name: 'Play flight animations' }));
        expect(renderer.props.arcsData).toBe(arcs);
        expect(Number(rendererValue('arcDashAnimateTime', animated))).toBeGreaterThan(0);
    });

    it('highlights the selected route and endpoints while retaining background routes', () => {
        renderMap('?route=LAX-SEA');
        const selected = renderedArcs().find(arc => arc.isStatic && arc.routeKey === 'LAX-SEA')!;
        const other = renderedArcs().find(arc => arc.isStatic && arc.routeKey !== 'LAX-SEA')!;
        expect(rendererValue('arcStroke', selected)).toBeGreaterThan(rendererValue('arcStroke', other));
        expect(rendererValue('arcColor', selected)).not.toEqual(rendererValue('arcColor', other));
        const endpoint = renderedPoints().find(point => point.airport.code === 'LAX')!;
        const unrelated = renderedPoints().find(point => point.airport.code === 'BFI')!;
        expect(rendererValue('pointAltitude', endpoint)).toBeGreaterThan(rendererValue('pointAltitude', unrelated));
        expect(rendererValue('pointColor', endpoint)).not.toEqual(rendererValue('pointColor', unrelated));
        expect(rendererValue('pointRadius', endpoint)).toBeGreaterThan(Number(rendererValue('pointRadius', unrelated)));
    });

    it('selects and clears a visited airport while labeling its connected airports', () => {
        renderMap();
        const sea = renderedPoints().find(point => point.airport.code === 'SEA')!;
        const clickPoint = () => act(() => renderer.props.onPointClick?.(sea, new MouseEvent('click'), { lat: 0, lng: 0, altitude: 0 }));
        clickPoint();
        expect(screen.getByTestId('location')).toHaveTextContent('airport=SEA');
        expect(renderer.props.htmlElementsData?.map(point => (point as GlobePoint).airport.code)).toEqual(expect.arrayContaining(['SEA', 'LAX', 'BFI']));
        clickPoint();
        expect(screen.getByTestId('location')).not.toHaveTextContent('airport=');
        expect(screen.getByTestId('location')).toHaveTextContent('stats=0');
    });

    it.each(['country=US', 'region=US-CA'])('styles focused visited and unvisited airports consistently: %s', selection => {
        renderMap(`?${selection}&allAirports=1`);
        const points = renderedPoints();
        const focused = points.find(point => point.airport.code === 'LAX')!;
        const other = points.find(point => point.airport.code === 'YVR')!;
        const focusedUnvisited = points.find(point => point.airport.code === 'SFO')!;
        expect(rendererValue('pointColor', focusedUnvisited)).not.toEqual(rendererValue('pointColor', other));
        expect(rendererValue('pointAltitude', focusedUnvisited)).toBeGreaterThan(Number(rendererValue('pointAltitude', other)));
        expect(rendererValue('pointRadius', focusedUnvisited)).toBeGreaterThan(Number(rendererValue('pointRadius', other)));
        expect(rendererValue('pointAltitude', focused)).toBeGreaterThan(Number(rendererValue('pointAltitude', focusedUnvisited)));
        expect(rendererValue('pointRadius', focused)).toBeGreaterThan(Number(rendererValue('pointRadius', focusedUnvisited)));
    });

    it('selects a desktop route from an animated arc and clears it on a background click', () => {
        vi.mocked(window.matchMedia).mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
        renderMap();
        clickArc(renderedArcs().find(arc => !arc.isStatic)!);
        expect(screen.getByTestId('location')).toHaveTextContent('route=LAX-SEA');
        expect(screen.queryByRole('dialog', { name: 'Route information' })).not.toBeInTheDocument();
        act(() => renderer.props.onGlobeClick?.({ lat: 0, lng: 0 }, new MouseEvent('click')));
        expect(screen.getByTestId('location')).not.toHaveTextContent('route=');
        expect(screen.getByTestId('location')).toHaveTextContent('stats=0');
    });

    it('uses current route data for a phone tap on an animated arc', () => {
        renderMap('?year=2024');
        clickArc(renderedArcs().find(arc => !arc.isStatic)!);
        expect(within(screen.getByRole('dialog', { name: 'Route information' })).getByTitle(/^Flight time: 2\.8 h\./)).toHaveTextContent('3h');
        expect(screen.getByTestId('location')).not.toHaveTextContent('route=');
    });

    it.each(['?anim=0', '?rotation=1'])('respects disabled animation and reduced motion: %s', query => {
        if (query.includes('rotation')) {
            vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
        }
        renderMap(query);
        act(() => renderer.props.onGlobeReady?.());
        expect(renderedArcs().some(arc => !arc.isStatic)).toBe(true);
        for (const arc of renderedArcs()) expect(rendererValue('arcDashAnimateTime', arc)).toBe(0);
        expect(renderer.controls.autoRotate).toBe(false);
    });

    it('hides paths without removing airports or loading optional geography', () => {
        renderMap('?paths=0');
        expect(renderedArcs()).toEqual([]);
        expect(renderedPoints()).toHaveLength(3);
        expect(renderer.loadAsset).not.toHaveBeenCalledWith('allAirports.geojson', true);
        expect(renderer.loadAsset).not.toHaveBeenCalledWith('usStates.geojson', true);
    });

    it.each(['domestic', 'international'])('highlights and labels only airports represented by the %s flight type', flightType => {
        renderMap(`?flightType=${flightType}`);
        const point = renderedPoints().find(point => point.airport.code === 'SEA')!;
        if (flightType === 'domestic') {
            expect(renderer.props.htmlElementsData).toHaveLength(3);
            expect(rendererValue('pointAltitude', point)).toBe(0.05);
            expect(renderedArcs().filter(arc => !arc.isStatic).every(arc => Number(rendererValue('arcDashAnimateTime', arc)) > 0)).toBe(true);
        } else {
            expect(renderer.props.htmlElementsData).toEqual([]);
            expect(rendererValue('pointAltitude', point)).toBe(0.025);
        }
    });

    it('includes focused region airports without including unrelated unvisited airports', () => {
        renderMap('?region=US-CA');
        const codes = renderer.props.htmlElementsData?.map(point => (point as GlobePoint).airport.code);
        expect(codes).toEqual(expect.arrayContaining(['LAX', 'SFO']));
        expect(codes).not.toContain('YVR');
        expect(renderedPoints().find(point => point.airport.code === 'SFO')?.isAllAirports).toBe(true);
    });

    it.each(['?country=US', '?country=US&allAirports=1'])('deduplicates focused unvisited airports and keeps them unselectable: %s', query => {
        renderMap(query);
        expect(renderer.loadAsset).toHaveBeenCalledWith('allAirports.geojson', true);
        const points = renderedPoints();
        expect(points.filter(point => point.airport.code === 'SFO')).toHaveLength(1);
        expect(points.filter(point => point.airport.code === 'SEA')).toHaveLength(1);
        const unvisited = points.find(point => point.airport.code === 'SFO')!;
        act(() => renderer.props.onPointClick?.(unvisited, new MouseEvent('click'), { lat: 0, lng: 0, altitude: 0 }));
        expect(screen.getByTestId('location')).toHaveTextContent('country=US');
        expect(screen.getByTestId('location')).not.toHaveTextContent('airport=');
        expect(renderer.props.htmlElementsData?.some(point => (point as GlobePoint).airport.code === 'SFO')).toBe(true);
    });

    it('uses filtered flight legs for state polygons', () => {
        renderMap('?usStates=1&year=2024');
        expect(renderer.loadAsset).toHaveBeenCalledWith('usStates.geojson', true);
        expect(renderer.props.polygonsData).toHaveLength(1);
        expect(renderer.props.polygonsData?.[0]).toMatchObject({ stats: { flightCount: 1, duration: { totalMinutes: 165 } } });
        fireEvent.click(screen.getByRole('button', { name: 'Use 2025' }));
        expect(renderer.props.polygonsData?.[0]).toMatchObject({ stats: { flightCount: 1, duration: { totalMinutes: 240 } } });
    });
});
