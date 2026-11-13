import { Map as MapLibreMap, NavigationControl, Popup } from '../../maps/maplibre';
import type { FilterSpecification, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { ResilientFullscreenControl, restoreFullscreenControl } from '../../maps/ResilientFullscreenControl';
import { cartoRasterStyle, cartoVectorStyleUrl } from '../../maps/cartoBasemaps';
import { recoverBasemap, type BasemapState } from '../../maps/recoverBasemap';
import { OVERVIEW_BOUNDS, formatRadius } from './geometry';
import { attachRadiusLabels } from './radiusLabels';
import { pinContext } from '../../../shared/worldPins';
import { isDescendantPin } from './navigation';
import { DATA_SOURCES, EMPTY, installPinLayers } from './mapLayers';
import type { PinsMapData, PinsMapProps, ViewRequest } from './types';

export const POINT_SOURCE_TIMEOUT_MS = 15_000;
// MapLibre's tap recognizer allows 500 ms between taps.
export const BACKGROUND_CLICK_DELAY_MS = 500;
interface Options {
    container: HTMLDivElement;
    overlay: HTMLDivElement;
    previousFullscreen: ResilientFullscreenControl | null;
    getProps: () => PinsMapProps;
    getData: () => PinsMapData;
    onError: (message: string) => void;
    onBasemapState: (state: BasemapState) => void;
    onLoading: () => void;
    onReady: () => void;
}

/** Own the renderer, its deadlines, and every resource that must survive a style change. */
export function createPinsRenderer(options: Options) {
    const { container, overlay, getProps, getData, onError, onReady } = options;
    const map = new MapLibreMap({
        container, style: cartoVectorStyleUrl('dark-matter'), bounds: OVERVIEW_BOUNDS,
        fitBoundsOptions: { padding: 32 }, minZoom: 0, maxZoom: 16,
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
            options.onLoading();
            deadline = setTimeout(() => fail('The map could not draw the pins. Retry the map to continue.'), POINT_SOURCE_TIMEOUT_MS);
        };
        cleanups.push(() => clearTimeout(deadline));
        const canvas = map.getCanvas();
        canvas.setAttribute('aria-label', 'Interactive globe of country, state, province, territory, and county pins');
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        const target = container.closest<HTMLElement>('.pins-map-area') ?? container.parentElement ?? container;
        const fullscreen = restoreFullscreenControl(target, options.previousFullscreen,
            element => new ResilientFullscreenControl({ container: element }));
        map.addControl(fullscreen, 'top-right');
        const recovery = recoverBasemap(map, {
            dataSources: DATA_SOURCES,
            providerStyle: () => cartoVectorStyleUrl('dark-matter'), neutralStyle: () => cartoRasterStyle('dark', ''),
        }, options.onBasemapState);
        cleanups.push(recovery.dispose);
        const labels = attachRadiusLabels(map, overlay);
        cleanups.push(labels.dispose);
        const popup = new Popup({ closeButton: false, closeOnClick: true, offset: 14, locationOccludedOpacity: 0 });
        cleanups.push(() => popup.remove());
        let hovered = '';
        let backgroundClick: ReturnType<typeof setTimeout> | undefined;
        const cancelBackgroundClick = () => { clearTimeout(backgroundClick); backgroundClick = undefined; };
        cleanups.push(cancelBackgroundClick);
        let hoverPoints: FeatureCollection | undefined;
        let hoverUnit: PinsMapProps['unit'] | undefined;
        const dismissPopup = () => {
            hovered = '';
            canvas.style.cursor = '';
            popup.remove();
        };
        const dismissOnEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            cancelBackgroundClick();
            if (!hovered) return;
            dismissPopup();
            // Close transient details before navigating the geographic hierarchy.
            event.preventDefault(); event.stopPropagation();
        };
        container.addEventListener('mouseleave', dismissPopup);
        document.addEventListener('keydown', dismissOnEscape, true);
        map.on('movestart', dismissPopup);
        map.on('movestart', cancelBackgroundClick);
        map.on('dblclick', cancelBackgroundClick);
        map.on('mousedown', cancelBackgroundClick);
        map.on('touchstart', cancelBackgroundClick);
        cleanups.push(() => {
            container.removeEventListener('mouseleave', dismissPopup);
            document.removeEventListener('keydown', dismissOnEscape, true);
            map.off('movestart', dismissPopup);
            map.off('movestart', cancelBackgroundClick);
            map.off('dblclick', cancelBackgroundClick);
            map.off('mousedown', cancelBackgroundClick);
            map.off('touchstart', cancelBackgroundClick);
        });
        const sent = new Map<string, unknown>();
        let lastViewKey: ViewRequest['key'] | undefined;
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
            if (hoverPoints !== data.points || hoverUnit !== current.unit) {
                hoverPoints = data.points;
                hoverUnit = current.unit;
                dismissPopup();
            }
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
            for (const id of ['state-pins', 'state-labels']) map.setLayoutProperty(id, 'visibility', current.showRegions === false ? 'none' : 'visible');
            map.setFilter('context-pins', ['all', ['==', ['get', 'context'], true],
                current.showCounties ? true : ['!=', ['get', 'level'], 'county'],
                current.showRegions === false ? ['!=', ['get', 'level'], 'state'] : true]);
            const filter: FilterSpecification = current.stateFips ? ['==', ['get', 'stateFips'], current.stateFips] : ['has', 'id'];
            for (const id of ['state-fill', 'state-lines', 'county-fill', 'county-lines']) map.setFilter(id, filter);
            for (const id of ['selected-state', 'selected-county', 'selected-pin']) map.setFilter(id, ['==', ['get', 'id'],
                id === 'selected-state' && current.stateFips ? `state-${current.stateFips}` : current.selected?.id ?? '']);
            if (current.view && current.view.key !== lastViewKey) {
                lastViewKey = current.view.key;
                map.resize();
                // Leave a visible center even in a short landscape viewport.
                const width = container.clientWidth, height = container.clientHeight;
                if (current.view.bounds[2] - current.view.bounds[0] >= 360) {
                    // Opposite edges of a world-sized bounds box meet on a globe.
                    // Frame the sphere explicitly instead of fitting that seam.
                    map.flyTo({ center: [0, 20], zoom: Math.max(0, Math.log2(Math.max(128, Math.min(width, height)) / 256) + 0.5),
                        padding: 0, bearing: 0, pitch: 0, roll: 0, duration: current.reducedMotion ? 0 : 900 });
                    return;
                }
                const tools = container.parentElement?.querySelector<HTMLElement>('.pins-map-tools')?.getBoundingClientRect();
                const box = container.getBoundingClientRect();
                const coveredTop = tools && tools.right >= box.left + width / 2 - 16 ? tools.bottom - box.top + 16 : 0;
                map.fitBounds(current.view.bounds, {
                    padding: { top: Math.min(height * 0.6, Math.max(Math.min(80, height / 4), coveredTop)), right: Math.min(50, width / 4), bottom: Math.min(60, height / 4), left: Math.min(50, width / 4) },
                    maxZoom: 13, duration: current.reducedMotion ? 0 : 900,
                });
            }
        };
        map.on('style.load', () => {
            if (disposed || failed) return;
            dismissPopup();
            sent.clear();
            // Hosted CARTO styles and the recovery style have their own defaults.
            // Restore the globe whenever either background is loaded.
            map.setProjection({ type: 'globe' });
            map.setSky({ 'sky-color': '#080e16', 'horizon-color': '#344d60', 'fog-color': '#171f26',
                'fog-ground-blend': 0, 'atmosphere-blend': 0.8 });
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
        map.on('click', event => {
            cancelBackgroundClick();
            const current = getProps(), native = event.originalEvent;
            if (disposed || failed || pointsPending || current.dataState !== 'ready'
                || native?.defaultPrevented || native && (native.button !== 0 || native.ctrlKey || native.metaKey || native.shiftKey || native.altKey)) return;
            const target = native?.target;
            if (target instanceof Element && target.closest('button, a, input, select, summary, .maplibregl-ctrl, .maplibregl-popup')) return;
            if ((native?.detail ?? 1) > 1) return;
            const layers = ['selected-pin', 'country-pins', 'state-pins', 'county-pins', 'context-pins'].filter(id => map.getLayer(id));
            const tolerance = window.matchMedia('(pointer: coarse)').matches ? 22 : 6;
            const { x, y } = event.point;
            const features = layers.length ? map.queryRenderedFeatures([[x - tolerance, y - tolerance], [x + tolerance, y + tolerance]], { layers }) : [];
            // Screen distance prevents a larger, already-selected marker from
            // swallowing a nearby small marker in the expanded touch target.
            const distance = (feature: typeof features[number]) => {
                if (feature.geometry?.type !== 'Point') return Infinity;
                const point = map.project(feature.geometry.coordinates as [number, number]);
                return Math.hypot(point.x - x, point.y - y);
            };
            features.sort((a, b) => (distance(a) - distance(b) || layers.indexOf(a.layer.id) - layers.indexOf(b.layer.id)));
            const marker = features.find(feature => feature.properties?.id);
            if (marker) { current.onSelect(String(marker.properties.id)); return; }
            const polygons = ['county-fill', 'state-fill'].filter(id => map.getLayer(id));
            const boundaries = polygons.length ? map.queryRenderedFeatures([x, y], { layers: polygons }) : [];
            for (const id of polygons) {
                const feature = boundaries.find(feature => feature.layer.id === id);
                if (feature?.properties?.id) {
                    const pin = current.pins.find(pin => pin.id === feature.properties.id);
                    // Sibling outlines provide context. Their pins remain direct
                    // targets; clicking their surrounding area moves up instead.
                    if (current.selected && feature.properties.id !== current.selected.id
                        && (!pin || !isDescendantPin(current.selected, pin))) continue;
                    if (feature.properties.id !== current.selected?.id) current.onSelect(String(feature.properties.id));
                    return;
                }
            }
            dismissPopup();
            const key = current.navigationKey;
            // Give a double-click/tap time to become a zoom gesture. Explicit
            // parent controls and Escape remain immediate.
            backgroundClick = setTimeout(() => {
                backgroundClick = undefined;
                if (!disposed && !failed && getProps().navigationKey === key) getProps().onNavigateUp?.();
            }, BACKGROUND_CLICK_DELAY_MS);
        });
        map.on('mousemove', event => {
            const current = getProps();
            const layers = ['country-pins', 'state-pins', 'county-pins', 'context-pins'].filter(id => map.getLayer(id));
            const feature = layers.length ? map.queryRenderedFeatures(event.point, { layers })[0] : null;
            const id = feature?.properties?.id ? String(feature.properties.id) : null;
            canvas.style.cursor = id ? 'pointer' : '';
            const signature = `${id}:${current.unit}`;
            if (hovered === signature) return;
            dismissPopup();
            const pin = current.pins.find(pin => pin.id === id) ?? current.contextPins?.find(pin => pin.id === id);
            if (!pin) return;
            hovered = signature;
            const content = document.createElement('div');
            content.className = 'pins-tooltip';
            const title = document.createElement('strong');
            title.textContent = pinContext(pin) ? `${pin.name}, ${pinContext(pin)}` : pin.name;
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
