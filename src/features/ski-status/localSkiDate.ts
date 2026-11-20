const formatters = new Map<string, Intl.DateTimeFormat>();

export function localSkiDate(now: number, timeZone: string) {
    let formatter = formatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
        formatters.set(timeZone, formatter);
    }
    const parts = formatter.formatToParts(now);
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
