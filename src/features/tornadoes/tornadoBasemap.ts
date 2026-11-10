import type { Map } from '../../maps/maplibre';
import { cartoRasterStyle, cartoVectorStyle } from '../../maps/cartoBasemaps';

export type TornadoBasemapState = 'loading' | 'ready' | 'unavailable';
export const TORNADO_BASEMAP_TIMEOUT_MS = 15_000;

const DATA_SOURCES = new Set([
    'tornado-tracks', 'tornado-track-points', 'tornado-points', 'selected-tornado-track', 'us-states',
]);

/** Keep data layers usable when the hosted style or its resources cannot load. */
export function recoverTornadoBasemap(map: Map, onState: (state: TornadoBasemapState) => void) {
    let disposed = false;
    let state: TornadoBasemapState = 'loading';
    let providerSources: string[] | null = null;
    let rendererUnavailable = false;
    let timer: ReturnType<typeof setTimeout>;

    function setState(next: TornadoBasemapState) {
        if (state === next) return;
        state = next;
        onState(next);
    }

    function showNeutralBackground() {
        if (disposed || rendererUnavailable || state === 'unavailable') return;
        clearTimeout(timer);
        providerSources = null;
        setState('unavailable');
        map.setStyle(cartoRasterStyle('dark', ''), { diff: false });
    }

    function startDeadline() {
        clearTimeout(timer);
        timer = setTimeout(showNeutralBackground, TORNADO_BASEMAP_TIMEOUT_MS);
    }

    function handleError(event: { error?: { message: string }; sourceId?: string }) {
        if (event.sourceId && DATA_SOURCES.has(event.sourceId)) return;
        if (/webgl|context|worker/i.test(event.error?.message ?? '')) {
            handleRendererUnavailable();
            return;
        }
        showNeutralBackground();
    }

    function checkReady() {
        if (disposed || rendererUnavailable || state !== 'loading' || providerSources === null) return;
        // Global `idle` also waits for application GeoJSON and camera motion.
        // Only provider sources belong to the background deadline.
        if (!providerSources.every(id => map.getSource(id) && map.isSourceLoaded(id))) return;
        clearTimeout(timer);
        setState('ready');
    }

    function handleStyleLoad() {
        if (state !== 'loading') return;
        providerSources = Object.keys(map.getStyle().sources).filter(id => !DATA_SOURCES.has(id));
    }

    function handleRendererUnavailable() {
        rendererUnavailable = true;
        clearTimeout(timer);
    }

    function handleRendererRestored() {
        rendererUnavailable = false;
        if (state === 'loading') startDeadline();
    }

    map.on('error', handleError);
    map.on('style.load', handleStyleLoad);
    map.on('render', checkReady);
    map.on('sourcedata', checkReady);
    map.on('idle', checkReady);
    map.on('webglcontextlost', handleRendererUnavailable);
    map.on('webglcontextrestored', handleRendererRestored);
    startDeadline();

    return {
        retry() {
            if (disposed || rendererUnavailable) return;
            providerSources = null;
            setState('loading');
            startDeadline();
            map.setStyle(cartoVectorStyle('dark-matter'), { diff: false });
        },
        dispose() {
            disposed = true;
            clearTimeout(timer);
            map.off('error', handleError);
            map.off('style.load', handleStyleLoad);
            map.off('render', checkReady);
            map.off('sourcedata', checkReady);
            map.off('idle', checkReady);
            map.off('webglcontextlost', handleRendererUnavailable);
            map.off('webglcontextrestored', handleRendererRestored);
        },
    };
}
