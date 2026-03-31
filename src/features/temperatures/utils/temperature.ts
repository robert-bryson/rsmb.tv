/** Convert °F to °C (raw number). */
export function fToC(f: number): number {
    return (f - 32) * 5 / 9;
}

/** Format a temperature for display with the correct unit suffix. */
export function formatTemp(tempF: number, useCelsius: boolean): string {
    if (useCelsius) return `${fToC(tempF).toFixed(1)}°C`;
    return `${tempF}°F`;
}
