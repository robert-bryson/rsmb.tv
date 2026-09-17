const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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

export function formatDate(dateStr: string): string {
    if (!dateStr) return dateStr;
    const date = parseIsoDate(dateStr);
    return date ? fullDateFormatter.format(date) : dateStr;
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
