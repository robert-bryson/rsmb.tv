import type { Map as MapLibreMap } from 'maplibre-gl';
import { clipSegment, containsPoint, expandRect, overlaps, type TooltipRect, type TooltipSegment } from '../../maps/screenGeometry';
import { COUNTY_COLOR, NATIONAL_COLOR, STATE_COLOR } from './geometry';
import { radiusLabelMinimumZoom, type RadiusLines } from './radii';

const COLORS = { country: NATIONAL_COLOR, state: STATE_COLOR, county: COUNTY_COLOR };
const ORDER = { country: 0, state: 1, county: 2 };
const OBSTACLES = '.pins-location-bar, .pins-region-control, .pins-layers-toggle, .pins-layer-options, .pins-unit-control, .maplibregl-ctrl, .pins-map-message, .pins-boundary-error';

function alongPath(segments: TooltipSegment[], fraction: number) {
    const lengths = segments.map(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y));
    let remaining = lengths.reduce((total, length) => total + length, 0) * fraction;
    for (let index = 0; index < segments.length; index++) {
        if (remaining > lengths[index]) { remaining -= lengths[index]; continue; }
        const [a, b] = segments[index];
        const length = lengths[index] || 1;
        const t = remaining / length;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
            normalX: -(b.y - a.y) / length, normalY: (b.x - a.x) / length };
    }
    return null;
}

