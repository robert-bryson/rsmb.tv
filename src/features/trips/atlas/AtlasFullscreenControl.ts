import { FullscreenControl, type FullscreenControlOptions, type Map } from 'maplibre-gl';

/** MapLibre rebuilds the button on reattachment but retains its fullscreen state. */
export class AtlasFullscreenControl extends FullscreenControl {
    private active = false;

    constructor(options: FullscreenControlOptions) {
        super(options);
        this.on('fullscreenstart', () => { this.active = true; });
        this.on('fullscreenend', () => { this.active = false; });
    }

    override onAdd(map: Map) {
        const container = super.onAdd(map);
        const button = container.querySelector('button');
        button?.classList.toggle('maplibregl-ctrl-shrink', this.active);
        button?.classList.toggle('maplibregl-ctrl-fullscreen', !this.active);
        return container;
    }
}

/** Reuse a control while its stable fullscreen target survives renderer replacement. */
export function restoreAtlasFullscreenControl(container: HTMLElement, previous: AtlasFullscreenControl | null) {
    const document = container.ownerDocument as Document & { webkitFullscreenElement?: Element | null };
    const active = (document.fullscreenElement ?? document.webkitFullscreenElement) === container
        || container.classList.contains('maplibregl-pseudo-fullscreen');
    // A failed renderer can leave the control detached while native fullscreen exits.
    // Recreate inactive controls so MapLibre discards its unobserved fullscreen state.
    return previous && active ? previous : new AtlasFullscreenControl({ container });
}
