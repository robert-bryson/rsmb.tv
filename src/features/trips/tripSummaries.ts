import { summaries } from 'virtual:trip-content';
import type { TripSummary } from './types';

export function getTripSummary(id: string | undefined): TripSummary | undefined {
    return id && Object.hasOwn(summaries, id) ? summaries[id] : undefined;
}
