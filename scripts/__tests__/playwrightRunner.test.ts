// @vitest-environment node
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForVite } from '../run-playwright.js';

function child() {
    return Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
}

afterEach(() => vi.useRealTimers());

describe('Playwright server startup', () => {
    it('rejects an occupied port instead of mistaking "already in use" for readiness', async () => {
        const vite = child();
        const pending = waitForVite(vite);
        const rejected = expect(pending).rejects.toThrow('exited before becoming ready');
        vite.stderr.write('error when starting dev server: Error: Port 4174 is already in use');
        vite.stdout.write('Error: Port 4174 is already in use');
        vite.emit('exit', 1);
        await rejected;
        expect(vite.stdout.listenerCount('data')).toBe(0);
        expect(vite.listenerCount('exit')).toBe(0);
    });

    it('waits for the listening URL even when startup output spans chunks', async () => {
        const vite = child();
        const ready = vi.fn();
        const pending = waitForVite(vite).then(ready);
        vite.stdout.write('VITE v8 ready in 250ms\n');
        await Promise.resolve();
        expect(ready).not.toHaveBeenCalled();
        vite.stdout.write('\u001b[32m➜  Loc');
        vite.stdout.write('al:   http://127.0.0.1:4174/\u001b[0m\n');
        await pending;
        expect(ready).toHaveBeenCalledOnce();
        expect(vite.listenerCount('error')).toBe(0);
    });

    it('rejects process startup errors', async () => {
        const vite = child();
        const rejected = expect(waitForVite(vite)).rejects.toThrow('spawn failed');
        vite.emit('error', new Error('spawn failed'));
        await rejected;
    });

    it('times out and removes startup listeners when the server does not listen', async () => {
        vi.useFakeTimers();
        const vite = child();
        const rejected = expect(waitForVite(vite)).rejects.toThrow('Timed out');
        await vi.advanceTimersByTimeAsync(120_000);
        await rejected;
        expect(vite.stdout.listenerCount('data')).toBe(0);
        expect(vite.listenerCount('exit')).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });
});
