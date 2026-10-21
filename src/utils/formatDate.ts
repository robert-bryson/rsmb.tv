const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
});
const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
});
const monthYearFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
});
const monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC',
});

function parseIsoDate(dateStr: string): Date | undefined {
    const match = ISO_DATE_PATTERN.exec(dateStr);
    if (!match) return undefined;

    const [, yearString, monthString, dayString] = match;
    const year = Number(yearString);
    const month = Number(monthString) - 1;
    const day = Number(dayString);
    const date = new Date(`${dateStr}T00:00:00Z`);

    if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month
        || date.getUTCDate() !== day
    ) {
        return undefined;
    }

    return date;
}

export function formatDate(dateStr: string, month: 'long' | 'short' = 'long'): string {
    if (!dateStr) return dateStr;
    const date = parseIsoDate(dateStr);
    const formatter = month === 'short' ? shortDateFormatter : fullDateFormatter;
    return date ? formatter.format(date) : dateStr;
}

/** Format an ISO date or month in UTC. Preserve invalid input for correction. */
export function formatMonthYear(dateStr: string): string {
    const date = parseIsoDate(/^\d{4}-\d{2}$/.test(dateStr) ? `${dateStr}-01` : dateStr);
    return date ? monthYearFormatter.format(date) : dateStr;
}

export function formatDateRange(startDateStr: string, endDateStr: string): string {
    if (startDateStr === endDateStr) return formatDate(startDateStr);

    const startDate = parseIsoDate(startDateStr);
    const endDate = parseIsoDate(endDateStr);
    if (!startDate || !endDate || endDate < startDate) {
        return `${formatDate(startDateStr)} – ${formatDate(endDateStr)}`;
    }

    const startYear = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear();
    const startMonth = startDate.getUTCMonth();
    const endMonth = endDate.getUTCMonth();
    if (startYear === endYear && startMonth === endMonth) {
        return `${monthFormatter.format(startDate)} ${startDate.getUTCDate()}–${endDate.getUTCDate()}, ${startYear}`;
    }

    if (startYear === endYear) {
        return `${monthFormatter.format(startDate)} ${startDate.getUTCDate()} – ${monthFormatter.format(endDate)} ${endDate.getUTCDate()}, ${startYear}`;
    }

    return `${formatDate(startDateStr)} – ${formatDate(endDateStr)}`;
}
