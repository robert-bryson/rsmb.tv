export function formatDate(dateStr: string): string {
    if (!dateStr) return dateStr;
    const date = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    });
}
