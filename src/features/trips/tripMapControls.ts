import * as maplibregl from 'maplibre-gl';
import { basemaps, type BasemapId } from './tripMapBasemaps';

export class BasemapControl implements maplibregl.IControl {
    private readonly container: HTMLDivElement;
    private readonly button: HTMLButtonElement;

    constructor(onCycle: () => void) {
        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.addEventListener('click', onCycle);

        const icon = document.createElement('span');
        icon.className = 'trip-basemap-control-icon';
        icon.setAttribute('aria-hidden', 'true');
        this.button.append(icon);
        this.container.append(this.button);
        this.setBasemap('muted');
    }

    onAdd() {
        return this.container;
    }

    onRemove() {
        this.container.remove();
    }

    setBasemap(id: BasemapId) {
        const label = basemaps.find((basemap) => basemap.id === id)?.label ?? id;
        this.button.title = `Change basemap (current: ${label})`;
        this.button.setAttribute('aria-label', `Change basemap (current: ${label})`);
    }
}

// Seed compact mode before source metadata arrives so MapLibre does not expand it.
export class CollapsedAttributionControl extends maplibregl.AttributionControl {
    onAdd(map: maplibregl.Map) {
        const container = super.onAdd(map);
        container.classList.add('maplibregl-compact');
        container.classList.remove('maplibregl-compact-show');
        container.removeAttribute('open');
        return container;
    }
}

export class DownloadRouteControl implements maplibregl.IControl {
    private readonly container = document.createElement('div');

    constructor(routeUrl: string) {
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group trip-route-download';
        const download = document.createElement('a');
        download.href = routeUrl;
        download.download = '';
        download.target = '_blank';
        download.rel = 'noreferrer';
        download.title = 'Download route (GeoJSON)';
        download.setAttribute('aria-label', download.title);
        download.innerHTML = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" /></svg>';
        this.container.append(download);
    }

    onAdd() {
        return this.container;
    }

    onRemove() {
        this.container.remove();
    }
}

export class RouteActionsControl implements maplibregl.IControl {
    private readonly container = document.createElement('div');
    private readonly reset = document.createElement('button');
    private map?: maplibregl.Map;

    constructor(onReset: () => void, initiallyFocused: boolean, label = 'Show full route') {
        this.container.className = 'maplibregl-ctrl trip-route-actions';
        this.reset.type = 'button';
        this.reset.textContent = label;
        this.reset.hidden = !initiallyFocused;
        this.reset.addEventListener('click', () => {
            this.map?.stop();
            this.map?.once('moveend', this.hideReset);
            onReset();
        });

        this.container.append(this.reset);
    }

    showReset = () => { this.reset.hidden = false; };
    private hideReset = () => { this.reset.hidden = true; };
    private watchMovement = () => {
        // Let the initial stop-focus animation finish before watching for changes.
        if (this.map?.isMoving()) this.map.once('moveend', this.watchMovement);
        else this.map?.on('move', this.showReset);
    };

    onAdd(map: maplibregl.Map) {
        this.map = map;
        map.once('load', this.watchMovement);
        return this.container;
    }

    onRemove() {
        this.map?.off('load', this.watchMovement);
        this.map?.off('move', this.showReset);
        this.map?.off('moveend', this.hideReset);
        this.map?.off('moveend', this.watchMovement);
        this.container.remove();
        this.map = undefined;
    }
}
