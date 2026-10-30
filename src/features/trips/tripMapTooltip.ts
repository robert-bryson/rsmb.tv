import { Popup, type Map } from 'maplibre-gl';

function setTooltipText(popup: Popup, label: string, subtitle?: string) {
    if (!subtitle) return popup.setText(label);
    const content = document.createElement('div');
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
    return {
        show({ label, subtitle, color, coordinates }: { label: string; subtitle?: string; color: string; coordinates: [number, number] }) {
            if (!popup) {
                popup = new Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, offset: 12, className: 'trip-day-popup' })
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
            popup.getElement().style.setProperty('--trip-day-color', color);
        },
        remove() {
            popup?.remove();
            popup = undefined;
            previousLabel = undefined;
            previousSubtitle = undefined;
        },
    };
}
