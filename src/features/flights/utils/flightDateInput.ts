/** Calendar dates only. Elapsed durations are entered directly, without clock/time-zone arithmetic. */
export function parseFlightDate(value: string): { date: Date; year: number; canonical: string } {
    const input = value.trim();
    const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (!local && !iso) throw new Error('date must be M/D/YYYY or YYYY-MM-DD');
    const year = Number(local ? local[3] : iso![1]);
    const month = Number(local ? local[1] : iso![2]);
    const day = Number(local ? local[2] : iso![3]);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new Error('date must be a valid calendar date');
    }
    return { date, year, canonical: `${month}/${day}/${year}` };
}
