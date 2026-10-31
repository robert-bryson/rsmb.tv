import { describe, expect, it } from 'vitest';
import { getPostReturnDestination } from '../blog/postReturnDestination';

describe('post return destinations', () => {
    it.each([
        '/projects/adv-atlas/map?trip=coast&view=selected',
        '/projects/motorcycle-trips/map?trip=coast',
    ])('keeps the originating atlas visit through returns and further reading (%s)', from => {
        const destination = getPostReturnDestination({ from, returnKey: 'origin' }, 'trips');
        expect(destination).toEqual({
            to: from, label: 'Back to map',
            returnState: { restoreScroll: true, returnKey: 'origin' },
            onwardState: { from, returnKey: 'origin' },
        });
        expect(getPostReturnDestination(destination.onwardState, 'blog')).toEqual(destination);
    });

    it.each([undefined, null, 42, {}, [], { from: 12 },
        { from: 'https://example.com/posts' }, { from: '//example.com/posts' },
        { from: '/posts/other' }, { from: '/projects/adv-atlas/map/other' },
    ])('uses the collection fallback for an unavailable or invalid source (%j)', state => {
        expect(getPostReturnDestination(state, 'trips').to).toBe('/posts?type=trips');
        expect(getPostReturnDestination(state, 'blog')).toMatchObject({
            to: '/posts?type=writing', label: 'Back to posts',
            returnState: { restoreScroll: true },
            onwardState: { from: '/posts?type=writing' },
        });
    });

    it('retains post filters without forwarding an atlas identity', () => {
        const from = '/posts?type=trips&country=US&region=washington';
        expect(getPostReturnDestination({ from, returnKey: 'unrelated' }, 'trips')).toEqual({
            to: from, label: 'Back to posts',
            returnState: { restoreScroll: true }, onwardState: { from },
        });
    });

    it.each([undefined, 12, '', null])('ignores an invalid atlas history key (%j)', returnKey => {
        const from = '/projects/adv-atlas/map';
        expect(getPostReturnDestination({ from, returnKey }, 'trips')).toMatchObject({
            returnState: { restoreScroll: true }, onwardState: { from },
        });
    });
});
