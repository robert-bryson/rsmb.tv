import { Map as MapLibreMap, NavigationControl, Popup } from '../../maps/maplibre';
import type { FilterSpecification, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { ResilientFullscreenControl, restoreFullscreenControl } from '../../maps/ResilientFullscreenControl';
import { cartoRasterStyle } from '../../maps/cartoBasemaps';
import { recoverBasemap, type BasemapState } from '../../maps/recoverBasemap';
import { OVERVIEW_BOUNDS, formatRadius } from './geometry';
import { attachRadiusLabels } from './radiusLabels';
import { DATA_SOURCES, EMPTY, installPinLayers } from './mapLayers';
import type { PinsMapData, PinsMapProps } from './types';

export const POINT_SOURCE_TIMEOUT_MS = 15_000;
interface Options {
    container: HTMLDivElement;
    overlay: HTMLDivElement;
    previousFullscreen: ResilientFullscreenControl | null;
    getProps: () => PinsMapProps;
    getData: () => PinsMapData;
    onError: (message: string) => void;
    onBasemapState: (state: BasemapState) => void;
    onReady: () => void;
}

/** Own the renderer, its deadlines, and every resource that must survive a style change. */
export function createPinsRenderer(options: Options) {
    const { container, overlay, getProps, getData, onError, onReady } = options;
    const map = new MapLibreMap({
        container, style: cartoRasterStyle('dark'), bounds: OVERVIEW_BOUNDS,
        fitBoundsOptions: { padding: 32 }, minZoom: 1.5, maxZoom: 16,
        attributionControl: { compact: false },
    });
    const cleanups: Array<() => void> = [() => map.remove()];
    let disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        for (const cleanup of cleanups.reverse()) cleanup();
    };
    try {
        let failed = false;
        let pointsPending = false;
        let deadline: ReturnType<typeof setTimeout> | undefined;
        const fail = (message: string) => {
            if (disposed || failed) return;
            failed = true;
            clearTimeout(deadline);
            onError(message);
        };
        const checkReady = () => {
            if (disposed || failed || !pointsPending || !map.getSource('pin-points') || !map.isSourceLoaded('pin-points')) return;
            pointsPending = false;
            clearTimeout(deadline);
            onReady();
        };
        const startDeadline = () => {
            if (pointsPending) return;
            pointsPending = true;
            deadline = setTimeout(() => fail('The map could not draw the pins. Retry the map to continue.'), POINT_SOURCE_TIMEOUT_MS);
        };
        cleanups.push(() => clearTimeout(deadline));
        map.getCanvas().setAttribute('aria-label', 'Interactive map of state, territory, and county pins');
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        const target = container.parentElement ?? container;
        const fullscreen = restoreFullscreenControl(target, options.previousFullscreen,
            element => new ResilientFullscreenControl({ container: element }));
        map.addControl(fullscreen, 'top-right');
        const recovery = recoverBasemap(map, {
            dataSources: DATA_SOURCES,
            providerStyle: () => cartoRasterStyle('dark'), neutralStyle: () => cartoRasterStyle('dark', ''),
        }, options.onBasemapState);
        cleanups.push(recovery.dispose);
        const labels = attachRadiusLabels(map, overlay);
        cleanups.push(labels.dispose);
        const sent = new Map<string, unknown>();
        let lastViewKey: number | undefined;
        const send = (id: string, data: FeatureCollection | null) => {
            const source = map.getSource(id) as GeoJSONSource | undefined;
            if (!source || sent.get(id) === (data ?? EMPTY)) return;
            source.setData(data ?? EMPTY);
            sent.set(id, data ?? EMPTY);
            if (id === 'pin-points' && data?.features.length) startDeadline();
        };
        const sync = () => {
            if (disposed || failed) return;
            const current = getProps(), data = getData();
            if (data.points.features.length && sent.get('pin-points') !== data.points) startDeadline();
            if (!map.getLayer('state-pins')) return;
            send('pin-states', current.states);
            send('pin-counties', current.counties);
            send('pin-points', data.points);
            send('pin-circles', data.circles);
            send('pin-selection', data.selection);
            send('pin-radii', data.radii);
            labels.setData(data.radii);
            for (const id of ['county-fill', 'county-lines', 'county-pins', 'county-labels']) {
                map.setLayoutProperty(id, 'visibility', current.showCounties ? 'visible' : 'none');
            }
            const filter: FilterSpecification = current.stateFips ? ['==', ['get', 'stateFips'], current.stateFips] : ['has', 'id'];
            for (const id of ['state-fill', 'state-lines', 'county-fill', 'county-lines']) map.setFilter(id, filter);
            for (const id of ['selected-state', 'selected-county', 'selected-pin']) map.setFilter(id, ['==', ['get', 'id'], current.selected?.id ?? '']);
            if (current.view && current.view.key !== lastViewKey) {
                lastViewKey = current.view.key;
                map.resize();
                // Leave a visible center even in a short landscape viewport.
                const width = container.clientWidth, height = container.clientHeight;
                map.fitBounds(current.view.bounds, {
                    padding: { top: Math.min(80, height / 4), right: Math.min(50, width / 4), bottom: Math.min(60, height / 4), left: Math.min(50, width / 4) },
                    maxZoom: 13, duration: current.reducedMotion ? 0 : 900,
                });
            }
        };
        map.on('style.load', () => {
            if (disposed || failed) return;
            sent.clear();
            installPinLayers(map);
            sync();
        });
        map.on('render', checkReady);
        map.on('sourcedata', checkReady);
        map.on('error', (event: { sourceId?: string; error?: { message: string } }) => {
            if ((event.sourceId && DATA_SOURCES.has(event.sourceId)) || /worker|webgl|context/i.test(event.error?.message ?? '')) {
                fail('The map renderer stopped. Retry the map to continue.');
            }
        });
        map.on('webglcontextlost', () => fail('The map graphics context was interrupted. Retry the map to continue.'));
        const onMove = () => getProps().onZoom(map.getZoom());
        map.on('zoomend', onMove);
        onMove();
        const clickableLayers = () => ['selected-pin', 'country-pins', 'state-pins', 'county-pins', 'county-fill', 'state-fill'].filter(id => map.getLayer(id));
        map.on('click', event => {
            const layers = clickableLayers();
            const features = layers.length ? map.queryRenderedFeatures([event.point.x, event.point.y], { layers }) : [];
            for (const id of layers) {
                const feature = features.find(feature => feature.layer.id === id);
                if (feature?.properties?.id) { getProps().onSelect(String(feature.properties.id)); return; }
            }
        });
        const popup = new Popup({ closeButton: false, closeOnClick: true, offset: 14 });
        cleanups.push(() => popup.remove());
        let hovered = '';
        map.on('mousemove', event => {
            const current = getProps();
            const layers = ['country-pins', 'state-pins', 'county-pins'].filter(id => map.getLayer(id));
            const feature = layers.length ? map.queryRenderedFeatures(event.point, { layers })[0] : null;
            const id = feature?.properties?.id ? String(feature.properties.id) : null;
            map.getCanvas().style.cursor = id ? 'pointer' : '';
            const signature = `${id}:${current.unit}`;
            if (hovered === signature) return;
            hovered = signature;
            popup.remove();
            const pin = current.pins.find(pin => pin.id === id);
            if (!pin) return;
            const content = document.createElement('div');
            content.className = 'pins-tooltip';
            const title = document.createElement('strong');
            title.textContent = pin.level === 'county' ? `${pin.name}, ${pin.stateAbbr}` : pin.name;
            const distance = document.createElement('span');
            distance.textContent = `${formatRadius(pin.radiusMeters, current.unit)} to the nearest edge`;
            content.append(title, distance);
            popup.setLngLat(event.lngLat).setDOMContent(content).addTo(map);
        });
        const resize = new ResizeObserver(() => map.resize());
        cleanups.push(() => resize.disconnect());
        resize.observe(container);
        sync();
        return { sync, fullscreen, retryBasemap: recovery.retry, dispose };
    } catch (error) {
        dispose();
        throw error;
    }
}
