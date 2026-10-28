import { useEffect, useEffectEvent, useId, useRef, type RefObject } from 'react';
import { Popup, type Map, type MapLayerMouseEvent } from 'maplibre-gl';
import type { RouteGeoJson } from './routeGeometry';
import { dayColor, tripMapDayAnchor, tripMapDayForTrack } from './tripMapView';
import type { TripManifest } from './types';

/** Link route hover, day labels, and a non-interactive map tooltip without changing the camera. */
export function useTripDayHover({ map, mapRef, enabled, manifest, route, dayId, onHighlight }: {
    map: Map | null;
    mapRef: RefObject<Map | null>;
    enabled: boolean;
    manifest: TripManifest;
    route: RouteGeoJson | null;
    dayId?: string;
    onHighlight: (dayId?: string) => void;
}) {
    const tooltipId = useId();
    const isCurrentMap = useEffectEvent(() => mapRef.current === map);
    const popupRef = useRef<{ popup: Popup; dayId: string }>(null);
    const routeHoverRef = useRef<{ id: string; coordinates: [number, number] }>(null);
    const clearPopup = () => {
        popupRef.current?.popup.remove();
        popupRef.current = null;
    };
    const showPopup = useEffectEvent((id: string, coordinates: [number, number]) => {
        if (!map || !enabled || !isCurrentMap()) return;
        const day = manifest.days?.find(day => day.id === id);
        if (!day) return;
        if (!popupRef.current) {
            const popup = new Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, offset: 12, className: 'trip-day-popup' })
                .setLngLat(coordinates).setText(day.title).addTo(map);
            popup.getElement().setAttribute('role', 'tooltip');
            popup.getElement().id = tooltipId;
            popupRef.current = { popup, dayId: id };
        } else {
            if (popupRef.current.dayId !== id) popupRef.current.popup.setText(day.title);
            popupRef.current.dayId = id;
            popupRef.current.popup.setLngLat(coordinates);
        }
        popupRef.current.popup.getElement().style.setProperty('--trip-day-color', dayColor(manifest, id));
    });
    const hoverRoute = useEffectEvent((event: MapLayerMouseEvent) => {
        const day = event.features?.map(feature => tripMapDayForTrack(manifest, feature.properties?.trackId)).find(Boolean);
        if (!day) {
            routeHoverRef.current = null;
            onHighlight();
            return;
        }
        const coordinates: [number, number] = [event.lngLat.lng, event.lngLat.lat];
        routeHoverRef.current = { id: day.id, coordinates };
        onHighlight(day.id);
        showPopup(day.id, coordinates);
    });
    const leaveRoute = useEffectEvent(() => {
        routeHoverRef.current = null;
        onHighlight();
    });

    useEffect(() => {
        if (!map || !enabled || !isCurrentMap()) return;
        let disposed = false;
        const canvas = map.getCanvas();
        const previousCursor = canvas.style.cursor;
        const move = (event: MapLayerMouseEvent) => {
            if (disposed) return;
            hoverRoute(event);
            canvas.style.cursor = routeHoverRef.current ? 'pointer' : previousCursor;
        };
        const leave = () => {
            if (disposed) return;
            leaveRoute();
            canvas.style.cursor = previousCursor;
        };
        map.on('mousemove', 'trip-route-halo', move);
        map.on('mouseleave', 'trip-route-halo', leave);
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            map.off('mousemove', 'trip-route-halo', move);
            map.off('mouseleave', 'trip-route-halo', leave);
            map.off('remove', dispose);
            canvas.style.cursor = previousCursor;
            leaveRoute();
            clearPopup();
        };
        map.on('remove', dispose);
        return dispose;
    }, [map, enabled]);

    useEffect(() => {
        if (!map || !enabled || !isCurrentMap() || !dayId || !route) {
            clearPopup();
            return;
        }
        const anchor = routeHoverRef.current?.id === dayId
            ? routeHoverRef.current.coordinates : tripMapDayAnchor(manifest, route, dayId);
        if (!anchor) { clearPopup(); return; }
        const center = map.getCenter();
        showPopup(dayId, map.getBounds().contains(anchor) ? anchor : [center.lng, center.lat]);
    }, [map, enabled, dayId, manifest, route]);
    return tooltipId;
}
