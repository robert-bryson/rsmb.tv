import { ResilientFullscreenControl, restoreFullscreenControl } from '../../../maps/ResilientFullscreenControl';

/** MapLibre rebuilds the button on reattachment but retains its fullscreen state. */
export class AtlasFullscreenControl extends ResilientFullscreenControl {
    protected override updateButton() {
        super.updateButton();
        this.button?.setAttribute('data-atlas-tooltip', this.active ? 'Exit fullscreen and return to the page layout.' : 'Expand the map and trip browser to fill the screen.');
        this.button?.removeAttribute('title');
    }
}

/** Reuse a control while its stable fullscreen target survives renderer replacement. */
export function restoreAtlasFullscreenControl(container: HTMLElement, previous: AtlasFullscreenControl | null) {
    return restoreFullscreenControl(container, previous, target => new AtlasFullscreenControl({ container: target }));
}
