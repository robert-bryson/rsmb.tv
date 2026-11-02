// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from 'vite';
import config from '../../vite.config';

vi.mock('vite', async importOriginal => ({
    ...await importOriginal<typeof import('vite')>(),
    loadEnv: vi.fn(() => ({})),
}));

afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(loadEnv).mockReset().mockReturnValue({});
});

function evaluate(command: 'build' | 'serve', mode = 'production') {
    if (typeof config !== 'function') throw new Error('Expected a Vite config factory');
    return config({ command, mode });
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
        vi.mocked(loadEnv).mockReturnValue({ CARTO_API_KEY: 'local-browser-key', PRIVATE_FIXTURE: 'must-stay-private' });
        const value = await evaluate('build');
        expect(value.define?.['import.meta.env.VITE_CARTO_API_KEY']).toBe('"build-browser-key"');
        expect(JSON.stringify(value.define)).not.toContain('must-stay-private');
        vi.stubEnv('VITE_CARTO_API_KEY', 'browser-test-key');
        expect((await evaluate('build')).define?.['import.meta.env.VITE_CARTO_API_KEY']).toBe('"browser-test-key"');
    });
});
