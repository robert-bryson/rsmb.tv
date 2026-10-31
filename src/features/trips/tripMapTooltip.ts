import { Popup, type Map, type PositionAnchor } from 'maplibre-gl';

function setTooltipText(popup: Popup, label: string, subtitle?: string) {
    if (!subtitle) return popup.setText(label);
    const content = document.createElement('div');
    content.className = 'trip-map-tooltip-content';
    const title = document.createElement('div');
    title.textContent = label;
    const detail = document.createElement('div');
    detail.className = 'trip-map-tooltip-subtitle';
    detail.textContent = subtitle;
    content.append(title, detail);
    return popup.setDOMContent(content);
}

/** Shared, text-only route tooltip for story maps and the trip atlas. */
export function createTripMapTooltip(map: Map, tooltipId: string) {
    let popup: Popup | undefined;
    let previousLabel: string | undefined;
    let previousSubtitle: string | undefined;
    let previousAnchor: PositionAnchor | undefined;
    return {
        show({ label, subtitle, color, coordinates, anchor }: { label: string; subtitle?: string; color: string; coordinates: [number, number]; anchor?: PositionAnchor }) {
            if (popup && anchor !== previousAnchor) { popup.remove(); popup = undefined; }
            if (!popup) {
                popup = new Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, offset: 12, className: 'trip-day-popup', ...(anchor ? { anchor } : {}) })
                    .setLngLat(coordinates);
                setTooltipText(popup, label, subtitle).addTo(map);
                popup.getElement().setAttribute('role', 'tooltip');
                popup.getElement().id = tooltipId;
            } else {
                if (label !== previousLabel || subtitle !== previousSubtitle) setTooltipText(popup, label, subtitle);
                popup.setLngLat(coordinates);
            }
            previousLabel = label;
            previousSubtitle = subtitle;
            previousAnchor = anchor;
            popup.getElement().style.setProperty('--trip-day-color', color);
            if (anchor) {
                const container = map.getContainer();
                popup.setMaxWidth(`${Math.max(1, Math.min(240, container.clientWidth - 24))}px`);
                const bounds = container.getBoundingClientRect();
                const box = popup.getElement().getBoundingClientRect();
                if (bounds.width && bounds.height) {
                    // Keep directional labels below the toolbar and clear of attribution where space permits.
                    const top = Math.min(72, Math.max(12, (bounds.height - box.height) / 2));
                    const bottom = Math.min(72, Math.max(12, bounds.height - box.height - top));
                    const left = Math.max(bounds.left + 12, Math.min(bounds.right - 12 - box.width, box.left));
                    const y = Math.max(bounds.top + top, Math.min(bounds.bottom - bottom - box.height, box.top));
                    const dx = left - box.left;
                    const dy = y - box.top;
                    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                        const point = map.project(coordinates);
                        popup.setLngLat(map.unproject([point.x + dx, point.y + dy]));
                    }
                }
            }
        },
        remove() {
            popup?.remove();
            popup = undefined;
            previousLabel = undefined;
            previousSubtitle = undefined;
            previousAnchor = undefined;
        },
    };
}
