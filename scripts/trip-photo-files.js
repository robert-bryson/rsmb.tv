// Published image versions remain immutable when a trip is prepared again.
export function isVersionedTripPhoto(filename) {
    return /-[a-f0-9]{12}-(?:\d+\.webp|full\.(?:jpg|png)|view-\d+\.(?:jpg|png))$/.test(filename);
}

export function isFullTripPhoto(filename) {
    return /-[a-f0-9]{12}-full\.(?:jpg|png)$/.test(filename);
}

export function isTripViewerDerivative(filename) {
    return /-[a-f0-9]{12}-view-\d+\.(?:jpg|png)$/.test(filename);
}
