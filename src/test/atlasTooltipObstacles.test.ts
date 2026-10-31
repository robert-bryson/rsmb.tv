import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { atlasTooltipObstacles, observeAtlasTooltipObstacles } from '../features/trips/atlas/atlasTooltipObstacles';

function measured(element: HTMLElement, x: number, y: number, width: number, height: number) {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, width, height));
    return element;
}

function setup() {
    const root = document.createElement('main');
    root.className = 'atlas-explorer';
    const map = measured(document.createElement('div'), 300, 20, 600, 400);
    root.append(map);
    document.body.append(root);
    const add = (x: number, y: number, width: number, height: number) => {
        const element = measured(document.createElement('div'), x, y, width, height);
        element.dataset.atlasMapObstacle = '';
        root.append(element);
        return element;
    };
    return { root, map, add };
}

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Atlas tooltip UI obstacles', () => {
    it('uses map-local rectangles, clips partial UI, and excludes hidden or external UI', () => {
        const { map, add } = setup();
        add(310, 30, 44, 44);
        add(280, 200, 64, 60).className = 'atlas-panel-handle';
        add(0, 20, 300, 400); // The drawer sits beside the map.
        add(910, 30, 44, 44);
        add(310, 430, 44, 44);
        add(299, 19, 1, 1); // Screen-reader status.
        add(400, 200, 100, 100).style.visibility = 'hidden';
        add(500, 200, 100, 100).style.display = 'none';
        expect(atlasTooltipObstacles(map)).toEqual([
            { left: 10, top: 10, right: 54, bottom: 54 }, { left: 0, top: 180, right: 44, bottom: 240 },
        ]);
    });

    it('includes native map controls and transparent screenshot overlays', () => {
        const { root, map, add } = setup();
        const controls = document.createElement('div');
        controls.className = 'maplibregl-control-container';
        const control = measured(document.createElement('div'), 800, 32, 88, 44);
        control.className = 'maplibregl-ctrl';
        controls.append(control);
        map.append(controls);
        add(500, 300, 200, 30).style.opacity = '0';
        expect(atlasTooltipObstacles(map)).toEqual([
            { left: 500, top: 12, right: 588, bottom: 56 }, { left: 200, top: 280, right: 400, bottom: 310 },
        ]);
        root.className = ''; // Standalone renderers use their parent as the scope.
        expect(atlasTooltipObstacles(map)).toHaveLength(2);
    });

    it('observes new UI, resizes and transitions, ignores popup updates, and cleans up', async () => {
        const { root, map, add } = setup();
        const refresh = vi.fn();
        const observe = vi.fn();
        const disconnect = vi.fn();
        let resized: (() => void) | undefined;
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback: () => void) { resized = callback; }
            observe = observe;
            disconnect = disconnect;
        });
        const stop = observeAtlasTooltipObstacles(map, refresh);
        expect(observe).toHaveBeenCalledWith(map);
        const ui = add(310, 30, 44, 44);
        await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
        expect(observe).toHaveBeenCalledWith(ui);
        resized?.();
        root.dispatchEvent(new Event('transitionend'));
        expect(refresh).toHaveBeenCalledTimes(3);
        const popup = document.createElement('div');
        popup.className = 'trip-day-popup';
        map.append(popup);
        popup.textContent = 'Updated title';
        popup.classList.add('maplibregl-popup-anchor-top');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(refresh).toHaveBeenCalledTimes(3);
        ui.hidden = true;
        await waitFor(() => expect(refresh).toHaveBeenCalledTimes(4));
        stop();
        expect(disconnect).toHaveBeenCalled();
        add(400, 40, 44, 44);
        root.dispatchEvent(new Event('transitionend'));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(refresh).toHaveBeenCalledTimes(4);
    });
});
