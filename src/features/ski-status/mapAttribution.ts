import baseDownload from '../../../projects/ski-status/data/resort-bases.json?url';
import locationDownload from '../../../projects/ski-status/data/locations.json?url';
import terrainDownload from '../../../projects/ski-status/data/resort-terrain.pmtiles?url';
import { AttributionControl, type IControl } from '../../maps/maplibre';
import { escapeHtml } from '../../utils/escapeHtml';
import { locationAttribution, locationLicense } from './catalog';

const credits = {
    MapLibre: 'https://maplibre.org/',
    ...locationAttribution,
    ODbL: locationLicense,
};
const downloads = [
    { label: 'Catalog points', url: locationDownload, filename: 'ski-status-locations.json' },
    { label: 'Base points', url: baseDownload, filename: 'ski-status-resort-bases.json' },
    { label: 'Terrain data', url: terrainDownload, filename: 'ski-status-resort-terrain.pmtiles' },
];

export function skiMapAttribution(): IControl {
    const providerCredits = new AttributionControl({
        compact: false,
        customAttribution: Object.entries(credits).map(([label, url]) => `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`),
    });
    const control = document.createElement('details');
    control.className = 'maplibregl-ctrl ski-map-attribution';
    const toggle = document.createElement('summary');
    toggle.className = 'maplibregl-ctrl-attrib-button';
    toggle.setAttribute('aria-label', 'Map sources and data');
    toggle.title = 'Map sources and data';
    const panel = document.createElement('div');
    panel.className = 'ski-map-attribution-panel';
    const actions = document.createElement('div');
    actions.className = 'ski-map-downloads';
    for (const { label, url, filename } of downloads) {
        const link = document.createElement('a');
        link.textContent = label;
        link.href = url;
        link.download = filename;
        actions.append(link);
    }

    panel.append(actions);
    control.append(toggle, panel);

    function close() {
        control.open = false;
    }
    control.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !control.open) return;
        event.preventDefault();
        event.stopPropagation();
        close();
        toggle.focus({ preventScroll: true });
    });
    return {
        onAdd(map) {
            panel.prepend(providerCredits.onAdd(map));
            map.on('dragstart', close);
            return control;
        },
        onRemove(map) {
            map.off('dragstart', close);
            providerCredits.onRemove();
            control.remove();
        },
    };
}
