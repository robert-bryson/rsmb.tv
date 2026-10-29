// @vitest-environment node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { withVisibleScrollbars } from '../trip-browser-options';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

describe('visible scrollbar launch options', () => {
    it('enables scrollbars with default Chromium options', () => {
        expect(withVisibleScrollbars('chromium', {})).toEqual({ ignoreDefaultArgs: ['--hide-scrollbars'] });
    });

    it('preserves configured options and does not mutate the original', () => {
        const options = Object.freeze({
            executablePath: '/custom/chromium', args: ['--example'], ignoreDefaultArgs: ['--mute-audio'],
        });
        expect(withVisibleScrollbars('chromium', options)).toEqual({
            executablePath: '/custom/chromium', args: ['--example'], ignoreDefaultArgs: ['--mute-audio', '--hide-scrollbars'],
        });
        expect(options.ignoreDefaultArgs).toEqual(['--mute-audio']);
    });

    it('retains an existing scrollbar override without duplication', () => {
        expect(withVisibleScrollbars('chromium', { ignoreDefaultArgs: ['--hide-scrollbars'] }))
            .toEqual({ ignoreDefaultArgs: ['--hide-scrollbars'] });
    });

    it('retains the option to ignore all default arguments', () => {
        expect(withVisibleScrollbars('chromium', { ignoreDefaultArgs: true })).toEqual({ ignoreDefaultArgs: true });
    });

    it('supports explicitly enabled default arguments', () => {
        expect(withVisibleScrollbars('chromium', { ignoreDefaultArgs: false }))
            .toEqual({ ignoreDefaultArgs: ['--hide-scrollbars'] });
    });

    it.each(['firefox', 'webkit'])('preserves %s launch options', browserName => {
        const options = { executablePath: '/custom/browser', ignoreDefaultArgs: ['--example'] };
        expect(withVisibleScrollbars(browserName, options)).toBe(options);
    });
});

it('preserves project launch options through the actual scrollbar fixture', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmb-browser-fixture-'));
    const projects = [
        {
            name: 'custom chromium',
            use: { browserName: 'chromium', launchOptions: {
                executablePath: '/custom/chromium', args: ['--example'], ignoreDefaultArgs: ['--mute-audio'],
            } },
            metadata: { expected: {
                executablePath: '/custom/chromium', args: ['--example'], ignoreDefaultArgs: ['--mute-audio', '--hide-scrollbars'],
            } },
        },
        {
            name: 'custom firefox',
            use: { browserName: 'firefox', launchOptions: { executablePath: '/custom/firefox', args: ['--example'] } },
            metadata: { expected: { executablePath: '/custom/firefox', args: ['--example'] } },
        },
        {
            name: 'all defaults ignored',
            use: { browserName: 'chromium', launchOptions: { ignoreDefaultArgs: true } },
            metadata: { expected: { ignoreDefaultArgs: true } },
        },
        {
            name: 'already visible',
            use: { browserName: 'chromium', launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } },
            metadata: { expected: { ignoreDefaultArgs: ['--hide-scrollbars'] } },
        },
        {
            name: 'default chromium',
            use: { browserName: 'chromium' },
            metadata: { expected: { ignoreDefaultArgs: ['--hide-scrollbars'] } },
        },
        {
            name: 'explicit defaults',
            use: { browserName: 'chromium', launchOptions: { ignoreDefaultArgs: false } },
            metadata: { expected: { ignoreDefaultArgs: ['--hide-scrollbars'] } },
        },
    ];
    try {
        fs.writeFileSync(path.join(directory, 'playwright.config.mjs'), `export default ${JSON.stringify({
            testDir: directory, outputDir: path.join(directory, 'results'), reporter: 'list', projects,
        })};`);
        fs.writeFileSync(path.join(directory, 'launch-options.spec.ts'), `
            import { expect } from ${JSON.stringify(path.join(repoRoot, 'node_modules/@playwright/test/index.mjs'))};
            import { scrollbarTest } from ${JSON.stringify(path.join(repoRoot, 'tests/trips/scrollbars.ts'))};
            scrollbarTest('keeps configured options', async ({ launchOptions }, testInfo) => {
                expect(launchOptions).toEqual(testInfo.project.metadata.expected);
            });
        `);
        const result = spawnSync(process.execPath, [
            path.join(repoRoot, 'node_modules/@playwright/test/cli.js'),
            'test', '--config', path.join(directory, 'playwright.config.mjs'), '--workers=1',
        ], { cwd: repoRoot, encoding: 'utf8', timeout: 15_000 });
        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('6 passed');
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}, 20_000);
