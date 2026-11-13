import type { MapPin } from '../../../shared/worldPins';

export function pinMapLinks(pin: Pick<MapPin, 'lat' | 'lng'>) {
    const lat = pin.lat.toFixed(8), lng = pin.lng.toFixed(8);
    return {
        google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`,
        osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`,
    };
}

export function formatElevation(meters: number, unit: 'mi' | 'km') {
    return `${Math.round(unit === 'mi' ? meters / 0.3048 : meters).toLocaleString('en-US')} ${unit === 'mi' ? 'ft' : 'm'}`;
}

export function compassDirection(bearing: number) {
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8];
}
