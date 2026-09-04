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

export function getRecentObservationDate(recentRecords: {
    asOf: string;
    dates?: string[];
    yesterday: { date: string }[];
}): string {
    const explicitDate = recentRecords.dates?.[0] ?? recentRecords.yesterday[0]?.date;
    if (explicitDate) return explicitDate;

    const generatedAt = new Date(`${recentRecords.asOf}T00:00:00Z`);
    if (Number.isNaN(generatedAt.getTime())) return recentRecords.asOf;
    generatedAt.setUTCDate(generatedAt.getUTCDate() - 1);
    return generatedAt.toISOString().slice(0, 10);
}

export function weightedMedianRecordYear(data: { year: number; highs: number; lows: number }[]): number | null {
    const total = data.reduce((sum, year) => sum + year.highs + year.lows, 0);
    if (total === 0) return null;

    const lowerRank = Math.floor((total - 1) / 2);
    const upperRank = Math.floor(total / 2);
    let cumulative = 0;
    let lowerYear: number | null = null;

    for (const year of data) {
        cumulative += year.highs + year.lows;
        if (lowerYear === null && cumulative > lowerRank) lowerYear = year.year;
        if (cumulative > upperRank) return ((lowerYear ?? year.year) + year.year) / 2;
    }

    return null;
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
