import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Plugin } from 'vite';
import { skiConditionsDirectory, skiConditionsRefreshWaitMs } from '../shared/skiConditionsCache.ts';

const exec = promisify(execFile);
const refreshInterval = 60 * 60_000;
const retryInterval = 5 * 60_000;

async function waitForManifest(refresh: Promise<void>) {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([refresh, new Promise<void>(resolve => { deadline = setTimeout(resolve, skiConditionsRefreshWaitMs); })]);
    } finally {
        clearTimeout(deadline);
    }
}

export function skiConditionsDevPlugin(mode: string): Plugin {
    return {
        name: 'ski-conditions-dev',
        apply: 'serve',
        configureServer(server) {
            if (mode !== '1' && mode !== 'rockies') return;
            const rockies = mode === 'rockies';
            const manifestRoute = `/${skiConditionsDirectory(rockies)}/manifest.json`;
            const manifestPath = resolve(server.config.root, manifestRoute.slice(1));
            const args = ['--import', 'tsx/esm', 'projects/ski-status/scripts/sync-conditions.ts'];
            if (rockies) args.push('--rockies-pilot');
            let refresh: Promise<void> | undefined;
            let lastAttempt = -Infinity;

            async function refreshIfDue() {
                const published = await stat(manifestPath).catch(error => {
                    if (error.code !== 'ENOENT') throw error;
                    return undefined;
                });
                const now = Date.now();
                if (published && published.mtimeMs <= now && now - published.mtimeMs < refreshInterval) return;
                if (refresh) return refresh;
                if (now - lastAttempt < retryInterval) return;
                lastAttempt = now;
                refresh = exec(process.execPath, args, { cwd: server.config.root }).then(() => undefined, error => {
                    server.config.logger.warn(`Could not refresh local ski conditions. ${error.message}`);
                }).finally(() => { refresh = undefined; });
                return refresh;
            }

            server.middlewares.use((request, _response, next) => {
                if (request.method !== 'GET' || request.url?.split('?')[0] !== manifestRoute) {
                    next();
                    return;
                }
                void waitForManifest(refreshIfDue()).then(() => next(), next);
            });
        },
    };
}
