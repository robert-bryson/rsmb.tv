import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageKey = 'rsmb:adv-atlas:sessions:v1';
const url = '/projects/adv-atlas/map?trip=coast';
const saved = {
    panelOpen: false, scrollTop: 320,
    camera: { center: [-122, 47] as [number, number], zoom: 8, bearing: 30, pitch: 20 },
};

beforeEach(() => { vi.resetModules(); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

describe('atlas tab sessions', () => {
    it('copies and restores drawer size and expanded presentation across module reloads', async () => {
        const { saveAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        const expanded = { ...saved, panelOpen: true, panelState: 'expanded' as const, resultsView: 'table' as const };
        saveAtlasSession('expanded', url, expanded);
        vi.resetModules();
        const { readAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        expect(readAtlasSession('expanded')).toEqual(expanded);
    });
    it('restores history and explicit report returns after the JavaScript module reloads', async () => {
        const { saveAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        saveAtlasSession('history-key', url, saved);
        vi.resetModules();
        const { readAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        expect(readAtlasSession('history-key')).toEqual(saved);
        expect(readAtlasSession('new-key', url)).toEqual(saved);
        expect(readAtlasSession('fresh-visit')).toBeUndefined();
    });

    it('keeps stored snapshots independent of callers and returned values', async () => {
        const { saveAtlasSession, readAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        const value = structuredClone(saved);
        saveAtlasSession('history-key', url, value);
        value.camera.center[0] = 0;
        value.scrollTop = 0;
        expect(readAtlasSession('history-key')).toEqual(saved);
        readAtlasSession('history-key')!.camera!.center[0] = 10;
        expect(readAtlasSession('new-key', url)).toEqual(saved);
    });

    it('restores the originating visit when another visit has overwritten the same URL', async () => {
        const { saveAtlasSession, readAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        saveAtlasSession('original-visit', url, saved);
        saveAtlasSession('later-visit', url, { panelOpen: true, scrollTop: 0 });
        expect(readAtlasSession('return-visit', url, 'original-visit')).toEqual(saved);
        saveAtlasSession('return-visit', url, { panelOpen: false, scrollTop: 80 });
        expect(readAtlasSession('return-visit', url, 'original-visit')).toEqual({ panelOpen: false, scrollTop: 80 });
    });

    it('does not substitute another visit when an explicit return snapshot is unavailable', async () => {
        const { saveAtlasSession, readAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        saveAtlasSession('later-visit', url, saved);
        expect(readAtlasSession('return-visit', url, 'expired-visit')).toBeUndefined();
    });

    it.each(['read', 'write'])('retains in-memory navigation when storage %s fails', async failure => {
        if (failure === 'read') vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('Storage blocked'); });
        else vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
        const { saveAtlasSession, readAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        expect(() => saveAtlasSession('history-key', url, saved)).not.toThrow();
        expect(readAtlasSession('history-key')).toEqual(saved);
    });

    it.each([
        'invalid JSON', '{}', 'null',
        JSON.stringify([['bad', null]]),
        JSON.stringify([['bad', { panelOpen: 'false', scrollTop: 0 }]]),
        JSON.stringify([['bad', { panelOpen: true, scrollTop: -1 }]]),
        JSON.stringify([['bad', { panelOpen: true, scrollTop: null }]]),
        JSON.stringify([['bad', { panelOpen: true, panelState: 'unknown', scrollTop: 0 }]]),
        JSON.stringify([['bad', { panelOpen: true, panelState: 'collapsed', scrollTop: 0 }]]),
        JSON.stringify([['bad', { panelOpen: true, resultsView: 'unknown', scrollTop: 0 }]]),
        JSON.stringify([['bad', { panelOpen: true, resultsView: { toString: {} }, scrollTop: 0 }]]),
        JSON.stringify([['bad', { ...saved, camera: { ...saved.camera, center: [0] } }]]),
        JSON.stringify([['bad', { ...saved, camera: { ...saved.camera, center: [0, 100] } }]]),
        JSON.stringify([['bad', { ...saved, camera: { ...saved.camera, zoom: '8' } }]]),
        JSON.stringify([['bad', { ...saved, camera: { ...saved.camera, zoom: 23 } }]]),
        JSON.stringify([['bad', { ...saved, camera: { ...saved.camera, bearing: null } }]]),
        JSON.stringify([['bad', { ...saved, camera: { ...saved.camera, pitch: -1 } }]]),
    ])('ignores malformed stored state: %s', async raw => {
        sessionStorage.setItem(storageKey, raw);
        const { readAtlasSession, saveAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        expect(readAtlasSession('bad')).toBeUndefined();
        expect(() => saveAtlasSession('recovered', url, saved)).not.toThrow();
        expect(readAtlasSession('recovered')).toEqual(saved);
    });

    it('loads valid records alongside invalid records and supports views without a camera', async () => {
        const panel = { panelOpen: true, scrollTop: 0 };
        sessionStorage.setItem(storageKey, JSON.stringify([null, ['bad', {}], ['panel', panel], ['camera', saved]]));
        const { readAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        expect(readAtlasSession('panel')).toEqual(panel);
        expect(readAtlasSession('camera')).toEqual(saved);
        expect(readAtlasSession('bad')).toBeUndefined();
    });

    it('retains wrapped map coordinates and strips unknown stored fields', async () => {
        const wrapped = { ...saved, camera: { ...saved.camera, center: [540, -40], zoom: -1 } };
        sessionStorage.setItem(storageKey, JSON.stringify([['wrapped', {
            ...wrapped, extra: 'discard', camera: { ...wrapped.camera, extra: 'discard' },
        }]]));
        const { readAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        expect(readAtlasSession('wrapped')).toEqual(wrapped);
    });

    it('bounds persisted history and retains recently updated views across reloads', async () => {
        const { saveAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        for (let index = 0; index < 20; index++) saveAtlasSession(`history-${index}`, `${url}-${index}`, saved);
        saveAtlasSession('history-0', `${url}-0`, saved);
        saveAtlasSession('history-20', `${url}-20`, saved);
        expect(JSON.parse(sessionStorage.getItem(storageKey)!)).toHaveLength(40);
        vi.resetModules();
        const { readAtlasSession } = await import('../features/trips/atlas/tripAtlasSession');
        expect(readAtlasSession('history-0')).toEqual(saved);
        expect(readAtlasSession('history-1')).toBeUndefined();
        expect(readAtlasSession('history-20')).toEqual(saved);
    });
});
