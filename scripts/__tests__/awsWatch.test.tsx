// @vitest-environment node
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const terminal = vi.hoisted(() => ({ render: vi.fn(), restore: vi.fn() }));
vi.mock('ink', () => ({ render: terminal.render }));
vi.mock('../dashboard/App.js', () => ({ App: () => null }));
vi.mock('../dashboard/config.js', () => ({ createConfig: () => ({}) }));
vi.mock('../dashboard/useEventLog.js', () => ({ interceptConsole: () => terminal.restore }));

const originalArguments = process.argv;

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
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
    it('drains performance entries only while Ink is running and releases capture after exit', async () => {
        let exit!: () => void;
        const exited = new Promise<void>(resolve => { exit = resolve; });
        terminal.render.mockReturnValue({ waitUntilExit: () => exited });
        const clearMeasures = vi.spyOn(performance, 'clearMeasures');
        const clearMarks = vi.spyOn(performance, 'clearMarks');
        const running = import('../aws-watch.tsx');
        await vi.waitFor(() => expect(terminal.render).toHaveBeenCalledOnce());
        expect(vi.getTimerCount()).toBe(1);
        vi.advanceTimersByTime(60_000);
        expect(clearMeasures).toHaveBeenCalledOnce();
        expect(clearMarks).toHaveBeenCalledOnce();
        expect(terminal.restore).not.toHaveBeenCalled();
        exit();
        await running;
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
