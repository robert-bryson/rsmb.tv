export function airportCoordinates(airport) {
    const latitude = airport.latitude_deg;
    const longitude = airport.longitude_deg;
    if (typeof latitude !== 'string' || !latitude.trim()
        || typeof longitude !== 'string' || !longitude.trim()) return null;

    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90
        || !Number.isFinite(lon) || Math.abs(lon) > 180) return null;
    return { lat, lon };
}
