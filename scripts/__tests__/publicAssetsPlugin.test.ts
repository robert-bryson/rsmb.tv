// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { build, type InlineConfig } from 'vite';
import { publicAssetsPlugin } from '../public-assets-plugin';

const roots: string[] = [];
afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rsmb-public-assets-'));
    roots.push(root);
    const files = {
        'index.html': '<html><head><title>Built site</title></head><body>Site</body></html>',
        'public/index.html': 'This public file must not replace generated HTML.',
        'public/favicon.svg': '<svg />',
        'public/data/flights/routes.json': '{"routes":[]}',
        'public/data/trips/draft/photos/private.jpg': 'Local development photo',
        'public/data/trips/draft/geo/route.geojson': '{"local":true}',
        'public/media/trips/coast/animation.mp4': 'Reviewed bundled animation',
    };
    for (const [name, content] of Object.entries(files)) {
        const filename = path.join(root, name);
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        fs.writeFileSync(filename, content);
    }
    return root;
}

function config(root: string, extra: InlineConfig = {}): InlineConfig {
    return { configFile: false, root, logLevel: 'silent', plugins: [publicAssetsPlugin()], ...extra };
}

describe('hosted public asset output', () => {
    it.each(['production', 'development'])('excludes local trip files from a %s build while preserving hosted assets', async mode => {
        const root = fixture();
        await build(config(root, { mode }));
        expect(fs.existsSync(path.join(root, 'dist/data/trips'))).toBe(false);
        expect(fs.readFileSync(path.join(root, 'dist/data/flights/routes.json'), 'utf8')).toBe('{"routes":[]}');
        expect(fs.readFileSync(path.join(root, 'dist/media/trips/coast/animation.mp4'), 'utf8')).toBe('Reviewed bundled animation');
        expect(fs.readFileSync(path.join(root, 'dist/favicon.svg'), 'utf8')).toBe('<svg />');
        expect(fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8')).toContain('<title>Built site</title>');
        expect(fs.readFileSync(path.join(root, 'public/data/trips/draft/photos/private.jpg'), 'utf8')).toBe('Local development photo');
    });

    it.each(['disabled', 'missing', 'custom', 'no-copy'] as const)('respects %s public directory configuration', async choice => {
        const root = fixture();
        if (choice === 'custom') fs.renameSync(path.join(root, 'public'), path.join(root, 'static'));
        await build(config(root, {
            publicDir: choice === 'disabled' ? false : choice === 'missing' ? 'absent' : choice === 'custom' ? 'static' : 'public',
            build: { copyPublicDir: choice !== 'no-copy' },
        }));
        expect(fs.existsSync(path.join(root, 'dist/favicon.svg'))).toBe(choice === 'custom');
        expect(fs.existsSync(path.join(root, 'dist/data/trips'))).toBe(false);
    });

    it('does not write public files when build output is disabled', async () => {
        const root = fixture();
        await build(config(root, { build: { write: false } }));
        expect(fs.existsSync(path.join(root, 'dist'))).toBe(false);
    });

    it.each(['public', 'public/build'])('rejects %s output before source files can be removed', async outDir => {
        const root = fixture();
        await expect(build(config(root, { build: { outDir } })))
            .rejects.toThrow('Build output must be outside the public directory.');
        expect(fs.readFileSync(path.join(root, 'public/data/trips/draft/photos/private.jpg'), 'utf8')).toBe('Local development photo');
        expect(fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf8')).toBe('<svg />');
    });
});
