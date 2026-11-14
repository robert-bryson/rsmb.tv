// @vitest-environment node
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { PassThrough } from 'node:stream';
import nodeConsole from 'node:console';
import { Text, useApp, type Instance, type RenderOptions } from 'ink';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearEvents, useEvents, type DashboardEvent } from '../dashboard/useEventLog.js';

const terminal = vi.hoisted(() => ({
    stdout: undefined as PassThrough | undefined,
    stdin: undefined as PassThrough | undefined,
    instance: undefined as Instance | undefined,
    events: [] as DashboardEvent[],
    exit: undefined as (() => void) | undefined,
}));

// Keep Ink's renderer and console handling real. Replace only the terminal streams.
vi.mock('ink', async importOriginal => {
    const actual = await importOriginal<typeof import('ink')>();
    return {
        ...actual,
        render(node: ReactNode, options?: RenderOptions) {
            if (!terminal.stdout || !terminal.stdin) throw new Error('Test terminal is not ready.');
            terminal.instance = actual.render(node, {
                ...options, stdout: terminal.stdout, stdin: terminal.stdin, interactive: false,
            });
            return terminal.instance;
        },
    };
});
vi.mock('../dashboard/config.js', () => ({ createConfig: () => ({}) }));
vi.mock('../dashboard/App.js', () => ({
    App: function Probe() {
        const events = useEvents();
        const { exit } = useApp();
        useEffect(() => {
            terminal.events = events;
            terminal.exit = exit;
        }, [events, exit]);
        return <Text>Dashboard ready</Text>;
    },
}));

const originalArguments = process.argv;

beforeEach(() => {
    vi.stubEnv('TZ', 'UTC');
    vi.stubGlobal('console', nodeConsole);
    process.argv = [process.execPath, 'scripts/aws-watch.tsx'];
    terminal.stdout = Object.assign(new PassThrough(), { columns: 120, rows: 24, isTTY: false });
    terminal.stdin = new PassThrough();
    terminal.events = [];
    terminal.exit = undefined;
    clearEvents();
});

afterEach(() => {
    terminal.instance?.cleanup();
    terminal.instance = undefined;
    terminal.stdout?.destroy();
    terminal.stdin?.destroy();
    process.argv = originalArguments;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('watcher console integration', () => {
    it('keeps provider messages in the event log with their original levels while real Ink is mounted', async () => {
        let output = '';
        terminal.stdout!.on('data', (chunk: Buffer) => { output += chunk.toString(); });
        const original = { log: console.log, warn: console.warn, error: console.error, write: process.stderr.write };
        const running = import('../aws-watch.tsx');
        // Readiness can lag a rejected module. The finally block awaits the actual result.
        void running.catch(() => {});
        try {
            await vi.waitFor(() => expect(terminal.exit).toBeTypeOf('function'));
            console.log('Provider progress');
            console.warn('Provider delayed');
            console.error('Provider failed');
            process.stderr.write('Raw provider warning');
            await vi.waitFor(() => expect(terminal.events).toHaveLength(4), { timeout: 3500 });
            expect(terminal.events.map(({ level, source, message }) => ({ level, source, message }))).toEqual([
                { level: 'info', source: 'console', message: 'Provider progress' },
                { level: 'warn', source: 'console', message: 'Provider delayed' },
                { level: 'error', source: 'console', message: 'Provider failed' },
                { level: 'warn', source: 'stderr', message: 'Raw provider warning' },
            ]);
        } finally {
            terminal.instance?.unmount();
            await running;
        }
        // Noninteractive Ink writes its final frame during unmount.
        expect(output).toContain('Dashboard ready');
        expect(output).not.toMatch(/Provider|Raw provider/);
        expect(console.log).toBe(original.log);
        expect(console.warn).toBe(original.warn);
        expect(console.error).toBe(original.error);
        expect(process.stderr.write).toBe(original.write);
    }, 10_000);
});
