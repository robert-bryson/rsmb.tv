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

/** Describe the historical calendar-date average used by the recent-record pipeline. */
export function formatComparisonPeriod(date: string): string {
    const match = /^(\d{4})-\d{2}-\d{2}$/.exec(date);
    const year = match ? Number(match[1]) : Number.NaN;
    return Number.isSafeInteger(year) && year > 1950 ? `1950–${year - 1} avg` : 'historical avg';
}

export function buildTemperaturePath(
    temperatures: (number | null)[],
    toY: (temperature: number | null) => number | null,
    width = 300,
): string {
    let drawing = false;
    const commands: string[] = [];
    const denominator = Math.max(temperatures.length - 1, 1);

    for (let index = 0; index < temperatures.length; index++) {
        const y = toY(temperatures[index]);
        if (y == null) {
            drawing = false;
            continue;
        }
        const x = (index / denominator) * width;
        commands.push(`${drawing ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`);
        drawing = true;
    }

    return commands.join(' ');
}
