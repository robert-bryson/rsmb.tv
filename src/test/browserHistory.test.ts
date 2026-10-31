import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeBrowserHistoryKey } from '../utils/browserHistory';

const originalState: unknown = window.history.state;
afterEach(() => {
    window.history.replaceState(originalState, '');
    vi.unstubAllGlobals();
});

describe('review regressions: direct browser history entries', () => {
    it('assigns a persistent key without changing the URL or existing state', () => {
        window.history.replaceState({ idx: 0, usr: { from: '/posts' } }, '');
        const url = window.location.href;
        initializeBrowserHistoryKey();
        const key: unknown = window.history.state.key;
        expect(key).toEqual(expect.any(String));
        expect(window.history.state).toEqual({ idx: 0, usr: { from: '/posts' }, key });
        expect(window.location.href).toBe(url);
        initializeBrowserHistoryKey();
        expect(window.history.state.key).toBe(key);
    });

    it('gives separate direct visits to the same URL different keys', () => {
        window.history.replaceState(null, '');
        initializeBrowserHistoryKey();
        const first: unknown = window.history.state.key;
        window.history.replaceState(null, '');
        initializeBrowserHistoryKey();
        expect(window.history.state.key).not.toBe(first);
    });

    it('retains a key already created by the router', () => {
        window.history.replaceState({ key: 'router-entry', idx: 2 }, '');
        initializeBrowserHistoryKey();
        expect(window.history.state).toEqual({ key: 'router-entry', idx: 2 });
    });

    it('initializes an HTTP development visit without randomUUID', () => {
        vi.stubGlobal('crypto', { getRandomValues: window.crypto.getRandomValues.bind(window.crypto) });
        window.history.replaceState(null, '');
        expect(() => initializeBrowserHistoryKey()).not.toThrow();
        expect(window.history.state.key).toEqual(expect.any(String));
    });

    it.each([null, '', 42, { key: '' }, { key: false }])('accepts an uninitialized history state: %j', state => {
        window.history.replaceState(state, '');
        initializeBrowserHistoryKey();
        expect(window.history.state.key).toEqual(expect.any(String));
        expect(window.history.state.key).not.toBe('');
    });
});
