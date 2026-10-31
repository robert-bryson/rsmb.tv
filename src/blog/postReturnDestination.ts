import { isTripAtlasLocation } from '../features/trips/atlas/tripAtlasView';

export interface PostReturnDestination {
    to: string;
    label: string;
    returnState: { restoreScroll: true; returnKey?: string };
    onwardState: { from: string; returnKey?: string };
}

/** Keep return links and subsequent reports tied to the same validated source visit. */
export function getPostReturnDestination(state: unknown, collection: 'blog' | 'trips'): PostReturnDestination {
    const source = state !== null && typeof state === 'object' ? state as Record<string, unknown> : {};
    const from = source.from;
    const atlas = typeof from === 'string' && isTripAtlasLocation(from);
    const to = typeof from === 'string' && (atlas || /^\/posts(?:\?|$)/.test(from))
        ? from : `/posts?type=${collection === 'trips' ? 'trips' : 'writing'}`;
    const identity = atlas && typeof source.returnKey === 'string' && source.returnKey ? { returnKey: source.returnKey } : {};
    return {
        to,
        label: atlas ? 'Back to map' : 'Back to posts',
        returnState: { restoreScroll: true, ...identity },
        onwardState: { from: to, ...identity },
    };
}
