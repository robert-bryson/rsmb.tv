/** Vincenty's direct solution on WGS84; radius is measured along the ellipsoid. */
export function geodesicDestination(lng: number, lat: number, bearing: number, meters: number): [number, number] {
    const rad = Math.PI / 180;
    const a = 6378137, f = 1 / 298.257223563, b = (1 - f) * a;
    const alpha = bearing * rad, sinAlpha1 = Math.sin(alpha), cosAlpha1 = Math.cos(alpha);
    const tanU1 = (1 - f) * Math.tan(lat * rad);
    const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1), sinU1 = tanU1 * cosU1;
    const sigma1 = Math.atan2(tanU1, cosAlpha1);
    const sinAlpha = cosU1 * sinAlpha1, cosSqAlpha = 1 - sinAlpha * sinAlpha;
    const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    let sigma = meters / (b * A);
    for (let i = 0; i < 20; i++) {
        const cos2SigmaM = Math.cos(2 * sigma1 + sigma), sinSigma = Math.sin(sigma), cosSigma = Math.cos(sigma);
        const delta = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM ** 2)
            - B / 6 * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));
        const next = meters / (b * A) + delta;
        if (Math.abs(next - sigma) < 1e-12) { sigma = next; break; }
        sigma = next;
    }
    const sinSigma = Math.sin(sigma), cosSigma = Math.cos(sigma), cos2SigmaM = Math.cos(2 * sigma1 + sigma);
    const temp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
    const latitude = Math.atan2(sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1, (1 - f) * Math.sqrt(sinAlpha ** 2 + temp ** 2));
    const lambda = Math.atan2(sinSigma * sinAlpha1, cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1);
    const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    const L = lambda - (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    // Keep rings continuous around their origin when crossing the antimeridian.
    return [lng + L / rad, latitude / rad];
}