/** DOM badges stay readable without remote fonts, and share the atlas collision geometry. */
export function attachRadiusLabels(map: MapLibreMap, overlay: HTMLElement) {
    let entries: Array<{ feature: RadiusLines['features'][number]; bounds: { west: number; east: number; south: number; north: number } }> = [];
    let frame: number | null = null;
    let disposed = false;
    let previous: RadiusLines | null = null;
    const labels = new Map<string, { element: HTMLSpanElement; prefix: HTMLSpanElement; text: HTMLSpanElement }>();

    function render() {
        if (disposed) return;
        const zoom = map.getZoom();
        const eligible = entries.filter(entry => entry.feature.properties.selected || zoom >= radiusLabelMinimumZoom(entry.feature.properties.minimumZoom));
        if (!eligible.length) {
            if (labels.size) { overlay.replaceChildren(); labels.clear(); }
            return;
        }
        const container = map.getContainer();
        const box = container.getBoundingClientRect();
        const viewport = { left: 8, top: 8, right: box.width - 8, bottom: box.height - 8 };
        const geographic = map.getBounds();
        const centerLng = map.getCenter().lng;
        const occupied: TooltipRect[] = [];
        for (const element of container.parentElement?.querySelectorAll<HTMLElement>(OBSTACLES) ?? []) {
            const obstacle = element.getBoundingClientRect();
            if (!obstacle.width || !obstacle.height) continue;
            occupied.push({ left: obstacle.left - box.left - 4, top: obstacle.top - box.top - 4,
                right: obstacle.right - box.left + 4, bottom: obstacle.bottom - box.top + 4 });
        }
        const visible: Array<{ entry: typeof entries[number]; points: Array<ReturnType<MapLibreMap['project']> | null> }> = [];
        const pins = new Set<string>();
        for (const entry of eligible) {
            const coordinates = entry.feature.geometry.coordinates;
            const offset = 360 * Math.round((centerLng - coordinates[0][0]) / 360);
            if (entry.bounds.east + offset < geographic.getWest() || entry.bounds.west + offset > geographic.getEast()
                || entry.bounds.north < geographic.getSouth() || entry.bounds.south > geographic.getNorth()) continue;
            const points = coordinates.map(([lng, lat]) => {
                const point = map.project([lng + offset, lat]);
                if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
                // Back-side locations can project onto the visible hemisphere.
                // A round trip through the public surface API distinguishes them.
                const surface = map.unproject(point);
                if (!Number.isFinite(surface.lng) || !Number.isFinite(surface.lat)) return null;
                const longitudeError = Math.abs(surface.lng - lng) % 360;
                if (Math.min(longitudeError, 360 - longitudeError) > 0.001 || Math.abs(surface.lat - lat) > 0.001) return null;
                return point;
            });
            visible.push({ entry, points });
            if (points[0] && !pins.has(entry.feature.properties.pinId) && containsPoint(viewport, points[0])) {
                pins.add(entry.feature.properties.pinId);
                const { x, y } = points[0];
                occupied.push({ left: x - 10, top: y - 10, right: x + 10, bottom: y + 10 });
            }
        }
        const active = new Set<string>();
        const labeledPins = new Set<string>();
        const maximum = box.width < 600 ? 20 : 45;
        for (const { entry, points } of visible) {
            if (active.size >= maximum) break;
            const properties = entry.feature.properties;
            // Overview badges identify more distinct pins instead of repeating
            // the same value on every contact. Selection reveals every contact.
            if (!properties.selected && labeledPins.has(properties.pinId)) continue;
            const segments: TooltipSegment[] = [];
            for (let index = 1; index < points.length; index++) {
                const start = points[index - 1], end = points[index];
                if (!start || !end) continue;
                const clipped = clipSegment(start, end, viewport);
                if (clipped) segments.push(clipped);
            }
            if (!segments.length) continue;
            const width = properties.label.length * 7 + 16, height = 24;
            let placement: { x: number; y: number; bounds: TooltipRect } | null = null;
            for (const fraction of [0.5, 0.7, 0.3]) {
                const point = alongPath(segments, fraction);
                if (!point) continue;
                for (const offset of [0, 16, -16, 30, -30]) {
                    const x = point.x + point.normalX * offset, y = point.y + point.normalY * offset;
                    const bounds = { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
                    if (!containsPoint(viewport, { x: bounds.left, y: bounds.top }) || !containsPoint(viewport, { x: bounds.right, y: bounds.bottom })
                        || occupied.some(obstacle => overlaps(obstacle, bounds))) continue;
                    placement = { x, y, bounds };
                    break;
                }
                if (placement) break;
            }
            if (!placement) continue;
            occupied.push(expandRect(placement.bounds, 4));
            active.add(properties.id);
            labeledPins.add(properties.pinId);
            let label = labels.get(properties.id);
            if (!label) {
                const element = document.createElement('span');
                const prefix = document.createElement('span');
                const text = document.createElement('span');
                element.className = 'pins-radius-label';
                prefix.className = 'sr-only';
                element.append(prefix, text);
                label = { element, prefix, text };
                labels.set(properties.id, label);
                overlay.append(element);
            }
            label.element.dataset.pinRadiusLabel = properties.pinId;
            label.element.dataset.radiusId = properties.id;
            label.element.classList.toggle('is-selected', properties.selected);
            label.element.style.setProperty('--radius-color', properties.selected
                ? properties.level === 'country' ? '#deceff' : '#ffe3ad' : COLORS[properties.level]);
            label.element.style.left = `${placement.x}px`;
            label.element.style.top = `${placement.y}px`;
            label.element.title = `${properties.name}: ${properties.label} to the boundary`;
            label.prefix.textContent = `${properties.name}: `;
            label.text.textContent = properties.label;
        }
        for (const [id, label] of labels) if (!active.has(id)) { label.element.remove(); labels.delete(id); }
    }
    function schedule() {
        if (!disposed && frame === null) frame = requestAnimationFrame(() => { frame = null; render(); });
    }
    map.on('move', schedule);
    map.on('resize', schedule);
    map.on('projectiontransition', schedule);
    map.on('style.load', schedule);
    // Display disclosures change occupied space without resizing the canvas.
    const controls = new ResizeObserver(schedule);
    for (const element of map.getContainer().parentElement?.querySelectorAll<HTMLElement>('.pins-layers') ?? []) controls.observe(element);
    return {
        setData(data: RadiusLines) {
            if (data === previous) { schedule(); return; }
            previous = data;
            entries = data.features.map(feature => ({ feature, bounds: {
                west: Math.min(...feature.geometry.coordinates.map(point => point[0])),
                east: Math.max(...feature.geometry.coordinates.map(point => point[0])),
                north: Math.max(...feature.geometry.coordinates.map(point => point[1])),
                south: Math.min(...feature.geometry.coordinates.map(point => point[1])),
            } })).sort((a, b) => Number(b.feature.properties.selected) - Number(a.feature.properties.selected)
                || ORDER[a.feature.properties.level] - ORDER[b.feature.properties.level]
                || b.feature.properties.distanceMeters - a.feature.properties.distanceMeters);
            schedule();
        },
        dispose() {
            disposed = true;
            if (frame !== null) cancelAnimationFrame(frame);
            map.off('move', schedule);
            map.off('resize', schedule);
            map.off('projectiontransition', schedule);
            map.off('style.load', schedule);
            controls.disconnect();
            overlay.replaceChildren();
            labels.clear();
        },
    };
}
