import { summaries } from 'virtual:trip-content';
export function getTripSummary(id: string | undefined) { return id ? summaries[id] : undefined; }
