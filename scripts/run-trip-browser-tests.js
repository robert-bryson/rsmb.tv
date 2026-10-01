import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build, preview } from 'vite';
const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rsmb-trip-browser-'));
let server;
try {
    await build({ mode: 'trip-test', build: { outDir } });
    server = await preview({ mode: 'trip-test', build: { outDir }, preview: { host: '127.0.0.1', port: 4175, strictPort: true } });
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.trip.config.ts', ...process.argv.slice(2)], { stdio: 'inherit' });
    process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); });
} finally {
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    await fs.rm(outDir, { recursive: true, force: true });
}
