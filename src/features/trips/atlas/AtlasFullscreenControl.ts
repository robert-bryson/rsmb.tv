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
