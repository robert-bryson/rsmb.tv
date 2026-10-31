import type { TooltipRect } from './atlasTooltipGeometry';

const selector = '.atlas-panel, .atlas-panel-handle, .maplibregl-control-container .maplibregl-ctrl, [data-atlas-map-obstacle]';
const scopeFor = (container: HTMLElement) => container.closest('.atlas-explorer') ?? container.parentElement ?? container;

/** Measure only UI that intersects this map; the desktop drawer usually sits beside it. */
export function atlasTooltipObstacles(container: HTMLElement): TooltipRect[] {
    const map = container.getBoundingClientRect();
    const obstacles: TooltipRect[] = [];
    for (const element of scopeFor(container).querySelectorAll<HTMLElement>(selector)) {
        const box = element.getBoundingClientRect();
        if (box.width <= 1 || box.height <= 1 || box.right <= map.left || box.left >= map.right || box.bottom <= map.top || box.top >= map.bottom) continue;
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        obstacles.push({ left: Math.max(0, box.left - map.left), top: Math.max(0, box.top - map.top), right: Math.min(map.width, box.right - map.left), bottom: Math.min(map.height, box.bottom - map.top) });
    }
    return obstacles;
}

/** Recheck mounted, resized, or moved UI without observing the tooltip's own updates. */
export function observeAtlasTooltipObstacles(container: HTMLElement, refresh: () => void) {
    const scope = scopeFor(container);
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(refresh);
    const observeSizes = () => {
        resize?.disconnect();
        resize?.observe(container);
        scope.querySelectorAll(selector).forEach(element => resize?.observe(element));
    };
    const isPopup = (node: Node) => node instanceof Element && Boolean(node.closest('.trip-day-popup'));
    const mutations = new MutationObserver(records => {
        if (!records.some(record => !isPopup(record.target)
            && (record.type !== 'childList' || [...record.addedNodes, ...record.removedNodes].some(node => !isPopup(node))))) return;
        observeSizes();
        refresh();
    });
    observeSizes();
    mutations.observe(scope, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden', 'data-panel-state', 'data-results-view'] });
    scope.addEventListener('transitionend', refresh);
    return () => {
        resize?.disconnect();
        mutations.disconnect();
        scope.removeEventListener('transitionend', refresh);
    };
}
