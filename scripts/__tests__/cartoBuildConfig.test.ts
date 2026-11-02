// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import config from '../../vite.config';

let envDirectory: string;

beforeEach(() => {
    envDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmb-carto-env-'));
    vi.stubEnv('VITE_CARTO_API_KEY', undefined);
    vi.stubEnv('CARTO_API_KEY', undefined);
});

afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(envDirectory, { recursive: true, force: true });
});

function writeLocalEnv(values: Record<string, string>) {
    fs.writeFileSync(path.join(envDirectory, '.env.local'), Object.entries(values)
        .map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n'));
}

function evaluate(command: 'build' | 'serve', mode = 'production') {
    if (typeof config !== 'function') throw new Error('Expected a Vite config factory');
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(envDirectory);
    try {
        return config({ command, mode });
    } finally {
        cwd.mockRestore();
    }
}

describe('CARTO build configuration', () => {
    it.each(['production', 'development'])('rejects a missing browser key in %s release builds', mode => {
        vi.stubEnv('VITE_CARTO_API_KEY', '');
        vi.stubEnv('CARTO_API_KEY', '');
        expect(() => evaluate('build', mode)).toThrow('Set CARTO_API_KEY');
    });

    it('permits local development and synthetic test builds without credentials', () => {
        vi.stubEnv('VITE_CARTO_API_KEY', '');
        vi.stubEnv('CARTO_API_KEY', '');
        expect(() => evaluate('serve', 'development')).not.toThrow();
        expect(() => evaluate('build', 'trip-test')).not.toThrow();
    });

    it('exposes only the selected browser key and honors process environment over local files', async () => {
        vi.stubEnv('CARTO_API_KEY', ' build-browser-key ');
        vi.stubEnv('VITE_CARTO_API_KEY', '');
        writeLocalEnv({ CARTO_API_KEY: 'local-browser-key', PRIVATE_FIXTURE: 'must-stay-private' });
        const value = await evaluate('build');
        expect(value.define?.['import.meta.env.VITE_CARTO_API_KEY']).toBe('"build-browser-key"');
        expect(JSON.stringify(value.define)).not.toContain('must-stay-private');
        vi.stubEnv('VITE_CARTO_API_KEY', 'browser-test-key');
        expect((await evaluate('build')).define?.['import.meta.env.VITE_CARTO_API_KEY']).toBe('"browser-test-key"');
    });

    it.each<{
        name: string; processAlias?: string; processKey?: string;
        local: Record<string, string>; expected: string;
    }>([
        {
            name: 'process key after a blank client alias', processAlias: ' \t ', processKey: ' process-key ',
            local: {}, expected: 'process-key',
        },
        {
            name: 'file key after a blank process client alias', processAlias: ' ',
            local: { CARTO_API_KEY: ' file-key ' }, expected: 'file-key',
        },
        {
            name: 'file key after a blank file client alias',
            local: { VITE_CARTO_API_KEY: ' ', CARTO_API_KEY: ' file-key ' }, expected: 'file-key',
        },
        {
            name: 'process key before a file client alias', processKey: 'process-key',
            local: { VITE_CARTO_API_KEY: 'file-client-key' }, expected: 'process-key',
        },
        {
            name: 'file client alias before a file key',
            local: { VITE_CARTO_API_KEY: 'file-client-key', CARTO_API_KEY: 'file-key' }, expected: 'file-client-key',
        },
        {
            name: 'file key when higher-priority sources are unset',
            local: { CARTO_API_KEY: 'file-key' }, expected: 'file-key',
        },
    ])('selects the $name', async ({ processAlias, processKey, local, expected }) => {
        vi.stubEnv('VITE_CARTO_API_KEY', processAlias);
        vi.stubEnv('CARTO_API_KEY', processKey);
        writeLocalEnv(local);
        expect((await evaluate('build')).define?.['import.meta.env.VITE_CARTO_API_KEY']).toBe(JSON.stringify(expected));
    });

    it.each(['production', 'development'])('rejects whitespace-only keys in %s release builds', mode => {
        vi.stubEnv('VITE_CARTO_API_KEY', ' \t ');
        vi.stubEnv('CARTO_API_KEY', ' ');
        writeLocalEnv({ VITE_CARTO_API_KEY: '\t', CARTO_API_KEY: ' ' });
        expect(() => evaluate('build', mode)).toThrow('Set CARTO_API_KEY');
    });

    it('preserves Vite process overrides for the same variable name, including blank values', () => {
        vi.stubEnv('VITE_CARTO_API_KEY', ' ');
        vi.stubEnv('CARTO_API_KEY', '');
        writeLocalEnv({ VITE_CARTO_API_KEY: 'file-client-key', CARTO_API_KEY: 'file-key' });
        expect(() => evaluate('build')).toThrow('Set CARTO_API_KEY');
    });

    it('permits the unit-test build mode without credentials', () => {
        vi.stubEnv('VITE_CARTO_API_KEY', '');
        vi.stubEnv('CARTO_API_KEY', '');
        expect(() => evaluate('build', 'test')).not.toThrow();
    });
});
