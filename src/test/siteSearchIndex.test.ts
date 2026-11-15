import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.doUnmock('virtual:site-search'));

describe('site search index loading', () => {
    it('loads on demand and shares both pending and successful requests', async () => {
        const documents = [{ url: '/about', title: 'About' }];
        const module = vi.fn(() => ({ documents }));
        vi.doMock('virtual:site-search', module);
        const { loadSiteSearchIndex } = await import('../navigation/siteSearchIndex');
        expect(module).not.toHaveBeenCalled();
        const first = loadSiteSearchIndex();
        expect(loadSiteSearchIndex()).toBe(first);
        await expect(first).resolves.toBe(documents);
        expect(loadSiteSearchIndex()).toBe(first);
        expect(module).toHaveBeenCalledOnce();
    });

    it('releases a failed request so the next attempt can load the index', async () => {
        vi.doMock('virtual:site-search', () => { throw new Error('Index unavailable'); });
        const { loadSiteSearchIndex } = await import('../navigation/siteSearchIndex');
        await expect(loadSiteSearchIndex()).rejects.toThrow();
        const documents = [{ url: '/about', title: 'About' }];
        vi.doMock('virtual:site-search', () => ({ documents }));
        await expect(loadSiteSearchIndex()).resolves.toBe(documents);
    });
});
