import { Popup, type Map } from 'maplibre-gl';

/** Shared, text-only route tooltip for story maps and the trip atlas. */
export function createTripMapTooltip(map: Map, tooltipId: string) {
    let popup: Popup | undefined;
    let previousLabel: string | undefined;
    return {
        show({ label, color, coordinates }: { label: string; color: string; coordinates: [number, number] }) {
            if (!popup) {
                popup = new Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, offset: 12, className: 'trip-day-popup' })
                    .setLngLat(coordinates).setText(label).addTo(map);
                popup.getElement().setAttribute('role', 'tooltip');
                popup.getElement().id = tooltipId;
            } else {
                if (label !== previousLabel) popup.setText(label);
                popup.setLngLat(coordinates);
            }
            previousLabel = label;
            popup.getElement().style.setProperty('--trip-day-color', color);
        },
        remove() {
            popup?.remove();
            popup = undefined;
            previousLabel = undefined;
        },
    };
}
