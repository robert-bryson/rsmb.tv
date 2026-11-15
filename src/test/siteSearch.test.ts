import { describe, expect, it } from 'vitest';
import { searchSite, type SiteSearchDocument } from '../content/siteSearch';

const documents: SiteSearchDocument[] = [
    { url: '/trips/coast', kind: 'Trip report', title: 'A weekend away', description: 'Camping on the coast.', content: 'We crossed Bainbridge and explored the temperate rainforest before catching the ferry home.' },
    { url: '/projects/ferry', kind: 'Project', title: 'Ferry routes', description: 'Route planning tools.', content: 'Explore islands and coastlines.', keywords: 'Python TypeScript' },
    { url: '/about', kind: 'Page', title: 'About', description: 'My background.', content: 'Geospatial engineering in Québec and St. Louis.' },
];

describe('site search', () => {
    it('finds words that occur only in article bodies and excerpts the matching passage', () => {
        expect(searchSite(documents, 'rainforest')).toMatchObject([{ url: '/trips/coast', excerpt: expect.stringContaining('temperate rainforest') }]);
    });

    it('searches project technologies and page content alongside posts', () => {
        expect(searchSite(documents, 'python')[0].url).toBe('/projects/ferry');
        expect(searchSite(documents, 'geospatial')[0].url).toBe('/about');
    });

    it('ranks title matches ahead of body matches', () => {
        expect(searchSite(documents, 'ferry').map(result => result.url)).toEqual(['/projects/ferry', '/trips/coast']);
    });

    it('requires every word, including words across title, metadata, and body', () => {
        expect(searchSite(documents, 'weekend Bainbridge')[0].url).toBe('/trips/coast');
        expect(searchSite(documents, 'rainforest python')).toEqual([]);
    });

    it('ignores accents, case, punctuation, and repeated keywords', () => {
        expect(searchSite(documents, 'QUEBEC! Québec.')[0].url).toBe('/about');
        expect(searchSite(documents, 'st. louis')[0].url).toBe('/about');
    });

    it.each(['', '   ', '---', '✨'])('returns no matches for an empty query: %s', query => {
        expect(searchSite(documents, query)).toEqual([]);
    });

    it('keeps excerpts short and includes matches deep in a long article', () => {
        const content = `${'An ordinary sentence. '.repeat(60)}There was a driftwood fort near the beach. ${'More stories. '.repeat(60)}`;
        const [result] = searchSite([{ ...documents[0], content }], 'driftwood');
        expect(result.excerpt).toContain('driftwood fort');
        expect(result.excerpt.length).toBeLessThanOrEqual(192);
        expect(result.excerpt.startsWith('…')).toBe(true);
    });
});
