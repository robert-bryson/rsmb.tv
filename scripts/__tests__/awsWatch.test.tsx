// @vitest-environment node
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const terminal = vi.hoisted(() => ({ render: vi.fn(), restore: vi.fn(), configure: vi.fn() }));
vi.mock('ink', () => ({ render: terminal.render }));
vi.mock('../dashboard/App.js', () => ({ App: () => null }));
vi.mock('../dashboard/config.js', () => ({ createConfig: terminal.configure }));
vi.mock('../dashboard/useEventLog.js', () => ({ interceptConsole: () => terminal.restore }));

const originalArguments = process.argv;

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    terminal.configure.mockReturnValue({});
    vi.useFakeTimers();
    vi.stubEnv('TZ', 'UTC');
    process.argv = [process.execPath, 'scripts/aws-watch.tsx'];
});

afterEach(() => {
    process.argv = originalArguments;
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('review regressions: November 14 watcher lifecycle', () => {
    it('preserves fractional interval values instead of truncating them', async () => {
        process.argv.push('--interval', '60.5');
        terminal.render.mockReturnValue({ waitUntilExit: () => Promise.resolve() });
        await import('../aws-watch.tsx');
        expect(terminal.configure).toHaveBeenCalledWith(expect.objectContaining({ interval: 60.5 }));
    });

    it.each(['invalid', '300seconds', 'Infinity', '0', '-1', '429497'])(
        'rejects --interval %s before installing capture or starting Ink', async interval => {
            const { createConfig } = await vi.importActual<typeof import('../dashboard/config.js')>('../dashboard/config.js');
            terminal.configure.mockImplementation(createConfig);
            process.argv.push('--interval', interval);
            await expect(import('../aws-watch.tsx')).rejects.toThrow(/interval/i);
            expect(terminal.render).not.toHaveBeenCalled();
            expect(terminal.restore).not.toHaveBeenCalled();
            expect(vi.getTimerCount()).toBe(0);
        },
    );

    it.each(['', undefined])('rejects a missing interval value (%s)', async interval => {
        const { createConfig } = await vi.importActual<typeof import('../dashboard/config.js')>('../dashboard/config.js');
        terminal.configure.mockImplementation(createConfig);
        process.argv.push('--interval');
        if (interval !== undefined) process.argv.push(interval);
        await expect(import('../aws-watch.tsx')).rejects.toThrow(/interval/i);
        expect(terminal.render).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('drains performance entries only while Ink is running and releases capture after exit', async () => {
        let exit!: () => void;
        const exited = new Promise<void>(resolve => { exit = resolve; });
        terminal.render.mockReturnValue({ waitUntilExit: () => exited });
        const clearMeasures = vi.spyOn(performance, 'clearMeasures');
        const clearMarks = vi.spyOn(performance, 'clearMarks');
        const running = import('../aws-watch.tsx');
        try {
            await vi.waitFor(() => expect(terminal.render).toHaveBeenCalledOnce());
            expect(terminal.render).toHaveBeenCalledWith(expect.anything(), { patchConsole: false });
            expect(vi.getTimerCount()).toBe(1);
            vi.advanceTimersByTime(60_000);
            expect(clearMeasures).toHaveBeenCalledOnce();
            expect(clearMarks).toHaveBeenCalledOnce();
            expect(terminal.restore).not.toHaveBeenCalled();
        } finally {
            exit();
            await running;
        }
        expect(vi.getTimerCount()).toBe(0);
        expect(terminal.restore).toHaveBeenCalledOnce();
    });

    it.each(['render', 'exit'])('releases the timer and console capture after an Ink %s failure', async failure => {
        const error = new Error('Terminal failed');
        if (failure === 'render') terminal.render.mockImplementation(() => { throw error; });
        else terminal.render.mockReturnValue({ waitUntilExit: () => Promise.reject(error) });
        await expect(import('../aws-watch.tsx')).rejects.toThrow(error);
        expect(vi.getTimerCount()).toBe(0);
        expect(terminal.restore).toHaveBeenCalledOnce();
    });
});
