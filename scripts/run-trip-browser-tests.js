import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import { generateJsonFeed } from './generate-json-feed.js';
import { generateRss } from './generate-rss.js';
import { generateSiteIcons } from './generate-site-icons.js';
const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rsmb-trip-browser-'));
const fixtureRoot = fileURLToPath(new URL('../tests/fixtures/trip-content/', import.meta.url));
const postsPath = path.join(fixtureRoot, 'posts.json');
// Browser tests intercept tile requests. Never use production credentials here.
process.env.VITE_CARTO_API_KEY = 'browser-test-key';
delete process.env.CARTO_API_KEY;
let server;
try {
    await build({ mode: 'trip-test', build: { outDir } });
    // Copy browser identity only; feeds come from the same fixtures as the HTML.
    await Promise.all(['site.webmanifest', 'favicon.svg', 'apple-touch-icon.png'].map(name =>
        fs.copyFile(new URL(`../public/${name}`, import.meta.url), path.join(outDir, name))));
    await generateSiteIcons({ outputDir: outDir });
    generateRss({ postsPath, outputPath: path.join(outDir, 'rss.xml'), repoRoot: fixtureRoot });
    generateJsonFeed({ postsPath, outputPath: path.join(outDir, 'feed.json') });
    server = await preview({ mode: 'trip-test', build: { outDir }, preview: { host: '127.0.0.1', port: 4175, strictPort: true } });
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.trip.config.ts', ...process.argv.slice(2)], { stdio: 'inherit' });
    process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); });
} finally {
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    await fs.rm(outDir, { recursive: true, force: true });
}
