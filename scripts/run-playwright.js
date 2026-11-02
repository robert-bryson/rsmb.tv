#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const isWindows = process.platform === 'win32';
const extraArgs = process.argv.slice(2);
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const playwrightBin = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));

function parsePort(value) {
    if (value !== undefined && !/^\d+$/.test(value)) {
        throw new Error(`Invalid PLAYWRIGHT_PORT: ${value}`);
    }
    const port = Number(value ?? '4174');
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid PLAYWRIGHT_PORT: ${value}`);
    }
    return port;
}

const port = parsePort(process.env.PLAYWRIGHT_PORT);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        shell: isWindows,
        ...options,
    });

    if (result.error) throw result.error;
    if (result.signal) throw new Error(`${command} exited from signal ${result.signal}`);
    return result.status ?? 1;
}

export function waitForVite(vite) {
    return new Promise((resolve, reject) => {
        let output = '';
        const finish = (error) => {
            clearTimeout(timeout);
            vite.stdout.off('data', handleOutput);
            vite.off('error', handleError);
            vite.off('exit', handleExit);
            if (error) reject(error);
            else resolve();
        };
        const timeout = setTimeout(() => {
            finish(new Error('Timed out waiting for Vite to start'));
        }, 120_000);

        const handleOutput = (chunk) => {
            output = (output + stripVTControlCharacters(chunk.toString())).slice(-8192);
            // "already in use" contains "ready in". Only Vite's listening URL
            // establishes readiness; never attach tests to an existing server.
            if (/\bLocal:\s+https?:\/\/\S+/.test(output)) finish();
        };
        const handleError = (error) => finish(error);
        const handleExit = (code) => finish(new Error(`Vite exited before becoming ready with code ${code ?? 1}`));

        vite.stdout.on('data', handleOutput);
        vite.once('error', handleError);
        vite.once('exit', handleExit);
    });
}

function stopProcess(child) {
    return new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) {
            resolve();
            return;
        }

        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
        }, 5_000);

        child.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
        child.kill('SIGTERM');
    });
}

async function main() {
    const buildCode = run('npm', ['run', 'build-flights']);
    if (buildCode !== 0) {
        process.exitCode = buildCode;
        return;
    }

    const vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, VITE_CARTO_API_KEY: 'browser-test-key', CARTO_API_KEY: '' },
        shell: false,
    });
    vite.stdout.pipe(process.stdout);
    vite.stderr.pipe(process.stderr);

    try {
        await waitForVite(vite);
        const testCode = run(process.execPath, [playwrightBin, 'test', ...extraArgs], {
            env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL, PLAYWRIGHT_SKIP_WEB_SERVER: '1' },
            shell: false,
        });
        process.exitCode = testCode;
    } finally {
        await stopProcess(vite);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
