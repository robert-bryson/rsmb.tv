import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Plugin } from 'vite';
import { skiConditionsDirectory, skiConditionsRefreshWaitMs } from '../shared/skiConditionsCache.ts';
import { drivingDirectory, drivingRefreshMs } from '../shared/skiDriving.ts';

const exec = promisify(execFile);
const retryInterval = 5 * 60_000;

async function waitForManifest(refresh: Promise<void>, waitMs: number) {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([refresh, new Promise<void>(resolve => { deadline = setTimeout(resolve, waitMs); })]);
    } finally {
        clearTimeout(deadline);
    }
}

export function skiConditionsDevPlugin(mode: string): Plugin {
    const rockies = mode === 'rockies';
    return skiFeedDevPlugin({
        name: 'conditions', enabled: mode === '1' || rockies, directory: skiConditionsDirectory(rockies),
        args: rockies ? ['--rockies-pilot'] : [], refreshInterval: 60 * 60_000, waitMs: skiConditionsRefreshWaitMs,
    });
}

export function skiDrivingDevPlugin(enabled: boolean, udotKey?: string): Plugin {
    return skiFeedDevPlugin({
        name: 'driving', enabled, directory: drivingDirectory, args: [], refreshInterval: drivingRefreshMs,
        waitMs: 17_000, env: udotKey ? { ...process.env, UDOT_API_KEY: udotKey } : process.env,
    });
}

function skiFeedDevPlugin({ name, enabled, directory, args, refreshInterval, waitMs, env }: {
    name: 'conditions' | 'driving'; enabled: boolean; directory: string; args: string[]; refreshInterval: number;
    waitMs: number; env?: NodeJS.ProcessEnv;
}): Plugin {
    return {
        name: `ski-${name}-dev`,
        apply: 'serve',
        configureServer(server) {
            if (!enabled) return;
            const manifestRoute = `/${directory}/manifest.json`;
            const manifestPath = resolve(server.config.root, manifestRoute.slice(1));
            const command = ['--import', 'tsx/esm', `projects/ski-status/scripts/sync-${name}.ts`, ...args];
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
                refresh = exec(process.execPath, command, { cwd: server.config.root, env }).then(() => undefined, error => {
                    server.config.logger.warn(`Could not refresh local ski ${name}. ${error.message}`);
                }).finally(() => { refresh = undefined; });
                return refresh;
            }

            server.middlewares.use((request, _response, next) => {
                if (request.method !== 'GET' || request.url?.split('?')[0] !== manifestRoute) {
                    next();
                    return;
                }
                void waitForManifest(refreshIfDue(), waitMs).then(() => next(), next);
            });
        },
    };
}
