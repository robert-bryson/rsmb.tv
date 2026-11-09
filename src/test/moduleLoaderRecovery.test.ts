import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => document.querySelectorAll('link[data-module-retry]').forEach(link => link.remove()));

it('restores a failed CSS dependency when another map imports it', async () => {
    const { moduleLoader, MAPLIBRE_STYLESHEET } = await import('../navigation/moduleLoader');
    const original = document.createElement('link');
    original.rel = 'stylesheet'; original.href = '/assets/maplibre-gl-review.css'; original.dataset.moduleRetry = '';
    document.head.append(original);
    const first = moduleLoader(() => Promise.reject(new Error(`Unable to preload CSS for ${original.href}`)), MAPLIBRE_STYLESHEET);
    await expect(first()).rejects.toThrow('Unable to preload CSS');
    const load = vi.fn().mockResolvedValue({ default: 'second map' });
    const second = moduleLoader(load, MAPLIBRE_STYLESHEET);
    const request = second();
    await vi.waitFor(() => expect([...document.querySelectorAll<HTMLLinkElement>('link')].filter(link => link.href === original.href)).toHaveLength(2));
    expect(load).not.toHaveBeenCalled();
    const restored = [...document.querySelectorAll<HTMLLinkElement>('link')].find(link => link.href === original.href && link !== original)!;
    restored.dataset.moduleRetry = '';
    restored.dispatchEvent(new Event('load'));
    await expect(request).resolves.toEqual({ default: 'second map' });
    expect(second()).toBe(request);
    expect(original).not.toBeInTheDocument();
});

it('clears a synchronously thrown or non-Error loader failure', async () => {
    const { moduleLoader } = await import('../navigation/moduleLoader');
    const load = vi.fn().mockImplementationOnce(() => { throw 'unavailable'; }).mockResolvedValue('recovered');
    const shared = moduleLoader(load);
    await expect(shared()).rejects.toBe('unavailable');
    await expect(shared()).resolves.toBe('recovered');
});
