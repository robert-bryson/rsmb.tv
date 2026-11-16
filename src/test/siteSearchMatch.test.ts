import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findSiteSearchMatch, getSiteSearchQuery, withoutSiteSearchQuery } from '../navigation/siteSearchMatch';

function passage(html: string, query: string) {
    const main = document.createElement('main');
    main.innerHTML = html;
    document.body.append(main);
    return findSiteSearchMatch(main, query);
}

beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
        return (getComputedStyle(this).display === 'none' ? [] : [new DOMRect(0, 400, 300, 24)]) as unknown as DOMRectList;
    });
    const createRange = document.createRange.bind(document);
    vi.spyOn(document, 'createRange').mockImplementation(() => {
        const range = createRange();
        range.getClientRects = () => (getComputedStyle(range.startContainer.parentElement!).display === 'none'
            ? [] : [new DOMRect(0, 400, 300, 24)]) as unknown as DOMRectList;
        return range;
    });
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('site search passage matching', () => {
    it('search match review regressions: finds rendered text when its wrapper has no layout box', () => {
        vi.mocked(HTMLElement.prototype.getClientRects).mockReturnValue([] as unknown as DOMRectList);
        const match = passage('<p>A <span style="display:contents">quiet harbor</span>.</p>', 'quiet harbor');
        expect(match?.range.toString()).toBe('quiet harbor');
    });

    it('search match review regressions: ignores fully transparent ancestors', () => {
        const match = passage('<div style="opacity:0"><p>Quiet harbor.</p></div><p>A visible quiet harbor.</p>', 'quiet harbor');
        expect(match?.element.textContent).toBe('A visible quiet harbor.');
    });

    it('search match review regressions: treats explicit line breaks as word boundaries', () => {
        const match = passage('<p>Quiet<br>harbor.</p>', 'quiet harbor');
        expect(match?.range.toString()).toBe('Quietharbor');
    });

    it('search match review regressions: treats displayed block spans as word boundaries', () => {
        const match = passage('<p>Quiet<span style="display:block">harbor</span>tonight.</p>', 'quiet harbor tonight');
        expect(match?.range.toString()).toBe('Quietharbortonight');
    });

    it('matches phrases across inline markup and separate whitespace nodes', () => {
        const match = passage('<p>Before.</p><p>Past the <em>quiet</em> <strong>harbor</strong> at dusk.</p>', 'quiet harbor');
        expect(match?.range.toString()).toBe('quiet harbor');
        expect(match?.element.textContent).toBe('Past the quiet harbor at dusk.');
    });

    it.each([
        ['An adventure in Québec.', 'quebec', 'Québec'],
        ['A cafe\u0301 in town.', 'cafe', 'cafe\u0301'],
        ['A winter–camping trip.', 'winter camping', 'winter–camping'],
        ['🚲 A ﬁne ride past 𐐀.', 'fine', 'ﬁne'],
        ['🚲 A ﬁne ride past 𐐀.', '𐐨', '𐐀'],
        ['We saw ΟΣ at dusk.', 'ος', 'ΟΣ'],
    ])('maps normalized %s to the original text for %s', (text, query, expected) => {
        expect(passage(`<p>${text}</p>`, query)?.range.toString()).toBe(expected);
    });

    it('prefers a complete phrase over an earlier partial match', () => {
        const match = passage('<p>A harbor.</p><p>A quiet harbor.</p>', 'quiet harbor');
        expect(match?.range.toString()).toBe('quiet harbor');
    });

    it('prefers all words in one passage, then supports words distributed across fields', () => {
        const match = passage('<p>A quiet place.</p><p>The harbor was quiet.</p>', 'quiet harbor');
        expect(match?.element.textContent).toBe('The harbor was quiet.');
        expect(match?.range.toString()).toBe('quiet');
        expect(passage('<h1>Camping</h1><p>A coastal forest.</p>', 'camping forest')?.range.toString()).toBe('Camping');
    });

    it('excludes navigation, controls, hidden text, and screen-reader labels', () => {
        const match = passage(`<nav><p>Harbor</p></nav><button>Harbor</button><p hidden>Harbor</p>
            <p aria-hidden="true">Harbor</p><p class="sr-only">Harbor</p><p style="display:none">Harbor</p>
            <p style="visibility:hidden">Harbor</p><p>A visible harbor.</p>`, 'harbor');
        expect(match?.element.textContent).toBe('A visible harbor.');
    });

    it('does not combine words from separate paragraphs into a phrase', () => {
        const match = passage('<p>Quiet</p><p>harbor</p><p>The quiet harbor was empty.</p>', 'quiet harbor');
        expect(match?.range.toString()).toBe('quiet harbor');
    });

    it('handles plain text containers without paragraph elements', () => {
        const match = passage('<div>Some <span>harbor</span> notes.</div>', 'some harbor notes');
        expect(match?.range.toString()).toBe('Some harbor notes');
    });

    it('returns no target for absent words, empty text, or punctuation-only queries', () => {
        expect(passage('<p>Ordinary text.</p>', 'absent')).toBeUndefined();
        expect(passage('', 'harbor')).toBeUndefined();
        expect(passage('<p>Ordinary text.</p>', '---')).toBeUndefined();
    });
});

describe('site search navigation state', () => {
    it('drops the landing request from later edits without changing the original history entry', () => {
        const state = { siteSearchQuery: 'harbor', returnKey: 'origin', readerContext: { collection: 'trips' } };
        expect(withoutSiteSearchQuery(state)).toEqual({ returnKey: 'origin', readerContext: { collection: 'trips' } });
        expect(state.siteSearchQuery).toBe('harbor');
        expect(withoutSiteSearchQuery(null)).toBeNull();
        expect(withoutSiteSearchQuery('caller state')).toBe('caller state');
        expect(withoutSiteSearchQuery([])).toEqual([]);
    });

    it.each([undefined, null, true, 2, 'harbor', {}, { siteSearchQuery: 2 }, { siteSearchQuery: '---' }])('ignores invalid state %j', state => {
        expect(getSiteSearchQuery(state)).toBe('');
    });

    it('normalizes the query without interpreting HTML or changing other state', () => {
        const state = { siteSearchQuery: '  Québec / Camping! ', from: '/posts' };
        expect(getSiteSearchQuery(state)).toBe('quebec camping');
        expect(state.siteSearchQuery).toBe('  Québec / Camping! ');
    });
});
