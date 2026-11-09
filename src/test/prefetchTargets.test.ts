import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePrefetchTarget, prefetchRollout } from '../navigation/prefetchTargets';

vi.mock('../content/posts', () => ({ getPostBySlug: (slug: string) => slug === 'known' ? { slug, format: 'trip' }
    : slug === 'incomplete' ? { slug, development: { contentAvailable: false } } : undefined }));
const origin = 'https://www.rsmb.tv/projects';
beforeEach(() => vi.stubEnv('VITE_INTENT_PREFETCH', undefined));
afterEach(() => vi.unstubAllEnvs());

describe('prefetch targets', () => {
    it.each([
        [undefined, 'all'], ['', 'all'], ['all', 'all'], ['pages', 'pages'], ['off', 'off'],
        ['disabled', 'off'], ['OFF', 'off'], ['page', 'off'],
    ])('uses safe rollout rules for %s', (value, expected) => {
        expect(prefetchRollout(value)).toBe(expected);
    });

    it('normalizes aliases and temperature views without changing navigation URLs', () => {
        expect(resolvePrefetchTarget('/projects/adv-atlas', origin)).toMatchObject({ page: '/projects/adv-atlas/map', map: 'atlas' });
        expect(resolvePrefetchTarget('/projects/motorcycle-trips/map', origin)?.key).toBe('/projects/adv-atlas/map');
        expect(resolvePrefetchTarget('/trips', origin)?.page).toBe('/posts');
        expect(resolvePrefetchTarget('/blog/known?x=1#photos', origin)).toMatchObject({ key: '/trips/known', slug: 'known', search: '?x=1' });
        expect(resolvePrefetchTarget('/projects/temperature-records/map?view=county&state=MO', origin)?.key).toBe('/projects/temperature-records/map?view=county');
    });

    it('skips external, same-page, unknown, unpublished, and malformed destinations', () => {
        for (const href of ['https://example.com/about', 'mailto:x@example.com', '/projects?sort=1', '#projects', '/missing',
            '/blog/unknown', '/trips/incomplete', '/blog/%', 'https://user:password@www.rsmb.tv/about']) {
            expect(resolvePrefetchTarget(href, origin), href).toBeNull();
        }
    });

    it('resolves relative URLs and respects router basenames and canonical HTML aliases', () => {
        expect(resolvePrefetchTarget('about', 'https://www.rsmb.tv/site/posts', '/site/')).toMatchObject({ page: '/about' });
        expect(resolvePrefetchTarget('/about', 'https://www.rsmb.tv/site/posts', '/site/')).toBeNull();
        expect(resolvePrefetchTarget('/site/about.html', 'https://www.rsmb.tv/site/posts', '/site/')).toMatchObject({ page: '/about' });
        expect(prefetchRollout('pages')).toBe('pages'); expect(prefetchRollout('off')).toBe('off');
    });
});
