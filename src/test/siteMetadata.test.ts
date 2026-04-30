import { describe, it, expect } from 'vitest';
import { SITE_URL, DEFAULT_OG_IMAGE, AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';

describe('siteMetadata', () => {
    it('exposes the canonical site origin without trailing slash', () => {
        expect(SITE_URL).toBe('https://rsmb.tv');
    });

    it('derives DEFAULT_OG_IMAGE from SITE_URL', () => {
        expect(DEFAULT_OG_IMAGE).toBe('https://rsmb.tv/og-image.png');
    });

    it('exposes a frozen-shape Person reference for the author', () => {
        expect(AUTHOR_PERSON).toEqual({
            '@type': 'Person',
            name: 'Robby Bryson',
            url: 'https://rsmb.tv',
        });
    });

    describe('absoluteUrl', () => {
        it('prefixes root-relative paths with SITE_URL', () => {
            expect(absoluteUrl('/about')).toBe('https://rsmb.tv/about');
            expect(absoluteUrl('/projects/flights')).toBe('https://rsmb.tv/projects/flights');
        });

        it('inserts a slash for relative paths missing one', () => {
            expect(absoluteUrl('blog')).toBe('https://rsmb.tv/blog');
        });

        it('passes through absolute http(s) URLs unchanged', () => {
            expect(absoluteUrl('https://example.com/page')).toBe('https://example.com/page');
            expect(absoluteUrl('http://example.com/page')).toBe('http://example.com/page');
        });

        it('passes through other URI schemes unchanged', () => {
            expect(absoluteUrl('mailto:hi@example.com')).toBe('mailto:hi@example.com');
            expect(absoluteUrl('tel:+15555550100')).toBe('tel:+15555550100');
        });
    });
});
