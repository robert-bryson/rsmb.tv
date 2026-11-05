import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadEnv } from 'vite';
import { parseTornadoAnnualSummary, parseTornadoTrendIndex } from '../shared/tornadoTrends.ts';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_BASE_URL = 'https://data.rsmb.tv/tornadoes';

async function readRemoteJson(url, fetchImpl, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Tornado publication request timed out.')), timeoutMs);
    try {
        const response = await fetchImpl(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new Error(`${path.basename(url.pathname)}: ${message}`, { cause });
    } finally {
        clearTimeout(timer);
    }
}

async function publicationReader(baseUrl, publicRoot, fetchImpl, timeoutMs) {
    if (baseUrl.startsWith('/') && !baseUrl.startsWith('//')) {
        if (/[?#\\]/.test(baseUrl)) throw new Error('Invalid local tornado data path.');
        const root = await fs.realpath(publicRoot);
        const directory = await fs.realpath(path.resolve(root, `.${decodeURIComponent(baseUrl)}`));
        if (directory !== root && !directory.startsWith(`${root}${path.sep}`)) throw new Error('Tornado data must be inside public/.');
        return async filename => {
            const file = await fs.realpath(path.join(directory, filename));
            if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Tornado data must be inside public/.');
            return JSON.parse(await fs.readFile(file, 'utf8'));
        };
    }
    const url = new URL(baseUrl.replace(/\/+$/, '') + '/');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('Use an HTTP(S) tornado data URL without credentials, query parameters, or a fragment.');
    }
    return filename => readRemoteJson(new URL(filename, url), fetchImpl, timeoutMs);
}

/** Fail release builds before they ship a frontend with unavailable chart data. */
export async function verifyTornadoPublication({
    baseUrl = DEFAULT_BASE_URL, publicRoot = path.join(repoRoot, 'public'), fetchImpl = fetch, timeoutMs = 30_000,
} = {}) {
    try {
        const read = await publicationReader(baseUrl, publicRoot, fetchImpl, timeoutMs);
        const annual = parseTornadoAnnualSummary(await read('annual-summary.json'));
        const index = parseTornadoTrendIndex(await read('trend-index.json'), annual);
        return { years: annual.length, groups: index.groups.length };
    } catch (cause) {
        throw new Error('Tornado publication check failed. Publish matching annual-summary.json and trend-index.json before building the frontend.', { cause });
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const { values } = parseArgs({ options: { mode: { type: 'string', default: 'production' } } });
        const env = loadEnv(values.mode, repoRoot, 'VITE_');
        await verifyTornadoPublication({ baseUrl: env.VITE_TORNADO_DATA_BASE_URL || DEFAULT_BASE_URL });
        console.log('Tornado publication verified.');
    } catch (error) {
        console.error(error.message);
        if (error.cause) console.error(error.cause.message);
        process.exitCode = 1;
    }
}
