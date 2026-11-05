import { describe, expect, it, vi } from 'vitest';
import { createPageRecovery } from '../utils/pageRecovery';

function storageFixture() {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, values };
}

describe('page reload recovery', () => {
    it('remembers A after retrying B, including across fresh documents', () => {
        const storage = storageFixture();
        const reload = vi.fn();
        const options = { storage: () => storage, now: () => 1000, reload };
        expect(createPageRecovery(options)('https://example.test/about')).toBe(true);
        expect(createPageRecovery(options)('https://example.test/projects')).toBe(true);
        expect(createPageRecovery(options)('https://example.test/about?new=1#changed')).toBe(false);
        expect(reload).toHaveBeenCalledTimes(2);
    });
    it('expires attempts after one minute and prunes stored history', () => {
        const storage = storageFixture();
        let now = 1000;
        const recover = createPageRecovery({ storage: () => storage, now: () => now, reload: vi.fn() });
        expect(recover('https://example.test/about')).toBe(true);
        now += 59_999;
        expect(recover('https://example.test/about')).toBe(false);
        now++;
        expect(recover('https://example.test/about')).toBe(true);
        expect(JSON.parse([...storage.values.values()][0])).toEqual([['/about', now]]);
    });
    it('bounds history to 32 routes', () => {
        const storage = storageFixture();
        const recover = createPageRecovery({ storage: () => storage, now: () => 1000, reload: vi.fn() });
        for (let index = 0; index < 40; index++) recover(`https://example.test/page-${index}`);
        expect(JSON.parse([...storage.values.values()][0])).toHaveLength(32);
        expect(recover('https://example.test/page-39')).toBe(false);
    });
    it.each(['bad json', '{}', '[null,["/about","yesterday"],["/about",9999999]]'])('recovers from malformed stored data: %s', stored => {
        const storage = { getItem: () => stored, setItem: vi.fn() };
        expect(createPageRecovery({ storage: () => storage, now: () => 1000, reload: vi.fn() })('https://example.test/about')).toBe(true);
    });
    it('retains an in-document limit when storage reads or writes throw', () => {
        const recover = createPageRecovery({ storage: () => { throw new Error('Storage blocked'); }, now: () => 1000, reload: vi.fn() });
        expect(recover('https://example.test/about')).toBe(true);
        expect(recover('https://example.test/about')).toBe(false);
    });
    it('retains the in-document limit when reads succeed but writes fail', () => {
        const recover = createPageRecovery({ storage: () => ({ getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } }), now: () => 1000, reload: vi.fn() });
        expect(recover('https://example.test/about')).toBe(true);
        expect(recover('https://example.test/about')).toBe(false);
    });
});
