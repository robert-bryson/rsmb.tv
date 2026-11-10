import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build, preview } from 'vite';

const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rsmb-page-recovery-'));
process.env.VITE_CARTO_API_KEY = 'browser-test-key';
process.env.VITE_INTENT_PREFETCH = 'all';
delete process.env.CARTO_API_KEY;
let server;
try {
    await build({ mode: 'trip-test', build: { outDir } });
    await fs.cp(new URL('../public/images/previews/', import.meta.url), path.join(outDir, 'images/previews'), { recursive: true });
    server = await preview({ mode: 'trip-test', build: { outDir }, preview: { host: '127.0.0.1', port: 4177, strictPort: true } });
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'tests/e2e/page-recovery.spec.ts', 'tests/e2e/intent-prefetch.spec.ts', 'tests/e2e/accessibility.spec.ts', '--workers=1', ...process.argv.slice(2)], {
        stdio: 'inherit', env: { ...process.env, PAGE_RECOVERY: '1', PLAYWRIGHT_SKIP_WEB_SERVER: '1', PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:4177' },
    });
    process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); });
} finally {
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    await fs.rm(outDir, { recursive: true, force: true });
}
