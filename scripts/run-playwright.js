#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

function waitForVite(vite) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Timed out waiting for Vite to start'));
        }, 120_000);

        const handleOutput = (chunk) => {
            const text = chunk.toString();
            process.stdout.write(chunk);
            if (text.includes('Local:') || text.includes('ready in')) {
                clearTimeout(timeout);
                resolve();
            }
        };

        vite.stdout.on('data', handleOutput);
        vite.stderr.on('data', handleOutput);
        vite.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        vite.on('exit', (code) => {
            clearTimeout(timeout);
            reject(new Error(`Vite exited before becoming ready with code ${code ?? 1}`));
        });
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
        shell: isWindows,
    });

    try {
        await waitForVite(vite);
        const testCode = run(process.execPath, [playwrightBin, 'test', ...extraArgs], {
            env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL, PLAYWRIGHT_SKIP_WEB_SERVER: '1' },
        });
        process.exitCode = testCode;
    } finally {
        await stopProcess(vite);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});