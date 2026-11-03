import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';
import type { BrokenRecord, CountyRecordsCollection, RecentRecords, StateRecordsCollection } from '../features/temperatures/types';

interface TestFeature {
    layer: { id: string };
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: Record<string, unknown>;
}
interface TestEvent { features?: TestFeature[]; point?: { x: number; y: number } }
type Listener = (event: TestEvent) => void;

const mapMocks = vi.hoisted(() => {
    class TestMap {
        static instances: TestMap[] = [];
        layers = new Map<string, LayerSpecification>();
        sources = new Map<string, SourceSpecification & { setData: ReturnType<typeof vi.fn> }>();
        renderedFeatures: TestFeature[] = [];
        listeners: { type: string; layers?: string[]; callback: Listener }[] = [];
        remove = vi.fn();
        resize = vi.fn();
        addControl = vi.fn();
        fitBounds = vi.fn();
        flyTo = vi.fn();
        zoom = 3.5;
        constructor() { TestMap.instances.push(this); }
        on(type: string, layersOrListener: string | string[] | Listener, listener?: Listener) {
            this.listeners.push(typeof layersOrListener === 'function'
                ? { type, callback: layersOrListener }
                : { type, layers: [layersOrListener].flat(), callback: listener! });
        }
        fire(type: string, features: TestFeature[] = []) {
            this.renderedFeatures = features;
            for (const listener of this.listeners.filter(entry => entry.type === type)) {
                const matches = listener.layers ? features.filter(feature => listener.layers!.includes(feature.layer.id)) : features;
                if (!listener.layers || matches.length) listener.callback({ features: matches, point: { x: 100, y: 100 } });
            }
        }
        getSource(id: string) { return this.sources.get(id); }
        addSource(id: string, source: SourceSpecification) { this.sources.set(id, { ...source, setData: vi.fn() }); }
        getLayer(id: string) { return this.layers.get(id); }
        addLayer(layer: LayerSpecification) { this.layers.set(layer.id, structuredClone(layer)); }
        setLayoutProperty(id: string, property: string, value: unknown) {
            const layer = this.layers.get(id)!;
            layer.layout = { ...layer.layout, [property]: value };
        }
        setPaintProperty = vi.fn();
        getZoom() { return this.zoom; }
        getCanvas() { return { style: { cursor: '' } }; }
        queryRenderedFeatures(_point: unknown, { layers }: { layers: string[] }) {
            return this.renderedFeatures.filter(feature => layers.includes(feature.layer.id));
        }
    }
    class TestPopup {
        static instances: TestPopup[] = [];
        element = document.createElement('div');
        remove = vi.fn();
        constructor() { TestPopup.instances.push(this); }
        setLngLat() { return this; }
        setHTML(html: string) { this.element.innerHTML = html; return this; }
        addTo() { return this; }
        on() { return this; }
        getElement() { return this.element; }
    }
    return { Map: TestMap, Popup: TestPopup, NavigationControl: class {} };
});

vi.mock('maplibre-gl', () => mapMocks);
vi.mock('../features/temperatures/hooks/useTemperatureData', () => ({ useTemperatureData: vi.fn() }));
vi.mock('../features/temperatures/hooks/useClimateTrends', () => ({
    useClimateTrends: () => ({ trends: null, loading: false, error: null }),
}));
vi.mock('../features/temperatures/components/StationDetailPanel', () => ({
    StationDetailPanel: ({ stationName }: { stationName: string }) => <div data-testid="selected-station">{stationName}</div>,
}));

import { TemperatureMap } from '../features/temperatures/components/TemperatureMap';
import { useTemperatureData } from '../features/temperatures/hooks/useTemperatureData';

