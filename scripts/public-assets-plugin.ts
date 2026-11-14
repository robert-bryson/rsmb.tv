import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

function assertOutputOutsidePublic(publicDir: string, output: string) {
    const relative = path.relative(publicDir, output);
    const outside = path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`);
    if (!outside) throw new Error('Build output must be outside the public directory.');
}

/** Copy hosted public assets while keeping the local trip mirror out of builds. */
export function publicAssetsPlugin(): Plugin {
    let config: ResolvedConfig;
    let copy = false;
    return {
        name: 'public-assets',
        apply: 'build',
        config(value) {
            copy = value.build?.copyPublicDir !== false;
            return { build: { copyPublicDir: false } };
        },
        configResolved(value) {
            config = value;
            // Validate before Vite can empty the configured output directory.
            if (copy && config.publicDir) assertOutputOutsidePublic(config.publicDir, path.resolve(config.root, config.build.outDir));
        },
        async writeBundle(options, bundle) {
            if (!copy || !config.publicDir || !fs.existsSync(config.publicDir)) return;
            const output = path.resolve(config.root, options.dir ?? config.build.outDir);
            assertOutputOutsidePublic(config.publicDir, output);
            const generated = new Set(Object.keys(bundle));
            await fs.promises.cp(config.publicDir, output, {
                recursive: true,
                dereference: true,
                filter(source) {
                    const relative = path.relative(config.publicDir, source).split(path.sep).join('/');
                    // Prune the directory before traversing any of its files.
                    return relative !== 'data/trips' && !relative.startsWith('data/trips/') && !generated.has(relative);
                },
            });
        },
    };
}
