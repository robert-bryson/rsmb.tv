import { Popup, type Map, type PositionAnchor } from 'maplibre-gl';

interface TooltipText { label: string; subtitle?: string; color: string }
interface TooltipOptions extends TooltipText { coordinates: [number, number]; anchor?: PositionAnchor; offset?: number }

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
    let previousOffset = 12;
    let previousCoordinates: [number, number] | undefined;
    const limitWidth = (current: Popup, anchor?: PositionAnchor) => {
        const pointer = anchor === 'left' || anchor === 'right' ? 10 : 0;
        current.setMaxWidth(`${Math.max(1, Math.min(240, map.getContainer().clientWidth - 24)) + pointer}px`);
    };
    const render = ({ label, subtitle, color, coordinates, anchor, offset = 12 }: TooltipOptions) => {
        if (popup && anchor !== previousAnchor) { popup.remove(); popup = undefined; }
        if (!popup) {
            popup = new Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, offset, className: 'trip-day-popup', ...(anchor ? { anchor } : {}) })
                .setLngLat(coordinates);
            setTooltipText(popup, label, subtitle).addTo(map);
            popup.getElement().setAttribute('role', 'tooltip');
            popup.getElement().id = tooltipId;
        } else {
            if (label !== previousLabel || subtitle !== previousSubtitle) setTooltipText(popup, label, subtitle);
            if (offset !== previousOffset) popup.setOffset(offset);
            popup.setLngLat(coordinates);
        }
        previousLabel = label;
        previousSubtitle = subtitle;
        previousAnchor = anchor;
        previousOffset = offset;
        previousCoordinates = coordinates;
        popup.getElement().style.setProperty('--trip-day-color', color);
        return popup;
    };
    return {
        /** Measure mounted content before Atlas chooses an anchor. The placeholder cannot paint. */
        measure(text: TooltipText) {
            const center = map.getCenter();
            const current = render({ ...text, coordinates: previousCoordinates ?? [center.lng, center.lat], anchor: previousAnchor ?? 'bottom', offset: previousOffset });
            current.getElement().style.visibility = 'hidden';
            limitWidth(current, previousAnchor);
            const content = current.getElement().querySelector('.maplibregl-popup-content') ?? current.getElement();
            const box = content.getBoundingClientRect();
            return { width: Math.max(1, box.width), height: Math.max(1, box.height) };
        },
        show(options: TooltipOptions) {
            const current = render(options);
            if (options.anchor) limitWidth(current, options.anchor);
            current.getElement().style.visibility = '';
        },
        remove() {
            popup?.remove();
            popup = undefined;
            previousLabel = undefined;
            previousSubtitle = undefined;
            previousAnchor = undefined;
            previousCoordinates = undefined;
        },
    };
}
