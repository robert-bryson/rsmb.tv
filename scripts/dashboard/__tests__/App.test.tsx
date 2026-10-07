import React from 'react';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, useInput, type Instance, type Key } from 'ink';
import terminalSize from 'terminal-size';
import { App } from '../App.js';
import type { DashboardConfig } from '../config.js';
import { clearEvents } from '../useEventLog.js';
import { clearResolvedIncidents } from '../useIncidentLog.js';

const panels = vi.hoisted(() => ({
    health: undefined as ((problems: string[]) => void) | undefined,
    external: {} as Record<string, (problems: string[]) => void>,
}));

vi.mock('ink', async (importOriginal) => ({
    ...await importOriginal<typeof import('ink')>(),
    useInput: vi.fn(),
}));

vi.mock('../HealthPanel.js', () => ({
    HealthPanel: ({ onProblems }: { onProblems: (problems: string[]) => void }) => {
        panels.health = onProblems;
        return null;
    },
}));
vi.mock('../AlarmPanel.js', () => ({ AlarmPanel: () => null }));
vi.mock('../BuildPanel.js', () => ({ BuildPanel: () => null }));
vi.mock('../CostPanel.js', () => ({ CostPanel: () => null }));
vi.mock('../ResourcePanel.js', () => ({ ResourcePanel: () => null }));
vi.mock('../GitHubPanel.js', () => ({ GitHubPanel: () => null }));
vi.mock('../ExternalHealthPanel.js', () => ({
    ExternalHealthPanel: ({ group, onProblems }: {
        group: DashboardConfig['externalGroups'][number];
        onProblems: (problems: string[]) => void;
    }) => {
        panels.external[group.id] = onProblems;
        return null;
    },
}));
vi.mock('../useEventLog.js', () => ({ EventLogPanel: () => null, clearEvents: vi.fn() }));
vi.mock('../useIncidentLog.js', () => ({
    IncidentSummary: () => null,
    IncidentPanel: () => null,
    clearResolvedIncidents: vi.fn(),
}));

const config: DashboardConfig = {
    profile: 'test',
    region: 'us-east-1',
    timeZone: 'UTC',
    githubToken: undefined,
    projects: [],
    githubRepos: [],
    externalGroups: [],
    intervals: { health: 60, alarms: 60, builds: 60, costs: 300, external: 60, github: 120 },
};

let instance: Instance | undefined;

afterEach(async () => {
    instance?.unmount();
    await instance?.waitUntilExit();
    instance?.cleanup();
    instance = undefined;
    panels.health = undefined;
    panels.external = {};
    vi.clearAllMocks();
});

function mountDashboard(rows?: number, overrides: Partial<DashboardConfig> = {}) {
    const stdout = Object.assign(new PassThrough(), { columns: 120, rows, isTTY: false });
    let frame = '';
    stdout.on('data', (chunk: Buffer) => { frame = chunk.toString(); });
    instance = render(<App config={{ ...config, ...overrides }} />, {
        stdout,
        debug: true,
        interactive: false,
        patchConsole: false,
    });
    return {
        stdout,
        getHeight: () => frame.replace(/\n$/, '').split('\n').length,
        getFrame: () => frame,
    };
}

function press(input: string, overrides: Partial<Key> = {}) {
    const handler = vi.mocked(useInput).mock.lastCall?.[0];
    if (!handler) throw new Error('Dashboard input handler was not registered');
    handler(input, {
        upArrow: false, downArrow: false, leftArrow: false, rightArrow: false,
        pageDown: false, pageUp: false, home: false, end: false, return: false,
        escape: false, ctrl: false, shift: false, tab: false, backspace: false,
        delete: false, meta: false, super: false, hyper: false, capsLock: false,
        numLock: false,
        ...overrides,
    });
}

