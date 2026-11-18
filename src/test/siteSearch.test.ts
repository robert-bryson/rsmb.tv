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

    it('uses the description when the title or technologies explain a match', () => {
        const [result] = searchSite([{ ...documents[1], content: 'Route controls Failed to load routes. Added map layers in November.' }], 'ferry');
        expect(result.excerpt).toBe('Route planning tools.');
        expect(searchSite(documents, 'python')[0].excerpt).toBe('Route planning tools.');
    });

    it('selects a coherent paragraph with the most matching words', () => {
        const [result] = searchSite([{ ...documents[1], content: 'Choose an island.\nCompare island ferry connections before planning a route.\nSource and change notes' }], 'island connections');
        expect(result.excerpt).toBe('Compare island ferry connections before planning a route.');
    });

    it('prefers the paragraph with body-only terms over a stronger metadata-only paragraph', () => {
        const [result] = searchSite([{
            ...documents[1], title: 'Ferry forest routes',
            content: 'Ferry forest routes\nExplore the island before planning a crossing.',
        }], 'ferry forest island');
        expect(result.excerpt).toBe('Explore the island before planning a crossing.');
    });

    it('ranks eligible paragraphs and retains the first equally relevant paragraph', () => {
        const [result] = searchSite([{
            ...documents[1], content: '  \nExplore the island.\nFerry trips visit this island.\nThe island has ferry trips.',
        }], 'ferry island');
        expect(result.excerpt).toBe('Ferry trips visit this island.');
    });

    it('uses the description when required body terms occur in different paragraphs', () => {
        const [result] = searchSite([{ ...documents[1], content: 'Explore the island.\nWalk through the forest.' }], 'island forest');
        expect(result.excerpt).toBe('Route planning tools.');
    });

    it('builds a relevant excerpt when a title match has no description', () => {
        const content = `${'An ordinary sentence. '.repeat(20)}Take the ferry across the channel. ${'More stories. '.repeat(20)}`;
        const [result] = searchSite([{ ...documents[1], description: '', content }], 'ferry');
        expect(result.excerpt).toContain('ferry across the channel');
        expect(result.excerpt.length).toBeLessThanOrEqual(192);
    });

    it('keeps a title-only result when both its description and body are empty', () => {
        const [result] = searchSite([{ ...documents[1], description: '', content: '' }], 'ferry');
        expect(result.excerpt).toBe('');
    });

    it('bounds excerpts for long identifiers without word boundaries', () => {
        const [result] = searchSite([{ ...documents[1], content: `forest${'x'.repeat(300)}` }], 'forest');
        expect(result.excerpt).toContain('forest');
        expect(result.excerpt).toHaveLength(191);
        expect(result.excerpt.endsWith('…')).toBe(true);
    });

    it('keeps matches searchable while leaving error states out of project previews', () => {
        const [result] = searchSite([{ ...documents[1], content: 'Record history\nFailed to load standing record-age data\nTry again' }], 'record-age');
        expect(result.excerpt).toBe('Route planning tools.');
    });

    it('preserves authored discussion of errors in article excerpts', () => {
        const [result] = searchSite([{ ...documents[0], content: 'Unable to load the offline map, we followed the road to the campground.' }], 'offline');
        expect(result.excerpt).toContain('offline map');
    });

    it('centers deep body matches instead of common words already explained by metadata', () => {
        const content = `${'The road runs out of the forest along the coast. '.repeat(80)}We rode the Avenue of the Giants beneath the redwoods.`;
        const [result] = searchSite([{ ...documents[0], content }], 'Avenue of the Giants');
        expect(result.excerpt).toContain('Avenue of the Giants');
        expect(result.excerpt.length).toBeLessThanOrEqual(192);
    });
});
