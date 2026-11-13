import { FullscreenControl, type FullscreenControlOptions, type Map } from './maplibre';

/** Retain fullscreen state when a renderer removes and reattaches its controls. */
export class ResilientFullscreenControl extends FullscreenControl {
    protected active = false;
    protected button: HTMLButtonElement | null = null;

    protected updateButton() {
        this.button?.classList.toggle('maplibregl-ctrl-shrink', this.active);
        this.button?.classList.toggle('maplibregl-ctrl-fullscreen', !this.active);
    }

    constructor(options: FullscreenControlOptions) {
        super(options);
        this.on('fullscreenstart', () => { this.active = true; this.updateButton(); });
        this.on('fullscreenend', () => { this.active = false; this.updateButton(); });
    }

    override onAdd(map: Map) {
        const container = super.onAdd(map);
        this.button = container.querySelector('button');
        this.updateButton();
        return container;
    }
}

export function restoreFullscreenControl<T extends ResilientFullscreenControl>(
    container: HTMLElement, previous: T | null, create: (target: HTMLElement) => T,
): T {
    const document = container.ownerDocument as Document & { webkitFullscreenElement?: Element | null };
    const active = (document.fullscreenElement ?? document.webkitFullscreenElement) === container
        || container.classList.contains('maplibregl-pseudo-fullscreen');
    // Escape can leave a detached control with state from the removed renderer.
    return previous && active ? previous : create(container);
}