describe('dashboard terminal dimensions', () => {
    it('uses the terminal height and keeps the footer visible', async () => {
        const dashboard = mountDashboard(32);
        await vi.waitFor(() => expect(dashboard.getHeight()).toBe(32));
        expect(dashboard.getFrame()).toContain('[q] quit');
    });

    it('updates the height when the terminal resizes', async () => {
        const dashboard = mountDashboard(32);
        await vi.waitFor(() => expect(dashboard.getHeight()).toBe(32));
        dashboard.stdout.rows = 18;
        dashboard.stdout.emit('resize');
        await vi.waitFor(() => expect(dashboard.getHeight()).toBe(18));
        expect(dashboard.getFrame()).toContain('[q] quit');
    });

    it('uses detected terminal dimensions when the output stream has no rows', async () => {
        const expectedHeight = terminalSize().rows || 24;
        const dashboard = mountDashboard();
        await vi.waitFor(() => expect(dashboard.getHeight()).toBe(expectedHeight));
        expect(dashboard.getFrame()).toContain('[q] quit');
    });
});

describe('dashboard controls', () => {
    it('resets scrolling when switching display modes', async () => {
        const dashboard = mountDashboard(32);
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('(auto)'));
        press('j');
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('(auto) \u2191'));
        press('h');
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('Detail View'));
        expect(dashboard.getFrame()).not.toContain('(detail) \u2191');
        press('h');
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('(auto)'));
        expect(dashboard.getFrame()).not.toContain('Detail View');
    });

    it.each(['letters', 'arrows'])('clamps upward scrolling at zero with %s', async (controls) => {
        const dashboard = mountDashboard(32);
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('(auto)'));
        press(controls === 'letters' ? 'j' : '', { downArrow: controls === 'arrows' });
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('(auto) \u2191'));
        press(controls === 'letters' ? 'k' : '', { upArrow: controls === 'arrows' });
        await vi.waitFor(() => expect(dashboard.getFrame()).not.toContain('(auto) \u2191'));
        press(controls === 'letters' ? 'k' : '', { upArrow: controls === 'arrows' });
        await instance?.waitUntilRenderFlush();
        expect(dashboard.getHeight()).toBe(32);
        expect(dashboard.getFrame()).not.toContain('(auto) \u2191');
    });

    it('clears only the requested log', async () => {
        const dashboard = mountDashboard(32);
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('[q] quit'));
        press('e');
        expect(clearEvents).toHaveBeenCalledOnce();
        expect(clearResolvedIncidents).not.toHaveBeenCalled();
        press('c');
        expect(clearResolvedIncidents).toHaveBeenCalledOnce();
        expect(clearEvents).toHaveBeenCalledOnce();
    });

    it('exits and removes the resize listener on quit', async () => {
        const dashboard = mountDashboard(32);
        await vi.waitFor(() => expect(dashboard.stdout.listenerCount('resize')).toBeGreaterThan(0));
        press('q');
        await instance?.waitUntilExit();
        expect(dashboard.stdout.listenerCount('resize')).toBe(0);
    });
});

describe('dashboard problem reports', () => {
    it('shows health problems in compact mode and clears them after recovery', async () => {
        const dashboard = mountDashboard(32);
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('All OK'));
        panels.health?.(['service unavailable']);
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('ATTENTION'));
        expect(dashboard.getFrame()).toContain('service unavailable');
        press('h');
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('Detail View'));
        expect(dashboard.getFrame()).not.toContain('ATTENTION');
        press('h');
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('ATTENTION'));
        panels.health?.([]);
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('All OK'));
        expect(dashboard.getFrame()).not.toContain('service unavailable');
    });

    it('retains stable external callbacks and removes resolved group problems', async () => {
        const dashboard = mountDashboard(32, {
            externalGroups: [{ id: 'test', label: 'Test services', statusPageUrl: 'https://example.com', sites: [] }],
        });
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('Test services'));
        const report = panels.external.test;
        expect(report).toBeTypeOf('function');
        report(['external unavailable']);
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('external unavailable'));
        expect(panels.external.test).toBe(report);
        report(['external unavailable']);
        await instance?.waitUntilRenderFlush();
        expect(panels.external.test).toBe(report);
        report([]);
        await vi.waitFor(() => expect(dashboard.getFrame()).toContain('All OK'));
        expect(dashboard.getFrame()).not.toContain('external unavailable');
    });
});