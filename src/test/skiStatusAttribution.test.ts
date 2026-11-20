import { within } from '@testing-library/dom';
import { expect, it, vi } from 'vitest';
import { skiMapAttribution } from '../features/ski-status/mapAttribution';
import type { Map as MapLibreMap } from '../maps/maplibre';

it('lets the disclosure own its state and keeps downloads when the provider changes', () => {
    const listeners = new Map<string, (event?: unknown) => void>();
    const canvas = document.createElement('div');
    const map = {
        _getUIString: (key: string) => key,
        getCanvasContainer: () => canvas,
        style: { tileManagers: {} },
        on: (name: string, listener: (event?: unknown) => void) => { listeners.set(name, listener); },
        off: vi.fn((name: string) => { listeners.delete(name); }),
    };
    const renderer = map as unknown as MapLibreMap;
    const control = skiMapAttribution();
    const disclosure = control.onAdd(renderer) as HTMLDetailsElement;
    document.body.append(disclosure);

    try {
        const toggle = within(disclosure).getByLabelText('Map sources and data');
        const downloads = [...disclosure.querySelectorAll('a[download]')];
        expect(disclosure.open).toBe(false);
        expect(downloads.map(link => link.getAttribute('download'))).toEqual([
            'ski-status-locations.json', 'ski-status-resort-bases.json', 'ski-status-resort-terrain.pmtiles',
        ]);

        disclosure.open = true;
        map.style.tileManagers = {
            background: { used: true, getSource: () => ({ attribution: '<a href="https://example.test/">Tile provider</a>' }) },
        };
        listeners.get('styledata')?.({ dataType: 'style' });
        expect(disclosure.textContent).toContain('Tile provider');
        expect([...disclosure.querySelectorAll('a[download]')]).toEqual(downloads);
        expect(disclosure.open).toBe(true);
        listeners.get('dragstart')?.();
        expect(disclosure.open).toBe(false);

        disclosure.open = true;
        const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        downloads[0].dispatchEvent(escape);
        expect(escape.defaultPrevented).toBe(true);
        expect(disclosure.open).toBe(false);
        expect(toggle).toHaveFocus();
    } finally {
        control.onRemove(renderer);
    }
    expect(disclosure.isConnected).toBe(false);
    expect(listeners.size).toBe(0);
});
