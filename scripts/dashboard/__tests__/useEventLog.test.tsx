import { type ReactNode } from 'react';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addEvent, clearEvents, EventLogPanel, interceptConsole, useEvents } from '../useEventLog.js';

vi.mock('ink', () => ({
    Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Text: ({ children, color }: { children: ReactNode; color?: string }) => <span data-color={color}>{children}</span>,
}));

const now = new Date('2026-11-14T12:00:00Z');
const ttl = 10 * 60_000;
let restoreConsole: (() => void) | undefined;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    clearEvents();
});

afterEach(() => {
    restoreConsole?.();
    restoreConsole = undefined;
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('review regressions: November 14 dashboard events', () => {
    it('publishes changes on the next poll and avoids renders when the store is unchanged', () => {
        const renderEventLog = vi.fn(useEvents);
        const { result } = renderHook(renderEventLog);
        act(() => addEvent('error', 'Build', 'Failed'));
        expect(result.current).toEqual([]);
        act(() => vi.advanceTimersByTime(2000));
        expect(result.current).toEqual([expect.objectContaining({ level: 'error', source: 'Build', message: 'Failed', count: 1, timestamp: now })]);
        const renders = renderEventLog.mock.calls.length;
        act(() => vi.advanceTimersByTime(6000));
        expect(renderEventLog).toHaveBeenCalledTimes(renders);
    });

    it('keeps only the latest twenty distinct events', () => {
        for (let index = 0; index < 25; index++) addEvent('info', 'Build', `Job ${index}`);
        const { result } = renderHook(useEvents);
        expect(result.current.map(event => event.message)).toEqual(Array.from({ length: 20 }, (_, index) => `Job ${index + 5}`));
        expect(new Set(result.current.map(event => event.id)).size).toBe(20);
    });

    it('refreshes duplicates without changing a previously published snapshot', () => {
        addEvent('warn', 'Build', 'Slow');
        const { result } = renderHook(useEvents);
        const snapshot = result.current;
        act(() => {
            vi.advanceTimersByTime(2000);
            addEvent('warn', 'Build', 'Slow');
            addEvent('error', 'Build', 'Slow');
            addEvent('warn', 'Data', 'Slow');
            vi.advanceTimersByTime(2000);
        });
        expect(snapshot[0]).toMatchObject({ count: 1, timestamp: now });
        expect(result.current).toHaveLength(3);
        expect(result.current[0]).toMatchObject({ id: snapshot[0].id, count: 2, timestamp: new Date(now.getTime() + 2000) });
    });

    it('retains a recently repeated event when the log reaches capacity', () => {
        for (let index = 0; index < 20; index++) addEvent('info', 'Build', `Job ${index}`);
        const { result } = renderHook(useEvents);
        const snapshot = result.current;
        act(() => {
            vi.advanceTimersByTime(1000);
            addEvent('info', 'Build', 'Job 0');
            addEvent('info', 'Build', 'Job 20');
            vi.advanceTimersByTime(2000);
        });
        expect(result.current.map(event => event.message)).toEqual([
            ...Array.from({ length: 18 }, (_, index) => `Job ${index + 2}`), 'Job 0', 'Job 20',
        ]);
        expect(result.current.at(-2)).toMatchObject({ id: snapshot[0].id, count: 2 });
        expect(snapshot[0]).toMatchObject({ count: 1, timestamp: now });
    });

    it('expires events after ten minutes without waiting for another event', () => {
        addEvent('info', 'Build', 'Ready');
        const { result } = renderHook(useEvents);
        act(() => vi.advanceTimersByTime(ttl - 1));
        expect(result.current).toHaveLength(1);
        act(() => vi.advanceTimersByTime(1));
        expect(result.current).toEqual([]);
    });

    it('removes expired events when a subscriber mounts after a quiet period', () => {
        addEvent('info', 'Build', 'Ready');
        vi.setSystemTime(now.getTime() + ttl);
        const { result } = renderHook(useEvents);
        expect(result.current).toEqual([]);
    });

    it('clears events for every subscriber and releases their polling timers', () => {
        addEvent('info', 'Build', 'Ready');
        const first = renderHook(useEvents);
        const second = renderHook(useEvents);
        act(() => {
            clearEvents();
            vi.advanceTimersByTime(2000);
        });
        expect(first.result.current).toEqual([]);
        expect(second.result.current).toEqual([]);
        first.unmount();
        second.unmount();
        expect(vi.getTimerCount()).toBe(0);
        act(() => {
            addEvent('error', 'Build', 'Failed');
            vi.advanceTimersByTime(2000);
        });
        expect(first.result.current).toEqual([]);
        expect(second.result.current).toEqual([]);
    });

    it('renders event levels, UTC times, duplicate counts, and the cleared state', () => {
        addEvent('error', 'Build', 'Failed');
        addEvent('warn', 'Data', 'Slow');
        addEvent('info', 'Health', 'Recovered');
        addEvent('info', 'Health', 'Recovered');
        render(<EventLogPanel timeZone="UTC" />);
        expect(screen.getAllByText('12:00:00')).toHaveLength(3);
        expect(screen.getByText('Failed')).toHaveAttribute('data-color', 'red');
        expect(screen.getByText('Slow')).toHaveAttribute('data-color', 'yellow');
        expect(screen.getByText('Recovered')).toHaveAttribute('data-color', 'green');
        expect(screen.getByText('(×2)')).toBeVisible();
        act(() => {
            clearEvents();
            vi.advanceTimersByTime(2000);
        });
        expect(screen.queryByText('Event Log')).not.toBeInTheDocument();
    });

    it('captures errors, circular objects, bigint values, and console format arguments without throwing', () => {
        restoreConsole = interceptConsole();
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(() => console.log(circular, 12n)).not.toThrow();
        console.warn('Build %s: %d', 'test', 3);
        console.error(new Error('Provider failed'));
        console.log('   ');
        const { result } = renderHook(useEvents);
        expect(result.current).toHaveLength(3);
        expect(result.current[0].message).toContain('[Circular');
        expect(result.current[0].message).toContain('12n');
        expect(result.current[1]).toMatchObject({ level: 'warn', source: 'console', message: 'Build test: 3' });
        expect(result.current[2]).toMatchObject({ level: 'error', message: expect.stringContaining('Provider failed') });
    });

    it('removes terminal control sequences and bounds captured output', () => {
        restoreConsole = interceptConsole();
        console.log('\u001b[31mRed\u001b[0m');
        console.warn('x'.repeat(300));
        process.stderr.write(Buffer.from('\u001b[2J' + 'y'.repeat(300)));
        const { result } = renderHook(useEvents);
        expect(result.current.map(event => event.message)).toEqual(['Red', 'x'.repeat(197) + '…', 'y'.repeat(197) + '…']);
    });

    it('sanitizes and bounds provider errors before storing and deduplicating them', () => {
        const message = 'Provider failed: ' + 'x'.repeat(300);
        addEvent('error', 'Health', `\u001b[31m${message}\u001b[0m`);
        addEvent('error', 'Health', message);
        const { result } = renderHook(useEvents);
        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toMatchObject({ message: message.slice(0, 197) + '…', count: 2 });
    });

    it('omits empty provider errors instead of retaining blank events', () => {
        addEvent('error', 'Health', ' \u001b[0m ');
        const { result } = renderHook(useEvents);
        expect(result.current).toEqual([]);
    });

    it('keeps Unicode characters intact when a message reaches the truncation boundary', () => {
        addEvent('warn', 'Build', 'x'.repeat(196) + '🚀' + 'y'.repeat(20));
        const { result } = renderHook(useEvents);
        expect(result.current[0].message).toBe('x'.repeat(196) + '…');
        expect(result.current[0].message.isWellFormed()).toBe(true);
    });

    it.each([
        ['Buffer', (bytes: Uint8Array) => Buffer.from(bytes)],
        ['Uint8Array', (bytes: Uint8Array) => bytes],
        ['Uint16Array', (bytes: Uint8Array) => new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)],
        ['DataView', (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)],
    ] as const)('ignores string encodings for raw stderr %s data, as Node does', (_type, view) => {
        restoreConsole = interceptConsole();
        const bytes = new TextEncoder().encode('xxCafé!yy').subarray(2, -2);
        process.stderr.write(view(bytes), 'hex');
        const { result } = renderHook(useEvents);
        expect(result.current[0].message).toBe('Café!');
    });

    it.each([
        ['hex', '436166c3a9'],
        ['base64', 'Q2Fmw6k='],
    ] as const)('applies %s encoding to string stderr chunks before reading terminal text', (encoding, text) => {
        restoreConsole = interceptConsole();
        process.stderr.write(text, encoding);
        const { result } = renderHook(useEvents);
        expect(result.current[0].message).toBe('Café');
    });

    it('decodes a UTF-8 character divided between consecutive stderr writes', () => {
        restoreConsole = interceptConsole();
        const bytes = Buffer.from('🚀');
        process.stderr.write(bytes.subarray(0, 2), 'hex');
        process.stderr.write(bytes.subarray(2));
        const { result } = renderHook(useEvents);
        expect(result.current.map(event => event.message)).toEqual(['🚀']);
    });

    it('flushes incomplete bytes on cleanup and starts the next capture with fresh decoder state', () => {
        restoreConsole = interceptConsole();
        process.stderr.write(Buffer.from([0xe2]));
        const { result } = renderHook(useEvents);
        expect(result.current).toEqual([]);
        act(() => {
            restoreConsole?.();
            vi.advanceTimersByTime(2000);
        });
        expect(result.current.map(event => event.message)).toEqual(['�']);
        restoreConsole = interceptConsole();
        act(() => {
            process.stderr.write('Next session');
            vi.advanceTimersByTime(2000);
        });
        expect(result.current.map(event => event.message)).toEqual(['�', 'Next session']);
    });

    it('completes stderr callbacks asynchronously, including filtered writes and binary chunks', async () => {
        restoreConsole = interceptConsole();
        const completed = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
        expect(process.stderr.write('GET /repos/example - 403 with id abc', completed[0])).toBe(true);
        process.stderr.write('  ', 'utf8', completed[1]);
        process.stderr.write(Buffer.from('Encoded'), 'utf16le', completed[2]);
        process.stderr.write(new Uint8Array(Buffer.from('Raw warning')), completed[3]);
        completed.forEach(callback => expect(callback).not.toHaveBeenCalled());
        await Promise.resolve();
        completed.forEach(callback => expect(callback).toHaveBeenCalledExactlyOnceWith());
        const { result } = renderHook(useEvents);
        expect(result.current.map(event => event.message)).toEqual(['Encoded', 'Raw warning']);
    });

    it('installs interception once and restores console and stderr after each session', () => {
        const original = { log: console.log, warn: console.warn, error: console.error, write: process.stderr.write };
        const first = interceptConsole();
        restoreConsole = first;
        const capturedLog = console.log;
        expect(interceptConsole()).toBe(first);
        expect(console.log).toBe(capturedLog);
        first();
        expect(console.log).toBe(original.log);
        expect(console.warn).toBe(original.warn);
        expect(console.error).toBe(original.error);
        expect(process.stderr.write).toBe(original.write);
        restoreConsole = interceptConsole();
        first();
        expect(console.log).not.toBe(original.log);
        restoreConsole();
        expect(console.log).toBe(original.log);
    });
});