function record(overrides: Partial<BrokenRecord> = {}): BrokenRecord {
    return {
        stationName: 'Clicked station', uid: 1, state: 'KS', stateName: 'Kansas', county: '20001',
        lat: 39, lon: -100, elev: 100, type: 'high', tempF: 90, prevRecordF: 85,
        prevRecordDate: '2011-11-02', normalF: 70, date: '2026-11-02', recordScope: 'daily', ...overrides,
    };
}
function recent(records = [record()]): RecentRecords {
    return { asOf: '2026-11-03', yesterday: records, last7Days: records.slice(0, 1) };
}
function feature(layer: string, properties = record()): TestFeature {
    return { layer: { id: layer }, geometry: { type: 'Point', coordinates: [properties.lon, properties.lat] }, properties: { ...properties } };
}
function allTimeData() {
    const countyRecords: CountyRecordsCollection = {
        type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-100, 39] },
            properties: { countyFips: '20001', countyName: 'Test County', state: 'KS', type: 'high', tempF: 110,
                date: '2020-08-01', stationName: 'Test Station', lat: 39, lon: -100 } }],
    };
    const stateRecords: StateRecordsCollection = {
        type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-100, 39] },
            properties: { state: 'KS', stateName: 'Kansas', type: 'high', tempF: 120, date: '1936-07-01', location: 'Test', station: 'Test' } }],
    };
    return { countyRecords, stateRecords };
}
function data(overrides: Partial<ReturnType<typeof useTemperatureData>> = {}) {
    return {
        stateRecords: null, countyRecords: null, recentRecords: null, summary: null,
        loading: false, error: null, stateHighs: [], stateLows: [], ...overrides,
    };
}
function mount(path = '/projects/temperature-records/map') {
    const tree = () => <MemoryRouter initialEntries={[path]}><TemperatureMap /></MemoryRouter>;
    const rendered = render(tree());
    const map = mapMocks.Map.instances.at(-1)!;
    act(() => map.fire('load'));
    return { map, refresh: () => rendered.rerender(tree()) };
}
function label(map: InstanceType<typeof mapMocks.Map>, id: string) {
    const layer = map.getLayer(id);
    if (layer?.type !== 'symbol') throw new Error(`Missing symbol layer: ${id}`);
    return layer.layout?.['text-field'];
}

