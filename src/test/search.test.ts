import { describe, expect, it } from 'vitest';
import { normalizeSearch, withSearchQuery } from '../utils/search';

describe('shared search text and URL values', () => {
    it.each([
        ['Québec — Saint-Lawrence', 'quebec saint lawrence'],
        ['  MapLibre.GL  ', 'maplibre gl'],
        ['東京 ２０２６', '東京 2026'],
        ['!!!', ''],
    ])('normalizes %s without removing non-Latin names', (input, expected) => {
        expect(normalizeSearch(input)).toBe(expected);
    });

    it('replaces or clears every query value without changing the source or unrelated parameters', () => {
        const source = new URLSearchParams('category=maps&q=stale&q=duplicate&source=one&source=two');
        const updated = withSearchQuery(source, 'weather maps ');
        expect(updated.getAll('q')).toEqual(['weather maps ']);
        expect(updated.getAll('source')).toEqual(['one', 'two']);
        expect(source.getAll('q')).toEqual(['stale', 'duplicate']);
        const cleared = withSearchQuery(updated, '');
        expect(cleared.has('q')).toBe(false);
        expect(cleared.get('category')).toBe('maps');
        expect(cleared.getAll('source')).toEqual(['one', 'two']);
        expect(updated.get('q')).toBe('weather maps ');
    });
});
