import { summaries } from 'virtual:trip-content';
export function getTripSummary(id: string | undefined) { return id && Object.hasOwn(summaries, id) ? summaries[id] : undefined; }