beforeEach(() => {
    mapMocks.Map.instances = [];
    mapMocks.Popup.instances = [];
    vi.mocked(useTemperatureData).mockReturnValue(data());
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('temperature map record rendering', () => {
    it('keeps nearby high and low records unclustered and limits collisions to text', () => {
        const records = [record(), record({ uid: 2, type: 'low', tempF: 20, lon: -100.01 })];
        vi.mocked(useTemperatureData).mockReturnValue(data({ recentRecords: recent(records) }));
        const { map } = mount();
        const source = map.getSource('broken-records');
        expect(source?.type).toBe('geojson');
        if (source?.type !== 'geojson') throw new Error('Missing record source');
        expect(source.cluster ?? false).toBe(false);
        expect(source.data).toMatchObject({ features: records.map(({ uid, type }) => ({ properties: { uid, type } })) });
        expect([...map.layers.keys()].some(id => id.includes('cluster'))).toBe(false);
        expect(map.getLayer('broken-highs')).toMatchObject({ type: 'circle', paint: { 'circle-color': '#ef4444' } });
        expect(map.getLayer('broken-lows')).toMatchObject({ type: 'circle', paint: { 'circle-stroke-color': '#3b82f6' } });
        expect(map.getLayer('broken-labels')).toMatchObject({ layout: { 'text-allow-overlap': false } });
    });

    it('uses Celsius when recent records arrive after the map loads', () => {
        const { map, refresh } = mount('/projects/temperature-records/map?unit=C');
        vi.mocked(useTemperatureData).mockReturnValue(data({ recentRecords: recent() }));
        refresh();
        expect(JSON.stringify(label(map, 'broken-labels'))).toContain('°C');
    });

    it.each(['county', 'state', 'freshness'])('does not show late recent markers in the %s view', view => {
        const { map, refresh } = mount(`/projects/temperature-records/map?view=${view}`);
        vi.mocked(useTemperatureData).mockReturnValue(data({ recentRecords: recent() }));
        refresh();
        for (const id of ['broken-glow', 'broken-highs', 'broken-lows', 'broken-labels']) {
            expect(map.getLayer(id)?.layout?.visibility).toBe('none');
        }
    });

    it.each(['county', 'state', 'freshness'])('shows the %s view when all-time data arrives late', view => {
        const { map, refresh } = mount(`/projects/temperature-records/map?view=${view}&unit=C`);
        vi.mocked(useTemperatureData).mockReturnValue(data(allTimeData()));
        refresh();
        const ids = view === 'county' ? ['county-highs', 'county-lows', 'county-labels']
            : view === 'state' ? ['state-highs', 'state-lows', 'state-labels'] : ['freshness-circles', 'freshness-labels'];
        for (const id of ids) expect(map.getLayer(id)?.layout?.visibility).toBe('visible');
        expect(JSON.stringify(label(map, 'state-highs'))).toContain('°C');
    });

    it('updates existing data for the chosen period and keeps markers in their view', () => {
        vi.mocked(useTemperatureData).mockReturnValue(data({ recentRecords: recent([record(), record({ uid: 2 })]) }));
        const { map } = mount();
        fireEvent.click(screen.getByRole('button', { name: 'Last 7 Days' }));
        expect(map.getSource('broken-records')?.setData).toHaveBeenLastCalledWith(expect.objectContaining({
            features: [expect.objectContaining({ properties: expect.objectContaining({ uid: 1, period: 'last7Days' }) })],
        }));
        fireEvent.click(screen.getByRole('button', { name: /County Extremes/ }));
        expect(map.getLayer('broken-highs')?.layout?.visibility).toBe('none');
        fireEvent.click(screen.getByRole('button', { name: /Recent/ }));
        expect(map.getLayer('broken-highs')?.layout?.visibility).toBe('visible');
    });

    it('selects the visible marker once when a neighboring glow overlaps it', () => {
        vi.mocked(useTemperatureData).mockReturnValue(data({ recentRecords: recent() }));
        const { map } = mount();
        act(() => map.fire('click', [feature('broken-highs'), feature('broken-glow', record({ uid: 2, stationName: 'Neighbor' })), feature('broken-glow')]));
        expect(screen.getByTestId('selected-station')).toHaveTextContent('Clicked station');
        expect(mapMocks.Popup.instances).toHaveLength(1);
    });

    it('keeps the glow selectable when the pointer misses the inner marker', () => {
        vi.mocked(useTemperatureData).mockReturnValue(data({ recentRecords: recent() }));
        const { map } = mount();
        act(() => map.fire('click', [feature('broken-glow')]));
        expect(screen.getByTestId('selected-station')).toHaveTextContent('Clicked station');
    });

    it('keeps the station selected when the map crosses the county zoom threshold', () => {
        vi.mocked(useTemperatureData).mockReturnValue(data({ recentRecords: recent() }));
        const { map } = mount();
        act(() => map.fire('click', [feature('broken-highs')]));
        act(() => { map.zoom = 6; map.fire('zoom'); });
        expect(screen.getByTestId('selected-station')).toHaveTextContent('Clicked station');
        expect(mapMocks.Popup.instances[0].remove).not.toHaveBeenCalled();
    });

    it('uses the current unit for hover text and selects the top marker once', () => {
        vi.mocked(useTemperatureData).mockReturnValue(data({ recentRecords: recent() }));
        const { map } = mount();
        fireEvent.click(screen.getByRole('button', { name: 'Switch to Celsius' }));
        act(() => map.fire('mousemove', [feature('broken-highs'), feature('broken-glow', record({ uid: 2, stationName: 'Neighbor' }))]));
        expect(mapMocks.Popup.instances).toHaveLength(1);
        expect(mapMocks.Popup.instances[0].element.textContent).toContain('32.2°C');
        expect(mapMocks.Popup.instances[0].element.textContent).toContain('Clicked station');
        expect(mapMocks.Popup.instances[0].element.textContent).not.toContain('Neighbor');
    });

    it('preserves state details during zoom and clears them when leaving the state view', () => {
        const records = allTimeData();
        vi.mocked(useTemperatureData).mockReturnValue(data(records));
        const { map } = mount('/projects/temperature-records/map?view=state');
        const state = records.stateRecords.features[0];
        act(() => map.fire('click', [{ layer: { id: 'state-highs' }, geometry: state.geometry, properties: { ...state.properties } }]));
        expect(map.getLayer('state-detail-circle')?.layout?.visibility).toBe('visible');
        expect(map.fitBounds).toHaveBeenCalledOnce();
        act(() => { map.zoom = 6; map.fire('zoom'); });
        expect(map.getLayer('state-detail-circle')?.layout?.visibility).toBe('visible');
        expect(mapMocks.Popup.instances[0].remove).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /County Extremes/ }));
        expect(map.getLayer('state-detail-circle')?.layout?.visibility).toBe('none');
        expect(mapMocks.Popup.instances[0].remove).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('button', { name: /State Extremes/ }));
        expect(map.getLayer('state-detail-circle')?.layout?.visibility).toBe('none');
    });

    it('escapes an invalid previous-record date instead of creating HTML elements', () => {
        const unsafe = record({ stationName: '<b>Station</b>', prevRecordDate: '<img src=x onerror="alert(1)">' });
        vi.mocked(useTemperatureData).mockReturnValue(data({ recentRecords: recent([unsafe]) }));
        const { map } = mount();
        act(() => map.fire('click', [feature('broken-highs', unsafe)]));
        const popup = mapMocks.Popup.instances.at(-1)!.element;
        expect(popup.querySelector('img, b')).toBeNull();
        expect(popup.textContent).toContain('<img src=x onerror="alert(1)">');
        expect(popup.textContent).toContain('<b>Station</b>');
    });
});
