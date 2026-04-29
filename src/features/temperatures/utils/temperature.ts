/** Convert °F to °C (raw number). */
export function fToC(f: number): number {
    return (f - 32) * 5 / 9;
}

/** Convert a Fahrenheit temperature difference to a Celsius temperature difference. */
export function fDeltaToCDelta(deltaF: number): number {
    return deltaF * 5 / 9;
}

/** Format a temperature for display with the correct unit suffix. */
export function formatTemp(tempF: number, useCelsius: boolean): string {
    if (useCelsius) return `${fToC(tempF).toFixed(1)}°C`;
    return `${tempF}°F`;
}

/** Format a temperature difference, where Celsius has no 32° offset. */
export function formatTempDelta(deltaF: number, useCelsius: boolean): string {
    if (useCelsius) return `${fDeltaToCDelta(deltaF).toFixed(1)}°C`;
    return `${deltaF.toFixed(1)}°F`;
}
